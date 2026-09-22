import type { Pattern } from '@traqula/rules-sparql-1-1';
import type * as SparqlJs from 'sparqljs';
import type { SparqlJsCompatIndir, SparqlJsTermToTraqula } from './core.js';
import { ensurePatternGroup } from './core.js';
import { expressionFromSparqlJs } from './expression.js';
import { selectQueryFromSparqlJs } from './query.js';
import { termFromSparqlJs } from './term.js';
import { tripleFromSparqlJs, valuesPatternFromSparqlJs } from './triple.js';

/**
 * Converts a single sparqljs {@link SparqlJs.Pattern} (a where-clause element, including nested subqueries)
 * into a Traqula {@link Pattern}.
 */
export const patternFromSparqlJs: SparqlJsCompatIndir<'patternFromSparqlJs', Pattern, [SparqlJs.Pattern]> = {
  name: 'patternFromSparqlJs',
  fun: ({ SUBRULE }) => (context, pattern) => {
    const { astFactory: F } = context;
    switch (pattern.type) {
      case 'bgp':
        return F.patternBgp(pattern.triples.map(triple => SUBRULE(tripleFromSparqlJs, triple)), F.gen());
      case 'group':
        return F.patternGroup(pattern.patterns.map(p => SUBRULE(patternFromSparqlJs, p)), F.gen());
      case 'optional':
        return F.patternOptional(pattern.patterns.map(p => SUBRULE(patternFromSparqlJs, p)), F.gen());
      case 'union':
        return F.patternUnion(
          pattern.patterns.map(branch => ensurePatternGroup(F, SUBRULE(patternFromSparqlJs, branch))),
          F.gen(),
        );
      case 'minus':
        return F.patternMinus(pattern.patterns.map(p => SUBRULE(patternFromSparqlJs, p)), F.gen());
      case 'graph':
        return F.patternGraph(
          <SparqlJsTermToTraqula<typeof pattern.name>> SUBRULE(termFromSparqlJs, pattern.name),
          pattern.patterns.map(p => SUBRULE(patternFromSparqlJs, p)),
          F.gen(),
        );
      case 'service':
        return F.patternService(
          <SparqlJsTermToTraqula<typeof pattern.name>> SUBRULE(termFromSparqlJs, pattern.name),
          pattern.patterns.map(p => SUBRULE(patternFromSparqlJs, p)),
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
