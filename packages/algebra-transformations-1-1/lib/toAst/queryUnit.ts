import type * as RDF from '@rdfjs/types';
import type {
  BasicGraphPattern,
  Expression,
  Ordering,
  Pattern,
  PatternBind,
  PatternGroup,
  QueryBase,
  QuerySelect,
  SolutionModifierGroupBind,
  Sparql11Nodes,
  TermVariable,
} from '@traqula/rules-sparql-1-1';
import type { Algebra } from '../index.js';
import { types } from '../toAlgebra/index.js';
import { inScopeVariables } from '../util.js';
import type { AstIndir } from './core.js';
import { resetContext } from './core.js';
import { translateAlgExpressionOrOrdering, translateAlgPureExpression } from './expression.js';
import type { RdfTermToAst } from './general.js';
import { translateAlgPattern, translateAlgTerm } from './general.js';
import { translateAlgPatternNew } from './pattern.js';

export const translateAlgConstruct: AstIndir<'translateConstruct', PatternGroup, [Algebra.Construct]> = {
  name: 'translateConstruct',
  fun: ({ SUBRULE }) => ({ astFactory: F, order }, op) => {
    const queryConstruct = F.queryConstruct(
      F.gen(),
      [],
      F.patternBgp(<BasicGraphPattern> op.template.map(x => SUBRULE(translateAlgPattern, x)), F.gen()),
      F.patternGroup([ SUBRULE(translateAlgPatternNew, op.input) ].flat(), F.gen()),
      {},
      F.datasetClauses([], F.gen()),
    );
    SUBRULE(registerOrderBy, queryConstruct);
    order.length = 0;
    // Subqueries need to be in a group! Top level grouping is removed at toAst function
    //  - for consistency with the other operators, we also wrap here.
    return F.patternGroup([ <Pattern> <unknown> queryConstruct ], F.gen());
  },
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
 * The variables a query form mentions outside its input, such as the terms of a DESCRIBE.
 */
function getFormVariables(op: Algebra.Operation): Set<string> {
  const names = new Set<string>();
  const collect = (value: unknown): void => {
    if ((<RDF.Term> value)?.termType === 'Variable') {
      names.add((<RDF.Variable> value).value);
    } else if (typeof value === 'object' && value !== null) {
      for (const child of Object.values(value)) {
        collect(child);
      }
    }
  };
  for (const [ key, value ] of Object.entries(op)) {
    if (key !== 'input') {
      collect(value);
    }
  }
  return names;
}

export const translateAlgProject:
AstIndir<'translateProject', PatternGroup, [Algebra.Project | Algebra.Ask | Algebra.Describe, string]> = {
  name: 'translateProject',
  fun: ({ SUBRULE }) => (c, op, type) => {
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
    // Without a SELECT clause, only the group variables of a group are visible to the query form.
    //  Extends above the group, and aggregates the query form reads, are thus evaluated in a SELECT subquery.
    if (type !== types.PROJECT && (c.group.length > 0 || c.aggregates.length > 0)) {
      const formVariables = getFormVariables(op);
      if (Object.keys(extensions).some(name => !c.group.some(variable => variable.value === name)) ||
        Object.keys(aggregators).some(name => formVariables.has(name))) {
        // Recover state and translate again, with the input wrapped in a projection of all it binds
        Object.assign(c, { extend, group, aggregates, having, order });
        const projection = inScopeVariables(op.input)
          .filter(variable => !aggregators[variable.value] || formVariables.has(variable.value));
        const subquery = c.algebraFactory.createProject(op.input, projection);
        return SUBRULE(translateAlgProject, { ...op, input: subquery }, type);
      }
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
    SUBRULE(registerVariables, select, variables, extensions);
    SUBRULE(putExtensionsInGroup, result, extensions);

    // Filters on top of the group are HAVING conditions, they can reference the aggregators
    if (c.having.length > 0) {
      select.solutionModifiers.having = F.solutionModifierHaving(
        c.having.map(expr => <typeof expr> SUBRULE(replaceAlgAggregatorVariables, expr, aggregators)),
        F.gen(),
      );
    }

    // Recover state
    c.extend = extend;
    c.group = group;
    c.aggregates = aggregates;
    c.having = having;
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

export const registerVariables:
AstIndir<'registerVariables', void, [QuerySelect, RDF.Variable[] | undefined, Record<string, Expression>]> = {
  name: 'registerVariables',
  fun: ({ SUBRULE }) => ({ astFactory: F, extend }, select, variables, unplacedExpressions) => {
    if (variables) {
      // Extends whose expression GROUP BY did not place yet, from outermost to innermost.
      const unplacedExtends = extend.filter(extend => unplacedExpressions[extend.variable.value]);
      const isProjected = (variable: RDF.Variable): boolean => variables.some(term => term.value === variable.value);

      // SELECT expressions are evaluated after the WHERE clause, so an extend can only become a SELECT expression
      //  when all extends around it do too. From the first unprojected extend inward, extends stay BINDs.
      const firstUnprojected = unplacedExtends.findIndex(extend => !isProjected(extend.variable));
      const selectedExtends = firstUnprojected < 0 ? unplacedExtends : unplacedExtends.slice(0, firstUnprojected);
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
      // A subquery is only allowed as the entire content of a group.
      //  Giving it siblings thus requires it to get a group of its own.
      if (result.where.patterns.length === 1 && F.isQuery(result.where.patterns[0])) {
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
