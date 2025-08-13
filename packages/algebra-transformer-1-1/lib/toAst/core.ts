import type * as RDF from '@rdfjs/types';
import { Transformer } from '@traqula/core';
import { Factory as AstFactory } from '@traqula/rules-sparql-1-1';
import type { Sparql11Nodes } from '@traqula/rules-sparql-1-1';
import * as Algebra from '../algebra';
import Factory from '../factory';

export interface AstContext {
  project: boolean;
  extend: Algebra.Extend[];
  group: RDF.Variable[];
  aggregates: Algebra.BoundAggregate[];
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
