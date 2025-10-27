import fs from 'node:fs';
import path from 'node:path';
import type * as T12 from '@traqula/rules-sparql-1-1';
import { AstFactory } from '@traqula/rules-sparql-1-2';
import { getStaticFilePath, positiveTest } from '@traqula/test-utils';
import { describe, it } from 'vitest';
import { Generator } from '../lib/index.js';

describe('a SPARQL 1.2 generator', () => {
  const generator = new Generator();
  const F = new AstFactory();

  function _sinkGenerated(suite: string, test: string, response: string): void {
    const dir = getStaticFilePath();
    const fileLoc = path.join(dir, suite, `${test}-generated.sparql`);
    // eslint-disable-next-line no-sync
    fs.writeFileSync(fileLoc, response);
  }

  describe('positive paths', () => {
    for (const { name, statics } of positiveTest('paths')) {
      it(`can parse ${name}`, async({ expect }) => {
        const { query, astWithSource, autoGen } = await statics();
        const path = <T12.Path>astWithSource;

        const generated = generator.generatePath(path, { origSource: query });
        expect(generated, 'round tripped generation').toEqual(query.trim());

        const replaceLoc = F.sourceLocationNodeReplaceUnsafe(path.loc);
        const autoGenAst = F.forcedAutoGenTree(path);
        autoGenAst.loc = replaceLoc;
        const selfGenerated = generator.generatePath(autoGenAst);
        expect(selfGenerated, 'auto generated').toEqual(autoGen.trim());
      });
    }
  });

  describe('positive sparql 1.1', () => {
    for (const { name, statics } of positiveTest('sparql-1-1')) {
      it(`can parse ${name}`, async({ expect }) => {
        const { query, astWithSource, autoGen } = await statics();
        const queryUpdate = <T12.Query | T12.Update>astWithSource;

        const roundTripped = generator.generate(queryUpdate, { origSource: query });
        expect(roundTripped, 'round-tripped generation').toEqual(query.trim());

        const replaceLoc = F.sourceLocationNodeReplaceUnsafe(queryUpdate.loc);
        const autoGenAst = F.forcedAutoGenTree(queryUpdate);
        autoGenAst.loc = replaceLoc;
        const selfGenerated = generator.generate(autoGenAst);
        // _sinkGenerated('sparql-1-1', name, selfGenerated);
        expect(selfGenerated, 'auto generated').toEqual(autoGen.trim());
      });
    }
  });

  describe('positive sparql 1.2', () => {
    for (const { name, statics } of positiveTest('sparql-1-2')) {
      it(`can parse ${name}`, async({ expect }) => {
        const { query, astWithSource, autoGen } = await statics();
        const queryUpdate = <T12.Query | T12.Update>astWithSource;

        const roundTripped = generator.generate(queryUpdate, { origSource: query });
        expect(roundTripped, 'round-tripped generation').toEqual(query.trim());

        const replaceLoc = F.sourceLocationNodeReplaceUnsafe(queryUpdate.loc);
        const autoGenAst = F.forcedAutoGenTree(queryUpdate);
        autoGenAst.loc = replaceLoc;
        const selfGenerated = generator.generate(autoGenAst);
        // _sinkGenerated('sparql-1-2', name, selfGenerated);
        expect(selfGenerated, 'auto generated').toEqual(autoGen.trim());
      });
    }
  });
});
