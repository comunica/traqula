import type * as RDF from '@rdfjs/types';
import { Transformer } from '@traqula/core';
import { Factory as AstFactory } from '@traqula/rules-sparql-1-1';
import type { Sparql11Nodes } from '@traqula/rules-sparql-1-1';
import * as Algebra from '../algebra';
import Factory from '../factory';
import { types } from '../toAlgebra/core';

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
  factory: Factory;
  astFactory: AstFactory;
  transformer: Transformer<Sparql11Nodes>;
}

export function createAstContext(): AstContext {
  return {
    project: false,
    extend: [],
    group: [],
    aggregates: [],
    order: [],
    factory: new Factory(),
    astFactory: new AstFactory(),
    transformer: new Transformer<Sparql11Nodes>(),
  };
}

export const eTypes = Algebra.expressionTypes;

export function resetContext(c: AstContext): void {
  c.project = false;
  c.extend = [];
  c.group = [];
  c.aggregates = [];
  c.order = [];
}

export function registerProjection(c: AstContext, op: Algebra.Operation): void {
  // GRAPH was added because the way graphs get added back here is not the same as how they get added in the future
  // ^ seems fine but might have to be changed if problems get detected in the future
  if (op.type !== types.EXTEND && op.type !== types.ORDER_BY && op.type !== types.GRAPH) {
    c.project = false;
  }
}
