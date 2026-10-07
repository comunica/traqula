// TODO(major): consider defining the validation functions with the IndirBuilder pattern,
//  so they call each other by name and SPARQL 1.2 can patch only the functions that differ
//  (findPatternBoundedVars, getVariablesFromExpression and queryProjectionIsGood).
//  The SPARQL 1.2 selectExpressionAliasesNotInScope and checkNote13 copy the SPARQL 1.1 implementation logic,
//  only to call the SPARQL 1.2 findPatternBoundedVars.
import { AstFactory } from '../astFactory.js';
import type {
  Wildcard,
  Expression,
  ExpressionAggregate,
  Pattern,
  PatternBgp,
  QuerySelect,
  TermVariable,
  SolutionModifierGroupBind,
  Update,
  PatternBind,
  Sparql11Nodes,
} from '../Sparql11types.js';
import { AstTransformer } from '../utils.js';

const F = new AstFactory();
const transformer = new AstTransformer();

/**
 * Get all 'aggregate' rules from an expression
 */
export function getAggregatesOfExpression(expression: Expression): ExpressionAggregate[] {
  if (F.isExpressionAggregate(expression)) {
    return [ expression ];
  }
  if (F.isExpressionOperator(expression) || F.isExpressionFunctionCall(expression)) {
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
export function getExpressionId(expression: SolutionModifierGroupBind | Expression | TermVariable): string | undefined {
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
export function getVariablesFromExpression(expression: Expression, variables: Set<string>): void {
  if (F.isExpressionOperator(expression)) {
    for (const expr of expression.args) {
      getVariablesFromExpression(expr, variables);
    }
  } else if (F.isTerm(expression) && F.isTermVariable(expression)) {
    variables.add(expression.value);
  }
}

/**
 * Verify that the projected variables (select head) are allowed:
 * - no group-by on select *
 * - if group-by, selected variables need to be collected by the group-by
 * - 'select ?var as ?other', ?other cannot be in scope
 */
export function queryProjectionIsGood(query: Pick<QuerySelect, 'variables' | 'solutionModifiers' | 'where'>): void {
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
  const groupBy = query.solutionModifiers.group;
  if (groupBy !== undefined || hasBuiltInAggregate(query)) {
    // We have to check whether
    //  1. Variables used in projection are usable given the group by clause
    //  2. An aggregate will create an implicit group by clause.
    for (const selectVar of variables) {
      if (F.isTerm(selectVar)) {
        if (!groupBy || !groupBy.groupings.map(groupvar => getExpressionId(groupvar))
          .includes((getExpressionId(selectVar)))) {
          throw new Error('Variable not allowed in projection');
        }
      } else {
        // Only collects the variables outside of aggregates and function calls (possibly custom aggregates)
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

  selectExpressionAliasesNotInScope(query);
}

/**
 * Grammar note 11 of https://www.w3.org/TR/sparql12-query/#sparqlGrammar (note 12 in SPARQL 1.1)
 * > Variables introduced by AS in a SELECT clause must not already be in-scope.
 * See also https://www.w3.org/TR/sparql12-query/#variableScope
 * > The variable v must not be in-scope at the point of the (expr AS v) form.
 * In-scope are the variables bound by the WHERE clause (including subquery projections), or, in a grouped query,
 * the GROUP BY keys (v and (expr AS v)), and the trailing VALUES clause (joined before the projection, 18.2.4.3).
 * The variable may also not be used in an earlier SELECT expression.
 */
export function selectExpressionAliasesNotInScope(
  query: Pick<QuerySelect, 'variables' | 'solutionModifiers' | 'where' | 'values'>,
): void {
  const selectBinds = query.variables.filter((variable): variable is PatternBind =>
    !F.isTerm(variable) && !F.isWildcard(variable));
  if (selectBinds.length > 0) {
    const inScopeVars = new Set<string>();
    // Grouping only keeps the variables of the group keys in scope
    if (!isGroupedQuery(query)) {
      findPatternBoundedVars(query.where, inScopeVars);
    }
    for (const grouping of query.solutionModifiers.group?.groupings ?? []) {
      if ('variable' in grouping) {
        inScopeVars.add(grouping.variable.value);
      } else if (F.isTermVariable(grouping)) {
        inScopeVars.add(grouping.value);
      }
    }
    for (const { variable } of selectBinds) {
      if (inScopeVars.has(variable.value)) {
        throw new Error(`Target id of 'AS' (?${variable.value}) is already in scope`);
      }
    }
  }
  selectExpressionAliasesNotUsedEarlier(query);
  selectExpressionAliasesNotInValues(query);
}

/**
 * A query is grouped when it has a GROUP BY clause or uses aggregates (18.2.4.1).
 * Since custom aggregates are syntactically function calls, this returns true for any query that may be grouped,
 * see {@link mayContainAggregate}.
 */
export function isGroupedQuery(query: Pick<QuerySelect, 'variables' | 'solutionModifiers'>): boolean {
  if (query.solutionModifiers.group) {
    return true;
  }
  return getAggregationScopeExpressions(query).some(expression => mayContainAggregate(expression));
}

/**
 * Whether the query uses a built-in aggregate, which makes it grouped, even without GROUP BY (18.2.4.1).
 * Unlike {@link isGroupedQuery}, function calls are not assumed to be custom aggregates,
 * so queries using custom functions without GROUP BY are not treated as grouped.
 */
export function hasBuiltInAggregate(query: Pick<QuerySelect, 'variables' | 'solutionModifiers'>): boolean {
  return getAggregationScopeExpressions(query).some(expression => getAggregatesOfExpression(expression).length > 0);
}

/**
 * The expressions of the SELECT, HAVING, and ORDER BY clauses, which are those that can contain aggregates.
 */
function getAggregationScopeExpressions(query: Pick<QuerySelect, 'variables' | 'solutionModifiers'>): Expression[] {
  const { having, order } = query.solutionModifiers;
  return [
    ...query.variables.flatMap(variable => 'expression' in variable ? [ variable.expression ] : []),
    ...having?.having ?? [],
    ...order?.orderDefs.map(ordering => ordering.expression) ?? [],
  ];
}

/**
 * Whether an expression may contain an aggregate, also when nested in a function call.
 * Custom aggregates are syntactically function calls:
 * > Aggregate functions can be one of the built-in keywords for aggregates or a custom aggregate,
 * > which is syntactically a function call.
 * The parser cannot know whether a function is an aggregate, so it leniently assumes any function call might be.
 */
function mayContainAggregate(expression: Expression): boolean {
  if (F.isExpressionAggregate(expression) || F.isExpressionFunctionCall(expression)) {
    return true;
  }
  if (F.isExpressionOperator(expression)) {
    return expression.args.some(arg => mayContainAggregate(arg));
  }
  return false;
}

/**
 * https://www.w3.org/TR/sparql12-query/#variableScope
 * > In SELECT, the variable v must not be in-scope in the graph pattern of the SELECT clause,
 * > nor used in another select expression earlier in the clause.
 */
export function selectExpressionAliasesNotUsedEarlier(
  query: { variables: readonly (TermVariable | Wildcard | { variable: TermVariable; expression: object })[] },
): void {
  const usedVars = new Set<string>();
  for (const variable of query.variables) {
    if ('expression' in variable) {
      if (usedVars.has(variable.variable.value)) {
        throw new Error(`Target id of 'AS' (?${variable.variable.value}) is used in an earlier select expression`);
      }
      transformer.visitNodeSpecific(<Expression> variable.expression, {}, { term: { variable: { visitor: (var_) => {
        usedVars.add(var_.value);
      } }}});
    }
  }
}

/**
 * The trailing VALUES clause is joined before the SELECT expressions are evaluated (18.2.4.3),
 * so its variables are in scope for those expressions (grammar note 11).
 */
export function selectExpressionAliasesNotInValues(
  query: {
    variables: readonly (TermVariable | Wildcard | { variable: TermVariable })[];
    values?: { variables: TermVariable[] };
  },
): void {
  const valuesVars = new Set(query.values?.variables.map(variable => variable.value));
  for (const variable of query.variables) {
    if ('variable' in variable && valuesVars.has(variable.variable.value)) {
      throw new Error(`Target id of 'AS' (?${variable.variable.value}) is already in scope`);
    }
  }
}

export function findPatternBoundedVars(
  op: Sparql11Nodes | undefined | (Sparql11Nodes | undefined)[],
  boundedVars: Set<string>,
): void {
  function recurse(x: Parameters<(typeof findPatternBoundedVars)>[0]): void {
    findPatternBoundedVars(x, boundedVars);
  }
  if (op === undefined) {
    return;
  }
  if (Array.isArray(op)) {
    for (const iter of op) {
      recurse(iter);
    }
  } else if (F.isQuery(op)) {
    if (F.isQuerySelect(op) || F.isQueryDescribe(op)) {
      // A projection only exposes the projected variables (18.2.1), wildcards expose everything.
      recurse(op.variables.some(x => F.isWildcard(x)) ?
          [ op.where, op.solutionModifiers.group, op.values ] :
        op.variables);
    } else {
      recurse(op.solutionModifiers.group);
    }
  } else if (F.isTriple(op)) {
    recurse([ op.subject, op.predicate, op.object ]);
  } else if (F.isPathPure(op)) {
    recurse(op.items);
  } else if (F.isTripleCollection(op)) {
    recurse([ op.identifier, ...op.triples ]);
  } else if (F.isSolutionModifierGroup(op)) {
    recurse(op.groupings.filter(g => 'variable' in g).map(x => x.variable));
  } else if (F.isSolutionModifierHaving(op)) {
    recurse(op.having);
  } else if (F.isSolutionModifierOrder(op)) {
    recurse(op.orderDefs.map(x => x.expression));
  } else if (F.isPatternValues(op)) {
    for (const v of op.variables) {
      boundedVars.add(v.value);
    }
  } else if (F.isPatternBgp(op)) {
    recurse(op.triples);
  } else if (F.isPatternGroup(op) || F.isPatternUnion(op) || F.isPatternOptional(op)) {
    recurse(op.patterns);
  } else if (F.isPatternService(op) || F.isPatternGraph(op)) {
    recurse([ op.name, ...op.patterns ]);
  } else if (F.isPatternBind(op)) {
    recurse(op.variable);
  } else if (F.isTermVariable(op)) {
    boundedVars.add(op.value);
  }
}

/**
 * Grammar note 12 of https://www.w3.org/TR/sparql12-query/#sparqlGrammar (note 13 in SPARQL 1.1)
 * > The variable assigned in a BIND clause must not already be in-use within the immediately preceding TriplesBlock
 *   within a GroupGraphPattern.
 * See also https://www.w3.org/TR/sparql12-query/#variableScope
 * > In BIND (expr AS v) requires that the variable v is not in-scope from the preceeding elements in the
 *    group graph pattern in which it is used.
 */
export function checkNote13(patterns: Pattern[]): void {
  // Only a BIND can violate this note, so there is no need to collect the bounded variables without one.
  if (!patterns.some(pattern => F.isPatternBind(pattern))) {
    return;
  }
  // The variables of the immediately preceding TriplesBlock are also collected by findPatternBoundedVars.
  const boundedVars = new Set<string>();
  for (const pattern of patterns) {
    // A bind may not bind a variable in scope, after which its own variable is in scope too.
    if (F.isPatternBind(pattern) && boundedVars.has(pattern.variable.value)) {
      throw new Error(`Variable used to bind is already bound (?${pattern.variable.value})`);
    }
    findPatternBoundedVars(pattern, boundedVars);
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

/**
 * https://www.w3.org/TR/sparql11-query/#bgpBNodeLabels
 * > A label can be used in only a single basic graph pattern in any query.
 */
export function checkBlankNodeBGPScope(patterns: Pattern[]): void {
  const labelOwner = new Map<string, object>();

  // Each entry is a unique object used only as an identity marker for "the current scope"
  const scopeStack: object[] = [{}];
  const currentScope = (): object => scopeStack.at(-1)!;

  function collectBlankNodeLabels(bgp: PatternBgp): Set<string> {
    const labels = new Set<string>();
    transformer.visitNodeSpecific(bgp, {}, { term: { blankNode: { visitor: (blankNode) => {
      labels.add(blankNode.label);
    } }}});
    return labels;
  }

  // Introduces a new blank node scope on entry.
  // Pops the introduced scope and resets the parent scope on exit.
  const newBlankNodeScopeHandler = {
    preVisitor: () => {
      scopeStack.push({});
      return {};
    },
    visitor: () => {
      scopeStack.pop();
      // Within a list of patterns, seeing this pattern breaks the scope of the list of patterns.
      // BIND and FILTER do not break the scope since when transforming to algebra, they are collected separately:
      // https://www.w3.org/TR/sparql12-query/#sparqlCollectFilters
      scopeStack[scopeStack.length - 1] = {};
    },
  };

  transformer.visitNodeSpecific(
    patterns,
    {
      query: {
        preVisitor: () => ({ continue: false }),
      },
      pattern: newBlankNodeScopeHandler,
    },
    {
      pattern: {
        bgp: {
          preVisitor: (bgp) => {
            const scope = currentScope();
            for (const label of collectBlankNodeLabels(bgp)) {
              const owner = labelOwner.get(label);
              if (owner !== undefined && owner !== scope) {
                throw new Error(
                  `Detected reuse of blank node across two different basic graph patterns (_:${
                    label.replace(/^[eg]_/u, '')})`,
                );
              }
              labelOwner.set(label, scope);
            }
            return { continue: false };
          },
          visitor: () => {},
        },
        // FILTER (not) EXISTS introduces a new scope.
        // Unlike newBlankScopeHandler, we only pop on exit, we don't reset the parent scope;
        // labels can still be reused after a FILTER or (not) EXISTS.
        filter: {
          preVisitor: () => {
            scopeStack.push({});
            return {};
          },
          visitor: () => {
            scopeStack.pop();
          },
        },
      },
    },
  );
}
