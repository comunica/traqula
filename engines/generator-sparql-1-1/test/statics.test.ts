import fs from 'node:fs';
import path from 'node:path';
import type * as T11 from '@traqula/rules-sparql-1-1';
import { Factory } from '@traqula/rules-sparql-1-1';
import { positiveTest } from '@traqula/test-utils';
import { describe, it } from 'vitest';
import { Generator } from '../lib';

describe('a SPARQL 1.1 generator', () => {
  const generator = new Generator();
  const F = new Factory();

  function _sinkGenerated(suite: string, test: string, response: string): void {
    const dir = '/home/jitsedesmet/Documents/PhD/code/traqula/packages/test-utils/lib/statics/';
    const fileLoc = path.join(dir, suite, `${test}-generated.sparql`);
    // eslint-disable-next-line no-sync
    fs.writeFileSync(fileLoc, response);
  }

  describe('positive paths', () => {
    for (const { name, statics } of positiveTest('paths')) {
      it(`can parse ${name}`, async({ expect }) => {
        const { query, ast, autoGen } = await statics();
        const path = <T11.Path>ast;

        const generated = generator.generatePath(path, query);
        expect(generated).toEqual(query);

        const replaceLoc = F.sourceLocationNodeReplaceUnsafe(path.loc);
        const autoGenAst = F.forcedAutoGenTree(path);
        autoGenAst.loc = replaceLoc;
        const selfGenerated = generator.generatePath(autoGenAst);
        // SinkGenerated('paths', name, selfGenerated);
        expect(selfGenerated).toEqual(autoGen);
      });
    }
  });

  describe('positive sparql 1.1', () => {
    for (const { name, statics } of positiveTest('sparql-1-1')) {
      it(`can parse ${name}`, async({ expect }) => {
        const { query, ast, autoGen } = await statics();
        const queryUpdate = <T11.Query | T11.Update>ast;

        const roundTripped = generator.generate(queryUpdate, query);
        expect(roundTripped).toEqual(query);

        const replaceLoc = F.sourceLocationNodeReplaceUnsafe(queryUpdate.loc);
        const autoGenAst = F.forcedAutoGenTree(queryUpdate);
        autoGenAst.loc = replaceLoc;
        const selfGenerated = generator.generate(autoGenAst);
        // SinkGenerated('sparql-1-1', name, selfGenerated);
        expect(selfGenerated).toEqual(autoGen);
      });
    }
  });
});
