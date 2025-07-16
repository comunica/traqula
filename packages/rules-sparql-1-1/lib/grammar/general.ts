import { CommonIRIs } from '../grammar-helpers/utils';
import * as l from '../lexer';
import type {
  ContextDefinition,
  ContextDefinitionBase,
  ContextDefinitionPrefix,
  GraphTerm,
  Term,
  TermIri,
  TermVariable,
} from '../RoundTripTypes';
import type { SparqlGrammarRule, SparqlRule } from '../Sparql11types';
import { blankNode, booleanLiteral, iri, iriFull, numericLiteral, rdfLiteral, verbA } from './literals';

/**
 * [[4]](https://www.w3.org/TR/sparql11-query/#rPrologue)
 */
export const prologue: SparqlRule<'prologue', ContextDefinition[]> = <const> {
  name: 'prologue',
  impl: ({ SUBRULE, MANY, OR }) => () => {
    const result: ContextDefinition[] = [];
    MANY(() => OR([
      { ALT: () => result.push(SUBRULE(baseDecl, undefined)) },
      // TODO: the [spec](https://www.w3.org/TR/sparql11-query/#iriRefs) says you cannot redefine prefixes.
      //  We might need to check this.
      { ALT: () => result.push(SUBRULE(prefixDecl, undefined)) },
    ]));
    return result;
  },
  gImpl: ({ SUBRULE }) => (ast, { factory: F }) => {
    for (const context of ast) {
      if (F.isContextDefinitionBase(context)) {
        SUBRULE(baseDecl, context, undefined);
      } else if (F.isContextDefinitionPrefix(context)) {
        SUBRULE(prefixDecl, context, undefined);
      }
    }
  },
};

/**
 * Registers base IRI in the context and returns it.
 * [[5]](https://www.w3.org/TR/sparql11-query/#rBaseDecl)
 */
export const baseDecl: SparqlRule<'baseDecl', ContextDefinitionBase> = <const> {
  name: 'baseDecl',
  impl: ({ ACTION, CONSUME, SUBRULE }) => (C) => {
    const base = CONSUME(l.baseDecl);
    const val = SUBRULE(iriFull, undefined);
    return ACTION(() => C.factory.contextDefinitionBase(C.factory.sourceLocation(base, val), val));
  },
  gImpl: ({ SUBRULE, PRINT_WORD }) => (ast, { factory: F }) => {
    F.printFilter(ast, () => PRINT_WORD('BASE'));
    SUBRULE(iri, ast.value, undefined);
  },
};

/**
 * Registers prefix in the context and returns registered key-value-pair.
 * [[6]](https://www.w3.org/TR/sparql11-query/#rPrefixDecl)
 */
export const prefixDecl: SparqlRule<'prefixDecl', ContextDefinitionPrefix> = <const> {
  name: 'prefixDecl',
  impl: ({ ACTION, CONSUME, SUBRULE }) => (C) => {
    const prefix = CONSUME(l.prefixDecl);
    const name = CONSUME(l.terminals.pNameNs).image.slice(0, -1);
    const value = SUBRULE(iriFull, undefined);

    return ACTION(() => C.factory.contextDefinitionPrefix(C.factory.sourceLocation(prefix, value), name, value));
  },
  gImpl: ({ SUBRULE, PRINT_WORDS }) => (ast, { factory: F }) => {
    F.printFilter(ast, () => {
      PRINT_WORDS('PREFIX', `${ast.key}:`);
    });
    SUBRULE(iri, ast.value, undefined);
  },
};

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
  gImpl: ({ PRINT_WORD }) => (ast, { factory: F }) => {
    F.printFilter(ast, () => PRINT_WORD(`?${ast.value}`));
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
        C.factory.namedNode(C.factory.sourceLocation(tokenNil), CommonIRIs.NIL));
    } },
  ]),
  gImpl: ({ SUBRULE }) => (ast, { factory: F }) => {
    if (F.isTermNamed(ast)) {
      SUBRULE(iri, ast, undefined);
    } else if (F.isTermLiteral(ast)) {
      SUBRULE(rdfLiteral, ast, undefined);
    } else if (F.isTermBlank(ast)) {
      SUBRULE(blankNode, ast, undefined);
    }
  },
};
