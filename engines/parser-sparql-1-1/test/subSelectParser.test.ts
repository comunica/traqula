import type { SparqlContext, SubSelect } from '@traqula/rules-sparql-1-1';
import { TraqulaFactory, completeParseContext, lex as l } from '@traqula/rules-sparql-1-1';
import { describe, it } from 'vitest';
import { subSelectParserBuilder } from '../lib';

describe('a SPARQL 1.1 objectlist parser', () => {
  const F = new TraqulaFactory();
  function parse(query: string, context: Partial<SparqlContext>): SubSelect {
    const parser = subSelectParserBuilder.consumeToParser({
      tokenVocabulary: l.sparql11Tokens.build(),
    });
    return parser.subSelect(query, completeParseContext(context), undefined);
  }
  const context = { prefixes: { ex: 'http://example.org/' }};

  const values = [
  ];

  it('builtin', ({ expect }) => {
    const res = parse(`seLect Distinct ?a  (Lang(?a) as ?b)
Where { {
 #sub
} .
  { ?a ?b ?c . }
  { { } . }
  FILTER ( ?a = ?b )
} Group By ?a Having (?b) order by Desc (?c) offset 5 limit 1
#done
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
