import type * as RDF from '@rdfjs/types';
import type { IndirDef } from '@traqula/core';
import type { Expression, PatternValues } from '@traqula/rules-sparql-1-1';
import { AstFactory, AstTransformer } from '@traqula/rules-sparql-1-1';
import * as Algebra from '../algebra.js';
import { AlgebraFactory } from '../algebraFactory.js';
import { types } from '../toAlgebra/index.js';

export interface AstContext {
  /**
   * Whether we are contained in a projection.
   * This allows us to differentiate between BIND and SELECT when translating EXTEND
   */
  project: boolean;
  /**
   * All extends found in our suboperations
   */
  extend: Algebra.Extend[];
  /**
   * All groups found in our suboperations
   */
  group: RDF.Variable[];
  /**
   * All aggregates found in our suboperations
   */
  aggregates: Algebra.BoundAggregate[];
  /**
   * All HAVING conditions (filters directly on top of a group) found in our suboperations
   */
  having: Expression[];
  /**
   * The VALUES joined on top of a group found in our suboperations, the query's trailing VALUES clause
   */
  values?: PatternValues;
  /**
   * All orderings found in our suboperations
   */
  order: Algebra.Expression[];
  algebraFactory: AlgebraFactory;
  astFactory: AstFactory;
  transformer: AstTransformer;
}

export function createAstContext(): AstContext {
  return {
    project: false,
    extend: [],
    group: [],
    aggregates: [],
    having: [],
    order: [],
    algebraFactory: new AlgebraFactory(),
    astFactory: new AstFactory(),
    transformer: new AstTransformer(),
  };
}

export type AstIndir<Name extends string, Ret, Arg extends any[]> = IndirDef<AstContext, Name, Ret, Arg>;
export const eTypes = Algebra.ExpressionTypes;

export const resetContext: AstIndir<'resetContext', void, []> = {
  name: 'resetContext',
  fun: () => (c) => {
    c.project = false;
    c.extend = [];
    c.group = [];
    c.aggregates = [];
    c.having = [];
    c.values = undefined;
    c.order = [];
  },
};

/**
 * Finds the group of a query below the given operation.
 * From the top, a group can be wrapped by the extends and orderings of the projection, then the trailing VALUES clause,
 * and then the HAVING conditions. `from` tells which of these the given operation can still be.
 */
export const findAlgGroupBelow: AstIndir<
  'findGroupBelow',
Algebra.Group | undefined,
[Algebra.Operation, 'projection' | 'values' | 'having']
> = {
  name: 'findGroupBelow',
  fun: () => (_, op, from) => {
    let input = op;
    if (from === 'projection') {
      while (input.type === types.EXTEND || input.type === types.ORDER_BY) {
        input = input.input;
      }
    }
    if (from !== 'having' && input.type === types.JOIN && input.input.length === 2) {
      // Join is commutative, so the VALUES can be either operand
      const valuesIndex = input.input.findIndex(operand => operand.type === types.VALUES);
      if (valuesIndex >= 0) {
        input = input.input[1 - valuesIndex];
      }
    }
    while (input.type === types.FILTER) {
      input = input.input;
    }
    return input.type === types.GROUP ? input : undefined;
  },
};

export const registerProjection: AstIndir<'registerProjection', void, [Algebra.Operation]> = {
  name: 'registerProjection',
  fun: () => (c, op) => {
    // GRAPH closes projection scope: Graph(?g, P) joins {?g} onto P's result, so an EXTEND
    // inside P must render as a BIND, not get hoisted into the outer SELECT list.
    if (op.type !== types.EXTEND && op.type !== types.ORDER_BY) {
      c.project = false;
    }
  },
};
