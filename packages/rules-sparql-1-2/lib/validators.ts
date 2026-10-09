// TODO(major): consider defining the validation functions with the IndirBuilder pattern,
//  so they call each other by name and SPARQL 1.2 can patch only the functions that differ
//  (findPatternBoundedVars).
//  The SPARQL 1.2 queryProjectionIsGood, selectExpressionAliasesNotInScope and checkNote13
//  only exist (and partially copy the SPARQL 1.1 logic) to call the SPARQL 1.2 findPatternBoundedVars.
import {
  getVariablesFromExpression as getVariablesFromExpression11,
  isGroupedQuery,
  queryProjectionRespectsGrouping,
  selectExpressionAliasesNotInValues,
  selectExpressionAliasesNotUsedEarlier,
} from '@traqula/rules-sparql-1-1';
import type * as T11 from '@traqula/rules-sparql-1-1';
import { AstFactory } from './AstFactory.js';
import type {
  Expression,
  Path,
  Pattern,
  PatternBind,
  PatternValues,
  QuerySelect,
  SparqlQuery,
  Term,
  TermLiteral,
  TripleCollection,
  TripleNesting,
  Wildcard,
} from './sparql12Types.js';

const F = new AstFactory();

function isLangDir(dir: string): dir is 'ltr' | 'rtl' {
  return dir === 'ltr' || dir === 'rtl';
}

export function langTagHasCorrectRange(literal: TermLiteral): void {
  if (F.isTermLiteralLangStr(literal)) {
    const dirSplit = literal.langOrIri.split('--');
    if (dirSplit.length > 1) {
      const [ _, direction ] = dirSplit;
      if (!isLangDir(direction)) {
        throw new Error(`language direction "${direction}" of literal "${JSON.stringify(literal)}" is not is required range 'ltr' | 'rtl'.`);
      }
    }
  }
}

/**
 * Get all variables used in an expression, including those within triple terms,
 * see {@link T11.getVariablesFromExpression}.
 */
export function getVariablesFromExpression(expression: Expression | Term, variables: Set<string>): void {
  getVariablesFromExpression11(<T11.Expression> expression, variables);
}

export function findPatternBoundedVars(
  iter: SparqlQuery | Pattern | TripleNesting | TripleCollection | Path | Term | Wildcard,
  boundedVars: Set<string>,
): void {
  if (F.isQuery(iter) || F.isUpdate(iter)) {
    if (F.isQuerySelect(iter) || F.isQueryDescribe(iter)) {
      // A projection only exposes the projected variables (18.2.1), wildcards expose everything.
      if (!iter.variables.some(x => F.isWildcard(x))) {
        for (const v of iter.variables) {
          findPatternBoundedVars(v, boundedVars);
        }
        return;
      }
      if (iter.where) {
        findPatternBoundedVars(iter.where, boundedVars);
      }
      if (iter.solutionModifiers.group) {
        const grouping = iter.solutionModifiers.group;
        for (const g of grouping.groupings) {
          if ('variable' in g) {
            findPatternBoundedVars(g.variable, boundedVars);
          }
        }
      }
      if (iter.values) {
        findPatternBoundedVars(iter.values, boundedVars);
      }
    }
  } else if (F.isTerm(iter)) {
    if (F.isTermVariable(iter)) {
      boundedVars.add(iter.value);
    }
    if (F.isTermTriple(iter)) {
      findPatternBoundedVars(iter.subject, boundedVars);
      findPatternBoundedVars(iter.predicate, boundedVars);
      findPatternBoundedVars(iter.object, boundedVars);
    }
  } else if (F.isTriple(iter)) {
    findPatternBoundedVars(iter.subject, boundedVars);
    findPatternBoundedVars(iter.predicate, boundedVars);
    findPatternBoundedVars(iter.object, boundedVars);
    for (const annotation of iter.annotations ?? []) {
      findPatternBoundedVars(
        F.isTripleCollection(annotation) ? annotation : annotation.val,
        boundedVars,
      );
    }
  } else if (F.isPath(iter)) {
    for (const item of iter.items) {
      findPatternBoundedVars(item, boundedVars);
    }
  } else if (F.isTripleCollection(iter) || F.isPatternBgp(iter)) {
    if (F.isTripleCollection(iter)) {
      // The reifier of a reified triple is only stored as its identifier
      findPatternBoundedVars(iter.identifier, boundedVars);
    }
    for (const triple of iter.triples) {
      findPatternBoundedVars(triple, boundedVars);
    }
  } else if (
    F.isPatternGroup(iter) || F.isPatternUnion(iter) || F.isPatternOptional(iter) || F.isPatternService(iter)) {
    for (const pattern of iter.patterns) {
      findPatternBoundedVars(pattern, boundedVars);
    }
    if (F.isPatternService(iter)) {
      findPatternBoundedVars(iter.name, boundedVars);
    }
  } else if (F.isPatternBind(iter)) {
    findPatternBoundedVars(iter.variable, boundedVars);
  } else if (F.isPatternValues(iter)) {
    for (const variable of iter.variables) {
      boundedVars.add(variable.value);
    }
  } else if (F.isPatternGraph(iter)) {
    findPatternBoundedVars(iter.name, boundedVars);
    for (const pattern of iter.patterns) {
      findPatternBoundedVars(pattern, boundedVars);
    }
  }
}

/**
 * SPARQL 1.2 version of {@link T11.queryProjectionIsGood}, see that function for the checks.
 * It differs in the in-scope variables of {@link selectExpressionAliasesNotInScope}.
 */
export function queryProjectionIsGood(
  query: Pick<QuerySelect, 'variables' | 'solutionModifiers' | 'where' | 'values'>,
  options: T11.ProjectionValidationOptions = {},
): void {
  queryProjectionRespectsGrouping(<T11.QuerySelect> <unknown> query, options);
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
    if (!isGroupedQuery(<T11.QuerySelect> <unknown> query)) {
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
 * SPARQL 1.2 version of the SPARQL 1.1 checkNote13, named after it so it overrides it in the `validation` export.
 * Grammar note 12 of https://www.w3.org/TR/sparql12-query/#sparqlGrammar (note 13 in SPARQL 1.1)
 * > The variable assigned in a BIND clause must not already be in-use within the immediately preceding TriplesBlock
 *   within a GroupGraphPattern.
 * See also https://www.w3.org/TR/sparql12-query/#variableScope
 * > In BIND (expr AS v) requires that the variable v is not in-scope from the preceeding elements in the
 *    group graph pattern in which it is used.
 * The in-scope variables include those of the preceding TriplesBlock,
 * also those within triple terms, reifiers, and annotations.
 */
export function checkNote13(patterns: Pattern[]): void {
  // Only a BIND can violate this note, so there is no need to collect the bounded variables without one.
  if (!patterns.some(pattern => F.isPatternBind(pattern))) {
    return;
  }
  const boundedVars = new Set<string>();
  for (const pattern of patterns) {
    if (F.isPatternBind(pattern) && boundedVars.has(pattern.variable.value)) {
      throw new Error(`Variable used to bind is already bound (?${pattern.variable.value})`);
    }
    findPatternBoundedVars(pattern, boundedVars);
  }
}

/**
 * Grammar note 10 of https://www.w3.org/TR/sparql12-query/#sparqlGrammar
 * > Variables in the variable list of a VALUES clause must be unique within that list.
 */
export function valuesVariablesAreUnique(values: PatternValues): void {
  const seen = new Set<string>();
  for (const variable of values.variables) {
    if (seen.has(variable.value)) {
      throw new Error(`Variable used more than once in VALUES (?${variable.value})`);
    }
    seen.add(variable.value);
  }
}
