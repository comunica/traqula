import type * as RDF from '@rdfjs/types';
import type { IndirDef } from '@traqula/core';
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
    c.order = [];
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
