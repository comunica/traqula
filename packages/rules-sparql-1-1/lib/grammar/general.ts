import { CommonIRIs } from '../grammar-helpers/utils';
import * as l from '../lexer';
import type { GraphTerm, Term, TermIri, TermVariable } from '../RoundTripTypes';
import type { SparqlGrammarRule, SparqlRule } from '../Sparql11types';
import { blankNode, booleanLiteral, iri, numericLiteral, rdfLiteral, verbA } from './literals';

/**
 * [[78]](https://www.w3.org/TR/sparql11-query/#rVerb)
 */
export const verb: SparqlGrammarRule<'verb', TermVariable | TermIri> = <const> {
  name: 'verb',
  impl: ({ SUBRULE, OR }) => () => OR([
    { ALT: () => SUBRULE(varOrIri, undefined) },
    { ALT: () => SUBRULE(verbA, undefined) },
  ]),
};

/**
 * [[106]](https://www.w3.org/TR/sparql11-query/#rVarOrTerm)
 */
export const varOrTerm: SparqlRule<'varOrTerm', Term> = <const> {
  name: 'varOrTerm',
  impl: ({ SUBRULE, OR }) => C => OR<Term>([
    { GATE: () => C.parseMode.has('canParseVars'), ALT: () => SUBRULE(var_, undefined) },
    { ALT: () => SUBRULE(graphTerm, undefined) },
  ]),
  gImpl: ({ SUBRULE }) => (ast, { factory: F }) => {
    if (F.isTermVariable(ast)) {
      return SUBRULE(var_, ast, undefined);
    }
    return SUBRULE(graphTerm, ast, undefined);
  },
};

/**
 * [[107]](https://www.w3.org/TR/sparql11-query/#rVarOrIri)
 */
export const varOrIri: SparqlGrammarRule<'varOrIri', TermIri | TermVariable> = <const> {
  name: 'varOrIri',
  impl: ({ SUBRULE, OR }) => C => OR<TermIri | TermVariable>([
    { GATE: () => C.parseMode.has('canParseVars'), ALT: () => SUBRULE(var_, undefined) },
    { ALT: () => SUBRULE(iri, undefined) },
  ]),
};

/**
 * [[108]](https://www.w3.org/TR/sparql11-query/#rVar)
 */
export const var_: SparqlRule<'var', TermVariable> = <const> {
  name: 'var',
  impl: ({ ACTION, CONSUME, OR }) => (C) => {
    const varToken = OR([
      { ALT: () => CONSUME(l.terminals.var1) },
      { ALT: () => CONSUME(l.terminals.var2) },
    ]);
    return ACTION(() => C.factory.variable(varToken.image.slice(1), C.factory.sourceLocation(varToken)));
  },
  gImpl: ({ PRINT_WORD }) => (ast) => {
    if (!ast.loc) {
      PRINT_WORD('?', ast.value);
    }
  },
};

/**
 * [[109]](https://www.w3.org/TR/sparql11-query/#rGraphTerm)
 */
export const graphTerm: SparqlRule<'graphTerm', GraphTerm> = <const> {
  name: 'graphTerm',
  impl: ({ ACTION, SUBRULE, CONSUME, OR }) => C => OR<GraphTerm>([
    { ALT: () => SUBRULE(iri, undefined) },
    { ALT: () => SUBRULE(rdfLiteral, undefined) },
    { ALT: () => SUBRULE(numericLiteral, undefined) },
    { ALT: () => SUBRULE(booleanLiteral, undefined) },
    { GATE: () => C.parseMode.has('canCreateBlankNodes'), ALT: () => SUBRULE(blankNode, undefined) },
    { ALT: () => {
      const tokenNil = CONSUME(l.terminals.nil);
      return ACTION(() =>
        C.factory.namedNode(CommonIRIs.NIL, undefined, C.factory.sourceLocation(tokenNil)));
    } },
  ]),
  gImpl: ({ SUBRULE }) => (ast, { factory: F }) => {
    if (F.isTermIri(ast)) {
      return SUBRULE(iri, ast, undefined);
    }
    if (F.isTermLiteral(ast)) {
      return SUBRULE(rdfLiteral, ast, undefined);
    }
    return SUBRULE(blankNode, ast, undefined);
  },
};
