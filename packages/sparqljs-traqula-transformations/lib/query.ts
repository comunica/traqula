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
import { extractTopLevelBgpTriples, isSparqlJsTerm, isWildcardVariables } from './core.js';
import { expressionFromSparqlJs } from './expression.js';
import { patternFromSparqlJs } from './pattern.js';
import { termFromSparqlJs } from './term.js';
import { tripleFromSparqlJs, valuesPatternFromSparqlJs } from './triple.js';

/**
 * `prefixes` and `base` are only populated on a top-level query/update by sparqljs' `Prologue` rule:
 * a nested subquery Pattern shares its enclosing query's lexical scope and carries neither, so both
 * parameters are treated as optional here even though sparqljs' own types mark `prefixes` as required.
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
 * Sparqljs' community types only declare `group`/`having`/`order`/`limit`/`offset` on `SelectQuery`, but
 * the SPARQL grammar applies SolutionModifier to SELECT, CONSTRUCT, DESCRIBE and ASK alike (see sparqljs'
 * sparql.jison, rules [9]-[13]) and sparqljs itself does populate them on every query form at runtime, so
 * this is declared separately rather than derived from `SparqlJs.BaseQuery`.
 */
export interface SolutionModifierFields {
  group?: SparqlJs.Grouping[] | undefined;
  having?: SparqlJs.Expression[] | undefined;
  order?: SparqlJs.Ordering[] | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}

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
        query.having.map(expr => SUBRULE(expressionFromSparqlJs, expr)),
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
      where: F.patternGroup((query.where ?? []).map(p => SUBRULE(patternFromSparqlJs, p)), F.gen()),
      variables,
      ...(query.distinct ? { distinct: true } : {}),
      ...(query.reduced ? { reduced: true } : {}),
      solutionModifiers: SUBRULE(solutionModifiersFromSparqlJs, query),
      ...(query.values ? { values: SUBRULE(valuesPatternFromSparqlJs, query.values) } : {}),
    }, F.gen());
  },
};

export const constructQueryFromSparqlJs: SparqlJsCompatIndir<
  'constructQueryFromSparqlJs',
  QueryConstruct,
  [SparqlJs.ConstructQuery]
> = {
  name: 'constructQueryFromSparqlJs',
  fun: ({ SUBRULE }) => (context, query) => {
    const { astFactory: F } = context;
    const where = F.patternGroup((query.where ?? []).map(p => SUBRULE(patternFromSparqlJs, p)), F.gen());
    // Sparqljs always populates `template` (also for the `CONSTRUCT WHERE { ... }` shorthand, where it
    // duplicates the where-clause triples), but the fallback keeps this robust for hand-built input too.
    const templateTriples = query.template ?? extractTopLevelBgpTriples(query.where ?? []);
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

export const askQueryFromSparqlJs: SparqlJsCompatIndir<'askQueryFromSparqlJs', QueryAsk, [SparqlJs.AskQuery]> = {
  name: 'askQueryFromSparqlJs',
  fun: ({ SUBRULE }) => (context, query) => {
    const { astFactory: F } = context;
    return {
      type: 'query',
      subType: 'ask',
      context: SUBRULE(contextFromSparqlJs, query.prefixes, query.base),
      datasets: SUBRULE(datasetClausesFromSparqlJs, query.from),
      where: F.patternGroup((query.where ?? []).map(p => SUBRULE(patternFromSparqlJs, p)), F.gen()),
      solutionModifiers: SUBRULE(solutionModifiersFromSparqlJs, <SolutionModifierFields> <unknown> query),
      values: query.values ? SUBRULE(valuesPatternFromSparqlJs, query.values) : undefined,
      loc: F.gen(),
    };
  },
};

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
      where: query.where ? F.patternGroup(query.where.map(p => SUBRULE(patternFromSparqlJs, p)), F.gen()) : undefined,
      variables,
      solutionModifiers: SUBRULE(solutionModifiersFromSparqlJs, <SolutionModifierFields> <unknown> query),
      values: query.values ? SUBRULE(valuesPatternFromSparqlJs, query.values) : undefined,
      loc: F.gen(),
    };
  },
};

export const queryFromSparqlJs: SparqlJsCompatIndir<'queryFromSparqlJs', Query, [SparqlJs.Query]> = {
  name: 'queryFromSparqlJs',
  fun: ({ SUBRULE }) => (context, query) => {
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
