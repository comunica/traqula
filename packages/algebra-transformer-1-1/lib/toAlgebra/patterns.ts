import type {
  Expression,
  PathPure,
  Pattern,
  PatternBgp,
  PatternFilter,
  PatternGroup,
  Wildcard,
} from '@traqula/rules-sparql-1-1';
import type { Algebra } from '../index';
import type { AlgebraContext, FlattenedTriple } from './core';
import { types } from './core';
import { translateInlineData, translateTerm } from './general';
import { translatePath } from './path';
import { recurseGraph, translateBasicGraphPattern, translateQuad } from './tripleAndQuad';
import { translateQuery } from './index';

/**
 * Handles part of: 18.2.2.2 Collect FILTER Elements
 */
export function translateExpression(c: AlgebraContext, expr: Expression | Wildcard): Algebra.Expression {
  const F = c.astFactory;
  if (F.isTerm(expr)) {
    return c.factory.createTermExpression(translateTerm(c, expr));
  }

  if (F.isWildcard(expr)) {
    return c.factory.createWildcardExpression();
  }

  if (F.isExpressionAggregate(expr)) {
    return c.factory.createAggregateExpression(
      expr.aggregation,
      translateExpression(c, expr.expression[0]),
      expr.distinct,
      F.isExpressionAggregateSeparator(expr) ? expr.separator : undefined,
    );
  }

  if (F.isExpressionFunctionCall(expr)) {
    // Outdated typings
    return c.factory.createNamedExpression(
      translateTerm(c, expr.function),
      expr.args.map(subExpr => translateExpression(c, subExpr)),
    );
  }

  if (F.isExpressionOperator(expr)) {
    return c.factory.createOperatorExpression(
      expr.operator,
      expr.args.map(subExpr => translateExpression(c, subExpr)),
    );
  }

  if (F.isExpressionPatternOperation(expr)) {
    return c.factory.createExistenceExpression(
      expr.operator === 'notexists',
      translateGraphPattern(c, expr.args),
    );
  }

  throw new Error(`Unknown expression: ${JSON.stringify(expr)}`);
}

export function translateGraphPattern(c: AlgebraContext, pattern: Pattern): Algebra.Operation {
  const F = c.astFactory;
  // 18.2.2.1: Expand Syntax Forms -
  //    partly done by sparql parser, partly in this.translateTerm, and partly in BGP
  // https://www.w3.org/TR/sparql11-query/#sparqlExpandForms
  // https://www.w3.org/TR/sparql11-query/#QSynIRI
  if (F.isPatternBgp(pattern)) {
    return translateBgp(c, pattern);
  }

  // 18.2.2.6: Translate Graph Patterns - GroupOrUnionGraphPattern
  if (F.isPatternUnion(pattern)) {
    return c.factory.createUnion(
      pattern.patterns.map((group: PatternGroup) => translateGraphPattern(c, group)),
    );
  }

  // 18.2.2.6: Translate Graph Patterns - GraphGraphPattern
  if (F.isPatternGraph(pattern)) {
    // Sparql.js combines the group graph pattern and the graph itself in the same object.
    // We split here so the group graph pattern can be interpreted correctly.
    const group = F.patternGroup(pattern.patterns, pattern.loc);
    let result = translateGraphPattern(c, group);

    // Output depends on if we use quads or not
    if (c.useQuads) {
      result = recurseGraph(c, result, translateTerm(c, pattern.name));
    } else {
      result = c.factory.createGraph(result, translateTerm(c, pattern.name));
    }

    return result;
  }

  // 18.2.2.6: Translate Graph Patterns - InlineData
  if (F.isPatternValues(pattern)) {
    return translateInlineData(c, pattern);
  }

  // 18.2.2.6: Translate Graph Patterns - SubSelect
  if (F.isQuerySelect(pattern)) {
    return translateQuery(c, pattern, c.useQuads, false);
  }

  // 18.2.2.6: Translate Graph Patterns - GroupGraphPattern
  if (F.isPatternGroup(pattern)) {
    // 18.2.2.2 - Collect FILTER Elements
    const filters: PatternFilter[] = [];
    const nonfilters: Pattern[] = [];
    for (const subPattern of pattern.patterns) {
      if (F.isPatternFilter(subPattern)) {
        filters.push(subPattern);
      } else {
        nonfilters.push(subPattern);
      }
    }

    // 18.2.2.6 - GroupGraphPattern
    let result: Algebra.Operation = c.factory.createBgp([]);
    for (const pattern of nonfilters) {
      result = accumulateGroupGraphPattern(c, result, pattern);
    }

    // 18.2.2.7 - Filters of Group - translateExpression handles notExists negation.
    const expressions: Algebra.Expression[] = filters.map(filter => translateExpression(c, filter.expression));
    if (expressions.length > 0) {
      let conjunction = expressions[0];
      for (const expression of expressions.slice(1)) {
        conjunction = c.factory.createOperatorExpression('&&', [ conjunction, expression ]);
      }
      // One big filter applied on the group
      result = c.factory.createFilter(result, conjunction);
    }

    return result;
  }

  throw new Error(`Unexpected pattern: ${pattern.subType}`);
}

/**
 * 18.2.2.1: Expand Syntax Forms: Flatten TripleCollection
 * 18.2.2.3: Translate Property Path Expressions
 * 18.2.2.4: Translate Property Path Patterns
 * 18.2.2.5: Translate Basic Graph Patterns
 * TODO: In the ast, a group with a single BGP in it is a single object. (TODO: not anymore)
 */
export function translateBgp(c: AlgebraContext, bgp: PatternBgp): Algebra.Operation {
  const F = c.astFactory;
  let patterns: Algebra.Pattern[] = [];
  const joins: Algebra.Operation[] = [];
  const flattenedTriples: FlattenedTriple[] = [];
  translateBasicGraphPattern(c, bgp.triples, flattenedTriples);
  for (const triple of flattenedTriples) {
    if (F.isPathPure(triple.predicate)) {
      const smartType = <FlattenedTriple & { predicate: PathPure }> triple;
      // TranslatePath returns a mix of Quads and Paths
      const path = translatePath(c, smartType);
      for (const p of path) {
        if (p.type === types.PATH) {
          if (patterns.length > 0) {
            joins.push(c.factory.createBgp(patterns));
          }
          patterns = [];
          joins.push(p);
        } else {
          patterns.push(p);
        }
      }
    } else {
      patterns.push(translateQuad(c, triple));
    }
  }
  if (patterns.length > 0) {
    joins.push(c.factory.createBgp(patterns));
  }
  if (joins.length === 1) {
    return joins[0];
  }
  return c.factory.createJoin(joins);
}

/**
 * 18.2.2.6 Translate Graph Patterns - GroupGraphPattern
 */
export function accumulateGroupGraphPattern(
  c: AlgebraContext,
  algebraOp: Algebra.Operation,
  pattern: Pattern,
): Algebra.Operation {
  const F = c.astFactory;
  if (F.isPatternOptional(pattern)) {
    // Optional input needs to be interpreted as a group
    const groupAsAlgebra = translateGraphPattern(c, F.patternGroup(pattern.patterns, pattern.loc));
    if (groupAsAlgebra.type === types.FILTER) {
      return c.factory.createLeftJoin(algebraOp, groupAsAlgebra.input, groupAsAlgebra.expression);
    }
    return c.factory.createLeftJoin(algebraOp, groupAsAlgebra);
  }

  if (F.isPatternMinus(pattern)) {
    // Minus input needs to be interpreted as a group
    const groupAsAlgebra = translateGraphPattern(c, F.patternGroup(pattern.patterns, pattern.loc));
    return c.factory.createMinus(algebraOp, groupAsAlgebra);
  }

  if (F.isPatternBind(pattern)) {
    return c.factory.createExtend(
      algebraOp,
      translateTerm(c, pattern.variable),
      translateExpression(c, pattern.expression),
    );
  }

  if (F.isPatternService(pattern)) {
    // Transform to group so child-nodes get parsed correctly
    const group = F.patternGroup(pattern.patterns, pattern.loc);
    const A = c.factory.createService(
      translateGraphPattern(c, group),
      translateTerm(c, pattern.name),
      pattern.silent,
    );
    return simplifiedJoin(c, algebraOp, A);
  }

  const A = translateGraphPattern(c, pattern);
  return simplifiedJoin(c, algebraOp, A);
}

export function simplifiedJoin(c: AlgebraContext, G: Algebra.Operation, A: Algebra.Operation): Algebra.Operation {
  // Note: this is more simplification than requested in 18.2.2.8, but no reason not to do it.
  if (G.type === types.BGP && A.type === types.BGP) {
    G = c.factory.createBgp([ ...G.patterns, ...A.patterns ]);
  } else if (G.type === types.BGP && G.patterns.length === 0) {
    // 18.2.2.8 (simplification)
    G = A;
  } else if (A.type === types.BGP && A.patterns.length === 0) {
    // Do nothing
  } else {
    G = c.factory.createJoin([ G, A ]);
  }
  return G;
}
