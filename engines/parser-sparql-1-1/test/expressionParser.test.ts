import type { Expression, SparqlContext } from '@traqula/rules-sparql-1-1';
import { TraqulaFactory, completeParseContext, lex as l } from '@traqula/rules-sparql-1-1';
import { describe, it } from 'vitest';
import { expressionParserBuilder } from '../lib';

describe('a SPARQL 1.1 expression parser', () => {
  const F = new TraqulaFactory();
  function parse(query: string, context: Partial<SparqlContext>): Expression {
    const parser = expressionParserBuilder.consumeToParser({
      tokenVocabulary: l.sparql11Tokens.build(),
    });
    return parser.builtInStr(query, completeParseContext(context), undefined);
  }
  const context = { prefixes: { ex: 'http://example.org/' }};

  it('builtin', ({ expect }) => {
    const res = parse(`
#a
STR
#b
(?x
)`, context);
    expect(res).toEqual(F.expressionOperation({ args: [ F.variable([], '?x') ], img1: 'STR', ignored: [
      [ F.blankSpace('\n'), F.comment('a') ],
      [ F.blankSpace('\n'), F.comment('b') ],
      [ F.blankSpace('\n') ],
    ]}));
  });
});
