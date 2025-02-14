/* eslint-disable require-unicode-regexp,no-control-regex,unicorn/better-regex */
import type { GeneratorRule } from '@traqula/core';
import { Builder, createToken, GeneratorBuilder, LexerBuilder } from '@traqula/core';
import { describe, it } from 'vitest';
import type { SparqlContext, SparqlRule } from '../lib';
import {
  ignore0,
  ignore1,
  ignore2,
  image1,
  isBS,
  isPrefixedIriTerm,
  literalTerm,
  namedNode,
  wrap,
} from '../lib/factory';
import * as l from '../lib/lexer';
import type {
  IriTermFull,
  Ignored,
  IriTerm,
  ITOS,
  LiteralTermRTT,
  IriTermPrefixed,
  Reconstructed,
} from '../lib/RoundTripTypes';

/**
 * In order to keep the complexity of the parser down (maxLookahead),
 * we need to track whitespace and comments as a single token.
 */
const ignoredSpace = createToken({ name: 'Ws', pattern: /(?:[\u0020\u0009\u000D\u000A]|#[^\n]*\n)+/ });

function genB(subrule: Parameters<GeneratorRule<any, any, ITOS>['gImpl']>[0]['SUBRULE'], ast: ITOS): string {
  return subrule(blank, ast, undefined);
}

/**
 * Parses blank space and comments. - Subrule needs to be called before every CONSUME!
 */
const blank: SparqlRule<'itos', ITOS> = <const> {
  name: 'itos',
  impl: ({ ACTION, CONSUME, OPTION }) => () => {
    const image = OPTION(() => CONSUME(ignoredSpace).image);
    return ACTION(() => {
      if (image === undefined) {
        return [];
      }
      const res: ITOS = [];
      let iter = image;
      while (iter) {
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
  gImpl: () => ast => ast.map(x => isBS(x) ? x.bs : `${x.comment}\n`).join(''),
};

/**
 * Parses a string literal.
 * [[135]](https://www.w3.org/TR/sparql11-query/#rString)
 */
const string: SparqlRule<'string', Reconstructed<string>> = <const> {
  name: 'string',
  impl: ({ ACTION, CONSUME, OR, SUBRULE }) => () => {
    let image = '';
    const w0 = SUBRULE(blank, undefined);
    const rawString = OR([
      { ALT: () => {
        image = CONSUME(l.terminals.stringLiteral1).image;
        return image.slice(1, -1);
      } },
      { ALT: () => {
        image = CONSUME(l.terminals.stringLiteral2).image;
        return image.slice(1, -1);
      } },
      { ALT: () => {
        image = CONSUME(l.terminals.stringLiteralLong1).image;
        return image.slice(3, -3);
      } },
      { ALT: () => {
        image = CONSUME(l.terminals.stringLiteralLong2).image;
        return image.slice(3, -3);
      } },
    ]);
    // Handle string escapes (19.7). (19.2 is handled at input level.)
    return ACTION(() => {
      const value = rawString.replaceAll(/\\([tnrbf"'\\])/gu, (_, char: string) => {
        switch (char) {
          case 't':
            return '\t';
          case 'n':
            return '\n';
          case 'r':
            return '\r';
          case 'b':
            return '\b';
          case 'f':
            return '\f';
          default:
            return char;
        }
      });
      return ignore0(image1(wrap(value), image), w0);
    });
  },
  gImpl: ({ SUBRULE: s }) => ast => `${genB(s, ast.i0)}${ast.img1}`,
};

/**
 * Parses a named node, either as an IRI or as a prefixed name.
 * [[136]](https://www.w3.org/TR/sparql11-query/#riri)
 */
const iri: SparqlRule<'iri', Ignored<IriTerm>> = <const> {
  name: 'iri',
  impl: ({ SUBRULE, OR }) => () => OR<Ignored<IriTerm>>([
    { ALT: () => SUBRULE(iriFull, undefined) },
    { ALT: () => SUBRULE(prefixedName, undefined) },
  ]),
  gImpl: ({ SUBRULE }) => (ast) => {
    const { val, i0 } = ast;
    if (isPrefixedIriTerm(val)) {
      return SUBRULE(prefixedName, ignore0(wrap(val), i0), undefined);
    }
    return SUBRULE(iriFull, ignore0(wrap(val), i0), undefined);
  },
};

const iriFull: SparqlRule<'iriFull', Ignored<IriTermFull>> = <const> {
  name: 'iriFull',
  impl: ({ SUBRULE, CONSUME }) => () => {
    const w0 = SUBRULE(blank, undefined);
    const iriVal = CONSUME(l.terminals.iriRef).image.slice(1, -1);
    return ignore0(wrap(namedNode(iriVal, undefined)), w0);
  },
  gImpl: ({ SUBRULE: s }) => ast => `${genB(s, ast.i0)}<${ast.val.value}>`,
};

/**
 * Registers base IRI in the context and returns it.
 * [[5]](https://www.w3.org/TR/sparql11-query/#rBaseDecl)
 */
const baseDecl: SparqlRule<'baseDecl', Reconstructed<IriTermFull, '0' | '1'>> = <const> {
  name: 'baseDecl',
  impl: ({ CONSUME, SUBRULE }) => () => {
    const i0 = SUBRULE(blank, undefined);
    const image = CONSUME(l.baseDecl).image;
    const val = SUBRULE(iriFull, undefined);
    return ignore1(
      image1(wrap(val.val), image),
      i0,
      val.i0,
    );
  },
  gImpl: ({ SUBRULE: s }) => ast =>
    `${genB(s, ast.i0)}${ast.img1}${s(iriFull, ignore0(wrap(ast.val), ast.i1), undefined)}`,
};

/**
 * Parses a named node with a prefix. Looks up the prefix in the context and returns the full IRI.
 * [[137]](https://www.w3.org/TR/sparql11-query/#rPrefixedName)
 */
const prefixedName: SparqlRule<'prefixedName', Ignored<IriTermPrefixed>> = <const> {
  name: 'prefixedName',
  impl: ({ ACTION, CONSUME, SUBRULE, OR }) => () => {
    const w0 = SUBRULE(blank, undefined);
    const node = OR<IriTermPrefixed>([
      { ALT: () => {
        const longName = CONSUME(l.terminals.pNameLn).image;
        return ACTION(() => {
          const [ prefix, localName ] = longName.split(':');
          return namedNode(localName, prefix);
        });
      } },
      { ALT: () => namedNode('', CONSUME(l.terminals.pNameNs).image.slice(0, -1)) },
    ]);
    return ignore0(wrap(node), w0);
  },
  gImpl: ({ SUBRULE: s }) => ast =>
    `${genB(s, ast.i0)}${ast.val.prefix}:${ast.val.value}`,
};

const rdfLiteral: SparqlRule<'rdfLiteral', LiteralTermRTT> = <const> {
  name: 'rdfLiteral',
  impl: ({ SUBRULE1, CONSUME, OPTION, OR }) => () => {
    const value = SUBRULE1(string, undefined);
    const RTT = ignore0(image1({}, value.img1), value.i0);
    return OPTION(() => {
      const i1 = SUBRULE1(blank, undefined);
      return OR<LiteralTermRTT>([
        { ALT: () => {
          const lang = CONSUME(l.terminals.langTag).image.slice(1);
          const RTT = ignore1(image1({}, value.img1), value.i0, i1);
          return { ...literalTerm(value.val, lang), RTT };
        } },
        {
          ALT: () => {
            CONSUME(l.symbols.hathat);
            const iriAndW = SUBRULE1(iri, undefined);
            const RTT = ignore2(image1({}, value.img1), value.i0, i1, iriAndW.i0);
            return { ...literalTerm(value.val, iriAndW.val), RTT };
          },
        },
      ]);
    }) ?? { ...literalTerm(value.val, undefined), RTT };
  },
  gImpl: ({ SUBRULE }) => (ast) => {
    const builder: string[] = [
      SUBRULE(string, ignore0(image1(wrap(ast.value), ast.RTT.img1), ast.RTT.i0), undefined),
    ];
    if (ast.langOrIri !== undefined) {
      builder.push(genB(SUBRULE, ast.RTT.i1));
      if (typeof ast.langOrIri === 'string') {
        builder.push(`@${ast.langOrIri}`);
      } else {
        builder.push('^^', SUBRULE(iri, ignore0(wrap(ast.langOrIri), ast.RTT.i2), undefined));
      }
    }
    return builder.join('');
  },
};

const literalOrBase: SparqlRule<'literalOrBase', LiteralTermRTT | Reconstructed<IriTermFull, '0' | '1'>> = <const> {
  name: 'literalOrBase',
  impl: ({ SUBRULE, OR }) => () => OR<LiteralTermRTT | Reconstructed<IriTermFull, '0' | '1'>>([
    { ALT: () => SUBRULE(rdfLiteral, undefined) },
    { ALT: () => SUBRULE(baseDecl, undefined) },
  ]),
  gImpl: ({ SUBRULE }) => ast =>
    'type' in ast ? SUBRULE(rdfLiteral, ast, undefined) : SUBRULE(baseDecl, ast, undefined),
};

describe('generatorLiterals', () => {
  const rules = <const> [
    blank,
    string,
    iri,
    iriFull,
    prefixedName,
    rdfLiteral,
    baseDecl,
    literalOrBase,
  ];
  const parserBuilder = Builder.createBuilder(rules);
  const generatorBuilder = GeneratorBuilder.createBuilder(rules);
  const lexerBuilder = LexerBuilder.create().add(
    ignoredSpace,
    l.terminals.stringLiteral1,
    l.terminals.stringLiteral2,
    l.terminals.stringLiteralLong1,
    l.terminals.stringLiteralLong2,
    l.terminals.iriRef,
    l.terminals.pNameLn,
    l.terminals.pNameNs,
    l.terminals.langTag,
    l.symbols.hathat,
    l.baseDecl,
  );
  const parser = parserBuilder.consumeToParser({
    tokenVocabulary: lexerBuilder.build(),
  });
  const generator = generatorBuilder.build();

  function testRoundTrip(input: string): void {
    it(`can round trip ${input}`, ({ expect }) => {
      const ast = parser.literalOrBase(input, <SparqlContext> {}, undefined);
      const gen = generator.literalOrBase(ast, undefined, undefined);
      expect(gen).toBe(input);
    });
  }

  // TestRoundTrip(`'I am'`);
  testRoundTrip(`"I am"@en`);
  testRoundTrip(`"I am" # what am I?
   @en`);
  testRoundTrip(`"I am" ^^
<ns:>`);
  testRoundTrip(`"I am"^^<ns:>`);
  testRoundTrip(`   
  BAse <http://example.org/>`);
});
