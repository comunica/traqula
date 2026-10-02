import type * as RDF from '@rdfjs/types';
import type { BasicGraphPattern, PathPure, TripleCollection, TripleNesting } from '@traqula/rules-sparql-1-1';
import type { Algebra } from '../index.js';
import type { AlgebraIndir, FlattenedTriple } from './core.js';
import { isVariable, types, typeVals } from './core.js';
import { generateFreshVar, translateTerm } from './general.js';

export const translateTripleCollection:
AlgebraIndir<'translateTripleCollection', void, [TripleCollection, FlattenedTriple[]]> = {
  name: 'translateTripleCollection',
  fun: ({ SUBRULE }) => (_, collection, result) => {
    SUBRULE(translateBasicGraphPattern, collection.triples, result);
  },
};

/**
 * When flattening, nested subject triples first, followed by nested object triples, lastly the current tripple.
 */
export const translateBasicGraphPattern:
AlgebraIndir<'translateBasicGraphPattern', void, [BasicGraphPattern, FlattenedTriple[]]> = {
  name: 'translateBasicGraphPattern',
  fun: ({ SUBRULE }) => ({ astFactory: F }, triples, result) => {
    for (const triple of triples) {
      if (F.isTripleCollection(triple)) {
        SUBRULE(translateTripleCollection, triple, result);
      } else {
        SUBRULE(translateTripleNesting, triple, result);
      }
    }
  },
};

/**
 * Generates: everything for the subject collection + everything for the object collection + itself
 */
export const translateTripleNesting:
AlgebraIndir<'translateTripleNesting', void, [TripleNesting, FlattenedTriple[]]> = {
  name: 'translateTripleNesting',
  fun: ({ SUBRULE }) => ({ astFactory: F }, triple, result) => {
    let subject: RDF.Term;
    let predicate: RDF.Term | PathPure;
    let object: RDF.Term;
    if (F.isTripleCollection(triple.subject)) {
      SUBRULE(translateTripleCollection, triple.subject, result);
      subject = SUBRULE(translateTerm, triple.subject.identifier);
    } else {
      subject = SUBRULE(translateTerm, triple.subject);
    }

    if (F.isPathPure(triple.predicate)) {
      predicate = triple.predicate;
    } else {
      predicate = SUBRULE(translateTerm, triple.predicate);
    }

    if (F.isTripleCollection(triple.object)) {
      SUBRULE(translateTripleCollection, triple.object, result);
      object = SUBRULE(translateTerm, triple.object.identifier);
    } else {
      object = SUBRULE(translateTerm, triple.object);
    }

    result.push({
      subject,
      predicate,
      object,
    });
  },
};

/**
 * GRAPH joins the result of a subquery with the graph name (18.5),
 * so the subquery has to project, and group by, the graph variable.
 */
function addGraphVariable(algOp: Algebra.Project | Algebra.Group, graph: RDF.Term): void {
  if (graph.termType === 'Variable' && !algOp.variables.some(v => v.equals(graph))) {
    algOp.variables = [ ...algOp.variables, graph ];
  }
}

/**
 * Translate terms to be of some graph
 * @param c algebraContext
 * @param algOp algebra operation to translate
 * @param graph that should be assigned to the triples in algOp
 * @param replacement used for replacing shadowed variables.
 */
export const recurseGraph:
AlgebraIndir<'recurseGraph', Algebra.Operation, [Algebra.Operation, RDF.Term, RDF.Variable | undefined]> = {
  name: 'recurseGraph',
  fun: ({ SUBRULE }) => ({ algebraFactory: AF }, algOp, graph, replacement) => {
    if (algOp.type === types.GRAPH) {
      if (replacement) {
        // At this point we would lose track of the replacement which would result in incorrect results
        // This would indicate the library is not being used as intended though
        throw new Error('Recursing through nested GRAPH statements with a replacement is impossible.');
      }
      // In case there were nested GRAPH statements that were not recursed yet for some reason
      algOp = SUBRULE(recurseGraph, algOp.input, algOp.name, undefined);
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
        replacement = SUBRULE(generateFreshVar);
      }
      algOp.input = SUBRULE(recurseGraph, algOp.input, graph, replacement);
      addGraphVariable(algOp, graph);
    } else if (algOp.type === types.EXTEND && !replacement) {
      // This can happen if the query extends an expression to the name of the graph
      // since the extend happens here there should be no further occurrences of this name
      // if there are it's the same situation as above
      if (algOp.variable.equals(graph)) {
        replacement = SUBRULE(generateFreshVar);
        // The quads already bind the graph variable, so filter instead of extending it (18.5).
        // COALESCE keeps solutions where the expression errors, as those left the variable unbound.
        const graphExpression = AF.createTermExpression(algOp.variable);
        return AF.createFilter(
          SUBRULE(recurseGraph, algOp.input, graph, replacement),
          AF.createOperatorExpression('=', [
            AF.createOperatorExpression('coalesce', [ algOp.expression, graphExpression ]),
            graphExpression,
          ]),
        );
      }
      algOp.input = SUBRULE(recurseGraph, algOp.input, graph, replacement);
    } else if (algOp.type === types.MINUS && graph.termType === 'Variable') {
      algOp.graphScopeVar = graph;
      algOp.input = [
        SUBRULE(recurseGraph, algOp.input[0], graph, replacement),
        SUBRULE(recurseGraph, algOp.input[1], graph, replacement),
      ];
    } else {
      for (const [ key, value ] of Object.entries(algOp)) {
        const castedKey = <keyof typeof algOp> key;
        if (Array.isArray(value)) {
          algOp[castedKey] = <any> value.map((x: any) => replacement && isVariable(x) && x.equals(graph) ?
            replacement :
            SUBRULE(recurseGraph, x, graph, replacement));
        } else if (typeVals.includes(value.type)) {
          // Can't do instanceof on an interface
          algOp[castedKey] = <any> SUBRULE(recurseGraph, value, graph, replacement);
        } else if (replacement && isVariable(value) && value.equals(graph)) {
          algOp[castedKey] = <any> replacement;
        }
      }
      if (algOp.type === types.PROJECT || algOp.type === types.GROUP) {
        addGraphVariable(algOp, graph);
      }
      if (algOp.type === types.VALUES && replacement) {
        algOp.bindings = algOp.bindings.map(binding => Object.fromEntries(Object.entries(binding)
          .map(([ name, term ]) => [ name === graph.value ? replacement!.value : name, term ])));
      }
    }

    return algOp;
  },
};

export const translateQuad: AlgebraIndir<'translateQuad', Algebra.Pattern, [FlattenedTriple]> = {
  name: 'translateQuad',
  fun: () => ({ astFactory: F, algebraFactory: AF }, quad) => {
    if (F.isPathPure(quad.predicate)) {
      throw new Error('Trying to translate property path to quad.');
    }
    // Graphs are needed here
    return AF.createPattern(quad.subject, quad.predicate, quad.object, (<any>quad).graph);
  },
};
