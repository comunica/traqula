import type { Query, SparqlContext } from '@traqula/rules-sparql-1-1';
import { TraqulaFactory, completeParseContext, lex as l } from '@traqula/rules-sparql-1-1';
import { describe, it } from 'vitest';
import { queryUnitParserBuilder } from '../lib';

describe('a SPARQL 1.1 objectlist parser', () => {
  const F = new TraqulaFactory();
  function parse(query: string, context: Partial<SparqlContext>): Query {
    const parser = queryUnitParserBuilder.consumeToParser({
      tokenVocabulary: l.sparql11Tokens.build(),
    });
    return parser.queryUnit(query, completeParseContext(context), undefined);
  }
  const context = { prefixes: { ex: 'http://example.org/' }};

  const values = [
    `PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
  BASE <https://example.org/>
seLect Distinct ?a  (Lang(?a) as ?b)
Where { {
 #sub
} .
  { ?a ?b ?c . }
  { { } . }
  FILTER ( ?a = ?b )
} Group By ?a Having (?b) order by Desc (?c) offset 5 limit 1
VALUEs ?a { <a> <b> <c> }
#done
`,
    `PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
  BASE <https://example.org/>
ConsTruct { [] a "apple" } FroM NaMED xsd:test
 FrOM <apple-tree> { ?s ?p ?o } Group By ?a Having (?b) order by Desc (?c) offset 5 limit 1
VALUEs ?a { <a> <b> <c> }
#done
`,
    `PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
  BASE <https://example.org/>
ConsTruct FroM NaMED xsd:test
 FrOM <apple-tree> Where { ?s ?p ?o } Group By ?a Having (?b) order by Desc (?c) offset 5 limit 1
VALUEs ?a { <a> <b> <c> }
#done
`,
    `PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
  BASE <https://example.org/>
DeSCRIBE ?s ?p xsd:apple <pears> FroM NaMED xsd:test
 FrOM <apple-tree> Where { ?s ?p ?o } Group By ?a Having (?b) order by Desc (?c) offset 5 limit 1
VALUEs ?a { <a> <b> <c> }
#done
`,
    `PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
  BASE <https://example.org/>
aSk\tFroM NaMED xsd:test
 FrOM <apple-tree> Where { ?s ?p ?o } Group By ?a Having (?b) order by Desc (?c) offset 5 limit 1
VALUEs ?a { <a> <b> <c> }
#done
`,
  ];

  it('builtin', ({ expect }) => {
    const res = parse(`PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
  BASE <https://example.org/>
aSk\tFroM NaMED xsd:test
 FrOM <apple-tree> Where { ?s ?p ?o } Group By ?a Having (?b) order by Desc (?c) offset 5 limit 1
VALUEs ?a { <a> <b> <c> }
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
