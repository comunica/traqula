/* eslint-disable require-unicode-regexp */
import { Builder, createToken, LexerBuilder } from '@traqula/core';
import type { SparqlContext, SparqlGrammarRule } from '@traqula/rules-sparql-1-1';
import { completeParseContext } from '@traqula/rules-sparql-1-1';
import { describe, it } from 'vitest';

export const lexA = createToken({ name: 'lexA', pattern: /a/i, label: 'a' });
export const lexC = createToken({ name: 'lexC', pattern: /c/i, label: 'c' });
export const lexD = createToken({ name: 'lexD', pattern: /d/i, label: 'd' });
export const lexE = createToken({ name: 'lexE', pattern: /e/i, label: 'e' });
export const lexF = createToken({ name: 'lexF', pattern: /f/i, label: 'f' });

const gramB: SparqlGrammarRule<'gramB', 'gramB'> = {
  name: 'gramB',
  impl: ({ CONSUME, SUBRULE, MANY }) => () => {
    CONSUME(lexC);
    MANY(() => {
      SUBRULE(gramD, undefined);
      CONSUME(lexE);
    });
    return 'gramB';
  },
};

const gramD: SparqlGrammarRule<'gramD', 'gramD'> = {
  name: 'gramD',
  impl: ({ CONSUME, OPTION }) => () => {
    OPTION(() => CONSUME(lexD));
    return 'gramD';
  },
};

// A B(C (opt(D) E)*) opt(D) F    -- ACDF
const gramMain: SparqlGrammarRule<'gramMain', 'gramMain'> = {
  name: 'gramMain',
  impl: ({ SUBRULE, CONSUME }) => () => {
    CONSUME(lexA);
    SUBRULE(gramB, undefined);
    SUBRULE(gramD, undefined);
    CONSUME(lexF);
    return 'gramMain';
  },
};

describe('a SPARQL 1.1 expression parser', () => {
  function parse(query: string, context: Partial<SparqlContext>): string {
    const parser = Builder.createBuilder(<const> [
      gramMain,
      gramB,
      gramD,
    ]).consumeToParser({
      tokenVocabulary: LexerBuilder.create().add(lexA, lexC, lexD, lexE, lexF).build(),
    });
    return parser.gramMain(query, completeParseContext(context), undefined);
  }
  const context = { prefixes: { ex: 'http://example.org/' }};

  it('bug recreation', ({ expect }) => {
    const res = parse(`ACDF`, context);
    expect(res).toEqual('gramMain');
  });
});
