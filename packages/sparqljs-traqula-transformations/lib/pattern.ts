import type { Pattern, PatternGroup } from '@traqula/rules-sparql-1-1';
import { validation } from '@traqula/rules-sparql-1-1';
import type * as SparqlJs from 'sparqljs';
import type { SparqlJsCompatIndir, SparqlJsTermToTraqula } from './core.js';
import { expressionFromSparqlJs } from './expression.js';
import { selectQueryFromSparqlJs } from './query.js';
import { termFromSparqlJs } from './term.js';
import { tripleFromSparqlJs, valuesPatternFromSparqlJs } from './triple.js';

/**
 * Converts the content of a `{ ... }` group: a WHERE clause, a nested group, or the body of
 * OPTIONAL/MINUS/GRAPH/SERVICE.
 * @param patterns - The SPARQL.js patterns inside the braces.
 * @returns The converted patterns, checked for blank node label scope unless `skipValidation` is set.
 */
export const groupPatternsFromSparqlJs: SparqlJsCompatIndir<
  'groupPatternsFromSparqlJs',
  Pattern[],
  [SparqlJs.Pattern[]]
> = {
  name: 'groupPatternsFromSparqlJs',
  fun: ({ SUBRULE }) => (context, patterns) => {
    const converted = patterns.map(pattern => SUBRULE(patternFromSparqlJs, pattern));
    // Traqula's parser runs this check on every group; SPARQL.js does not, and hand-built input may violate it.
    if (!context.skipValidation) {
      validation.checkBlankNodeBGPScope(converted);
    }
    return converted;
  },
};

/**
 * Wraps a converted pattern in a group unless it already is one.
 * SPARQL.js input may give a `{ ... }` with a single pattern (a UNION branch, an EXISTS argument) as that pattern.
 */
export const ensurePatternGroup: SparqlJsCompatIndir<'ensurePatternGroup', PatternGroup, [Pattern]> = {
  name: 'ensurePatternGroup',
  fun: () => ({ astFactory: F }, pattern) =>
    F.isPatternGroup(pattern) ? pattern : F.patternGroup([ pattern ], F.gen()),
};

/**
 * Converts a single SPARQL.js pattern (a WHERE clause element, including nested subqueries).
 */
export const patternFromSparqlJs: SparqlJsCompatIndir<'patternFromSparqlJs', Pattern, [SparqlJs.Pattern]> = {
  name: 'patternFromSparqlJs',
  fun: ({ SUBRULE }) => (context, pattern) => {
    const { astFactory: F } = context;
    switch (pattern.type) {
      case 'bgp':
        return F.patternBgp(pattern.triples.map(triple => SUBRULE(tripleFromSparqlJs, triple)), F.gen());
      case 'group':
        return F.patternGroup(SUBRULE(groupPatternsFromSparqlJs, pattern.patterns), F.gen());
      case 'optional':
        return F.patternOptional(SUBRULE(groupPatternsFromSparqlJs, pattern.patterns), F.gen());
      case 'union':
        return F.patternUnion(
          pattern.patterns.map(branch => SUBRULE(ensurePatternGroup, SUBRULE(patternFromSparqlJs, branch))),
          F.gen(),
        );
      case 'minus':
        return F.patternMinus(SUBRULE(groupPatternsFromSparqlJs, pattern.patterns), F.gen());
      case 'graph':
        return F.patternGraph(
          <SparqlJsTermToTraqula<typeof pattern.name>> SUBRULE(termFromSparqlJs, pattern.name),
          SUBRULE(groupPatternsFromSparqlJs, pattern.patterns),
          F.gen(),
        );
      case 'service':
        return F.patternService(
          <SparqlJsTermToTraqula<typeof pattern.name>> SUBRULE(termFromSparqlJs, pattern.name),
          SUBRULE(groupPatternsFromSparqlJs, pattern.patterns),
          pattern.silent,
          F.gen(),
        );
      case 'filter':
        return F.patternFilter(SUBRULE(expressionFromSparqlJs, pattern.expression), F.gen());
      case 'bind':
        return F.patternBind(
          SUBRULE(expressionFromSparqlJs, pattern.expression),
          <SparqlJsTermToTraqula<typeof pattern.variable>> SUBRULE(termFromSparqlJs, pattern.variable),
          F.gen(),
        );
      case 'values':
        return SUBRULE(valuesPatternFromSparqlJs, pattern.values);
      case 'query':
        return SUBRULE(selectQueryFromSparqlJs, pattern);
      default:
        throw new Error(`Cannot convert sparqljs pattern of type '${(<{ type: string }> pattern).type}'`);
    }
  },
};
