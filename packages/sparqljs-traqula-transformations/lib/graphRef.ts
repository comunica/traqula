import type { GraphRef, GraphRefDefault, GraphRefSpecific } from '@traqula/rules-sparql-1-1';
import type * as SparqlJs from 'sparqljs';
import type { SparqlJsCompatIndir, SparqlJsTermToTraqula } from './core.js';
import { termFromSparqlJs } from './term.js';

type GraphRefDefaultOrSpecific = GraphRefDefault | GraphRefSpecific;

export const graphOrDefaultToGraphRef: SparqlJsCompatIndir<
  'graphOrDefaultToGraphRef',
  GraphRefDefaultOrSpecific,
  [SparqlJs.GraphOrDefault]
> = {
  name: 'graphOrDefaultToGraphRef',
  fun: ({ SUBRULE }) => (context, graph) => {
    const { astFactory: F } = context;
    if (graph.default === true || !graph.name) {
      return F.graphRefDefault(F.gen());
    }
    const name = <SparqlJsTermToTraqula<typeof graph.name>> SUBRULE(termFromSparqlJs, graph.name);
    return F.graphRefSpecific(name, F.gen());
  },
};

export const graphReferenceToGraphRef: SparqlJsCompatIndir<
  'graphReferenceToGraphRef',
  GraphRef,
  [SparqlJs.GraphReference]
> = {
  name: 'graphReferenceToGraphRef',
  fun: ({ SUBRULE }) => (context, graph) => {
    const { astFactory: F } = context;
    if (graph.default) {
      return F.graphRefDefault(F.gen());
    }
    if (graph.named) {
      return F.graphRefNamed(F.gen());
    }
    if (graph.all) {
      return F.graphRefAll(F.gen());
    }
    // Sparqljs' `GraphOrDefault.name` is optional, but the grammar guarantees exactly one of
    // default/named/all/name is set, so this last branch always has a name.
    const name = <SparqlJs.IriTerm> graph.name;
    return F.graphRefSpecific(<SparqlJsTermToTraqula<typeof name>> SUBRULE(termFromSparqlJs, name), F.gen());
  },
};
