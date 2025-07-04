import { Parser } from '@traqula/parser-sparql-1-1';
import type * as T11 from '@traqula/rules-sparql-1-1';
import type { Query } from '@traqula/rules-sparql-1-1';
import { TraqulaFactory } from '@traqula/rules-sparql-1-1';
import { describe, it } from 'vitest';
import { Generator } from '../lib';

describe('a SPARQL 1.1 generator', () => {
  const generator = new Generator();
  const parser = new Parser();
  const F = new TraqulaFactory();

  it ('should generate a simple query', ({ expect }) => {
    const query = 'SELECT * WHERE { ?s ?p ?o }';
    const ast = <T11.Query> parser.parse(query);
    console.log(JSON.stringify(ast, null, 2));
    const result = generator.generate(ast, query);
    expect(result.replaceAll(/\s+/gu, ' ')).toBe(query);
  });

  it ('should generate a simple query 5', ({ expect }) => {
    /* eslint-disable ts/ban-ts-comment */
    function alterType(curObject: object, searchType: string, patch: (current: object) => object): object {
      for (const [ key, value ] of Object.entries(curObject)) {
        if (value && typeof value === 'object') {
          (<Record<string, unknown>> curObject)[key] = alterType(value, searchType, patch);
        }
      }
      if ((<{ type?: unknown }> curObject).type === searchType) {
        return patch(curObject);
      }
      return curObject;
    }
    const query = 'SELECT * WHERE { ?s ?p ?o }';
    const ast = <T11.Query> parser.parse(query);

    const altered = alterType(ast, 'term', (current) => {
      // @ts-expect-error
      if (current.termType === 'Variable' && current.value === 's') {
        // @ts-expect-error
        return F.variable('subject', F.sourceLocationNodeReplace(current.loc));
      }
      return current;
    });
    /* eslint-enable ts/ban-ts-comment */

    console.error(JSON.stringify(altered, null, 2));
    const result = generator.generate(<Query>altered, query);
    expect(result.replaceAll(/\s+/gu, ' ')).toBe(query);
  });

  it ('can auto gen query', ({ expect }) => {
    const query = 'SELECT * WHERE { ?s ?p ?o . } ';
    const ast = F.querySelect({
      variables: [ F.wildcard(F.gen()) ],
      datasets: F.datasetClauses([], F.sourceLocation()),
      context: [],
      where: F.patternGroup([
        F.patternBgp([
          F.triple(F.variable('s', F.gen()), F.variable('p', F.gen()), F.variable('o', F.gen())),
        ], F.gen()),
      ], F.gen()),
      solutionModifiers: {},
    }, F.gen());
    console.log(JSON.stringify(ast, null, 2));
    const result = generator.generate(ast);
    expect(result.replaceAll(/\s+/gu, ' ')).toBe(query);
  });
});
