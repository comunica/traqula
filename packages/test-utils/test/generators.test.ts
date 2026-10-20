import { basename } from 'node:path';
import { describe, it } from 'vitest';
import { negativeTest, positiveTest, sparqlAlgebraOnlyTests, sparqlAlgebraTests, sparqlQueries }
  from '../lib/index.js';

type Gen = (filter?: (name: string) => boolean) => Iterable<{ name: string }>;

describe('generator filters', () => {
  const generators: [string, Gen][] = [
    [ 'negativeTest', filter => negativeTest('sparql-1-2-invalid', filter) ],
    [ 'positiveTest', filter => positiveTest('sparql-1-2', filter) ],
    [ 'sparqlAlgebraTests', filter => sparqlAlgebraTests('sparql-1.1', false, false, filter) ],
    [ 'sparqlQueries', filter => sparqlQueries('sparql-1.1', filter) ],
    [ 'sparqlAlgebraOnlyTests', filter => sparqlAlgebraOnlyTests('sparql-1.1-algebra-only', filter) ],
  ];

  for (const [ name, gen ] of generators) {
    it(`${name} filters on the test file name`, ({ expect }) => {
      const all = [ ...gen() ].map(test => test.name);
      const rejected = basename(all[0]);
      const filtered = [ ...gen(file => file !== rejected) ].map(test => test.name);
      expect(all.length).toBeGreaterThan(1);
      expect(filtered).toEqual(all.filter(test => basename(test) !== rejected));
      expect(filtered.length).toBeLessThan(all.length);
    });
  }
});
