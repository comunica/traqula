import type { GeneratorRule } from '@traqula/core';
import { TraqulaFactory } from '../factory';
import { CommonIRIs, resolveIRI } from '../grammar-helpers/utils';
import * as l from '../lexer';
import type { FullIriTerm } from '../RoundTripTypes';
import type {
  GraphTerm,
  Term,
  VerbA,
  IriTerm,
  VariableTerm,
  BaseQuery,
  SparqlGrammarRule,
  SparqlRule,
} from '../Sparql11types';
import type { ITOS, Reconstructed } from '../TypeHelpersRTT';
import { blankNode, booleanLiteral, iri, iriFull, numericLiteral, rdfLiteral } from './literals';

const F = new TraqulaFactory();

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
  gImpl: () => ast => ast.map(x => F.isBS(x) ? x.bs : `${x.comment}\n`).join(''),
};

/**
 * [[4]](https://www.w3.org/TR/sparql11-query/#rPrologue)
 */
export const prologue: SparqlRule<'prologue', Pick<BaseQuery, 'base' | 'prefixes'>> = <const> {
  name: 'prologue',
  impl: ({ ACTION, SUBRULE, MANY, OR }) => (C) => {
    const result: Pick<BaseQuery, 'base' | 'prefixes'> = ACTION(() => ({
      prefixes: {},
      ...(C.baseIRI && { base: C.baseIRI }),
    }));
    MANY(() => {
      OR([
        {
          ALT: () => {
            const base = SUBRULE(baseDecl, undefined);
            ACTION(() => result.base = base);
          },
        },
        {
          ALT: () => {
            // TODO: the [spec](https://www.w3.org/TR/sparql11-query/#iriRefs) says you cannot redefine prefixes.
            //  We might need to check this.
            const pref = SUBRULE(prefixDecl, undefined);
            ACTION(() => {
              const [ name, value ] = pref;
              result.prefixes[name] = value;
            });
          },
        },
      ]);
    });
    return result;
  },
  gImpl: () => (ast) => {
    const rules: string[] = [];
    if (ast.base) {
      rules.push(`BASE <${ast.base}>`);
    }
    // eslint-disable-next-line ts/no-unnecessary-type-assertion
    for (const [ key, value ] of <[string, string][]> Object.entries(ast.prefixes)) {
      rules.push(`PREFIX ${key}: <${value}>`);
    }
    return rules.join(' ');
  },
};

/**
 * Registers base IRI in the context and returns it.
 * [[5]](https://www.w3.org/TR/sparql11-query/#rBaseDecl)
 */
const baseDecl: SparqlRule<'baseDecl', Reconstructed<FullIriTerm, '0' | '1'>> = <const> {
  name: 'baseDecl',
  impl: ({ CONSUME, SUBRULE }) => () => {
    const i0 = SUBRULE(blank, undefined);
    const image = CONSUME(l.baseDecl).image;
    const val = SUBRULE(iriFull, undefined);
    return F.ignores(
      F.image(F.wrap(val.val), image),
      i0,
      val.i0,
    );
  },
  gImpl: ({ SUBRULE: s }) => ast =>
    `${genB(s, ast.i0)}${ast.img1}${s(iriFull, F.ignores(F.wrap(ast.val), ast.i1), undefined)}`,
};

/**
 * Registers prefix in the context and returns registered key-value-pair.
 * [[6]](https://www.w3.org/TR/sparql11-query/#rPrefixDecl)
 */
export const prefixDecl: SparqlGrammarRule<'prefixDecl', [string, string]> = <const> {
  name: 'prefixDecl',
  impl: ({ CONSUME, ACTION }) => (C) => {
    CONSUME(l.prefixDecl);
    const name = CONSUME(l.terminals.pNameNs).image.slice(0, -1);
    const value = CONSUME(l.terminals.iriRef).image.slice(1, -1);

    return ACTION(() => {
      const fullIri = resolveIRI(value, C.baseIRI);
      C.prefixes[name] = fullIri;
      return [ name, fullIri ];
    });
  },
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

export const verbA: SparqlGrammarRule<'VerbA', VerbA> = <const> {
  name: 'VerbA',
  impl: ({ ACTION, CONSUME }) => (C) => {
    CONSUME(l.a);
    return ACTION(() => C.factory.namedNode(CommonIRIs.TYPE));
  },
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
