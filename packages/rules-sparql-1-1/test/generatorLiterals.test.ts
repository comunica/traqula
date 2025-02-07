/* eslint-disable require-unicode-regexp,no-control-regex,unicorn/better-regex */
import { Builder, createToken, GeneratorBuilder, LexerBuilder } from '@traqula/core';
import { describe, it } from 'vitest';
import type { SparqlContext, SparqlRule } from '../lib';
import * as l from '../lib/lexer';
import type { IriTerm, LiteralTerm, PrefixedIriTerm, WS, WTO, WTOS } from '../lib/RoundTripTypes';

/**
 * In order to keep the complexity of the parser down (maxLookahead),
 * we need to track whitespace and comments as a single token.
 */
const ignoredSpace = createToken({ name: 'Ws', pattern: /(?:[\u0020\u0009\u000D\u000A]|#[^\n]*\n)+/ });

function isWS(x: WTO): x is WS {
  return 'ws' in x;
}

/**
 * Parses whitespace and comments. - Subrule needs to be called before every CONSUME!
 */
const white: SparqlRule<'wtos', WTOS> = <const> {
  name: 'wtos',
  impl: ({ ACTION, CONSUME, OPTION }) => () => {
    const image = OPTION(() => CONSUME(ignoredSpace).image);
    return ACTION(() => {
      if (image === undefined) {
        return [];
      }
      const res: WTOS = [];
      let iter = image;
      while (iter) {
        const [ _, ws, comment ] = /^(?:([\u0020\u0009\u000D\u000A]+)|(#[^\n]*\n)).*/.exec(iter)!;
        if (ws) {
          res.push({ ws });
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
  gImpl: () => ast => ast.map(x => isWS(x) ? x.ws : `${x.comment}\n`).join(''),
};

/**
 * Parses a string literal.
 * [[135]](https://www.w3.org/TR/sparql11-query/#rString)
 */
const string: SparqlRule<'string', { value: string; image: string }> = <const> {
  name: 'string',
  impl: ({ ACTION, CONSUME, OR }) => () => {
    let image = '';
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
    return ACTION(() => ({
      value: rawString.replaceAll(/\\([tnrbf"'\\])/gu, (_, char: string) => {
        switch (char) {
          case 't': return '\t';
          case 'n': return '\n';
          case 'r': return '\r';
          case 'b': return '\b';
          case 'f': return '\f';
          default: return char;
        }
      }),
      image,
    }));
  },
  gImpl: () => ast => ast.image,
};

/**
 * Parses a named node, either as an IRI or as a prefixed name.
 * [[136]](https://www.w3.org/TR/sparql11-query/#riri)
 */
const iri: SparqlRule<'iri', IriTerm> = <const> {
  name: 'iri',
  impl: ({ SUBRULE, CONSUME, OR }) => () => OR<IriTerm>([
    { ALT: () => {
      const iriVal = CONSUME(l.terminals.iriRef).image.slice(1, -1);
      return {
        type: 'term',
        termType: 'NamedNode',
        value: iriVal,
        prefix: undefined,
      };
    } },
    { ALT: () => SUBRULE(prefixedName, undefined) },
  ]),
  gImpl: ({ SUBRULE }) => ast => ast.prefix ?
    SUBRULE(prefixedName, ast, undefined) :
`<${ast.value}>`,
};

/**
 * Parses a named node with a prefix. Looks up the prefix in the context and returns the full IRI.
 * [[137]](https://www.w3.org/TR/sparql11-query/#rPrefixedName)
 */
export const prefixedName: SparqlRule<'prefixedName', PrefixedIriTerm> = <const> {
  name: 'prefixedName',
  impl: ({ ACTION, CONSUME, OR }) => () => OR([
    { ALT: () => {
      const longname = CONSUME(l.terminals.pNameLn).image;
      return ACTION(() => {
        const [ prefix, localName ] = longname.split(':');
        return {
          type: 'term',
          termType: 'NamedNode',
          value: localName,
          prefix,
        };
      });
    } },
    { ALT: () => ({
      type: 'term',
      termType: 'NamedNode',
      value: '',
      prefix: CONSUME(l.terminals.pNameNs).image.slice(0, -1),
    }) },
  ]),
  gImpl: () => ast => `${ast.prefix}:${ast.value}`,
};

const rdfLiteral: SparqlRule<'rdfLiteral', LiteralTerm> = <const> {
  name: 'rdfLiteral',
  impl: ({ SUBRULE1, SUBRULE2, CONSUME, OPTION, OR }) => () => {
    const value = SUBRULE1(string, undefined);
    const result: LiteralTerm = {
      type: 'term',
      termType: 'Literal',
      value: value.value,
      langOrIri: undefined,
      RTT: {
        valueImage: value.image,
        w1: undefined,
        w2: undefined,
      },
    };
    OPTION(() => {
      result.RTT.w1 = SUBRULE1(white, undefined);
      OR([
        { ALT: () => result.langOrIri = CONSUME(l.terminals.langTag).image.slice(1) },
        {
          ALT: () => {
            CONSUME(l.symbols.hathat);
            result.RTT.w2 = SUBRULE2(white, undefined);
            result.langOrIri = SUBRULE1(iri, undefined);
          },
        },
      ]);
    });
    return result;
  },
  gImpl: ({ SUBRULE }) => (ast) => {
    const builder: string[] = [ SUBRULE(string, { value: ast.value, image: ast.RTT.valueImage }, undefined) ];
    if (ast.langOrIri) {
      builder.push(SUBRULE(white, ast.RTT.w1!, undefined));
      if (typeof ast.langOrIri === 'string') {
        builder.push(`@${ast.langOrIri}`);
      } else {
        builder.push('^^', SUBRULE(white, ast.RTT.w2!, undefined), SUBRULE(iri, ast.langOrIri, undefined));
      }
    }
    return builder.join('');
  },
};

describe('generatorLiterals', () => {
  const parserBuilder = Builder.createBuilder(<const> [ white, string, iri, prefixedName, rdfLiteral ]);
  const generatorBuilder = GeneratorBuilder.createBuilder(<const> [ white, string, iri, prefixedName, rdfLiteral ]);
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
  );
  const parser = parserBuilder.consumeToParser({
    tokenVocabulary: lexerBuilder.build(),
  });
  const generator = generatorBuilder.build();

  function testRoundTrip(input: string): void {
    it(`can round trip ${input}`, ({ expect }) => {
      const ast = parser.rdfLiteral(input, <SparqlContext> {}, undefined);
      const gen = generator.rdfLiteral(ast, undefined, undefined);
      expect(gen).toBe(input);
    });
  }

  testRoundTrip(`"I am"@en`);
  testRoundTrip(`"I am" # what am I?
   @en`);
  testRoundTrip(`"I am" ^^
<ns:>`);
  testRoundTrip(`"I am"^^<ns:>`);
});
