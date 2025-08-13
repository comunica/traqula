import type * as RDF from '@rdfjs/types';
import type {BasicGraphPattern, PathPure, TripleCollection, TripleNesting} from '@traqula/rules-sparql-1-1';
import {AlgebraContext, FlattenedTriple, isVariable, types, typeVals} from './core';
import type {Algebra} from "../index";
import {generateFreshVar, translateTerm} from "./general";

export function translateTripleCollection(
  c: AlgebraContext,
  collection: TripleCollection,
  result: FlattenedTriple[],
): void {
  translateBasicGraphPattern(c, collection.triples, result);
}

/**
 * When flattening, nested subject triples first, followed by nested object triples, lastly the current tripple.
 */
export function translateBasicGraphPattern(
  c: AlgebraContext,
  triples: BasicGraphPattern,
  result: FlattenedTriple[],
): void {
  const F = c.astFactory;
  for (const triple of triples) {
    if (F.isTripleCollection(triple)) {
      translateBasicGraphPattern(c, triple.triples, result);
    } else {
      translateTripleNesting(c, triple, result);
    }
  }
}

export function translateTripleNesting(c: AlgebraContext, triple: TripleNesting, result: FlattenedTriple[]): void {
  const F = c.astFactory;
  let subject: RDF.Term;
  let predicate: RDF.Term | PathPure;
  let object: RDF.Term;
  if (F.isTripleCollection(triple.subject)) {
    translateTripleCollection(c, triple.subject, result);
    subject = translateTerm(c, triple.subject.identifier);
  } else {
    subject = translateTerm(c, triple.subject);
  }

  if (F.isPathPure(triple.predicate)) {
    predicate = triple.predicate;
  } else {
    predicate = translateTerm(c, triple.predicate);
  }

  if (F.isTripleCollection(triple.object)) {
    translateTripleCollection(c, triple.object, result);
    object = translateTerm(c, triple.object.identifier);
  } else {
    object = translateTerm(c, triple.object);
  }

  result.push({
    subject,
    predicate,
    object,
  });
}

/**
 * Translate terms to be of some graph
 * @param c algebraContext
 * @param algOp algebra operation to translate
 * @param graph that should be assigned to the triples in algOp
 * @param replacement used for replacing shadowed variables.
 */
export function recurseGraph(
  c: AlgebraContext,
  algOp: Algebra.Operation,
  graph: RDF.Term,
  replacement?: RDF.Variable,
): Algebra.Operation {
  if (algOp.type === types.GRAPH) {
    if (replacement) {
      // At this point we would lose track of the replacement which would result in incorrect results
      // This would indicate the library is not being used as intended though
      throw new Error('Recursing through nested GRAPH statements with a replacement is impossible.');
    }
    // In case there were nested GRAPH statements that were not recursed yet for some reason
    algOp = recurseGraph(c, algOp.input, algOp.name);
  } else if (algOp.type === types.SERVICE) {
    // Service blocks are not affected by enclosing GRAPH statements, so nothing is modified in this block.
    // See https://github.com/joachimvh/SPARQLAlgebra.js/pull/104#issuecomment-1838016303
  } else if (algOp.type === types.BGP) {
    algOp.patterns = algOp.patterns.map((quad) => {
      if (replacement) {
        if (quad.subject.equals(graph)) {
          quad.subject = replacement;
        }
        if (quad.predicate.equals(graph)) {
          quad.predicate = replacement;
        }
        if (quad.object.equals(graph)) {
          quad.object = replacement;
        }
      }
      if (quad.graph.termType === 'DefaultGraph') {
        quad.graph = graph;
      }
      return quad;
    });
  } else if (algOp.type === types.PATH) {
    if (replacement) {
      if (algOp.subject.equals(graph)) {
        algOp.subject = replacement;
      }
      if (algOp.object.equals(graph)) {
        algOp.object = replacement;
      }
    }
    if (algOp.graph.termType === 'DefaultGraph') {
      algOp.graph = graph;
    }
  } else if (algOp.type === types.PROJECT && !replacement) {
    // Need to replace variables in subqueries should the graph also be a variable of the same name
    // unless the subquery projects that variable
    if (!algOp.variables.some(v => v.equals(graph))) {
      replacement = generateFreshVar(c);
    }
    algOp.input = recurseGraph(c, algOp.input, graph, replacement);
  } else if (algOp.type === types.EXTEND && !replacement) {
    // This can happen if the query extends an expression to the name of the graph
    // since the extend happens here there should be no further occurrences of this name
    // if there are it's the same situation as above
    if (algOp.variable.equals(graph)) {
      replacement = generateFreshVar(c);
    }
    algOp.input = recurseGraph(c, algOp.input, graph, replacement);
  } else {
    for (const key of Object.keys(algOp)) {
      if (Array.isArray(algOp[key])) {
        algOp[key] = algOp[key].map((x: any) => recurseGraph(c, x, graph, replacement));
      } else if (typeVals.includes(algOp[key].type)) {
        // Can't do instanceof on an interface
        algOp[key] = recurseGraph(c, algOp[key], graph, replacement);
      } else if (replacement && isVariable(algOp[key]) && algOp[key].equals(graph)) {
        algOp[key] = replacement;
      }
    }
  }

  return algOp;
}

export function translateQuad(c: AlgebraContext, quad: FlattenedTriple): Algebra.Pattern {
  if (c.astFactory.isPathPure(quad.predicate)) {
    throw new Error('Trying to translate property path to quad.');
  }
  // Graphs are needed here
  // TODO: investigate if typings are wrong or if we internally add graphs to these
  return c.factory.createPattern(quad.subject, quad.predicate, quad.object, (<any>quad).graph);
}