import { Generator as TraqulaGenerator } from '@traqula/generator-sparql-1-1';
import { Parser as TraqulaParser } from '@traqula/parser-sparql-1-1';
import { positiveTest } from '@traqula/test-utils';
import { translate, toSparqlJs } from 'sparqlalgebrajs';
import { Generator } from 'sparqljs';
import { describe, bench } from 'vitest';
import { AlgebraToAstTransformer, toAlgebra, toAst } from '../lib/index.js';

describe('algebra 1.1 generate', () => {
  const traqulaParser = new TraqulaParser();
  const traqulaToAstTransformer = new AlgebraToAstTransformer();
  const traqulaGenerator = new TraqulaGenerator();
  const sparqljsGenerator = new Generator();

  describe('generate general queries', async() => {
    const allQueries = await Promise.all([ ...positiveTest('sparql-1-1') ]
      .map(x => x.statics().then(x => x.query)));
    const allTraqulaAlgebra = allQueries.map(query => toAlgebra(traqulaParser.parse(query), { quads: true }));
    const allAlgebraJs = allQueries.map(query => translate(query, { quads: true }));

    bench('traqula 1.1 algebra -> query', () => {
      for (const algebra of allTraqulaAlgebra) {
        traqulaGenerator.generate(traqulaToAstTransformer.transform(algebra));
      }
    });

    bench('traqula 1.1 algebra -> query COLD', () => {
      for (const algebra of allTraqulaAlgebra) {
        const traqulaGenerator = new TraqulaGenerator();
        traqulaGenerator.generate(toAst(algebra));
      }
    });

    bench('sparqlAlgebra 1.1 -> query', () => {
      for (const algebra of allAlgebraJs) {
        sparqljsGenerator.stringify(toSparqlJs(algebra));
      }
    });

    bench('sparqlAlgebra 1.1 -> query COLD', () => {
      for (const algebra of allAlgebraJs) {
        const sparqljsGenerator = new Generator();
        sparqljsGenerator.stringify(toSparqlJs(algebra));
      }
    });
  });
});
