import { describe, it } from 'vitest';
import { negativeTest, positiveTest, sparqlAlgebraOnlyTests, sparqlAlgebraTests, sparqlQueries }
  from '../lib/index.js';

type Gen = (filter?: (name: string) => boolean) => Iterable<{ name: string }>;

describe('generator filters', () => {
  const generators: [string, Gen][] = [
    [ 'negativeTest', filter => negativeTest('sparql-1-2-invalid', filter) ],
    [ 'positiveTest', filter => positiveTest('sparql-1-2', filter) ],
    [ 'sparqlAlgebraTests', filter => sparqlAlgebraTests('sparql12', false, false, filter) ],
    [ 'sparqlQueries', filter => sparqlQueries('sparql12', filter) ],
    [ 'sparqlAlgebraOnlyTests', filter => sparqlAlgebraOnlyTests('sparql-1.1-algebra-only', filter) ],
  ];

  for (const [ name, gen ] of generators) {
    it(`${name} skips files the filter rejects`, ({ expect }) => {
      const all = [ ...gen() ].map(test => test.name);
      const [ rejected ] = all;
      const filtered = [ ...gen(name => name !== rejected) ].map(test => test.name);
      expect(all.length).toBeGreaterThan(1);
      expect(filtered).toEqual(all.slice(1));
    });
  }
});
