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
    return parser.expression(query, completeParseContext(context), undefined);
  }
  const context = { prefixes: { ex: 'http://example.org/' }};

  const value = [
    `5 + 2
# a
`,
    `STR
#a
(?x
#b
)
#c
`,
    `STR
#a
(?x
#b
)
#c

+ BNoDe ( )
# Lonely
`,
  ];

  it('builtin', ({ expect }) => {
    const res = parse(`5 + 2
# a
`, context);
    expect(res).toEqual(F.expressionOperation({
      img1: 'STR',
      args: [ F.variable([ F.blankSpace('\n'), F.comment('b') ], '?x') ],
      ignored: [
        [ F.blankSpace('\n'), F.comment('a') ],
        [],
        [ F.blankSpace('\n'), F.comment('b') ],
      ],
    }));
  });
});
