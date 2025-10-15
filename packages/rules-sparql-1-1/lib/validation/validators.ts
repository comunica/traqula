import type { SelectiveTraversalContext } from '@traqula/core';
import { AstFactory } from '../astFactory.js';
import type {
  Wildcard,
  Expression,
  ExpressionAggregate,
  Pattern,
  QuerySelect,
  TermVariable,
  SolutionModifierGroupBind,
  Update,
  PatternBind,
  TripleCollection,
  Path,
  TripleNesting,
  Term,
  SparqlQuery,
  Sparql11Nodes,
} from '../Sparql11types.js';
import { AstTransformer } from '../utils.js';

const F = new AstFactory();
const transformer = new AstTransformer();

/**
 * Get all 'aggregate' rules from an expression
 */
function getAggregatesOfExpression(expression: Expression): ExpressionAggregate[] {
  if (F.isExpressionAggregate(expression)) {
    return [ expression ];
  }
  if (F.isExpressionOperator(expression)) {
    const aggregates: ExpressionAggregate[] = [];
    for (const arg of expression.args) {
      aggregates.push(...getAggregatesOfExpression(arg));
    }
    return aggregates;
  }
  return [];
}

/**
 * Return the variable value id of an expression if bounded
 */
function getExpressionId(expression: SolutionModifierGroupBind | Expression | TermVariable): string | undefined {
  // Check if grouping
  if (F.isTerm(expression) && F.isTermVariable(expression)) {
    return expression.value;
  }
  if (F.isExpression(expression)) {
    if (F.isExpressionAggregate(expression) && F.isTermVariable(expression.expression[0])) {
      return expression.expression[0].value;
    }
    return undefined;
  }
  return expression.variable.value;
}

/**
 * Get all variables used in an expression
 */
function getVariablesFromExpression(expression: Expression, variables: Set<string>): void {
  if (F.isExpressionOperator(expression)) {
    for (const expr of expression.args) {
      getVariablesFromExpression(expr, variables);
    }
  } else if (F.isTerm(expression) && F.isTermVariable(expression)) {
    variables.add(expression.value);
  }
}

export function queryIsGood(query: Pick<QuerySelect, 'variables' | 'solutionModifiers' | 'where'>): void {
  // NoGroupByOnWildcardSelect
  if (query.variables.length === 1 && F.isWildcard(query.variables[0])) {
    if (query.solutionModifiers.group !== undefined) {
      throw new Error('GROUP BY not allowed with wildcard');
    }
    return;
  }

  // CannotProjectUngroupedVars - can be skipped if `SELECT *`
  // Check for projection of ungrouped variable
  // Check can be skipped in case of wildcard select.
  const variables = <Exclude<typeof query.variables, [Wildcard]>> query.variables;
  const hasCountAggregate = variables.flatMap(
    varVal => F.isTerm(varVal) ? [] : getAggregatesOfExpression(varVal.expression),
  ).some(agg => agg.aggregation === 'count' && !agg.expression.some(arg => F.isWildcard(arg)));
  const groupBy = query.solutionModifiers.group;
  if (hasCountAggregate || groupBy) {
    // We have to check whether
    //  1. Variables used in projection are usable given the group by clause
    //  2. A selectCount will create an implicit group by clause.
    for (const selectVar of variables) {
      if (F.isTerm(selectVar)) {
        if (!groupBy || !groupBy.groupings.map(groupvar => getExpressionId(groupvar))
          .includes((getExpressionId(selectVar)))) {
          throw new Error('Variable not allowed in projection');
        }
      } else if (getAggregatesOfExpression(selectVar.expression).length === 0) {
        // Current value binding does not use aggregates
        const usedvars = new Set<string>();
        getVariablesFromExpression(selectVar.expression, usedvars);
        for (const usedvar of usedvars) {
          if (!groupBy || !groupBy.groupings.map(groupVar => getExpressionId(groupVar))
            .includes(usedvar)) {
            throw new Error(`Use of ungrouped variable in projection of operation (?${usedvar})`);
          }
        }
      }
    }
  }

  // NOTE 12: Check if id of each AS-selected column is not yet bound by subquery
  const subqueries = query.where.patterns.filter(pattern => pattern.type === 'query');
  if (subqueries.length > 0) {
    const selectBoundedVars = new Set<string>();
    for (const variable of variables) {
      if ('variable' in variable) {
        selectBoundedVars.add(variable.variable.value);
      }
    }

    // Look at in scope variables
    const vars = subqueries.flatMap<TermVariable | PatternBind | Wildcard>(sub => sub.variables)
      .map(v => F.isTerm(v) ? v.value : (F.isWildcard(v) ? '*' : v.variable.value));
    const subqueryIds = new Set(vars);
    for (const selectedVarId of selectBoundedVars) {
      if (subqueryIds.has(selectedVarId)) {
        throw new Error(`Target id of 'AS' (?${selectedVarId}) already used in subquery`);
      }
    }
  }
}

function notUndefined<T>(some: T): some is Exclude<T, undefined> {
  return some !== undefined;
}

export function findPatternBoundedVars(
  iter: SparqlQuery | Pattern | TripleNesting | TripleCollection | Path | Term | Wildcard,
  boundedVars: Set<string>,
): void {
  transformer.traverseSubNodes(iter, {
    query: op => ({ next: [
      op.solutionModifiers.group,
    ].filter(notUndefined) }),
    triple: op => ({ next: [ op.subject, op.predicate, op.object ]}),
    path: op => ({ next: op.items }),
    tripleCollection: op => ({ next: [ op.identifier, ...op.triples ]}),
  }, {
    query: {
      select: op => ({ next: [
        ...(op.variables.some(x => F.isWildcard(x)) ? [ op.where ] : op.variables),
        op.solutionModifiers.group,
        op.values,
      ].filter(notUndefined) } satisfies SelectiveTraversalContext<Sparql11Nodes>),
      describe: op => ({ next: [
        ...(op.variables.some(x => F.isWildcard(x)) ? [ op.where ] : op.variables),
        op.solutionModifiers.group,
        op.values,
      ].filter(notUndefined) }),
    },
    solutionModifier: {
      group: op => ({ next:
          op.groupings.filter(g => 'variable' in g).map(x => x.variable),
      }),
      having: op => ({ next: op.having }),
      order: op => ({ next: op.orderDefs.map(x => x.expression) }),
    },
    pattern: {
      values: (op) => {
        for (const v of Object.keys(op.values.at(0) ?? {})) {
          boundedVars.add(v);
        }
        return {};
      },
      bgp: op => ({ next: op.triples }),
      group: op => ({ next: op.patterns }),
      union: op => ({ next: op.patterns }),
      optional: op => ({ next: op.patterns }),
      service: op => ({ next: [ op.name, ...op.patterns ]}),
      bind: op => ({ next: [ op.variable ]}),
      graph: op => ({ next: [ op.name, ...op.patterns ]}),
    },
    term: {
      variable: (op) => {
        boundedVars.add(op.value);
        return {};
      },
    },
  });
}

/**
 * NOTE 13 and https://www.w3.org/TR/sparql11-query/#variableScope
 * > In BIND (expr AS v) requires that the variable v is not in-scope from the preceeding elements in the
 *    group graph pattern in which it is used.
 */
export function checkNote13(patterns: Pattern[]): void {
  for (const [ index, pattern ] of patterns.entries()) {
    if (F.isPatternBind(pattern) && index > 0 && F.isPatternBgp(patterns[index - 1])) {
      const bgp = patterns[index - 1];
      // Find variables used.
      const variables: TermVariable[] = [];
      // TODO: this is slow! 2.6% self execution
      transformer.visitNodeSpecific(bgp, {}, { term: { variable: { visitor: (var_) => {
        variables.push(var_);
      } }}});
      if (variables.some(var_ => var_.value === pattern.variable.value)) {
        throw new Error(`Variable used to bind is already bound (?${pattern.variable.value})`);
      }
    }
  }

  const boundedVars = new Set<string>();
  for (const pattern of patterns) {
    // Element can be bind, in that case, check note 13. If it is not, buildup set of bounded variables.
    if (F.isPatternBind(pattern)) {
      if (boundedVars.has(pattern.variable.value)) {
        throw new Error(`Variable used to bind is already bound (?${pattern.variable.value})`);
      }
    } else {
      findPatternBoundedVars(pattern, boundedVars);
    }
  }
}

/**
 * https://www.w3.org/TR/sparql11-query/#grammarBNodes
 * > two INSERT DATA operations within a single SPARQL Update request
 */
export function updateNoReuseBlankNodeLabels(updateQuery: Update): void {
  const blankLabelsUsedInInsertData = new Set<string>();
  for (const update of updateQuery.updates) {
    if (!update.operation) {
      continue;
    }
    const operation = update.operation;
    if (operation.subType === 'insertdata') {
      const blankNodesHere = new Set<string>();
      transformer.visitNodeSpecific(operation, {}, { term: { blankNode: { visitor: (blankNode) => {
        blankNodesHere.add(blankNode.label);
        if (blankLabelsUsedInInsertData.has(blankNode.label)) {
          throw new Error('Detected reuse blank node across different INSERT DATA clauses');
        }
      } }}});
      for (const blankNode of blankNodesHere) {
        blankLabelsUsedInInsertData.add(blankNode);
      }
    }
  }
}
