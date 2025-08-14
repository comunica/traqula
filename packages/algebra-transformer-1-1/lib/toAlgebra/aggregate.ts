import type * as RDF from '@rdfjs/types';
import type {
  Expression,
  ExpressionAggregate,
  Ordering,
  PatternBind,
  Query,
  TermIri,
  TermVariable,
  Wildcard,
} from '@traqula/rules-sparql-1-1';
import equal from 'fast-deep-equal/es6';
import type { Algebra } from '../index';
import type { AlgebraContext, FlattenedTriple } from './core';
import {
  generateFreshVar,
  inScopeVariables,
  translateDatasetClause,
  translateInlineData,
  translateTerm,
} from './general';
import { translateExpression } from './patterns';
import { translateBasicGraphPattern, translateQuad } from './tripleAndQuad';

/**
 * 18.2.4
 */
export function translateAggregates(c: AlgebraContext, query: Query, res: Algebra.Operation): Algebra.Operation {
  const F = c.astFactory;
  const bindPatterns: PatternBind[] = [];

  const varAggrMap: Record<string, ExpressionAggregate> = {};
  const variables = F.isQuerySelect(query) || F.isQueryDescribe(query) ?
    query.variables.map(x => mapAggregate(c, x, varAggrMap)) :
    undefined;
  const having = query.solutionModifiers.having ?
    query.solutionModifiers.having.having.map(x => mapAggregate(c, x, varAggrMap)) :
    undefined;
  const order = query.solutionModifiers.order ?
    query.solutionModifiers.order.orderDefs.map(x => mapAggregate(c, x, varAggrMap)) :
    undefined;

  // Step: GROUP BY - If we found an aggregate, in group by or implicitly, do Group function.
  // 18.2.4.1 Grouping and Aggregation
  if (query.solutionModifiers.group ?? Object.keys(varAggrMap).length > 0) {
    const aggregates = Object.keys(varAggrMap).map(var_ =>
      translateBoundAggregate(c, varAggrMap[var_], c.dataFactory.variable(var_)));
    const vars: RDF.Variable[] = [];
    if (query.solutionModifiers.group) {
      for (const expression of query.solutionModifiers.group.groupings) {
        // https://www.w3.org/TR/sparql11-query/#rGroupCondition
        if (F.isTerm(expression)) {
          // This will always be a var, otherwise sparql would be invalid
          vars.push(translateTerm(c, <TermVariable> expression));
        } else {
          let var_: RDF.Variable;
          let expr: Expression;
          if ('variable' in expression) {
            var_ = translateTerm(c, expression.variable);
            expr = expression.value;
          } else {
            var_ = generateFreshVar(c);
            expr = expression;
          }
          res = c.factory.createExtend(res, var_, translateExpression(c, expr));
          vars.push(var_);
        }
      }
    }
    res = c.factory.createGroup(res, vars, aggregates);
  }

  // 18.2.4.2
  if (having) {
    for (const filter of having) {
      res = c.factory.createFilter(res, translateExpression(c, filter));
    }
  }

  // 18.2.4.3
  if (query.values) {
    res = c.factory.createJoin([ res, translateInlineData(c, query.values) ]);
  }

  // 18.2.4.4
  let PatternValues: (RDF.Variable | RDF.NamedNode)[] = [];

  if (variables) {
    // Sort variables for consistent output
    if (variables.some(wild => F.isWildcard(wild))) {
      PatternValues = [ ...inScopeVariables(query).values() ].map(x => c.dataFactory.variable(x))
        .sort((left, right) => left.value.localeCompare(right.value));
    } else {
      // Wildcard has been filtered out above
      for (const var_ of <(TermVariable | TermIri | PatternBind)[]> variables) {
        // Can have non-variables with DESCRIBE
        if (F.isTerm(var_)) {
          PatternValues.push(translateTerm(c, var_));
        } else {
          // ... AS ?x
          PatternValues.push(translateTerm(c, var_.variable));
          bindPatterns.push(var_);
        }
      }
    }
  }

  // TODO: Jena simplifies by having a list of extends
  for (const bind of bindPatterns) {
    res = c.factory.createExtend(
      res,
      translateTerm(c, bind.variable),
      translateExpression(c, bind.expression),
    );
  }

  // 18.2.5
  // not using toList and toMultiset

  // 18.2.5.1
  if (order) {
    res = c.factory.createOrderBy(res, order.map((expr) => {
      let result = translateExpression(c, expr.expression);
      if (expr.descending) {
        result = c.factory.createOperatorExpression('desc', [ result ]);
      }
      return result;
    }));
  }

  // 18.2.5.2
  // construct does not need a project (select, ask and describe do)
  if (F.isQuerySelect(query)) {
    // Named nodes are only possible in a DESCRIBE so this cast is safe
    res = c.factory.createProject(res, <RDF.Variable[]> PatternValues);
  }

  // 18.2.5.3
  if ((<{ distinct?: unknown }>query).distinct) {
    res = c.factory.createDistinct(res);
  }

  // 18.2.5.4
  if ((<{ reduced?: unknown }>query).reduced) {
    res = c.factory.createReduced(res);
  }

  if (F.isQueryConstruct(query)) {
    const triples: FlattenedTriple[] = [];
    translateBasicGraphPattern(c, query.template.triples, triples);
    res = c.factory.createConstruct(res, triples.map(quad => translateQuad(c, quad)));
  } else if (F.isQueryAsk(query)) {
    res = c.factory.createAsk(res);
  } else if (F.isQueryDescribe(query)) {
    res = c.factory.createDescribe(res, PatternValues);
  }

  // Slicing needs to happen after construct/describe
  // 18.2.5.5
  const limitOffset = query.solutionModifiers.limitOffset;
  if (limitOffset?.limit ?? limitOffset?.offset) {
    res = c.factory.createSlice(res, limitOffset.offset ?? 0, limitOffset.limit);
  }

  if (query.datasets.clauses.length > 0) {
    const clauses = translateDatasetClause(c, query.datasets);
    res = c.factory.createFrom(res, clauses.default, clauses.named);
  }

  return res;
}

type MapAggregateType = Wildcard | Expression | Ordering | PatternBind;

/**
 * Rewrites some of the input sparql object to make use of aggregate variables
 * It thus replaces aggregates by their representative variable and registers the mapping.
 *
 * DEBUG NOTE: The type is tricky since it does replace aggregates by variables, but it works for the most part
 */
export function mapAggregate<T extends MapAggregateType>(
  c: AlgebraContext,
  thingy: T,
  aggregates: Record<string, ExpressionAggregate>,
): T {
  const F = c.astFactory;

  if (F.isExpressionAggregate(thingy)) {
    // Needed to take away the difference in the various `loc` descriptions
    const canonicalAggregate = F.forcedAutoGenTree<ExpressionAggregate>(thingy);
    let val: TermVariable | undefined;
    // Look for the matching aggregate
    for (const [ key, aggregate ] of Object.entries(aggregates)) {
      if (equal(aggregate, canonicalAggregate)) {
        val = F.variable(key, F.sourceLocation());
        break;
      }
    }
    if (val !== undefined) {
      return <T> val;
    }
    const freshVar = generateFreshVar(c);
    aggregates[freshVar.value] = canonicalAggregate;
    return <T> F.variable(freshVar.value, F.sourceLocation());
  }

  if (F.isExpressionPure(thingy) && !F.isExpressionPatternOperation(thingy)) {
    return { ...thingy, args: thingy.args.map(x => mapAggregate(c, x, aggregates)) };
  }
  // Non-aggregate expression
  if ('expression' in thingy && thingy.expression) {
    return { ...thingy, expression: mapAggregate(c, thingy.expression, aggregates) };
  }
  return thingy;
}

export function translateBoundAggregate(
  c: AlgebraContext,
  thingy: ExpressionAggregate,
  variable: RDF.Variable,
): Algebra.BoundAggregate {
  const A = <Algebra.AggregateExpression> translateExpression(c, thingy);
  return { ...A, variable };
}
