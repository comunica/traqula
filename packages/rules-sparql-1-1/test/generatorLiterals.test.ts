import type { BaseQuad } from '@rdfjs/types';
import { CommonIRIs } from '@traqula/core';
import type { GeneratorRule } from '@traqula/core';
import { DataFactory } from 'rdf-data-factory';
import { describe, it } from 'vitest';
import type { LiteralTerm, SparqlContext } from '../lib';
import * as gram from '../lib/grammar';

describe('generatorLiterals', () => {
  const dataFactory = new DataFactory<BaseQuad>();

  const SUBRULE: <T, U>(cstDef: GeneratorRule<string, any, T, U>, input: T, arg: U) => string =
    (cstDef, input, arg) => {
      const record: Record<string, GeneratorRule<any, string, any> | undefined> = {
        string: gram.string,
      };
      const entry = record[cstDef.name];
      if (entry === undefined) {
        throw new Error(`No generator rule found for ${cstDef.name}`);
      }
      return entry.gImpl({ SUBRULE })(input, {}, arg);
    };

  function testLiteralParse(input: LiteralTerm, expected: string): void {
    it(`${input.value} -> ${expected}`, ({ expect }) => {
      expect(gram.rdfLiteral.gImpl({ SUBRULE })(input, <SparqlContext> {}, undefined)).toBe(expected);
    });
  }

  testLiteralParse(dataFactory.literal('value', 'en'), '"value"@en');
  testLiteralParse(dataFactory.literal(`The value's like "apple"`, 'en'), `"The value's like \\"apple\\""@en`);
  testLiteralParse(dataFactory.literal(`The value's like "apple"`, 'nl'), `"The value's like \\"apple\\""@nl`);
  testLiteralParse(dataFactory.literal(`10`, dataFactory.namedNode(CommonIRIs.DOUBLE)), `"10"^^<${CommonIRIs.DOUBLE}>`);
  testLiteralParse(dataFactory.literal(`10`), `"10"^^<${CommonIRIs.STRING}>`);
});
