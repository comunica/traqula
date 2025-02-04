import type { BaseQuad } from '@rdfjs/types';
import { GeneratorBuilder } from '@traqula/core';
import { DataFactory } from 'rdf-data-factory';
import { describe, it } from 'vitest';
import type { LiteralTerm } from '../lib';
import { CommonIRIs } from '../lib';
import * as gram from '../lib/grammar';

describe('generatorLiterals', () => {
  const dataFactory = new DataFactory<BaseQuad>();

  function testLiteralParse(input: LiteralTerm, expected: string): void {
    it(`${input.value} -> ${expected}`, ({ expect }) => {
      const generator = GeneratorBuilder.createBuilder(<const> [ gram.rdfLiteral, gram.string ]).build();
      expect(generator.rdfLiteral(input, undefined, undefined)).toBe(expected);
    });
  }

  testLiteralParse(dataFactory.literal('value', 'en'), '"value"@en');
  testLiteralParse(dataFactory.literal(`The value's like "apple"`, 'en'), `"The value's like \\"apple\\""@en`);
  testLiteralParse(dataFactory.literal(`The value's like "apple"`, 'nl'), `"The value's like \\"apple\\""@nl`);
  testLiteralParse(dataFactory.literal(`10`, dataFactory.namedNode(CommonIRIs.DOUBLE)), `"10"^^<${CommonIRIs.DOUBLE}>`);
  testLiteralParse(dataFactory.literal(`10`), `"10"^^<${CommonIRIs.STRING}>`);
});
