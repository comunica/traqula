// TODO(major): consider defining the validation functions with the IndirBuilder pattern,
//  so they call each other by name and SPARQL 1.2 can patch only the functions that differ
//  (findPatternBoundedVars).
//  The SPARQL 1.2 queryProjectionIsGood, selectExpressionAliasesNotInScope and checkNote13
//  only exist (and partially copy the SPARQL 1.1 logic) to call the SPARQL 1.2 findPatternBoundedVars.
import { AstFactory } from '../astFactory.js';
import type { SparqlContext } from '../sparql11HelperTypes.js';
import type {
  Wildcard,
  Expression,
  ExpressionAggregate,
  ExpressionFunctionCall,
  Pattern,
  PatternBgp,
  QueryDescribe,
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
 * Walks expressions, skipping the keys that hold no expressions or variables:
 * the source locations, the datatype IRI of a literal, and the IRI of a function call.
 */
const expressionTransformer = new AstTransformer({ ignoreKeys: new Set([ 'loc', 'langOrIri', 'function' ]) });

const stopVisit = { preVisitor: () => ({ continue: false }) };
/**
 * Stops visiting an expression that starts a new query level: the pattern of an EXISTS or NOT EXISTS,
 * whose aggregates and variables do not belong to the expression.
 */
const skipPatternOperation = { patternOperation: stopVisit };

/**
 * Get all built-in aggregates of an expression, also when nested in operators or function calls.
 * Does not look inside aggregates, nor in EXISTS or NOT EXISTS patterns.
 */
export function getAggregatesOfExpression(expression: Expression): ExpressionAggregate[] {
  return <ExpressionAggregate[]> findAggregates(expression, false);
}

/**
 * Get the built-in aggregates of an expression, and, if `functionCalls` is set, its function calls,
 * which may be custom aggregates.
 * Does not look inside them, nor in EXISTS or NOT EXISTS patterns.
 */
function findAggregates(
  expression: Expression,
  functionCalls: boolean,
): (ExpressionAggregate | ExpressionFunctionCall)[] {
  const found: (ExpressionAggregate | ExpressionFunctionCall)[] = [];
  const onFound = { preVisitor: (node: ExpressionAggregate | ExpressionFunctionCall) => {
    found.push(node);
    return { continue: false };
  } };
  expressionTransformer.visitNodeSpecific(expression, {}, { expression: {
    ...skipPatternOperation,
    aggregate: onFound,
    ...functionCalls ? { functionCall: onFound } : {},
  }});
  return found;
}

// TODO(major): remove getExpressionId, which the validation no longer uses.
/**
 * Return the variable value id of an expression if bounded
 * @deprecated Use {@link getGroupKeyVariables} for the variables that group keys keep in scope.
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
 * The variables a GROUP BY clause keeps in scope (18.2.4.1): its variable keys and the variables of its
 * (expr AS ?var) keys. Other keys, like expressions or (SPARQL 1.2) triple terms, keep no variable in scope.
 */
export function getGroupKeyVariables(
  group: { groupings: readonly (object | Pick<SolutionModifierGroupBind, 'variable'>)[] } | undefined,
): TermVariable[] {
  return group?.groupings.flatMap((grouping) => {
    if ('variable' in grouping) {
      return [ grouping.variable ];
    }
    return F.isTermVariable(grouping) ? [ <TermVariable> grouping ] : [];
  }) ?? [];
}

/**
 * The variables in scope after grouping: the variables of the group keys (see {@link getGroupKeyVariables}),
 * and those of the trailing VALUES clause, which is joined after grouping (18.2.4.3).
 */
export function getGroupedVariables(query: {
  solutionModifiers: { group?: Parameters<typeof getGroupKeyVariables>[0] };
  values?: { variables: readonly TermVariable[] };
}): TermVariable[] {
  return [ ...getGroupKeyVariables(query.solutionModifiers.group), ...query.values?.variables ?? [] ];
}

/**
 * Get all variables used in an expression, including those within (SPARQL 1.2) triple terms.
 * Does not look inside aggregates and function calls (possibly custom aggregates),
 * nor in EXISTS or NOT EXISTS patterns.
 */
export function getVariablesFromExpression(expression: Expression, variables: Set<string>): void {
  expressionTransformer.visitNodeSpecific(expression, {}, {
    expression: {
      ...skipPatternOperation,
      aggregate: stopVisit,
      functionCall: stopVisit,
    },
    term: { variable: { visitor: (variable) => {
      variables.add(variable.value);
    } }},
  });
}

/**
 * Options of {@link queryProjectionIsGood}, the equally named fields of the parse context.
 */
export type ProjectionValidationOptions = Pick<SparqlContext, 'rejectGroupedSelectAliasReuse'>;

/**
 * Verify that the projected variables (select head) respect the grouping of the query:
 * - no select * in a grouped query (GROUP BY, or a built-in aggregate in HAVING or ORDER BY).
 *   With `assumeCustomAggregates`, a function call, which may be a custom aggregate, also groups the query,
 *   see {@link isGroupedQuery}.
 * - if grouped, selected variables need to be collected by the group-by,
 *   or bound by the trailing VALUES clause, which is joined after grouping (18.2.4.3).
 *   Section 11.4 only mentions the group-by variables, but the algebra of 18.2.4.3 binds the VALUES variables
 *   before the projection, as do the tests of https://github.com/w3c/rdf-tests/pull/383.
 * - if grouped, select expressions may use variables bound by preceding (expr AS ?var) expressions,
 *   as https://www.w3.org/TR/sparql12-query/#aggregateRestrictions allows
 *   (https://github.com/w3c/sparql-query/pull/380).
 *   Ungrouped queries always allow them (https://www.w3.org/TR/sparql11-query/#selectExpressions),
 *   but the SPARQL 1.1 text for grouped queries (https://www.w3.org/TR/sparql11-query/#aggregateRestrictions)
 *   does not, so {@link ProjectionValidationOptions.rejectGroupedSelectAliasReuse} rejects them.
 */
export function queryProjectionRespectsGrouping(
  query: Pick<QuerySelect, 'variables' | 'solutionModifiers' | 'values'>,
  options: ProjectionValidationOptions = {},
  assumeCustomAggregates = false,
): void {
  // NoGroupByOnWildcardSelect
  if (query.variables.length === 1 && F.isWildcard(query.variables[0])) {
    if (query.solutionModifiers.group !== undefined) {
      throw new Error('GROUP BY not allowed with wildcard');
    }
    if (isGroupedQuery(query, assumeCustomAggregates)) {
      throw new Error('Aggregates not allowed with wildcard');
    }
    return;
  }

  // CannotProjectUngroupedVars - can be skipped if `SELECT *`
  // Check for projection of ungrouped variable
  // Check can be skipped in case of wildcard select.
  const variables = <Exclude<typeof query.variables, [Wildcard]>> query.variables;
  if (isGroupedQuery(query, assumeCustomAggregates)) {
    // We have to check whether
    //  1. Variables used in projection are usable given the group by clause
    //  2. An aggregate will create an implicit group by clause.
    // Variables bound by preceding (expr AS ?var) expressions are in scope for later expressions.
    const asBoundVars = new Set<string>();
    const groupedVars = new Set(getGroupedVariables(query).map(variable => variable.value));
    for (const selectVar of variables) {
      if (F.isTerm(selectVar)) {
        if (!groupedVars.has(selectVar.value)) {
          throw new Error('Variable not allowed in projection');
        }
      } else {
        const usedvars = new Set<string>();
        getVariablesFromExpression(selectVar.expression, usedvars);
        for (const usedvar of usedvars) {
          if (asBoundVars.has(usedvar)) {
            if (options.rejectGroupedSelectAliasReuse) {
              throw new Error(`Use of variable bound by an earlier select expression (?${usedvar}) in a grouped query`);
            }
          } else if (!groupedVars.has(usedvar)) {
            throw new Error(`Use of ungrouped variable in projection of operation (?${usedvar})`);
          }
        }
        asBoundVars.add(selectVar.variable.value);
      }
    }
  }
}

/**
 * Verify that the projected variables (select head) are allowed:
 * - they respect the grouping of the query, see {@link queryProjectionRespectsGrouping}
 * - 'select ?var as ?other', ?other cannot be in scope, see {@link selectExpressionAliasesNotInScope}
 * - when only a function call could group the query, they are valid when it is a custom aggregate,
 *   or when no function call is, see {@link projectionValidForSomeCustomAggregateReading}
 */
export function queryProjectionIsGood(
  query: Pick<QuerySelect, 'variables' | 'solutionModifiers' | 'where' | 'values'>,
  options: ProjectionValidationOptions = {},
): void {
  queryProjectionRespectsGrouping(query, options);
  selectExpressionAliasesNotInScope(query);
  projectionValidForSomeCustomAggregateReading(
    query,
    options,
    assumeCustomAggregates => selectExpressionAliasesNotInScope(query, assumeCustomAggregates),
  );
}

/**
 * {@link queryProjectionRespectsGrouping} only checks the grouping when the query is grouped without custom aggregates,
 * while {@link selectExpressionAliasesNotInScope} leniently assumes a function call might be a custom aggregate.
 * When a function call is all that would group the query, the query must be valid under one of those readings:
 * - the function calls are not aggregates, so the variables of the WHERE clause are in scope of the aliases, or
 * - one of them is a custom aggregate, so the projection must respect the (implicit) grouping.
 * For example, `SELECT (ex:f(?s) AS ?x) (?s AS ?o) WHERE { ?s ?p ?o }` is invalid in both,
 * since ?o is already in scope, and ?s is not grouped.
 * The checks that already ran cover the remaining combinations:
 * the grouping is only checked when the readings agree,
 * and an alias in scope when grouped is also in scope when not.
 * The alias check is given as a callback, since SPARQL 1.2 collects the in-scope variables differently.
 */
export function projectionValidForSomeCustomAggregateReading(
  query: Pick<QuerySelect, 'variables' | 'solutionModifiers' | 'values'>,
  options: ProjectionValidationOptions,
  aliasesNotInScope: (assumeCustomAggregates: boolean) => void,
): void {
  if (isGroupedQuery(query, false) || !isGroupedQuery(query)) {
    return;
  }
  try {
    aliasesNotInScope(false);
  } catch (error: unknown) {
    try {
      queryProjectionRespectsGrouping(query, options, true);
    } catch {
      throw error;
    }
  }
}

/**
 * Verify that the variables of a grouped DESCRIBE query are grouped,
 * as for the projection of {@link queryProjectionRespectsGrouping}.
 * DESCRIBE * is not checked, since toAlgebra expands it to the variables in scope,
 * which are the grouped ones in a grouped query (see {@link getGroupedVariables}).
 */
export function describeProjectionIsGood(query: QueryDescribe): void {
  queryProjectionRespectsGrouping({
    variables: query.variables.filter((variable): variable is TermVariable => F.isTermVariable(variable)),
    solutionModifiers: query.solutionModifiers,
    values: query.values,
  });
}

/**
 * Grammar note 11 of https://www.w3.org/TR/sparql12-query/#sparqlGrammar (note 12 in SPARQL 1.1)
 * > Variables introduced by AS in a SELECT clause must not already be in-scope.
 * See also https://www.w3.org/TR/sparql12-query/#variableScope
 * > The variable v must not be in-scope at the point of the (expr AS v) form.
 * In-scope are the variables bound by the WHERE clause (including subquery projections), or, in a grouped query,
 * the GROUP BY keys (v and (expr AS v)), and the trailing VALUES clause (joined before the projection, 18.2.4.3).
 * The variable may also not be used in an earlier SELECT expression.
 * By default, a function call is assumed to possibly be a custom aggregate that groups the query,
 * see {@link isGroupedQuery}.
 */
export function selectExpressionAliasesNotInScope(
  query: Pick<QuerySelect, 'variables' | 'solutionModifiers' | 'where' | 'values'>,
  assumeCustomAggregates = true,
): void {
  const selectBinds = query.variables.filter((variable): variable is PatternBind =>
    !F.isTerm(variable) && !F.isWildcard(variable));
  if (selectBinds.length > 0) {
    const inScopeVars = new Set<string>();
    // Grouping only keeps the variables of the group keys in scope
    if (!isGroupedQuery(query, assumeCustomAggregates)) {
      findPatternBoundedVars(query.where, inScopeVars);
    }
    for (const variable of getGroupKeyVariables(query.solutionModifiers.group)) {
      inScopeVars.add(variable.value);
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
 * Custom aggregates are syntactically function calls:
 * > Aggregate functions can be one of the built-in keywords for aggregates or a custom aggregate,
 * > which is syntactically a function call.
 * The parser cannot know whether a function is an aggregate, so by default it leniently assumes any function call
 * might be, and this returns true for any query that may be grouped.
 * Without `assumeCustomAggregates`, only a GROUP BY clause or a built-in aggregate group the query,
 * as they do in the algebra.
 */
export function isGroupedQuery(
  query: Pick<QuerySelect, 'variables' | 'solutionModifiers'>,
  assumeCustomAggregates = true,
): boolean {
  if (query.solutionModifiers.group) {
    return true;
  }
  return getAggregationScopeExpressions(query)
    .some(expression => findAggregates(expression, assumeCustomAggregates).length > 0);
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
