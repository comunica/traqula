import type { GraphRef, GraphRefDefault, GraphRefSpecific } from '@traqula/rules-sparql-1-1';
import type * as SparqlJs from 'sparqljs';
import type { SparqlJsCompatIndir, SparqlJsTermToTraqula } from './core.js';
import { termFromSparqlJs } from './term.js';

type GraphRefDefaultOrSpecific = GraphRefDefault | GraphRefSpecific;

/**
 * Converts the graph of a CREATE/ADD/MOVE/COPY operation: DEFAULT or a named graph.
 */
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

/**
 * Converts the graph of a CLEAR/DROP operation: DEFAULT, NAMED, ALL or a named graph.
 */
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
    // Parser output always sets one of these, but hand-built input might not.
    if (!graph.name) {
      throw new Error('GraphReference must set one of default/named/all/name');
    }
    return F.graphRefSpecific(
      <SparqlJsTermToTraqula<typeof graph.name>> SUBRULE(termFromSparqlJs, graph.name),
      F.gen(),
    );
  },
};
