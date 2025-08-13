import type * as RDF from '@rdfjs/types';
import type {
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
import type { Algebra } from '../index';
import { types } from '../toAlgebra/core';
import Util from '../util';
import { replaceAggregatorVariables } from './aggregate';
import type { AstContext } from './core';
import { resetContext } from './core';
import { translatePattern, translateTerm } from './general';
import { translateExpression, translateOperation } from './pattern';

export function translateConstruct(c: AstContext, op: Algebra.Construct): QueryConstruct {
  const F = c.astFactory;
  const queryConstruct = F.queryConstruct(
    F.gen(),
    [],
    F.patternBgp(op.template.map(x => translatePattern(c, x)), F.gen()),
    F.patternGroup(Util.flatten([
      translateOperation(c, op.input),
    ]), F.gen()),
    {},
    F.datasetClauses([], F.gen()),
  );
  if (c.order.length > 0) {
    queryConstruct.solutionModifiers.order = F.solutionModifierOrder(
      c.order.map(x => translateOperation(c, x)).map((o: Ordering | Expression) =>
        F.isExpression(o) ?
            ({
              expression: o,
              descending: false,
              loc: F.gen(),
            } satisfies Ordering) :
          o),
      F.gen(),
    );
    c.order.length = 0;
  }
  return queryConstruct;
}

export function translateDistinct(c: AstContext, op: Algebra.Distinct): PatternGroup {
  const result = translateOperation(c, op.input);
  // Project is nested in group object
  result.patterns[0].distinct = true;
  return result;
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
  const select: QuerySelect = <any> result;
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

  let input = Util.flatten<any>([ translateOperation(c, op.input) ]);
  if (input.length === 1 && F.isPatternGroup(input[0])) {
    input = (<PatternGroup> input[0]).patterns;
  }
  result.where = F.patternGroup(input, F.gen());

  // Map from variable to what agg it represents
  const aggregators: Record<string, Expression> = {};
  // These can not reference each other
  for (const agg of c.aggregates) {
    aggregators[translateTerm(c, agg.variable).value] = translateExpression(c, agg);
  }

  // Do these in reverse order since variables in one extend might apply to an expression in an other extend
  const extensions: Record<string, Expression> = {};
  for (const e of c.extend.reverse()) {
    extensions[translateTerm(c, e.variable).value] =
      replaceAggregatorVariables(c, translateExpression(c, e.expression), aggregators);
  }
  if (c.group.length > 0) {
    select.solutionModifiers.group = F.solutionModifierGroup(
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

  if (c.order.length > 0) {
    select.solutionModifiers.order = F.solutionModifierOrder(
      c.order.map(x => translateOperation(c, x)).map((o: Ordering | Expression) =>
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

  // This needs to happen after the group because it might depend on variables generated there
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

  // It is possible that at this point some extensions have not yet been resolved.
  // These would be bind operations that are not used in a GROUP BY or SELECT body.
  // We still need to add them though, as they could be relevant to the other extensions.
  const extensionEntries = Object.entries(extensions);
  if (extensionEntries.length > 0) {
    select.where = select.where ?? F.patternGroup([], F.gen());
    for (const [ key, value ] of extensionEntries) {
      select.where.patterns.push(
        F.patternBind(
          value,
          F.variable(key, F.gen()),
          F.gen(),
        ),
      );
    }
  }

  // Convert all filters to 'having' if it contains an aggregator variable
  // could always convert, but is nicer to use filter when possible
  const havings: Expression[] = [];
  result.where = filterReplace(c, result.where, aggregators, havings);
  if (havings.length > 0) {
    select.solutionModifiers.having = F.solutionModifierHaving(havings, F.gen());
  }

  c.extend = extend;
  c.group = group;
  c.aggregates = aggregates;
  c.order = order;

  // Subqueries need to be in a group, this will be removed again later for the root query
  return F.patternGroup([ select ], F.gen());
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
