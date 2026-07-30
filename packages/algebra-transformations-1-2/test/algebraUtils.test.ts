import { describe, it } from 'vitest';
import type { Algebra } from '../lib/index.js';
import { AlgebraFactory, algebraUtils, Types } from '../lib/index.js';

describe('algebraUtils', () => {
  const AF = new AlgebraFactory();

  it('exposes the pre-order transformers of the 1.1 algebra', ({ expect }) => {
    const bgp = AF.createBgp([]);
    const union = AF.createUnion([ bgp, bgp ], false);
    const filter = AF.createFilter(union, AF.createTermExpression(AF.createTerm('?x')));

    const result = <Algebra.Union> algebraUtils.mapOperationPreOrder<'unsafe', Algebra.Operation>(filter, {
      [Types.FILTER]: { transform: (op) => {
        if (op.input.type === Types.UNION) {
          return AF.createUnion(op.input.input.map(branch => AF.createFilter(branch, op.expression)), false);
        }
        return op;
      } },
    });

    expect(result.type).toBe(Types.UNION);
    expect(result.input.map(branch => branch.type)).toEqual([ Types.FILTER, Types.FILTER ]);
    expect(algebraUtils.mapOperationSubPreOrder).toBeTypeOf('function');
  });
});
