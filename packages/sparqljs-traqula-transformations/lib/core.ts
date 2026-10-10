import type { IndirDef } from '@traqula/core';
import type {
  AstFactory as AstFactoryType,
  TermBlank,
  TermIri,
  TermLiteral,
  TermVariable,
} from '@traqula/rules-sparql-1-1';
import { AstFactory } from '@traqula/rules-sparql-1-1';
import type * as SparqlJs from 'sparqljs';

/**
 * Context threaded through every conversion rule.
 */
export interface SparqlJsCompatContext {
  astFactory: AstFactoryType;
  /**
   * Skip the checks Traqula's parser also performs on the resulting AST (blank node label scope).
   */
  skipValidation: boolean;
}

/**
 * Fills in the defaults for any context option that is not set.
 */
export function createSparqlJsCompatContext(context: Partial<SparqlJsCompatContext> = {}): SparqlJsCompatContext {
  return {
    astFactory: context.astFactory ?? new AstFactory(),
    skipValidation: context.skipValidation ?? false,
  };
}

export type SparqlJsCompatIndir<Name extends string, Ret, Arg extends any[]> =
  IndirDef<SparqlJsCompatContext, Name, Ret, Arg>;

/**
 * The Traqula term type `termFromSparqlJs` returns for a given SPARQL.js term type,
 * like `RdfTermToAst` in `algebra-transformations-1-1`.
 */
export type SparqlJsTermToTraqula<T extends SparqlJs.Term> = T extends SparqlJs.VariableTerm ? TermVariable :
  T extends SparqlJs.BlankTerm ? TermBlank :
    T extends SparqlJs.LiteralTerm ? TermLiteral :
      T extends SparqlJs.IriTerm ? TermIri : never;

export function isSparqlJsWildcard(value: object): value is SparqlJs.Wildcard {
  const fields = <{ termType?: unknown; value?: unknown; expression?: unknown }> value;
  if (typeof fields.termType === 'string') {
    return fields.termType === 'Wildcard';
  }
  return !('expression' in fields) && fields.value === '*';
}

/**
 * Whether a value is a term rather than a path, pattern, expression or `{ expression, variable }` wrapper.
 * Does not rely on `termType`, which input that did not come from the SPARQL.js parser may lack.
 */
export function isSparqlJsTerm(value: object): value is SparqlJs.Term {
  // A Wildcard needs no check: it can only occur where `isWildcardVariables` has already matched it.
  if ('termType' in value) {
    return (<{ termType: unknown }> value).termType !== 'Wildcard';
  }
  if ('expression' in value) {
    return false;
  }
  return 'value' in value || ('subject' in value && 'predicate' in value && 'object' in value);
}

export function isWildcardVariables(variables: (object | SparqlJs.Wildcard)[]): variables is [SparqlJs.Wildcard] {
  return variables.length === 1 && isSparqlJsWildcard(variables[0]);
}

export function stripLeadingQuestionMark(name: string): string {
  return name.startsWith('?') ? name.slice(1) : name;
}
