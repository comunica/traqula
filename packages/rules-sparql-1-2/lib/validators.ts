import { getAggregatesOfExpression, getExpressionId, getVariablesFromExpression } from '@traqula/rules-sparql-1-1';
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
  TermVariable,
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
      if (iter.where && iter.variables.some(x => F.isWildcard(x))) {
        findPatternBoundedVars(iter.where, boundedVars);
      } else {
        for (const v of iter.variables) {
          findPatternBoundedVars(v, boundedVars);
        }
      }
      if (iter.solutionModifiers.group) {
        const grouping = iter.solutionModifiers.group;
        for (const g of grouping.groupings) {
          if ('variable' in g) {
            findPatternBoundedVars(g.variable, boundedVars);
          }
        }
      }
      if (iter.values?.values && iter.values.values.length > 0) {
        const values = iter.values.values;
        for (const v of Object.keys(values[0])) {
          boundedVars.add(v);
        }
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
