import { describe, it } from 'vitest';
import type { Bgp } from '../lib/algebra.js';
import { mapOperationReplace } from '../lib/algebra.js';
import { AlgebraFactory } from '../lib/index.js';

describe('mapOperationReplace', () => {
  const AF = new AlgebraFactory();
  it('can handle metadata recursions', ({ expect }) => {
    const op = AF.createBgp([]);
    op.metadata = { apple: op };
    expect(mapOperationReplace(op, {})).toMatchObject(op);
  });

  it('can not handle non-metadata recursions', ({ expect }) => {
    const op: Bgp & { temp?: Record<string, any> } = AF.createBgp([]);
    op.temp = { apple: op };
    expect(() => mapOperationReplace(op, {})).throws();
  });
});
