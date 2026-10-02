import {
  getAggregatesOfExpression,
  getExpressionId,
  getVariablesFromExpression,
  selectExpressionAliasesNotInValues,
} from '@traqula/rules-sparql-1-1';
import type * as T11 from '@traqula/rules-sparql-1-1';
import { AstFactory } from './AstFactory.js';
import type {
  Path,
  Pattern,
  PatternBind,
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
    for (const variable of Object.keys(iter.values.at(0) ?? {})) {
      boundedVars.add(variable);
    }
  } else if (F.isPatternGraph(iter)) {
    findPatternBoundedVars(iter.name, boundedVars);
    for (const pattern of iter.patterns) {
      findPatternBoundedVars(pattern, boundedVars);
    }
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
  const hasCountAggregate = variables.flatMap(
    varVal => F.isTerm(varVal) ? [] : getAggregatesOfExpression(<T11.Expression> varVal.expression),
  ).some(agg => agg.aggregation === 'count' && !agg.expression.some(arg => F.isWildcard(arg)));
  const groupBy = query.solutionModifiers.group;
  if (hasCountAggregate || groupBy) {
    // We have to check whether
    //  1. Variables used in projection are usable given the group by clause
    //  2. A selectCount will create an implicit group by clause.
    // Variables bound by preceding (expr AS ?var) expressions are in scope for later expressions.
    const asBoundVars = new Set<string>();
    for (const selectVar of variables) {
      if (F.isTerm(selectVar)) {
        if (!groupBy || !groupBy.groupings.map(groupvar =>
          getExpressionId(<T11.Expression | T11.SolutionModifierGroupBind> groupvar))
          .includes((getExpressionId(selectVar)))) {
          throw new Error('Variable not allowed in projection');
        }
      } else if (getAggregatesOfExpression(<T11.Expression> selectVar.expression).length === 0) {
        // Current value binding does not use aggregates
        const usedvars = new Set<string>();
        getVariablesFromExpression(<T11.Expression> selectVar.expression, usedvars);
        for (const usedvar of usedvars) {
          // If the var is created within the select, it is fine.
          if (asBoundVars.has(usedvar)) {
            continue;
          }
          if (!groupBy || !groupBy.groupings.map(groupVar =>
            getExpressionId(<T11.Expression | T11.SolutionModifierGroupBind>groupVar)).includes(usedvar)) {
            throw new Error(`Use of ungrouped variable in projection of operation (?${usedvar})`);
          }
        }
      }
      if (!F.isTerm(selectVar)) {
        // Register a var is created by a bind
        asBoundVars.add(selectVar.variable.value);
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
 * In-scope are the variables bound by the WHERE clause (including subquery projections), GROUP BY (expr AS v),
 * and the trailing VALUES clause (joined before the projection, 18.2.4.3).
 */
export function selectExpressionAliasesNotInScope(
  query: Pick<QuerySelect, 'variables' | 'solutionModifiers' | 'where' | 'values'>,
): void {
  const selectBinds = query.variables.filter((variable): variable is PatternBind =>
    !F.isTerm(variable) && !F.isWildcard(variable));
  if (selectBinds.length > 0) {
    const inScopeVars = new Set<string>();
    findPatternBoundedVars(query.where, inScopeVars);
    for (const grouping of query.solutionModifiers.group?.groupings ?? []) {
      if ('variable' in grouping) {
        inScopeVars.add(grouping.variable.value);
      }
    }
    for (const { variable } of selectBinds) {
      if (inScopeVars.has(variable.value)) {
        throw new Error(`Target id of 'AS' (?${variable.value}) is already in scope`);
      }
    }
  }
  selectExpressionAliasesNotInValues(query);
}
