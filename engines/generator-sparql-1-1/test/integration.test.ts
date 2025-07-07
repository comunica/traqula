import { Parser } from '@traqula/parser-sparql-1-1';
import type * as T11 from '@traqula/rules-sparql-1-1';
import type { Query, Sparql11Nodes } from '@traqula/rules-sparql-1-1';
import { Transformer, TraqulaFactory } from '@traqula/rules-sparql-1-1';
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
    const tester = new Transformer<Sparql11Nodes>();

    const query = 'SELECT * WHERE { ?s ?p ?o }';
    const ast = <T11.Query> parser.parse(query);

    const altered = tester.alterNode(ast, 'term', (current) => {
      if (F.isTermVariable(current) && current.value === 's') {
        return F.variable('subject', F.sourceLocationNodeReplaceUnsafe(current.loc));
      }
      return current;
    });

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
