import type { GeneratorRule } from '@traqula/core';
import { CommonIRIs } from '../grammar-helpers/utils';
import * as l from '../lexer';
import type { BaseDecl, ContextDefinition, PrefixDecl } from '../RoundTripTypes';
import type {
  GraphTerm,
  Term,
  IriTerm,
  VariableTerm,
  SparqlGrammarRule,
  SparqlRule,
} from '../Sparql11types';
import type { ITOS } from '../TypeHelpersRTT';
import { blankNode, booleanLiteral, iri, iriFull, numericLiteral, rdfLiteral, verbA } from './literals';

export function genB(subrule: Parameters<GeneratorRule<any, any, ITOS>['gImpl']>[0]['SUBRULE'], ast: ITOS): string {
  return subrule(blank, ast, undefined);
}

/**
 * Parses blank space and comments. - Subrule needs to be called before every CONSUME!
 */
export const blank: SparqlRule<'itos', ITOS> = <const> {
  name: 'itos',
  impl: ({ ACTION, CONSUME, OPTION }) => () => {
    const image = OPTION(() => CONSUME(l.terminals.ignoredSpace).image);
    return ACTION(() => {
      if (image === undefined) {
        return [];
      }
      const res: ITOS = [];
      let iter = image;
      while (iter) {
        // eslint-disable-next-line require-unicode-regexp,unicorn/better-regex,no-control-regex
        const [ _, ws, comment ] = /^(?:([\u0020\u0009\u000D\u000A]+)|(#[^\n]*\n)).*/.exec(iter)!;
        if (ws) {
          res.push({ bs: ws });
          iter = iter.slice(ws.length);
        }
        if (comment) {
          res.push({ comment: comment.slice(0, -1) });
          iter = iter.slice(comment.length);
        }
      }
      return res;
    });
  },
  gImpl: () => (ast, { factory: F }) =>
    ast.map(x => F.isBS(x) ? x.bs : `${x.comment}\n`).join(''),
};

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
  gImpl: ({ SUBRULE: s }) => (ast, { factory: F }) =>
    ast.map(rule => F.isBaseDecl(rule) ? s(baseDecl, rule, undefined) : s(prefixDecl, rule, undefined)).join(''),
};

/**
 * Registers base IRI in the context and returns it.
 * [[5]](https://www.w3.org/TR/sparql11-query/#rBaseDecl)
 */
const baseDecl: SparqlRule<'baseDecl', BaseDecl> = <const> {
  name: 'baseDecl',
  impl: ({ CONSUME, SUBRULE }) => ({ factory: F }) => {
    const i0 = SUBRULE(blank, undefined);
    const image = CONSUME(l.baseDecl).image;
    const val = SUBRULE(iriFull, undefined);
    return F.baseDecl(i0, image, val);
  },
  gImpl: ({ SUBRULE: s }) => ast => [
    genB(s, ast.RTT.i0),
    ast.RTT.img1,
    s(iriFull, ast.value, undefined),
  ].join(''),
};

/**
 * Registers prefix in the context and returns registered key-value-pair.
 * [[6]](https://www.w3.org/TR/sparql11-query/#rPrefixDecl)
 */
export const prefixDecl: SparqlRule<'prefixDecl', PrefixDecl> = <const> {
  name: 'prefixDecl',
  impl: ({ CONSUME, SUBRULE, SUBRULE1, SUBRULE2, SUBRULE3 }) => ({ factory: F }) => {
    const i0 = SUBRULE1(blank, undefined);
    const img1 = CONSUME(l.prefixDecl).image;
    const i1 = SUBRULE2(blank, undefined);
    const name = CONSUME(l.terminals.pNameNs).image.slice(0, -1);
    const i2 = SUBRULE3(blank, undefined);
    const value = SUBRULE(iriFull, undefined);

    return F.prefix(i0, img1, i1, i2, name, value);
  },
  gImpl: ({ SUBRULE: s }) => ast => [
    genB(s, ast.RTT.i0),
    ast.RTT.img1,
    genB(s, ast.RTT.i1),
    ast.key,
    ':',
    genB(s, ast.RTT.i2),
    s(iriFull, ast.value, undefined),
  ].join(''),
};

/**
 * [[78]](https://www.w3.org/TR/sparql11-query/#rVerb)
 */
export const verb: SparqlGrammarRule<'verb', VariableTerm | IriTerm> = <const> {
  name: 'verb',
  impl: ({ SUBRULE, OR }) => () => OR([
    { ALT: () => SUBRULE(varOrIri, undefined) },
    {
      ALT: () => SUBRULE(verbA, undefined),
    },
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
  gImpl: ({ SUBRULE }) => (ast) => {
    if (ast.termType === 'Variable') {
      return SUBRULE(var_, ast, undefined);
    }
    if (ast.termType === 'NamedNode') {
      return SUBRULE(iri, <IriTerm> ast, undefined);
    }
    if (ast.termType === 'BlankNode') {
      return SUBRULE(blankNode, ast, undefined);
    }
    return SUBRULE(rdfLiteral, ast, undefined);
  },
};

/**
 * [[107]](https://www.w3.org/TR/sparql11-query/#rVarOrIri)
 */
export const varOrIri: SparqlGrammarRule<'varOrIri', IriTerm | VariableTerm> = <const> {
  name: 'varOrIri',
  impl: ({ SUBRULE, OR }) => C => OR<IriTerm | VariableTerm>([
    { GATE: () => C.parseMode.has('canParseVars'), ALT: () => SUBRULE(var_, undefined) },
    { ALT: () => SUBRULE(iri, undefined) },
  ]),
};

/**
 * [[108]](https://www.w3.org/TR/sparql11-query/#rVar)
 */
export const var_: SparqlRule<'var', VariableTerm> = <const> {
  name: 'var',
  impl: ({ ACTION, CONSUME, OR }) => (C) => {
    const varVal = OR([
      { ALT: () => CONSUME(l.terminals.var1).image.slice(1) },
      { ALT: () => CONSUME(l.terminals.var2).image.slice(1) },
    ]);
    ACTION(() => {
      if (!C.parseMode.has('canParseVars')) {
        throw new Error('Variables are not allowed here');
      }
    });
    return ACTION(() => C.factory.variable(varVal));
  },
  gImpl: () => ast => `?${ast.value}`,
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
    {
      ALT: () => {
        CONSUME(l.terminals.nil);
        return ACTION(() => C.factory.namedNode(CommonIRIs.NIL));
      },
    },
  ]),
  gImpl: ({ SUBRULE }) => (ast) => {
    switch (ast.termType) {
      case 'BlankNode':
        return SUBRULE(blankNode, ast, undefined);
      case 'NamedNode':
        return SUBRULE(iri, ast, undefined);
      case 'Literal':
        return SUBRULE(rdfLiteral, ast, undefined);
    }
  },
};
