import type {
  PatternValues,
  Quads,
  TripleNesting,
  ValuePatternRow,
} from '@traqula/rules-sparql-1-1';
import type * as SparqlJs from 'sparqljs';
import type { SparqlJsCompatIndir, SparqlJsTermToTraqula } from './core.js';
import { isSparqlJsTerm, stripLeadingQuestionMark } from './core.js';
import { inferSparqlJsTermType, pathFromSparqlJs, termFromSparqlJs } from './term.js';

/**
 * Converts a single SPARQL.js triple.
 */
export const tripleFromSparqlJs: SparqlJsCompatIndir<'tripleFromSparqlJs', TripleNesting, [SparqlJs.Triple]> = {
  name: 'tripleFromSparqlJs',
  fun: ({ SUBRULE }) => (context, triple) => {
    const { astFactory: F } = context;
    const predicate = isSparqlJsTerm(triple.predicate) ?
      <SparqlJsTermToTraqula<typeof triple.predicate>> SUBRULE(termFromSparqlJs, triple.predicate) :
      SUBRULE(pathFromSparqlJs, triple.predicate);
    return F.triple(
      SUBRULE(termFromSparqlJs, triple.subject),
      predicate,
      SUBRULE(termFromSparqlJs, triple.object),
      F.gen(),
    );
  },
};

/**
 * Converts the quad blocks of INSERT/DELETE data.
 */
export const quadsFromSparqlJs: SparqlJsCompatIndir<'quadsFromSparqlJs', Quads[], [SparqlJs.Quads[]]> = {
  name: 'quadsFromSparqlJs',
  fun: ({ SUBRULE }) => (context, quads) => {
    const { astFactory: F } = context;
    return quads.map((quad) => {
      if (quad.type === 'bgp') {
        return F.patternBgp(quad.triples.map(triple => SUBRULE(tripleFromSparqlJs, triple)), F.gen());
      }
      return F.graphQuads(
        <SparqlJsTermToTraqula<typeof quad.name>> SUBRULE(termFromSparqlJs, quad.name),
        F.patternBgp(quad.triples.map(triple => SUBRULE(tripleFromSparqlJs, triple)), F.gen()),
        F.gen(),
      );
    });
  },
};

/**
 * Converts the rows of a VALUES block. Row keys may start with `?`, as the SPARQL.js parser writes them.
 */
export const valuesPatternFromSparqlJs: SparqlJsCompatIndir<
  'valuesPatternFromSparqlJs',
  PatternValues,
  [SparqlJs.ValuePatternRow[]]
> = {
  name: 'valuesPatternFromSparqlJs',
  fun: ({ SUBRULE }) => (context, rows) => {
    const { astFactory: F } = context;
    const variableNames = rows.length > 0 ? Object.keys(rows[0]) : [];
    const variables = variableNames.map(name => F.termVariable(stripLeadingQuestionMark(name), F.gen()));
    const values: ValuePatternRow[] = rows.map((row) => {
      const convertedRow: ValuePatternRow = {};
      for (const key of Object.keys(row)) {
        const value = row[key];
        if (value === undefined) {
          convertedRow[stripLeadingQuestionMark(key)] = undefined;
        } else {
          if (SUBRULE(inferSparqlJsTermType, value) === 'BlankNode') {
            throw new Error('Blank nodes are not allowed as VALUES bindings in the SPARQL 1.1 grammar');
          }
          convertedRow[stripLeadingQuestionMark(key)] =
            <SparqlJsTermToTraqula<Exclude<typeof value, SparqlJs.BlankTerm>>> SUBRULE(termFromSparqlJs, value);
        }
      }
      return convertedRow;
    });
    return F.patternValues(variables, values, F.gen());
  },
};
