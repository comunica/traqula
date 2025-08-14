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
import type { Algebra } from '../index';
import { types } from '../toAlgebra/core';
import Util from '../util';
import type { AstContext } from './core';
import { resetContext } from './core';
import { translateExpressionOrOrdering, translatePureExpression } from './expression';
import { translatePattern, translateTerm } from './general';
import { translatePatternNew } from './pattern';

export function translateConstruct(c: AstContext, op: Algebra.Construct): PatternGroup {
  const F = c.astFactory;
  const queryConstruct = F.queryConstruct(
    F.gen(),
    [],
    F.patternBgp(<BasicGraphPattern> op.template.map(x => translatePattern(c, x)), F.gen()),
    F.patternGroup(Util.flatten([ translatePatternNew(c, op.input) ]), F.gen()),
    {},
    F.datasetClauses([], F.gen()),
  );
  registerOrderBy(c, queryConstruct);
  c.order.length = 0;
  // Subqueries need to be in a group! Top level grouping is removed at toAst function
  //  - for consistency with the other operators, we also wrap here.
  return F.patternGroup([ <Pattern> <unknown> queryConstruct ], F.gen());
}

/**
 * DEBUG NOTE: The type is slightly of but works in the general case.
 */
function replaceAggregatorVariables<T>(c: AstContext, s: T, map: Record<string, Expression>): T {
  const F = c.astFactory;
  const st: Sparql11Nodes = Util.isSimpleTerm(s) ? translateTerm(c, s) : <Sparql11Nodes> s;

  // Look for TermVariable, if we find, replace it by the aggregator.
  if (F.isTermVariable(st)) {
    if (map[st.value]) {
      // Returns the ExpressionAggregate
      return <T> map[st.value];
    }
  } else if (Array.isArray(s)) {
    s = <T> s.map(e => replaceAggregatorVariables(c, e, map));
  } else if (typeof s === 'object') {
    const obj = <Record<string, any>> s;
    for (const key of Object.keys(obj)) {
      obj[key] = replaceAggregatorVariables(c, obj[key], map);
    }
  }
  return s;
}

export function translateProject(
  c: AstContext,
  op: Algebra.Project | Algebra.Ask | Algebra.Describe,
  type: string,
): PatternGroup {
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
    variables = op.variables;
  } else if (type === types.ASK) {
    result.subType = 'ask';
  } else if (type === types.DESCRIBE) {
    result.subType = 'describe';
    variables = op.terms;
  }

  // Backup values in case of nested queries
  // everything in extend, group, etc. is irrelevant for this project call
  const extend = c.extend;
  const group = c.group;
  const aggregates = c.aggregates;
  const order = c.order;
  resetContext(c);
  c.project = true;

  // TranslateOperation could give an array.
  let input = Util.flatten([ translatePatternNew(c, op.input) ]);
  if (input.length === 1 && F.isPatternGroup(input[0])) {
    input = (input[0]).patterns;
  }
  result.where = F.patternGroup(input, F.gen());

  // Map from variable to what agg it represents
  const aggregators: Record<string, Expression> = {};
  // These can not reference each other
  for (const agg of c.aggregates) {
    aggregators[translateTerm(c, agg.variable).value] = translatePureExpression(c, agg);
  }

  // Do these in reverse order since variables in one extend might apply to an expression in another extend
  const extensions: Record<string, Expression> = {};
  for (const e of c.extend.reverse()) {
    extensions[translateTerm(c, e.variable).value] =
      replaceAggregatorVariables(c, translatePureExpression(c, e.expression), aggregators);
  }
  registerGroupBy(c, result, extensions);
  registerOrderBy(c, result);
  registerVariables(c, select, variables, extensions);
  putExtensionsInGroup(c, result, extensions);

  // Convert all filters to 'having' if it contains an aggregator variable
  // could always convert, but is nicer to keep as filter when possible
  const havings: Expression[] = [];
  result.where = filterReplace(c, result.where, aggregators, havings);
  if (havings.length > 0) {
    select.solutionModifiers.having = F.solutionModifierHaving(havings, F.gen());
  }

  // Recover state
  c.extend = extend;
  c.group = group;
  c.aggregates = aggregates;
  c.order = order;

  // Subqueries need to be in a group! Top level grouping is removed at toAst function
  return F.patternGroup([ select ], F.gen());
}

function registerGroupBy(c: AstContext, result: QueryBase, extensions: Record<string, Expression>): void {
  const F = c.astFactory;
  if (c.group.length > 0) {
    result.solutionModifiers.group = F.solutionModifierGroup(
      c.group.map((variable) => {
        const v = translateTerm(c, variable);
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
}

function registerOrderBy(c: AstContext, result: QueryBase): void {
  const F = c.astFactory;
  if (c.order.length > 0) {
    result.solutionModifiers.order = F.solutionModifierOrder(
      c.order
        .map(x => translateExpressionOrOrdering(c, x))
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
}

function registerVariables(
  c: AstContext,
  select: QuerySelect,
  variables: RDF.Variable[] | undefined,
  extensions: Record<string, Expression>,
): void {
  const F = c.astFactory;
  if (variables) {
    select.variables = variables.map((term): TermVariable | PatternBind => {
      const v = translateTerm(c, term);
      if (extensions[v.value]) {
        const result: Expression = extensions[v.value];
        // Remove used extensions so only unused ones remain
        delete extensions[v.value];
        return F.patternBind(result, v, F.gen());
      }
      return v;
    });
    // If the * didn't match any variables this would be empty
    if (select.variables.length === 0) {
      select.variables = [ F.wildcard(F.gen()) ];
    }
  }
}

/**
 * It is possible that at this point some extensions have not yet been resolved.
 * These would be bind operations that are not used in a GROUP BY or SELECT body.
 * We still need to add them though, as they could be relevant to the other extensions.
 */
function putExtensionsInGroup(c: AstContext, result: QueryBase, extensions: Record<string, Expression>): void {
  const F = c.astFactory;
  const extensionEntries = Object.entries(extensions);
  if (extensionEntries.length > 0) {
    result.where = result.where ?? F.patternGroup([], F.gen());
    for (const [ key, value ] of extensionEntries) {
      result.where.patterns.push(
        F.patternBind(
          value,
          F.variable(key, F.gen()),
          F.gen(),
        ),
      );
    }
  }
}

function filterReplace(
  c: AstContext, group: PatternGroup, aggregators: Record<string, Expression>, havings: Expression[]):
PatternGroup;
function filterReplace(
  c: AstContext, group: PatternGroup | Pattern, aggregators: Record<string, Expression>, havings: Expression[]):
PatternGroup | Pattern;
function filterReplace(
  c: AstContext,
  group: PatternGroup | Pattern,
  aggregators: Record<string, Expression>,
  havings: Expression[],
):
PatternGroup | Pattern {
  const F = c.astFactory;
  if (!F.isPatternGroup(group)) {
    return group;
  }
  const patterns = group.patterns
    .map(x => filterReplace(c, x, aggregators, havings))
    .flatMap((pattern) => {
      if (F.isPatternFilter(pattern) && objectContainsVariable(c, pattern, Object.keys(aggregators))) {
        havings.push(replaceAggregatorVariables(c, pattern.expression, aggregators));
        return [];
      }
      return [ pattern ];
    });
  return F.patternGroup(patterns, F.gen());
}

function objectContainsVariable(c: AstContext, o: any, vals: string[]): boolean {
  const F = c.astFactory;
  const casted = <Sparql11Nodes> o;
  if (F.isTermVariable(casted)) {
    return vals.includes(casted.value);
  }
  if (Array.isArray(o)) {
    return o.some(e => objectContainsVariable(c, e, vals));
  }
  if (o === Object(o)) {
    return Object.keys(o).some(key => objectContainsVariable(c, o[key], vals));
  }
  return false;
}
