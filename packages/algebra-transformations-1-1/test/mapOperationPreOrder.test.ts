import { describe, it } from 'vitest';
import type * as A from '../lib/algebra.js';
import { AlgebraFactory, algebraUtils, ExpressionTypes, Types } from '../lib/index.js';

describe('mapOperationPreOrder', () => {
  const AF = new AlgebraFactory();
  const expression = AF.createTermExpression(AF.createTerm('?x'));
  const bgp = (subject: string): A.Bgp => AF.createBgp([
    AF.createPattern(AF.createTerm(subject), AF.createTerm(':p'), AF.createTerm(':o')),
  ]);

  /**
   * Sinks a filter into the branches of the union below it. Every branch gets its own filter,
   * which is transformed in turn, so a filter travels through as many unions as there are.
   */
  const pushDownFilter = (op: A.Operation): A.Operation =>
    algebraUtils.mapOperationPreOrder<'unsafe', A.Operation>(op, {
      [Types.FILTER]: (filter) => {
        if (filter.input.type === Types.UNION) {
          return { newValue: AF.createUnion(
            filter.input.input.map(branch => AF.createFilter(branch, filter.expression)),
            false,
          ) };
        }
        // Any other operation is a barrier for this filter
        return { newValue: filter };
      },
    });

  it('sinks a filter through the union below it', ({ expect }) => {
    const union = AF.createUnion([ bgp('?a'), bgp('?b') ], false);

    const result = <A.Union> pushDownFilter(AF.createFilter(union, expression));

    expect(result.type).toBe(Types.UNION);
    expect(result.input.map(branch => branch.type)).toEqual([ Types.FILTER, Types.FILTER ]);
    expect(result.input.map(branch => (<A.Filter> branch).input.type)).toEqual([ Types.BGP, Types.BGP ]);
  });

  it('sinks a filter through every union it meets in a single traversal', ({ expect }) => {
    const nested = AF.createUnion([ AF.createUnion([ bgp('?a'), bgp('?b') ], false), bgp('?c') ], false);

    const result = <A.Union> pushDownFilter(AF.createFilter(nested, expression));

    // Every leaf ended up with its own filter, contrary to mapOperation, which only maps the input tree
    const leaves: string[] = [];
    algebraUtils.visitOperation(result, { [Types.BGP]: { visitor: () => leaves.push(Types.BGP) }});
    expect(leaves).toHaveLength(3);
    const filters: A.Filter[] = [];
    algebraUtils.visitOperation(result, { [Types.FILTER]: { visitor: op => filters.push(op) }});
    expect(filters).toHaveLength(3);
    expect(filters.every(filter => filter.input.type === Types.BGP)).toBe(true);
  });

  it('leaves the input tree untouched', ({ expect }) => {
    const union = AF.createUnion([ bgp('?a'), bgp('?b') ], false);
    const filter = AF.createFilter(union, expression);

    pushDownFilter(filter);

    expect(filter.type).toBe(Types.FILTER);
    expect(filter.input).toBe(union);
    expect(union.input.map(branch => branch.type)).toEqual([ Types.BGP, Types.BGP ]);
  });

  it('does not descend into the operations the default context ignores', ({ expect }) => {
    const visited: string[] = [];

    // The transformer ignores the terms of a pattern, so its subject is never mapped
    algebraUtils.mapOperationPreOrder(bgp('?a'), {
      [Types.PATTERN]: (copy) => {
        visited.push(Types.PATTERN);
        return { newValue: copy };
      },
    });

    expect(visited).toEqual([ Types.PATTERN ]);
  });
});

describe('mapOperationSubPreOrder', () => {
  const AF = new AlgebraFactory();

  it('targets a subType before its descendants', ({ expect }) => {
    const inner = AF.createTermExpression(AF.createTerm('?x'));
    const aggregate = AF.createAggregateExpression('count', inner, false);
    const mapped: string[] = [];

    const result = <A.OperatorExpression> algebraUtils.mapOperationSubPreOrder<'unsafe', A.Operation>(
      aggregate,
      {},
      { [Types.EXPRESSION]: { [ExpressionTypes.AGGREGATE]: (copy) => {
        mapped.push(copy.aggregator);
        // Replacing the aggregate makes us iterate into the operator expression instead
        return { newValue: AF.createOperatorExpression('!', [ copy.expression ]) };
      } }},
    );

    expect(mapped).toEqual([ 'count' ]);
    expect(result.subType).toBe(ExpressionTypes.OPERATOR);
    expect(result.args).toEqual([ inner ]);
  });
});
