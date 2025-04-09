import type { ImplArgs } from '@traqula/core';
import * as l from '../../lexer';
import type {
  AggregateExpression,
  AskQuery,
  ConstructQuery,
  DescribeQuery,
  Expression,
  Grouping,
  IriTerm,
  Pattern,
  Query,
  SelectQuery,
  SparqlGrammarRule,
  SparqlRule,
  Triple,
  ValuePatternRow,
  Variable,
  VariableExpression,
  VariableTerm,
} from '../../Sparql11types';
import { Wildcard } from '../../Wildcard';
import { datasetClause, type IDatasetClause } from '../dataSetClause';
import { expression } from '../expression';
import { prologue, var_, varOrIri, varOrTerm } from '../general';
import { iri } from '../literals';
import { solutionModifier } from '../solutionModifier';
import { triplesBlock, triplesTemplate } from '../tripleBlock';
import { dataBlock, groupGraphPattern, inlineDataFull, whereClause } from '../whereClause';

/**
 * [[1]](https://www.w3.org/TR/sparql11-query/#rQueryUnit)
 */
export const queryUnit: SparqlGrammarRule<'queryUnit', Query> = <const> {
  name: 'queryUnit',
  impl: ({ SUBRULE }) => () => SUBRULE(query, undefined),
};

/**
 * [[2]](https://www.w3.org/TR/sparql11-query/#rQuery)
 */
export const query: SparqlRule<'query', Query> = <const> {
  name: 'query',
  impl: ({ ACTION, SUBRULE, OR }) => () => {
    const prologueValues = SUBRULE(prologue, undefined);
    const queryType = OR<Omit<Query, HandledByBase>>([
      { ALT: () => SUBRULE(selectQuery, undefined) },
      { ALT: () => SUBRULE(constructQuery, undefined) },
      { ALT: () => SUBRULE(describeQuery, undefined) },
      { ALT: () => SUBRULE(askQuery, undefined) },
    ]);
    const values = SUBRULE(valuesClause, undefined);

    return ACTION(() => (<Query>{
      ...prologueValues,
      ...queryType,
      type: 'query',
      ...(values && { values }),
    }));
  },
  gImpl: ({ SUBRULE }) => (ast) => {
    const prologueString = SUBRULE(prologue, ast, undefined);
    let queryString = '';
    switch (ast.queryType) {
      case 'SELECT':
        queryString = SUBRULE(selectQuery, ast, undefined);
        break;
      case 'CONSTRUCT':
        queryString = SUBRULE(constructQuery, ast, undefined);
        break;
      case 'DESCRIBE':
        queryString = SUBRULE(describeQuery, ast, undefined);
        break;
      case 'ASK':
        queryString = SUBRULE(askQuery, ast, undefined);
        break;
    }
    const valuesString = ast.values ? SUBRULE(valuesClause, ast.values, undefined) : '';
    return [ prologueString, queryString, valuesString ].filter(Boolean).join(' ');
  },
};

export type HandledByBase = 'values' | 'type' | 'base' | 'prefixes';

function extractFromOfDataSetClauses(ACTION: ImplArgs['ACTION'], MANY: ImplArgs['MANY'], SUBRULE: ImplArgs['SUBRULE']):
{ default: IriTerm[]; named: IriTerm[] } | undefined {
  const datasetClauses: IDatasetClause[] = [];
  MANY(() => {
    datasetClauses.push(SUBRULE(datasetClause, undefined));
  });
  return ACTION(() => {
    const from: { default: IriTerm[]; named: IriTerm[] } = {
      default: [],
      named: [],
    };
    for (const datasetClause of datasetClauses) {
      if (datasetClause.type === 'default') {
        from.default.push(datasetClause.value);
      } else {
        from.named.push(datasetClause.value);
      }
    }
    return (from.default.length === 0 && from.named.length === 0) ? undefined : from;
  });
}

/**
 * Get all 'aggregate' rules from an expression
 */
function getAggregatesOfExpression(expression: Expression | Pattern): AggregateExpression[] {
  if ('type' in expression) {
    if (expression.type === 'aggregate') {
      return [ expression ];
    }
    if (expression.type === 'operation') {
      const aggregates: AggregateExpression[] = [];
      for (const arg of expression.args) {
        aggregates.push(...getAggregatesOfExpression(arg));
      }
      return aggregates;
    }
  }
  return [];
}

/**
 * Return the id of an expression
 */
function getExpressionId(expression: Grouping | VariableTerm | VariableExpression): string | undefined {
  // Check if grouping
  if ('variable' in expression && expression.variable) {
    return expression.variable.value;
  }
  if ('value' in expression) {
    return expression.value;
  }
  return 'value' in expression.expression ? expression.expression.value : undefined;
}
/**
 * Get all variables used in an expression
 */
function getVariablesFromExpression(expression: Expression): Set<VariableTerm> {
  const variables = new Set<VariableTerm>();
  const visitExpression = (expr: Expression | Pattern | undefined): void => {
    if (!expr) {
      return;
    }
    if ('termType' in expr && expr.termType === 'Variable') {
      variables.add(expr);
    } else if ('type' in expr && expr.type === 'operation') {
      for (const rec of expr.args) {
        visitExpression(rec);
      }
    }
  };
  visitExpression(expression);
  return variables;
}

/**
 * [[7]](https://www.w3.org/TR/sparql11-query/#rSelectQuery)
 */
export const selectQuery: SparqlRule<'selectQuery', Omit<SelectQuery, HandledByBase>> = <const> {
  name: 'selectQuery',
  impl: ({ ACTION, SUBRULE, MANY }) => (C) => {
    const selectVal = SUBRULE(selectClause, undefined);
    const from = extractFromOfDataSetClauses(ACTION, MANY, SUBRULE);
    const where = SUBRULE(whereClause, undefined);
    const modifier = SUBRULE(solutionModifier, undefined);

    ACTION(() => {
      if (selectVal.variables.length === 1 && selectVal.variables[0] instanceof Wildcard) {
        if (modifier.group !== undefined) {
          throw new Error('GROUP BY not allowed with wildcard');
        }
        return;
      }
      const variables = <Variable[]> selectVal.variables;
      // Check for projection of ungrouped variable
      // Check can be skipped in case of wildcard select.
      if (!C.skipValidation) {
        const hasCountAggregate = variables.flatMap(
          varVal => 'termType' in varVal ? [] : getAggregatesOfExpression(varVal.expression),
        ).some(agg => agg.aggregation === 'count' && !(agg.expression instanceof Wildcard));
        if (hasCountAggregate || modifier.group) {
          // We have to check whether
          //  1. Variables used in projection are usable given the group by clause
          //  2. A selectCount will create an implicit group by clause.
          for (const selectVar of variables) {
            if ('termType' in selectVar) {
              if (!modifier.group || !modifier.group.map(groupvar => getExpressionId(groupvar))
                .includes((getExpressionId(selectVar)))) {
                throw new Error('Variable not allowed in projection');
              }
            } else if (getAggregatesOfExpression(selectVar.expression).length === 0) {
              const usedvars = getVariablesFromExpression(selectVar.expression);
              for (const usedvar of usedvars) {
                if (!modifier.group || !modifier.group.map || !modifier.group.map(groupVar => getExpressionId(groupVar))
                  .includes(getExpressionId(usedvar))) {
                  throw new Error(`Use of ungrouped variable in projection of operation (?${getExpressionId(usedvar)})`);
                }
              }
            }
          }
        }
      }
      // Check if id of each AS-selected column is not yet bound by subquery
      const subqueries = where.filter(pattern => pattern.type === 'query');
      if (subqueries.length > 0) {
        const selectedVarIds: string[] = [];
        for (const selectedVar of variables) {
          if ('variable' in selectedVar) {
            selectedVarIds.push(selectedVar.variable.value);
          }
        }
        const vars = subqueries.flatMap(sub => <(Variable | Wildcard)[]>sub.variables)
          .map(v => 'value' in v ? v.value : v.variable.value);
        const subqueryIds = new Set(vars);
        for (const selectedVarId of selectedVarIds) {
          if (subqueryIds.has(selectedVarId)) {
            throw new Error(`Target id of 'AS' (?${selectedVarId}) already used in subquery`);
          }
        }
      }
    });

    return {
      ...selectVal,
      queryType: 'SELECT',
      ...(from && { from }),
      where,
      ...modifier,
    };
  },
  gImpl: ({ SUBRULE }) => (ast) => {
    const selectString = SUBRULE(selectClause, ast, undefined);

    const fromDefaultString = ast.from?.default.map(clause =>
      `FROM ${SUBRULE(iri, clause, undefined)}`).join(' ') ?? '';

    const fromNamedString = ast.from?.named.map(clause =>
      `FROM NAMED ${SUBRULE(iri, clause, undefined)}`).join(' ') ?? '';

    const whereString = ast.where ?
      `WHERE ${SUBRULE(groupGraphPattern, { type: 'group', patterns: ast.where }, undefined)}` :
      '';

    const modifierString = SUBRULE(solutionModifier, ast, undefined);
    return [ selectString, fromDefaultString, fromNamedString, whereString, modifierString ].filter(Boolean).join(' ');
  },
};

/**
 * [[8]](https://www.w3.org/TR/sparql11-query/#rSubSelect)
 */
export const subSelect: SparqlGrammarRule<'subSelect', Omit<SelectQuery, 'prefixes'>> = <const> {
  name: 'subSelect',
  impl: ({ ACTION, SUBRULE }) => () => {
    const clause = SUBRULE(selectClause, undefined);
    const where = SUBRULE(whereClause, undefined);
    const modifiers = SUBRULE(solutionModifier, undefined);
    const values = SUBRULE(valuesClause, undefined);

    return ACTION(() => ({
      ...modifiers,
      ...clause,
      type: 'query',
      queryType: 'SELECT',
      where,
      ...(values && { values }),
    }));
  },
};

/**
 * [[9]](https://www.w3.org/TR/sparql11-query/#rSelectClause)
 */
export interface ISelectClause {
  variables: Variable[] | [Wildcard];
  distinct?: true;
  reduced?: true;
}
export const selectClause: SparqlRule<'selectClause', ISelectClause> = <const> {
  name: 'selectClause',
  impl: ({ ACTION, AT_LEAST_ONE, SUBRULE, CONSUME, SUBRULE1, SUBRULE2, OPTION, OR1, OR2, OR3 }) => (C) => {
    CONSUME(l.select);
    const couldParseAgg = ACTION(() =>
      C.parseMode.has('canParseAggregate') || !C.parseMode.add('canParseAggregate'));

    const distinctOrReduced = OPTION(() => OR1<Partial<{ distinct: true; reduced: true }>>([
      { ALT: () => {
        CONSUME(l.distinct);
        return { distinct: true };
      } },
      { ALT: () => {
        CONSUME(l.reduced);
        return { reduced: true };
      } },
    ]));
    const variables = OR2<ISelectClause['variables']>([
      { ALT: () => {
        CONSUME(l.symbols.star);
        return [ new Wildcard() ];
      } },
      { ALT: () => {
        const usedVars: VariableTerm[] = [];
        const result: Variable[] = [];
        AT_LEAST_ONE(() => OR3([
          { ALT: () => {
            const raw = SUBRULE1(var_, undefined);
            ACTION(() => {
              if (usedVars.some(v => v.equals(raw))) {
                throw new Error(`Variable ${raw.value} used more than once in SELECT clause`);
              }
              usedVars.push(raw);
              result.push(raw);
            });
          } },
          { ALT: () => {
            CONSUME(l.symbols.LParen);
            const expr = SUBRULE(expression, undefined);
            CONSUME(l.as);
            const variable = SUBRULE2(var_, undefined);
            CONSUME(l.symbols.RParen);
            ACTION(() => {
              if (usedVars.some(v => v.equals(variable))) {
                throw new Error(`Variable ${variable.value} used more than once in SELECT clause`);
              }
              usedVars.push(variable);
              result.push({
                expression: expr,
                variable,
              } satisfies VariableExpression);
            });
          } },
        ]));
        return result;
      } },
    ]);
    ACTION(() => !couldParseAgg && C.parseMode.delete('canParseAggregate'));
    return ACTION(() => ({
      ...distinctOrReduced,
      variables,
    }));
  },
  gImpl: ({ SUBRULE }) => (ast) => {
    const builder = [ 'SELECT' ];
    if (ast.distinct) {
      builder.push('DISTINCT');
    } else if (ast.reduced) {
      builder.push('REDUCED');
    }

    if (ast.variables.length === 1 && ast.variables[0] instanceof Wildcard) {
      builder.push('*');
    } else {
      for (const variable of <Variable[]> ast.variables) {
        if ('expression' in variable) {
          builder.push(`( ${SUBRULE(expression, variable.expression, undefined)} AS ${SUBRULE(var_, variable.variable, undefined)} )`);
        } else {
          builder.push(SUBRULE(var_, variable, undefined));
        }
      }
    }

    return builder.join(' ');
  },
};

/**
 * [[10]](https://www.w3.org/TR/sparql11-query/#rConstructQuery)
 */
export const constructQuery: SparqlRule<'constructQuery', Omit<ConstructQuery, HandledByBase>> = <const> {
  name: 'constructQuery',
  impl: ({ ACTION, SUBRULE, CONSUME, SUBRULE1, SUBRULE2, MANY1, MANY2, OPTION, OR }) => () => {
    CONSUME(l.construct);
    return OR<Omit<ConstructQuery, HandledByBase>>([
      {
        ALT: () => {
          const template = SUBRULE(constructTemplate, undefined);
          const from = extractFromOfDataSetClauses(ACTION, MANY1, SUBRULE1);
          const where = SUBRULE(whereClause, undefined);
          const modifiers = SUBRULE1(solutionModifier, undefined);
          return ACTION(() => ({
            ...modifiers,
            queryType: 'CONSTRUCT',
            template,
            from,
            where,
          }));
        },
      },
      {
        ALT: () => {
          const from = extractFromOfDataSetClauses(ACTION, MANY2, SUBRULE2);
          CONSUME(l.where);
          CONSUME(l.symbols.LCurly);
          const template = OPTION(() => SUBRULE(triplesTemplate, undefined));
          CONSUME(l.symbols.RCurly);
          const modifiers = SUBRULE2(solutionModifier, undefined);
          const where: Pattern[] = template ?
              [{
                type: 'bgp',
                triples: template,
              }] :
              [];

          return ACTION(() => ({
            ...modifiers,
            queryType: 'CONSTRUCT',
            from,
            template,
            where,
          }));
        },
      },
    ]);
  },
  gImpl: ({ SUBRULE }) => (ast) => {
    const constructString = SUBRULE(constructTemplate, ast.template, undefined);

    const fromDefaultString = ast.from?.default.map(clause =>
      `FROM ${SUBRULE(iri, clause, undefined)}`).join(' ') ?? '';

    const fromNamedString = ast.from?.named.map(clause =>
      `FROM NAMED ${SUBRULE(iri, clause, undefined)}`).join(' ') ?? '';

    const whereString = ast.where ?
      `WHERE ${SUBRULE(groupGraphPattern, { type: 'group', patterns: ast.where }, undefined)}` :
      '';

    const modifierString = SUBRULE(solutionModifier, ast, undefined);
    return [ 'CONSTRUCT', constructString, fromDefaultString, fromNamedString, whereString, modifierString ]
      .filter(Boolean).join(' ');
  },
};

/**
 * [[11]](https://www.w3.org/TR/sparql11-query/#rDescribeQuery)
 */
export const describeQuery: SparqlRule<'describeQuery', Omit<DescribeQuery, HandledByBase>> = <const> {
  name: 'describeQuery',
  impl: ({ ACTION, AT_LEAST_ONE, SUBRULE, CONSUME, MANY, OPTION, OR }) => () => {
    CONSUME(l.describe);
    const variables = OR<DescribeQuery['variables']>([
      { ALT: () => {
        const variables: (VariableTerm | IriTerm)[] = [];
        AT_LEAST_ONE(() => {
          variables.push(SUBRULE(varOrIri, undefined));
        });
        return variables;
      } },
      { ALT: () => {
        CONSUME(l.symbols.star);
        return [ new Wildcard() ];
      } },
    ]);
    const from = extractFromOfDataSetClauses(ACTION, MANY, SUBRULE);
    const where = OPTION(() => SUBRULE(whereClause, undefined));
    const modifiers = SUBRULE(solutionModifier, undefined);
    return ACTION(() => ({
      ...modifiers,
      queryType: 'DESCRIBE',
      variables,
      from,
      where,
    }));
  },
  gImpl: ({ SUBRULE }) => (ast) => {
    const builder = [ 'DESCRIBE' ];
    for (const variable of ast.variables) {
      if (variable.termType === 'Wildcard') {
        builder.push('*');
      } else {
        builder.push(SUBRULE(varOrTerm, variable, undefined));
      }
    }

    if (ast.from) {
      builder.push(ast.from.default.map(clause => `FROM ${SUBRULE(iri, clause, undefined)}`).join(' '));
      builder.push(ast.from.named.map(clause => `FROM NAMED ${SUBRULE(iri, clause, undefined)}`).join(' '));
    }

    if (ast.where) {
      builder.push(`WHERE ${SUBRULE(groupGraphPattern, { type: 'group', patterns: ast.where }, undefined)}`);
    }
    builder.push(SUBRULE(solutionModifier, ast, undefined));
    return builder.join(' ');
  },
};

/**
 * [[12]](https://www.w3.org/TR/sparql11-query/#rAskQuery)
 */
export const askQuery: SparqlRule<'askQuery', Omit<AskQuery, HandledByBase>> = <const> {
  name: 'askQuery',
  impl: ({ ACTION, SUBRULE, CONSUME, MANY }) => () => {
    CONSUME(l.ask);
    const from = extractFromOfDataSetClauses(ACTION, MANY, SUBRULE);
    const where = SUBRULE(whereClause, undefined);
    const modifiers = SUBRULE(solutionModifier, undefined);
    return ACTION(() => ({
      ...modifiers,
      queryType: 'ASK',
      from,
      where,
    }));
  },
  gImpl: ({ SUBRULE }) => (ast) => {
    const builder = [ 'ASK' ];
    if (ast.from) {
      builder.push(ast.from.default.map(clause => `FROM ${SUBRULE(iri, clause, undefined)}`).join(' '));
      builder.push(ast.from.named.map(clause => `FROM NAMED ${SUBRULE(iri, clause, undefined)}`).join(' '));
    }

    if (ast.where) {
      builder.push(`WHERE ${SUBRULE(groupGraphPattern, { type: 'group', patterns: ast.where }, undefined)}`);
    }
    builder.push(SUBRULE(solutionModifier, ast, undefined));
    return builder.join(' ');
  },
};

/**
 * [[28]](https://www.w3.org/TR/sparql11-query/#rValuesClause)
 */
export const valuesClause: SparqlRule<'valuesClause', ValuePatternRow[] | undefined> = <const> {
  name: 'valuesClause',
  impl: ({ SUBRULE, CONSUME, OPTION }) => () => OPTION(() => {
    CONSUME(l.values);
    return SUBRULE(dataBlock, undefined);
  }),
  gImpl: ({ SUBRULE }) => (ast) => {
    if (ast) {
      return `${SUBRULE(inlineDataFull, ast, undefined)}`;
    }
    return '';
  },
};

/**
 * [[73]](https://www.w3.org/TR/sparql11-query/#ConstructTemplate)
 */
export const constructTemplate: SparqlRule<'constructTemplate', Triple[] | undefined> = <const> {
  name: 'constructTemplate',
  impl: ({ SUBRULE, CONSUME, OPTION }) => () => {
    CONSUME(l.symbols.LCurly);
    const triples = OPTION(() => SUBRULE(constructTriples, undefined));
    CONSUME(l.symbols.RCurly);
    return triples;
  },
  gImpl: ({ SUBRULE }) => ast =>
    `{
${ast ? SUBRULE(triplesBlock, { type: 'bgp', triples: ast }, undefined) : ''}
}`,
};

/**
 * [[12]](https://www.w3.org/TR/sparql11-query/#rConstructTriples)
 */
export const constructTriples: SparqlGrammarRule<'constructTriples', Triple[]> = <const> {
  name: 'constructTriples',
  impl: triplesTemplate.impl,
};
