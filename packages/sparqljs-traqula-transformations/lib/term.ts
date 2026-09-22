import { CommonIRIs } from '@traqula/rules-sparql-1-1';
import type {
  Path,
  PathAlternativeLimited,
  PathNegatedElt,
  Term,
  TermIri,
} from '@traqula/rules-sparql-1-1';
import type * as SparqlJs from 'sparqljs';
import type { SparqlJsCompatIndir, SparqlJsTermToTraqula } from './core.js';
import { inferSparqlJsTermType, isSparqlJsTerm } from './core.js';

/**
 * Converts a single sparqljs (rdfjs-shaped) term into a Traqula {@link Term}.
 * Suitable for use on values coming from an rdfjs-compatible datastore, not only from sparqljs itself.
 * Tolerates a missing `termType` (see {@link inferSparqlJsTermType}).
 */
export const termFromSparqlJs: SparqlJsCompatIndir<'termFromSparqlJs', Term, [SparqlJs.Term]> = {
  name: 'termFromSparqlJs',
  fun: () => ({ astFactory: F }, term) => {
    const termType = inferSparqlJsTermType(term);
    switch (termType) {
      case 'NamedNode':
        return F.termNamed(F.gen(), (<SparqlJs.IriTerm> term).value);
      case 'Variable':
        return F.termVariable((<SparqlJs.VariableTerm> term).value, F.gen());
      case 'BlankNode': {
        // Strip sparqljs' own 'e_'/'g_' prefix before handing the label to termBlank, which re-applies
        // its own 'e_' prefix - otherwise explicit labels would double up (`_:b0` becoming `e_e_b0`).
        const label = (<SparqlJs.BlankTerm> term).value.replace(/^[eg]_/u, '');
        return F.termBlank(label, F.gen());
      }
      case 'Literal': {
        const literal = <SparqlJs.LiteralTerm> term;
        if (literal.language) {
          return F.termLiteral(F.gen(), literal.value, literal.language);
        }
        if (literal.datatype && literal.datatype.value !== CommonIRIs.STRING) {
          return F.termLiteral(F.gen(), literal.value, F.termNamed(F.gen(), literal.datatype.value));
        }
        return F.termLiteral(F.gen(), literal.value);
      }
      default:
        throw new Error(
          `Cannot convert sparqljs term of termType '${termType}' to a Traqula term ` +
          `(SPARQL-star quoted triples are not supported by @traqula/sparqljs-traqula-transformations)`,
        );
    }
  },
};

/**
 * Converts a sparqljs property path (or plain predicate IRI) into a Traqula {@link Path}.
 */
export const pathFromSparqlJs: SparqlJsCompatIndir<
  'pathFromSparqlJs',
  Path,
  [SparqlJs.IriTerm | SparqlJs.PropertyPath]
> = {
  name: 'pathFromSparqlJs',
  fun: ({ SUBRULE }) => (context, item) => {
    const { astFactory: F } = context;
    if (isSparqlJsTerm(item)) {
      return <SparqlJsTermToTraqula<typeof item>> SUBRULE(termFromSparqlJs, item);
    }
    if (item.pathType === '!') {
      // Sparqljs always wraps a negated property set's content as the single element of `items`, whether
      // it is a plain IRI (`!ex:p`), an inverse (`!^ex:p`) or an alternative list (`!(ex:p1|^ex:p2)`, itself
      // represented as a nested `{ pathType: '|', ... }` node) - never as a flattened array of alternatives.
      const [ child ] = item.items;
      const converted = <TermIri | PathNegatedElt | PathAlternativeLimited> SUBRULE(pathFromSparqlJs, child);
      return F.path('!', [ converted ], F.gen());
    }
    if (item.pathType === '?' || item.pathType === '*' || item.pathType === '+' || item.pathType === '^') {
      const [ child ] = item.items;
      return F.path(item.pathType, [ SUBRULE(pathFromSparqlJs, child) ], F.gen());
    }
    // '|' or '/'
    return F.path(item.pathType, item.items.map(child => SUBRULE(pathFromSparqlJs, child)), F.gen());
  },
};
