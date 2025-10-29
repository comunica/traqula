import type { SourceLocationStringReplace } from '@traqula/core';
import { traqulaIndentation, GeneratorBuilder } from '@traqula/core';
import { Parser } from '@traqula/parser-sparql-1-1';
import type * as T11 from '@traqula/rules-sparql-1-1';
import { AstFactory, AstTransformer, completeGeneratorContext } from '@traqula/rules-sparql-1-1';
import { beforeEach, describe, it } from 'vitest';
import { Generator, sparql11GeneratorBuilder } from '../lib/index.js';

describe('autoGen query inserting comments', () => {
  const generator = new Generator();
  const F = new AstFactory();
  const parser = new Parser({ lexerConfig: { positionTracking: 'full' }, defaultContext: { astFactory: F }});
  const transformer = new AstTransformer();

  beforeEach(() => {
    F.resetBlankNodeCounter();
  });

  const query = `SELECT * WHERE {
  # variable ?o is either 'a' 'b' or 'c'
  VALUES ?o { 'a' 'b' 'c' }
  ?s ?p ?o
}`;

  it ('generates simple round tripped', ({ expect }) => {
    const ast = <T11.Query> parser.parse(query);
    const result = generator.generate(ast);
    expect(result).toBe(query);
  });

  it('auto generates on no pretty - with no comments', ({ expect }) => {
    const ast = parser.parse(query);
    const result = generator.generate(F.forcedAutoGenTree(ast), { [traqulaIndentation]: -1, indentInc: 0 });
    expect(result).toBe(`SELECT * WHERE { VALUES ?o { "a" "b" "c" }?s ?p ?o . }`);
  });

  it('auto generates - with no comments', ({ expect }) => {
    const ast = parser.parse(query);
    const result = generator.generate(F.forcedAutoGenTree(ast));
    expect(result).toBe(`SELECT * WHERE {
  VALUES ?o {
    "a"
    "b"
    "c"
  }
  ?s ?p ?o .
}`);
  });

  it('auto generates - comment through sourceLocation', ({ expect }) => {
    const ast = F.forcedAutoGenTree(parser.parse(query));
    const detailGenerator = sparql11GeneratorBuilder.build();
    const genContext = completeGeneratorContext({});
    const alteredAst = transformer.transformNodeSpecific<'unsafe', typeof ast>(ast, {}, {
      pattern: { values: { transform: (values) => {
        values.loc = {
          sourceLocationType: 'stringReplace',
          start: 0,
          end: 0,
          newSource: `# Self inserted comment\n${detailGenerator.inlineData(values, genContext).trim()}\n`,
        } satisfies SourceLocationStringReplace;
        return values;
      } }},
    });
    const result = generator.generate(alteredAst);
    expect(result).toBe(`SELECT * WHERE {
  # Self inserted comment
VALUES ?o {
  "a"
  "b"
  "c"
}
?s ?p ?o .
}`);
  });

  it('auto generates - comment through modified generator', ({ expect }) => {
    const ast = F.forcedAutoGenTree(parser.parse(query));
    const origValues = sparql11GeneratorBuilder.getRule('inlineData');
    const myBuilder = GeneratorBuilder.create(sparql11GeneratorBuilder)
      .patchRule({
        name: 'inlineData',
        gImpl: $ => (ast, ...params) => {
          $.PRINT_ON_OWN_LINE('# My own comment, so cool');
          origValues.gImpl($)(ast, ...params);
        },
      } satisfies typeof origValues);

    const genContext = completeGeneratorContext({});
    const myGenerator = myBuilder.build();
    const result = myGenerator.queryOrUpdate(ast, genContext);
    expect(result).toBe(`
SELECT * WHERE {
  # My own comment, so cool
  VALUES ?o {
    "a"
    "b"
    "c"
  }
  ?s ?p ?o .
}
`);
  });
});
