import type * as RDF from '@rdfjs/types';
import type { IndirDef } from '@traqula/core';
import type {
  AstFactory as AstFactoryType,
  Pattern,
  PatternGroup,
  TermBlank,
  TermIri,
  TermLiteral,
  TermVariable,
} from '@traqula/rules-sparql-1-1';
import { AstFactory } from '@traqula/rules-sparql-1-1';
import type * as SparqlJs from 'sparqljs';

/**
 * Context threaded through every conversion rule. Holds the {@link AstFactoryType} used to construct
 * Traqula AST nodes.
 */
export interface SparqlJsCompatContext {
  astFactory: AstFactoryType;
}

export function createSparqlJsCompatContext(): SparqlJsCompatContext {
  return { astFactory: new AstFactory() };
}

export type SparqlJsCompatIndir<Name extends string, Ret, Arg extends any[]> =
  IndirDef<SparqlJsCompatContext, Name, Ret, Arg>;

/**
 * Maps a statically-known sparqljs term type onto the Traqula term type the `termFromSparqlJs` rule
 * produces for it, so call sites can cast its result to the precise type their input guarantees instead
 * of a manually written union (mirrors `RdfTermToAst` in `algebra-transformations-1-1/lib/toAst/general.ts`).
 */
export type SparqlJsTermToTraqula<T extends SparqlJs.Term> = T extends SparqlJs.VariableTerm ? TermVariable :
  T extends SparqlJs.BlankTerm ? TermBlank :
    T extends SparqlJs.LiteralTerm ? TermLiteral :
      T extends SparqlJs.IriTerm ? TermIri : never;

/**
 * Sparqljs itself has no fallback for a missing `termType` - its own generator identifies a term with
 * nothing more than `typeof object.termType === 'string'` and otherwise assumes a property-path node
 * (checking `.items`/`.pathType`), so this heuristic isn't mirroring an existing sparqljs mechanism, it's
 * new behavior. It exists because some rdfjs Term implementations expose `termType` through a
 * non-enumerable/prototype getter rather than an own data property: a *live* instance still passes
 * sparqljs' check fine (plain property access resolves a getter), but the value does not survive a plain
 * object hand-off (JSON round-tripping, `{ ...term }`, `structuredClone`, a hand-built AST fragment, ...)
 * even though every other property does. When `termType` is missing, this infers it from shape instead: a
 * `datatype`/`language` key means a Literal (an RDF.Literal always carries both, so `direction` - an RDF 1.2
 * concept out of scope for SPARQL 1.1 - needs no separate check here), a `subject`/`predicate`/`object`
 * triple of keys means a quoted triple (`Quad`), a `value` starting with `e_`/`g_` means a BlankNode
 * (sparqljs' own internal naming convention), a `value` that looks like an absolute IRI means a NamedNode,
 * and anything else is treated as a Variable. Blank nodes with an arbitrary label cannot be told apart from
 * Variables this way - this is a best-effort fallback for otherwise-unlabelled data, not a substitute for a
 * real termType when you have one.
 */
export function inferSparqlJsTermType(term: object): RDF.Term['termType'] {
  const t = <{ termType?: unknown; value?: unknown; datatype?: unknown; language?: unknown }> term;
  if (typeof t.termType === 'string') {
    return <RDF.Term['termType']> t.termType;
  }
  if ('subject' in term && 'predicate' in term && 'object' in term) {
    return 'Quad';
  }
  if ('datatype' in t || 'language' in t) {
    return 'Literal';
  }
  if (typeof t.value === 'string') {
    if (/^[eg]_/u.test(t.value)) {
      return 'BlankNode';
    }
    if (/^[a-z][a-z\d+.-]*:/iu.test(t.value)) {
      return 'NamedNode';
    }
  }
  return 'Variable';
}

export function isSparqlJsWildcard(value: object): value is SparqlJs.Wildcard {
  const v = <{ termType?: unknown; value?: unknown; expression?: unknown }> value;
  if (typeof v.termType === 'string') {
    return v.termType === 'Wildcard';
  }
  return !('expression' in v) && v.value === '*';
}

/**
 * A term-like leaf (as opposed to a Path/Pattern/Expression/Query/Update structural node, or a
 * VariableExpression-like `{ expression, variable }` wrapper). See {@link inferSparqlJsTermType} for why
 * this cannot simply check for a `termType` key.
 *
 * A bare Wildcard without a `termType` (`{ value: '*' }`) is not special-cased here: every position this
 * is called from can only ever hold a Wildcard when {@link isWildcardVariables} has already matched a
 * single-element `[Wildcard]` array beforehand (SPARQL's grammar never allows `*` to appear anywhere
 * else), so this is never actually reached with one.
 */
export function isSparqlJsTerm(value: object): value is SparqlJs.Term {
  if ('termType' in value) {
    return (<{ termType: unknown }> value).termType !== 'Wildcard';
  }
  const v = <{ value?: unknown; expression?: unknown }> value;
  if ('expression' in v) {
    return false;
  }
  return 'value' in v || ('subject' in value && 'predicate' in value && 'object' in value);
}

export function isWildcardVariables(variables: (object | SparqlJs.Wildcard)[]): variables is [SparqlJs.Wildcard] {
  return variables.length === 1 && isSparqlJsWildcard(variables[0]);
}

export function stripLeadingQuestionMark(name: string): string {
  return name.startsWith('?') ? name.slice(1) : name;
}

/**
 * Sparqljs' `degroupSingle` helper unwraps a `{ ... }` block down to its single inner pattern whenever it
 * contains exactly one (used for UNION branches and EXISTS/NOT EXISTS), so those are not necessarily of
 * type 'group' any more. This re-wraps a converted pattern into a {@link PatternGroup} when needed.
 */
export function ensurePatternGroup(astFactory: AstFactoryType, pattern: Pattern): PatternGroup {
  return astFactory.isPatternGroup(pattern) ? pattern : astFactory.patternGroup([ pattern ], astFactory.gen());
}

export function extractTopLevelBgpTriples(patterns: SparqlJs.Pattern[]): SparqlJs.Triple[] {
  return patterns.filter((pattern): pattern is SparqlJs.BgpPattern => pattern.type === 'bgp')
    .flatMap(pattern => pattern.triples);
}
