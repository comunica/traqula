import fs from 'node:fs';
import path from 'node:path';
import type { Query, Update } from '@traqula/rules-sparql-1-1';
import { TraqulaFactory } from '@traqula/rules-sparql-1-1';
import { positiveTest } from '@traqula/test-utils';
import { describe, it } from 'vitest';
import { Generator } from '../lib';

describe('a SPARQL 1.1 generator', () => {
  const generator = new Generator();
  const F = new TraqulaFactory();

  function sinkAst(suite: string, test: string, response: string): void {
    const dir = '/home/jitsedesmet/Documents/PhD/code/traqula/packages/test-utils/lib/statics/';
    const fileLoc = path.join(dir, suite, `${test}-generated.sparql`);
    // eslint-disable-next-line no-sync
    fs.writeFileSync(fileLoc, response);
  }

  describe('positive paths', () => {
    for (const { name, statics } of positiveTest('paths')) {
      it(`can parse ${name}`, async({ expect }) => {
        const { query, ast } = await statics();
        const generated = generator.generate(<Query> ast, query);
        // SinkAst('paths', name, <object> res);
        expect(generated).toEqual(query);
      });
    }
  });

  describe('positive sparql 1.1', () => {
    for (const { name, statics } of positiveTest('sparql-1-1')) {
      it(`can parse ${name}`, async({ expect }) => {
        const { query, ast } = await statics();
        const queryUpdate = <Query | Update>ast;

        // Const roundTripped = generator.generate(queryUpdate, query);
        // expect(roundTripped).toEqual(query);

        const replaceLoc = F.sourceLocationNodeReplaceUnsafe(queryUpdate.loc);
        const autoGenAst = F.forcedAutoGenTree(queryUpdate);
        autoGenAst.loc = replaceLoc;
        console.log(JSON.stringify(autoGenAst, null, 2));
        const selfGenerated = generator.generate(autoGenAst);

        sinkAst('sparql-1-1', name, selfGenerated);
      });
    }
  });
});
