import type {
  ContextDefinition,
  DatasetClauses,
  Expression,
  Query,
  QueryAsk,
  QueryConstruct,
  QueryDescribe,
  QuerySelect,
  SolutionModifierGroupBind,
  SolutionModifiers,
  Wildcard,
} from '@traqula/rules-sparql-1-1';
import type * as SparqlJs from 'sparqljs';
import type { SparqlJsCompatIndir, SparqlJsTermToTraqula } from './core.js';
import { isSparqlJsTerm, isWildcardVariables } from './core.js';
import { expressionFromSparqlJs } from './expression.js';
import { groupPatternsFromSparqlJs } from './pattern.js';
import { termFromSparqlJs } from './term.js';
import { tripleFromSparqlJs, valuesPatternFromSparqlJs } from './triple.js';

/**
 * Converts a PREFIX map and BASE into context definitions.
 * Both may be missing: a subquery carries neither, even though the SPARQL.js types require `prefixes`.
 */
export const contextFromSparqlJs: SparqlJsCompatIndir<
  'contextFromSparqlJs',
  ContextDefinition[],
  [Record<string, string> | undefined, string | undefined]
> = {
  name: 'contextFromSparqlJs',
  fun: () => ({ astFactory: F }, prefixes, base) => {
    const context: ContextDefinition[] = [];
    if (base !== undefined) {
      context.push(F.contextDefinitionBase(F.gen(), F.termNamed(F.gen(), base)));
    }
    for (const [ key, value ] of Object.entries(prefixes ?? {})) {
      context.push(F.contextDefinitionPrefix(F.gen(), key, F.termNamed(F.gen(), value)));
    }
    return context;
  },
};

/**
 * Converts FROM / FROM NAMED (or USING / USING NAMED) clauses.
 */
export const datasetClausesFromSparqlJs: SparqlJsCompatIndir<
  'datasetClausesFromSparqlJs',
  DatasetClauses,
  [{ default: SparqlJs.IriTerm[]; named: SparqlJs.IriTerm[] } | undefined]
> = {
  name: 'datasetClausesFromSparqlJs',
  fun: ({ SUBRULE }) => (context, from) => {
    const { astFactory: F } = context;
    const clauses: DatasetClauses['clauses'] = [];
    if (from) {
      for (const iri of from.default) {
        const value = <SparqlJsTermToTraqula<typeof iri>> SUBRULE(termFromSparqlJs, iri);
        clauses.push({ clauseType: 'default', value });
      }
      for (const iri of from.named) {
        const value = <SparqlJsTermToTraqula<typeof iri>> SUBRULE(termFromSparqlJs, iri);
        clauses.push({ clauseType: 'named', value });
      }
    }
    return F.datasetClauses(clauses, F.gen());
  },
};

/**
 * The DefinitelyTyped types drift from what the SPARQL.js parser supplies: they only declare these fields on
 * SELECT, while every query form can have them. We correct these types here.
 */
export interface SolutionModifierFields {
  group?: SparqlJs.Grouping[] | undefined;
  having?: SparqlJs.Expression[] | undefined;
  order?: SparqlJs.Ordering[] | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}

/**
 * Converts GROUP BY, HAVING, ORDER BY, LIMIT and OFFSET.
 */
export const solutionModifiersFromSparqlJs: SparqlJsCompatIndir<
  'solutionModifiersFromSparqlJs',
  SolutionModifiers,
  [SolutionModifierFields]
> = {
  name: 'solutionModifiersFromSparqlJs',
  fun: ({ SUBRULE }) => (context, query) => {
    const { astFactory: F } = context;
    const modifiers: SolutionModifiers = {};
    if (query.group && query.group.length > 0) {
      modifiers.group = F.solutionModifierGroup(
        query.group.map((grouping): Expression | SolutionModifierGroupBind => {
          const value = SUBRULE(expressionFromSparqlJs, grouping.expression);
          if (grouping.variable) {
            const variable =
              <SparqlJsTermToTraqula<typeof grouping.variable>> SUBRULE(termFromSparqlJs, grouping.variable);
            return { variable, value, loc: F.gen() };
          }
          return value;
        }),
        F.gen(),
      );
    }
    if (query.having && query.having.length > 0) {
      modifiers.having = F.solutionModifierHaving(
        query.having.map(condition => SUBRULE(expressionFromSparqlJs, condition)),
        F.gen(),
      );
    }
    if (query.order && query.order.length > 0) {
      modifiers.order = F.solutionModifierOrder(query.order.map(ordering => ({
        descending: Boolean(ordering.descending),
        expression: SUBRULE(expressionFromSparqlJs, ordering.expression),
        loc: F.gen(),
      })), F.gen());
    }
    if (query.limit !== undefined || query.offset !== undefined) {
      modifiers.limitOffset = F.solutionModifierLimitOffset(query.limit, query.offset, F.gen());
    }
    return modifiers;
  },
};

/**
 * Converts a SELECT query, including one used as a subquery.
 */
export const selectQueryFromSparqlJs: SparqlJsCompatIndir<
  'selectQueryFromSparqlJs',
  QuerySelect,
  [SparqlJs.SelectQuery]
> = {
  name: 'selectQueryFromSparqlJs',
  fun: ({ SUBRULE }) => (context, query) => {
    const { astFactory: F } = context;
    const variables = isWildcardVariables(query.variables) ?
      <[Wildcard]> [ F.wildcard(F.gen()) ] :
      query.variables.map((variable) => {
        if (isSparqlJsTerm(variable)) {
          return <SparqlJsTermToTraqula<typeof variable>> SUBRULE(termFromSparqlJs, variable);
        }
        return F.patternBind(
          SUBRULE(expressionFromSparqlJs, variable.expression),
          <SparqlJsTermToTraqula<typeof variable.variable>> SUBRULE(termFromSparqlJs, variable.variable),
          F.gen(),
        );
      });
    return F.querySelect({
      context: SUBRULE(contextFromSparqlJs, query.prefixes, query.base),
      datasets: SUBRULE(datasetClausesFromSparqlJs, query.from),
      where: F.patternGroup(SUBRULE(groupPatternsFromSparqlJs, query.where ?? []), F.gen()),
      variables,
      ...(query.distinct ? { distinct: true } : {}),
      ...(query.reduced ? { reduced: true } : {}),
      solutionModifiers: SUBRULE(solutionModifiersFromSparqlJs, query),
      ...(query.values ? { values: SUBRULE(valuesPatternFromSparqlJs, query.values) } : {}),
    }, F.gen());
  },
};

/**
 * Converts a CONSTRUCT query.
 */
export const constructQueryFromSparqlJs: SparqlJsCompatIndir<
  'constructQueryFromSparqlJs',
  QueryConstruct,
  [SparqlJs.ConstructQuery]
> = {
  name: 'constructQueryFromSparqlJs',
  fun: ({ SUBRULE }) => (context, query) => {
    const { astFactory: F } = context;
    const where = F.patternGroup(SUBRULE(groupPatternsFromSparqlJs, query.where ?? []), F.gen());
    // The SPARQL.js parser fills `template` for the `CONSTRUCT WHERE` shorthand and leaves it undefined for
    // an empty template (`CONSTRUCT { } WHERE`), so a missing template is converted as an empty one.
    const templateTriples = query.template ?? [];
    return F.queryConstruct(
      F.gen(),
      SUBRULE(contextFromSparqlJs, query.prefixes, query.base),
      F.patternBgp(templateTriples.map(triple => SUBRULE(tripleFromSparqlJs, triple)), F.gen()),
      where,
      SUBRULE(solutionModifiersFromSparqlJs, <SolutionModifierFields> <unknown> query),
      SUBRULE(datasetClausesFromSparqlJs, query.from),
      query.values ? SUBRULE(valuesPatternFromSparqlJs, query.values) : undefined,
    );
  },
};

/**
 * Converts an ASK query.
 */
export const askQueryFromSparqlJs: SparqlJsCompatIndir<'askQueryFromSparqlJs', QueryAsk, [SparqlJs.AskQuery]> = {
  name: 'askQueryFromSparqlJs',
  fun: ({ SUBRULE }) => (context, query) => {
    const { astFactory: F } = context;
    return {
      type: 'query',
      subType: 'ask',
      context: SUBRULE(contextFromSparqlJs, query.prefixes, query.base),
      datasets: SUBRULE(datasetClausesFromSparqlJs, query.from),
      where: F.patternGroup(SUBRULE(groupPatternsFromSparqlJs, query.where ?? []), F.gen()),
      solutionModifiers: SUBRULE(solutionModifiersFromSparqlJs, <SolutionModifierFields> <unknown> query),
      values: query.values ? SUBRULE(valuesPatternFromSparqlJs, query.values) : undefined,
      loc: F.gen(),
    };
  },
};

/**
 * Converts a DESCRIBE query.
 */
export const describeQueryFromSparqlJs: SparqlJsCompatIndir<
  'describeQueryFromSparqlJs',
  QueryDescribe,
  [SparqlJs.DescribeQuery]
> = {
  name: 'describeQueryFromSparqlJs',
  fun: ({ SUBRULE }) => (context, query) => {
    const { astFactory: F } = context;
    const variables = isWildcardVariables(query.variables) ?
      <[Wildcard]> [ F.wildcard(F.gen()) ] :
      query.variables.map(variable => <SparqlJsTermToTraqula<typeof variable>> SUBRULE(termFromSparqlJs, variable));
    return {
      type: 'query',
      subType: 'describe',
      context: SUBRULE(contextFromSparqlJs, query.prefixes, query.base),
      datasets: SUBRULE(datasetClausesFromSparqlJs, query.from),
      where: query.where ? F.patternGroup(SUBRULE(groupPatternsFromSparqlJs, query.where), F.gen()) : undefined,
      variables,
      solutionModifiers: SUBRULE(solutionModifiersFromSparqlJs, <SolutionModifierFields> <unknown> query),
      values: query.values ? SUBRULE(valuesPatternFromSparqlJs, query.values) : undefined,
      loc: F.gen(),
    };
  },
};

/**
 * Converts a query of any form, dispatching on `queryType`.
 */
export const queryFromSparqlJs: SparqlJsCompatIndir<'queryFromSparqlJs', Query, [SparqlJs.Query]> = {
  name: 'queryFromSparqlJs',
  fun: ({ SUBRULE }) => (_, query) => {
    switch (query.queryType) {
      case 'SELECT':
        return SUBRULE(selectQueryFromSparqlJs, query);
      case 'CONSTRUCT':
        return SUBRULE(constructQueryFromSparqlJs, query);
      case 'ASK':
        return SUBRULE(askQueryFromSparqlJs, query);
      case 'DESCRIBE':
        return SUBRULE(describeQueryFromSparqlJs, query);
      default:
        throw new Error(`Cannot convert sparqljs query of queryType '${(<{ queryType: string }> query).queryType}'`);
    }
  },
};
