import { describe, it } from 'vitest';
import { negativeTest } from '../lib/index.js';

describe('negativeTest filter', () => {
  it('skips files the filter rejects', ({ expect }) => {
    const all = [ ...negativeTest('sparql-1-2-invalid') ].map(test => test.name);
    const [ rejected ] = all;
    const filtered = [ ...negativeTest('sparql-1-2-invalid', name => name !== rejected) ].map(test => test.name);
    expect(filtered).toEqual(all.slice(1));
  });
});
