import { describe, bench } from 'vitest';
import type { GeneratorRule } from '../lib/index.js';
import { GeneratorBuilder } from '../lib/index.js';

/**
 * Prints short entries, each followed by a multi-character ENSURE the output already satisfies.
 * Checking such an ENSURE used to merge the stringBuilder tail into an ever-growing entry.
 */
const dashes: GeneratorRule<object, 'dashes', { count: number }, []> = {
  name: 'dashes',
  gImpl: ({ PRINT, ENSURE }) => (ast) => {
    for (let i = 0; i < ast.count; i++) {
      PRINT('-');
      ENSURE('--');
    }
  },
};

describe('generate with multi-character ENSURE', () => {
  const generator = GeneratorBuilder.create(<const>[ dashes ]).build();

  for (const count of [ 4_000, 16_000, 64_000 ]) {
    bench(`${count} entries`, () => {
      generator.dashes({ count }, { origSource: '' });
    });
  }
});
