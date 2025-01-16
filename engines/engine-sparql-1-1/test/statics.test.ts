import {beforeEach, describe, it} from "vitest";
import {Parser} from "../lib";
import {positiveTest, importSparql11NoteTests} from "@traqula/test-utils";
import {DataFactory} from "rdf-data-factory";
import {BaseQuad} from "@rdfjs/types";

describe('a SPARQL 1.1 parser', () => {
  const parser = new Parser({ prefixes: { ex: 'http://example.org/' }});
  beforeEach(() => {
    parser._resetBlanks();
  });

  describe('positive paths', () => {
    for (const { name, statics } of [...positiveTest('paths')]) {
      it(`can parse ${name}`, async({expect}) => {
        const { query, result } = await statics();
        const res: unknown = parser.parsePath(query);
        expect(res).toEqualParsedQuery(result);
      });
    }
  });

  describe('positive sparql 1.1', () => {
    for (const { name, statics } of [...positiveTest('sparql-1-1')]) {
      it(`can parse ${name}`, async({expect}) => {
        const { query, result } = await statics();
        const res: unknown = parser.parse(query);
        expect(res).toEqualParsedQuery(result);
      });
    }
  });

  describe('specific sparql 1.1 tests', () => {
    importSparql11NoteTests(args => new Parser(args), new DataFactory<BaseQuad>());
  });
});