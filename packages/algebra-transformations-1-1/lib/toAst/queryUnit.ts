import type * as RDF from '@rdfjs/types';
import type { PreOrderMappingReturn } from '@traqula/core';
import type {
  BasicGraphPattern,
  Expression,
  Ordering,
  Pattern,
  PatternBind,
  PatternGroup,
  QueryBase,
  QueryConstruct,
  QuerySelect,
  SolutionModifierGroupBind,
  Sparql11Nodes,
  TermVariable,
} from '@traqula/rules-sparql-1-1';
import type { Algebra } from '../index.js';
import { isVariable, types } from '../toAlgebra/index.js';
import { algebraTransformer, inScopeVariables, visitObject } from '../util.js';
import type { AstIndir } from './core.js';
import { findAlgGroupBelow, resetContext } from './core.js';
import { translateAlgExpressionOrOrdering, translateAlgPureExpression } from './expression.js';
import type { RdfTermToAst } from './general.js';
import { translateAlgPattern, translateAlgTerm } from './general.js';
import { translateAlgPatternNew } from './pattern.js';

/**
 * Only steps into the operations a callback asks to continue into.
 */
const chainTransformer = algebraTransformer({ continue: false });

/**
 * Only delegates to {@link translateAlgProject}, like the other query forms.
 * Kept as its own rule so overrides of `translateConstruct` keep being called.
 */
// TODO(major): remove, dispatch CONSTRUCT to translateAlgProject directly
export const translateAlgConstruct: AstIndir<'translateConstruct', PatternGroup, [Algebra.Construct]> = {
  name: 'translateConstruct',
  fun: ({ SUBRULE }) => (_, op) => SUBRULE(translateAlgProject, op, types.CONSTRUCT),
};

// Separate terms from wildcard since we handle them differently
function isSimpleTerm(term: any): term is RDF.Term {
  return term.termType !== undefined && term.termType !== 'Quad' && term.termType !== 'wildcard' &&
    term.termType !== 'Wildcard';
}

/**
 * Will mostly return the same type as what you give in second arg.
 */
export const replaceAlgAggregatorVariables:
AstIndir<'replaceAggregatorVariables', unknown, [unknown, Record<string, Expression>]> = {
  name: 'replaceAggregatorVariables',
  fun: ({ SUBRULE }) => ({ astFactory: F }, s, map) => {
    const st: Sparql11Nodes = isSimpleTerm(s) ? SUBRULE(translateAlgTerm, s) : <Sparql11Nodes> s;

    // Look for TermVariable, if we find, replace it by the aggregator.
    if (F.isTermVariable(st)) {
      if (map[st.value]) {
        // Returns the ExpressionAggregate
        return map[st.value];
      }
    } else if (Array.isArray(s)) {
      s = s.map(e => SUBRULE(replaceAlgAggregatorVariables, e, map));
    } else if (typeof s === 'object') {
      const obj = <Record<string, any>> s;
      for (const key of Object.keys(obj)) {
        obj[key] = SUBRULE(replaceAlgAggregatorVariables, obj[key], map);
      }
    }
    return s;
  },
};

/**
 * Collects the names of all variables in the given value, not descending into the given keys of the value itself.
 */
export const collectAlgVariables:
AstIndir<'collectVariables', Set<string>, [object, Set<string>, string[]?]> = {
  name: 'collectVariables',
  fun: () => (_, value, names, ignoreKeysList = []) => {
    const ignoreKeys = new Set(ignoreKeysList);
    visitObject(
      value,
      (object) => {
        const term = <RDF.Term> object;
        if (isVariable(term)) {
          names.add(term.value);
        }
      },
      object => (object === value ? { ignoreKeys } : {}),
    );
    return names;
  },
};

/**
 * The query forms {@link translateAlgProject} translates.
 */
export type AlgQueryForm = Algebra.Project | Algebra.Ask | Algebra.Describe | Algebra.Construct;

/**
 * Where the input of a query form is cut into a SELECT subquery by {@link wrapAlgInSubquery}.
 */
export interface AlgSubqueryCut {
  /**
   * The outermost operation of the input that moves into the subquery.
   */
  start: Algebra.Operation;
  /**
   * The variables the aggregates of the group are bound to.
   */
  aggregateVariables: Set<string>;
}

/**
 * SELECT expressions are evaluated after the WHERE clause, so an extend can only become a SELECT expression
 * when all extends around it do too. From the first unprojected extend inward, extends are BINDs.
 * @return how many of the given extends, outermost first, can become SELECT expressions.
 */
function countSelectableExtends(
  outermostFirst: Algebra.Extend[],
  isProjected: (variable: RDF.Variable) => boolean,
): number {
  const firstUnprojected = outermostFirst.findIndex(extend => !isProjected(extend.variable));
  return firstUnprojected < 0 ? outermostFirst.length : firstUnprojected;
}

/**
 * Determines whether the query form needs the extends and group of its input to be evaluated in a SELECT subquery.
 * Above a group, extends that are not SELECT expressions would be BINDs, evaluated before the grouping.
 * Without a SELECT clause, a query form can moreover only read the group variables of a group.
 * The group is found by {@link findAlgGroupBelow}, below the chain of extends and orderings of the input.
 * @return the cut, or undefined when no subquery is needed.
 */
export const findAlgSubqueryCut: AstIndir<'findSubqueryCut', AlgSubqueryCut | undefined, [AlgQueryForm]> = {
  name: 'findSubqueryCut',
  fun: ({ SUBRULE }) => (_, op) => {
    // The extends on top of the input, outermost first
    const chainExtends: Algebra.Extend[] = [];
    let input = op.input;
    while (input.type === types.EXTEND || input.type === types.ORDER_BY) {
      if (input.type === types.EXTEND) {
        chainExtends.push(input);
      }
      input = input.input;
    }
    const group = SUBRULE(findAlgGroupBelow, input, 'values');
    if (group) {
      const aggregateVariables = new Set(group.aggregates.map(aggregate => aggregate.variable.value));
      // Without a SELECT clause, no extend can become a SELECT expression
      const projected = new Set(op.type === types.PROJECT ? op.variables.map(variable => variable.value) : []);
      const selectable = countSelectableExtends(chainExtends, variable => projected.has(variable.value));
      if (selectable < chainExtends.length) {
        return { start: chainExtends[selectable], aggregateVariables };
      }
      if (op.type !== types.PROJECT) {
        // Without a SELECT clause, the aggregate variables are only visible from a subquery
        const formVariables = SUBRULE(collectAlgVariables, op, new Set(), [ 'input' ]);
        const readsAggregate = [ ...aggregateVariables ].some(variable => formVariables.has(variable));
        return readsAggregate ? { start: input, aggregateVariables } : undefined;
      }
    }
  },
};

/**
 * Moves the input of a query form, from the cut's `start` inward,
 * into a SELECT subquery projecting everything it binds.
 * Orderings in that part stay outside, since a subquery does not keep its order.
 * Aggregate variables are only projected when the outer query references them.
 */
export const wrapAlgInSubquery: AstIndir<'wrapInSubquery', AlgQueryForm, [AlgQueryForm, AlgSubqueryCut]> = {
  name: 'wrapInSubquery',
  fun: ({ SUBRULE }) => ({ algebraFactory: AF }, op, { start, aggregateVariables }) => {
    const outerVariables = new Set<string>();
    function wrap(input: Algebra.Operation): Algebra.Operation {
      // Lift the orderings out of the part that moves into the subquery
      const orderings: Algebra.OrderBy[] = [];
      const subqueryInput = chainTransformer.transformNodePreOrder<'unsafe', Algebra.Operation>(input, {
        [types.EXTEND]: extend => ({ newValue: extend, continue: true }),
        [types.ORDER_BY]: (ordering) => {
          orderings.push(ordering);
          SUBRULE(collectAlgVariables, ordering.expressions, outerVariables);
          return { newValue: ordering.input, continue: true, reTransform: true };
        },
      });
      const projection = inScopeVariables(subqueryInput)
        .filter(variable => !aggregateVariables.has(variable.value) || outerVariables.has(variable.value));
      return orderings.reduceRight<Algebra.Operation>(
        (result, ordering) => ({ ...ordering, input: result }),
        AF.createProject(subqueryInput, projection),
      );
    }
    // Walk down from the query form to the start of the subquery, through the orderings and extends that stay outside
    const step = (operation: AlgQueryForm | Algebra.Extend | Algebra.OrderBy): PreOrderMappingReturn => {
      SUBRULE(collectAlgVariables, operation, outerVariables, [ 'input' ]);
      if (operation.input === start) {
        return { newValue: { ...operation, input: wrap(operation.input) }};
      }
      return { newValue: operation, continue: true };
    };
    return chainTransformer.transformNodePreOrder<'unsafe', typeof op>(op, {
      [types.PROJECT]: step,
      [types.ASK]: step,
      [types.DESCRIBE]: step,
      [types.CONSTRUCT]: step,
      [types.EXTEND]: step,
      [types.ORDER_BY]: step,
    });
  },
};

export const translateAlgProject:
AstIndir<
  'translateProject',
PatternGroup,
[AlgQueryForm, string]
> = {
  name: 'translateProject',
  fun: ({ SUBRULE }) => (c, op, type) => {
    const cut = SUBRULE(findAlgSubqueryCut, op);
    if (cut) {
      op = SUBRULE(wrapAlgInSubquery, op, cut);
    }
    const F = c.astFactory;
    const result: QueryBase = <any> {
      type: 'query',
      solutionModifiers: {},
      loc: F.gen(),
      datasets: F.datasetClauses([], F.gen()),
      context: [],
    } satisfies Partial<QueryBase>;

    // Makes typing easier in some places
    const select = <QuerySelect> result;
    let variables: RDF.Variable[] | undefined;

    if (type === types.PROJECT) {
      result.subType = 'select';
      variables = (<Algebra.Project>op).variables;
    } else if (type === types.ASK) {
      result.subType = 'ask';
    } else if (type === types.CONSTRUCT) {
      result.subType = 'construct';
      (<QueryConstruct> result).template = F.patternBgp(
        <BasicGraphPattern> (<Algebra.Construct>op).template.map(x => SUBRULE(translateAlgPattern, x)),
        F.gen(),
      );
    } else {
      result.subType = 'describe';
      variables = <RDF.Variable[]>(<Algebra.Describe>op).terms;
    }

    // Backup values in case of nested queries
    // everything in extend, group, etc. is irrelevant for this project call
    const extend = c.extend;
    const group = c.group;
    const aggregates = c.aggregates;
    const having = c.having;
    const values = c.values;
    const order = c.order;
    SUBRULE(resetContext);
    c.project = true;

    // TranslateOperation could give an array.
    let input = [ SUBRULE(translateAlgPatternNew, op.input) ].flat();
    if (input.length === 1 && F.isPatternGroup(input[0])) {
      input = (input[0]).patterns;
    }
    result.where = F.patternGroup(input, F.gen());

    // Map from variable to what agg it represents
    const aggregators: Record<string, Expression> = Object.create(null);
    // These can not reference each other
    for (const agg of c.aggregates) {
      aggregators[(<RdfTermToAst<typeof agg.variable>>SUBRULE(translateAlgTerm, agg.variable)).value] =
        SUBRULE(translateAlgPureExpression, agg);
    }

    // Do these in reverse order since variables in one extend might apply to an expression in another extend
    const extensions: Record<string, Expression> = Object.create(null);
    for (const e of [ ...c.extend ].reverse()) {
      const expr = SUBRULE(translateAlgPureExpression, e.expression);
      extensions[(<RdfTermToAst<typeof e.variable>>SUBRULE(translateAlgTerm, e.variable)).value] =
        <typeof expr>SUBRULE(replaceAlgAggregatorVariables, expr, aggregators);
    }
    // SPARQL can only select an aggregate as `(aggregate AS ?variable)`,
    //  so a SELECT of an aggregate's variable needs the aggregate as its projection expression.
    // SELECT expressions are bound before ORDER BY, so ORDER BY can keep referencing selected aggregates by variable.
    const unselectedAggregators: Record<string, Expression> = Object.assign(Object.create(null), aggregators);
    if (type === types.PROJECT) {
      for (const variable of (<Algebra.Project>op).variables) {
        if (aggregators[variable.value]) {
          extensions[variable.value] = aggregators[variable.value];
          delete unselectedAggregators[variable.value];
        }
      }
    }
    SUBRULE(registerAlgGroupBy, result, extensions);
    SUBRULE(registerOrderBy, result, unselectedAggregators);
    // DESCRIBE can only list terms, not `(expr AS ?variable)`, so its extends stay BINDs in the WHERE clause.
    SUBRULE(registerVariables, select, variables, type === types.DESCRIBE ? Object.create(null) : extensions);
    SUBRULE(putExtensionsInGroup, result, extensions);

    // Filters on top of the group are HAVING conditions, they can reference the aggregators
    if (c.having.length > 0) {
      select.solutionModifiers.having = F.solutionModifierHaving(
        c.having.map(expr => <typeof expr> SUBRULE(replaceAlgAggregatorVariables, expr, aggregators)),
        F.gen(),
      );
    }
    SUBRULE(registerValues, result);

    // Recover state
    c.extend = extend;
    c.group = group;
    c.aggregates = aggregates;
    c.having = having;
    c.values = values;
    c.order = order;

    // Subqueries need to be in a group! Top level grouping is removed at toAst function
    return F.patternGroup([ select ], F.gen());
  },
};

export const registerAlgGroupBy: AstIndir<'registerGroupBy', void, [QueryBase, Record<string, Expression>]> = {
  name: 'registerGroupBy',
  fun: ({ SUBRULE }) => ({ astFactory: F, group }, result, extensions) => {
    if (group.length > 0) {
      result.solutionModifiers.group = F.solutionModifierGroup(
        group.map((variable) => {
          const v = <RdfTermToAst<typeof variable>>SUBRULE(translateAlgTerm, variable);
          if (extensions[v.value]) {
            const result = extensions[v.value];
            // Make sure there is only 1 'AS' statement
            delete extensions[v.value];
            return {
              variable: v,
              value: result,
              loc: F.gen(),
            } satisfies SolutionModifierGroupBind;
          }
          return v;
        }),
        F.gen(),
      );
    }
  },
};

/**
 * Aggregators used in an ordering are bound to a variable by the group operation.
 * Such variables are replaced by the aggregator they represent.
 */
export const registerOrderBy:
AstIndir<'registerOrderBy', void, [QueryBase, Record<string, Expression>?]> = {
  name: 'registerOrderBy',
  fun: ({ SUBRULE }) => ({ astFactory: F, order }, result, aggregators = Object.create(null)) => {
    if (order.length > 0) {
      result.solutionModifiers.order = F.solutionModifierOrder(
        order
          .map(x => SUBRULE(translateAlgExpressionOrOrdering, x))
          .map(x => <typeof x>SUBRULE(replaceAlgAggregatorVariables, x, aggregators))
          .map((o: Ordering | Expression) =>
            F.isExpression(o) ?
                ({
                  expression: o,
                  descending: false,
                  loc: F.gen(),
                } satisfies Ordering) :
              o),
        F.gen(),
      );
    }
  },
};

/**
 * The query's trailing VALUES clause is registered by translateAlgJoin, it is consumed here.
 */
export const registerValues: AstIndir<'registerValues', void, [QueryBase]> = {
  name: 'registerValues',
  fun: () => (c, result) => {
    if (c.values) {
      result.values = c.values;
      c.values = undefined;
    }
  },
};

export const registerVariables:
AstIndir<'registerVariables', void, [QuerySelect, RDF.Variable[] | undefined, Record<string, Expression>]> = {
  name: 'registerVariables',
  fun: ({ SUBRULE }) => ({ astFactory: F, extend }, select, variables, unplacedExpressions) => {
    if (variables) {
      // Extends whose expression GROUP BY did not place yet, from outermost to innermost.
      const unplacedExtends = extend.filter(extend => unplacedExpressions[extend.variable.value]);
      const isProjected = (variable: RDF.Variable): boolean => variables.some(term => term.value === variable.value);

      const selectedExtends = unplacedExtends.slice(0, countSelectableExtends(unplacedExtends, isProjected));
      const extendsKeptAsBind = new Set(
        unplacedExtends.slice(selectedExtends.length).map(extend => extend.variable.value),
      );

      // SELECT expressions are evaluated left to right, so an extend must come after the extends it wraps.
      //  The projection is a set, so the selected extends can fill their positions innermost first.
      const selectedVariables = new Set(selectedExtends.map(extend => extend.variable.value));
      const innermostFirst = selectedExtends.map(extend => extend.variable).reverse();
      const orderedVariables: RDF.Variable[] = [];
      for (const variable of variables) {
        if (selectedVariables.has(variable.value)) {
          orderedVariables.push(innermostFirst.shift()!);
        } else {
          orderedVariables.push(variable);
        }
      }

      select.variables = orderedVariables.map((term): TermVariable | PatternBind => {
        const v = <RdfTermToAst<typeof term>>SUBRULE(translateAlgTerm, term);
        // Selected extends and projected aggregates become SELECT expressions
        if (unplacedExpressions[v.value] && !extendsKeptAsBind.has(v.value)) {
          const result: Expression = unplacedExpressions[v.value];
          // Remove placed expressions so only unplaced ones remain
          delete unplacedExpressions[v.value];
          return F.patternBind(result, v, F.gen());
        }
        return v;
      });
      // If the * didn't match any variables this would be empty
      if (select.variables.length === 0) {
        select.variables = [ F.wildcard(F.gen()) ];
      }
    }
  },
};

/**
 * It is possible that at this point some extensions have not yet been resolved.
 * These would be bind operations that are not used in a GROUP BY or SELECT body.
 * We still need to add them though, as they could be relevant to the other extensions.
 */
export const putExtensionsInGroup: AstIndir<'putExtensionsInGroup', void, [QueryBase, Record<string, Expression>]> = {
  name: 'putExtensionsInGroup',
  fun: () => ({ astFactory: F }, result, extensions) => {
    const extensionEntries = Object.entries(extensions);
    if (extensionEntries.length > 0) {
      result.where = result.where ?? F.patternGroup([], F.gen());
      // A subquery is only allowed as the entire content of a group, and a FILTER constrains its entire group.
      //  Giving them siblings thus requires them to get a group of their own.
      const patterns = result.where.patterns;
      if ((patterns.length === 1 && F.isQuery(patterns[0])) || patterns.some(pattern => F.isPatternFilter(pattern))) {
        result.where = F.patternGroup([ F.patternGroup(result.where.patterns, F.gen()) ], F.gen());
      }
      for (const [ key, value ] of extensionEntries) {
        result.where.patterns.push(
          F.patternBind(
            value,
            F.termVariable(key, F.gen()),
            F.gen(),
          ),
        );
      }
    }
  },
};

/**
 * If second arg is a Group, we will return a group.
 * @deprecated No longer used: HAVING conditions are now collected by `translateAlgFilter`
 * in `AstContext.having` and emitted by {@link translateAlgProject}.
 */
// TODO(major): remove
export const filterReplace: AstIndir<
  'filterReplace',
PatternGroup | Pattern,
[PatternGroup | Pattern, Record<string, Expression>, Expression[]]
> = {
  name: 'filterReplace',
  fun: ({ SUBRULE }) => ({ astFactory: F }, group, aggregators, havings) => {
    if (!F.isPatternGroup(group)) {
      return group;
    }
    const patterns = group.patterns
      .map(x => SUBRULE(filterReplace, x, aggregators, havings))
      .flatMap((pattern) => {
        if (F.isPatternFilter(pattern) && SUBRULE(objectContainsVariable, pattern, Object.keys(aggregators))) {
          havings.push(
            <typeof pattern.expression>SUBRULE(replaceAlgAggregatorVariables, pattern.expression, aggregators),
          );
          return [];
        }
        return [ pattern ];
      });
    return F.patternGroup(patterns, F.gen());
  },
};

/**
 * @deprecated No longer used, only served {@link filterReplace}.
 */
// TODO(major): remove
export const objectContainsVariable: AstIndir<'objectContainsVariable', boolean, [any, string[]]> = {
  name: 'objectContainsVariable',
  fun: ({ SUBRULE }) => ({ astFactory: F }, o, vals) => {
    const casted = <Sparql11Nodes> o;
    if (F.isTermVariable(casted)) {
      return vals.includes(casted.value);
    }
    if (Array.isArray(o)) {
      return o.some(e => SUBRULE(objectContainsVariable, e, vals));
    }
    if (o === Object(o)) {
      return Object.keys(o).some(key => SUBRULE(objectContainsVariable, o[key], vals));
    }
    return false;
  },
};
