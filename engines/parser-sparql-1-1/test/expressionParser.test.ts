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

  // We add the strings in the test files since soo the test files bear witness to the usability of the TraqulaFactory.

  const tests: { query: string; ast: Expression | null; name: string }[] = [{
    name: 'numeric addition',
    query: `5 +  2
# a
`,
    ast: F.expressionOperation({
      img1: '+',
      args: [
        F.literalTerm([ F.blankSpace(' ') ], '5', '5', F.namedNode([], 'http://www.w3.org/2001/XMLSchema#integer')),
        F.literalTerm([
          F.blankSpace('\n'),
          F.comment(' a'),
        ], '2', '2', F.namedNode([], 'http://www.w3.org/2001/XMLSchema#integer')),
      ],
      ignored: [[ F.blankSpace('  ') ]],
    }),
  }, {
    name: 'simple str call',
    query: `sTR
#a
(?x
#b
)
#c
`,
    ast: F.expressionOperation({
      img1: 'sTR',
      ignored: [
        [ F.blankSpace('\n'), F.comment('a') ],
        [],
        [ F.blankSpace('\n'), F.comment('c') ],
      ],
      args: [
        F.variable([ F.blankSpace('\n'), F.comment('b') ], '?x'),
      ],
    }),
  }, {
    name: 'multiplication of expressions',
    query: `STR
#a
(?x
#b
)
#c

* BNoDe ( )
# Lonely
`,
    ast: F.expressionOperation({
      img1: '*',
      ignored: [
        [ F.blankSpace(' ') ],
      ],
      args: [
        F.expressionOperation({
          img1: 'STR',
          ignored: [
            [ F.blankSpace('\n'), F.comment('a') ],
            [],
            [ F.blankSpace('\n'), F.comment('c'), F.blankSpace('\n') ],
          ],
          args: [
            F.variable([ F.blankSpace('\n'), F.comment('b') ], '?x'),
          ],
        }),
        F.expressionOperation({
          img1: 'BNoDe',
          ignored: [
            [ F.blankSpace(' ') ],
            [ F.blankSpace(' ') ],
            [ F.blankSpace('\n'), F.comment(' Lonely') ],
          ],
          args: [],
        }),
      ],
    }),
  }];

  for (const { name, query, ast } of tests) {
    it(name, ({ expect }) => {
      const res = parse(query, context);
      expect(res).toEqual(ast);
    });
  }
});
