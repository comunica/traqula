import type * as RDF from '@rdfjs/types';
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
import { isSparqlJsTerm } from './core.js';

/**
 * Returns a term's `termType`, inferring it from the term's shape when it is missing.
 * @param term - A SPARQL.js (RDF/JS) term, possibly without `termType`.
 * @returns The (inferred) term type.
 */
export const inferSparqlJsTermType: SparqlJsCompatIndir<'inferSparqlJsTermType', RDF.Term['termType'], [object]> = {
  name: 'inferSparqlJsTermType',
  fun: () => (_, term) => {
    // `termType` is lost when a term comes from JSON, a spread (`{ ...term }`) or a hand-built fragment,
    // as some RDF/JS implementations define it as a getter rather than an own property.
    const fields = <{ termType?: unknown; value?: unknown }> term;
    if (typeof fields.termType === 'string') {
      return <RDF.Term['termType']> fields.termType;
    }
    if ('subject' in term && 'predicate' in term && 'object' in term) {
      return 'Quad';
    }
    // An RDF/JS literal always has both keys; `direction` is RDF 1.2 and needs no check.
    if ('datatype' in term || 'language' in term) {
      return 'Literal';
    }
    if (typeof fields.value === 'string') {
      // The SPARQL.js parser prefixes blank node labels with `e_` (explicit) or `g_` (generated).
      if (/^[eg]_/u.test(fields.value)) {
        return 'BlankNode';
      }
      if (/^[a-z][a-z\d+.-]*:/iu.test(fields.value)) {
        return 'NamedNode';
      }
    }
    // Other blank node labels cannot be told apart from variables.
    return 'Variable';
  },
};

/**
 * Converts a SPARQL.js (RDF/JS) term, tolerating a missing `termType`.
 */
export const termFromSparqlJs: SparqlJsCompatIndir<'termFromSparqlJs', Term, [SparqlJs.Term]> = {
  name: 'termFromSparqlJs',
  fun: ({ SUBRULE }) => ({ astFactory: F }, term) => {
    const termType = SUBRULE(inferSparqlJsTermType, term);
    switch (termType) {
      case 'NamedNode':
        return F.termNamed(F.gen(), (<SparqlJs.IriTerm> term).value);
      case 'Variable':
        return F.termVariable((<SparqlJs.VariableTerm> term).value, F.gen());
      case 'BlankNode': {
        // `termBlank` adds its own `e_` prefix, so strip the SPARQL.js one to avoid `e_e_b0`.
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
 * Converts a SPARQL.js property path or plain predicate IRI.
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
      // The negated set is always the single item: an IRI, an inverse, or a nested '|' path.
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
