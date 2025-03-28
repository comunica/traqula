import type { ContextDefinition, SparqlContext, Update } from '@traqula/rules-sparql-1-1';
import { completeParseContext, lex as l, TraqulaFactory } from '@traqula/rules-sparql-1-1';
import { describe, it } from 'vitest';
import { updateNoModifyParserBuilder } from '../lib';

describe('a SPARQL 1.1 objectlist parser', () => {
  const F = new TraqulaFactory();
  function parse(query: string, context: Partial<SparqlContext>): Update | ContextDefinition[] {
    const parser = updateNoModifyParserBuilder.consumeToParser({
      tokenVocabulary: l.sparql11Tokens.build(),
    });
    return parser.updateUnit(query, completeParseContext(context), undefined);
  }
  const context = { prefixes: { ex: 'http://example.org/' }};

  const values = [
    `BASE <https://example.org/>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>`,
    `BASE <https://example.org/>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
LOAD Silent :he inTO Graph sxd:example;
`,
    `PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
 BASE <https://example.org/>
CLEar Silent aLl
;
Delete Where {
    ?s ?p ?o .
}
`,
  ];

  it('builtin', ({ expect }) => {
    const res = parse(`PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
 BASE <https://example.org/>
CLEar Silent aLl
;
Delete Where {
    ?s ?p ?o .
}
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
