import type * as RDF from '@rdfjs/types';
import { TransformerSubTyped } from '@traqula/core';
import type * as A from './algebra.js';
import { ExpressionTypes, Types } from './algebra.js';

const transformer = new TransformerSubTyped<A.Operation>({}, {
  // Optimization that causes search tree pruning
  [Types.PATTERN]: { ignoreKeys: new Set([ 'subject', 'predicate', 'object', 'graph' ]) },
  [Types.EXPRESSION]: { ignoreKeys: new Set([ 'name', 'term', 'wildcard', 'variable' ]) },
  [Types.DESCRIBE]: { ignoreKeys: new Set([ 'terms' ]) },
  [Types.EXTEND]: { ignoreKeys: new Set([ 'variable' ]) },
  [Types.FROM]: { ignoreKeys: new Set([ 'default', 'named' ]) },
  [Types.GRAPH]: { ignoreKeys: new Set([ 'name' ]) },
  [Types.GROUP]: { ignoreKeys: new Set([ 'variables' ]) },
  [Types.LINK]: { ignoreKeys: new Set([ 'iri' ]) },
  [Types.NPS]: { ignoreKeys: new Set([ 'iris' ]) },
  [Types.PATH]: { ignoreKeys: new Set([ 'subject', 'object', 'graph' ]) },
  [Types.PROJECT]: { ignoreKeys: new Set([ 'variables' ]) },
  [Types.SERVICE]: { ignoreKeys: new Set([ 'name' ]) },
  [Types.VALUES]: { ignoreKeys: new Set([ 'variables', 'bindings' ]) },
  [Types.LOAD]: { ignoreKeys: new Set([ 'source', 'destination' ]) },
  [Types.CLEAR]: { ignoreKeys: new Set([ 'source' ]) },
  [Types.CREATE]: { ignoreKeys: new Set([ 'source' ]) },
  [Types.DROP]: { ignoreKeys: new Set([ 'source' ]) },
  [Types.ADD]: { ignoreKeys: new Set([ 'source', 'destination' ]) },
  [Types.MOVE]: { ignoreKeys: new Set([ 'source', 'destination' ]) },
  [Types.COPY]: { ignoreKeys: new Set([ 'source', 'destination' ]) },
});
export const mapOperation = transformer.transformNode.bind(transformer);
export const mapOperationSub = transformer.transformNodeSpecific.bind(transformer);
export const visitOperation = transformer.visitNode.bind(transformer);
export const visitOperationSub = transformer.visitNodeSpecific.bind(transformer);

/**
 * Resolves an IRI against a base path in accordance to the [Syntax for IRIs](https://www.w3.org/TR/sparql11-query/#QSynIRI)
 */
export function resolveIRI(iri: string, base: string | undefined): string {
  // Return absolute IRIs unmodified
  if (/^[a-z][\d+.a-z-]*:/iu.test(iri)) {
    return iri;
  }
  if (!base) {
    throw new Error(`Cannot resolve relative IRI ${iri} because no base IRI was set.`);
  }
  switch (iri[0]) {
    // An empty relative IRI indicates the base IRI
    case undefined:
      return base;
      // Resolve relative fragment IRIs against the base IRI
    case '#':
      return base + iri;
      // Resolve relative query string IRIs by replacing the query string
    case '?':
      return base.replace(/(?:\?.*)?$/u, iri);
      // Resolve root relative IRIs at the root of the base IRI
    case '/': {
      const baseMatch = /^(?:[a-z]+:\/*)?[^/]*/u.exec(base);
      if (!baseMatch) {
        throw new Error(`Could not determine relative IRI using base: ${base}`);
      }
      const baseRoot = baseMatch[0];
      return baseRoot + iri;
    }
    // Resolve all other IRIs at the base IRI's path
    default: {
      // Const lastSemi = base.lastIndexOf(':');
      // const lastSlash = base.lastIndexOf('/');
      // let basePath;
      // if (lastSlash === -1 && lastSemi === -1) {
      //   basePath = '';
      // } else if (lastSlash > lastSemi) {
      //   basePath = base.slice(0, lastSlash);
      // } else {
      //   basePath = base.slice(0, lastSemi);
      // }
      const basePath = base.replace(/[^/:]*$/u, '');
      return basePath + iri;
    }
  }
}

/**
 * Outputs a JSON object corresponding to the input algebra-like.
 */
export function objectify(algebra: any): any {
  if (algebra.termType) {
    if (algebra.termType === 'Quad') {
      return {
        type: 'pattern',
        termType: 'Quad',
        subject: objectify(algebra.subject),
        predicate: objectify(algebra.predicate),
        object: objectify(algebra.object),
        graph: objectify(algebra.graph),
      };
    }
    const result: any = { termType: algebra.termType, value: algebra.value };
    if (algebra.language) {
      result.language = algebra.language;
    }
    if (algebra.datatype) {
      result.datatype = objectify(algebra.datatype);
    }
    return result;
  }
  if (Array.isArray(algebra)) {
    return algebra.map(e => objectify(e));
  }
  if (algebra === Object(algebra)) {
    const result: any = {};
    for (const key of Object.keys(algebra)) {
      result[key] = objectify(algebra[key]);
    }
    return result;
  }
  return algebra;
}

/**
 * Detects all in-scope variables.
 * In practice this means iterating through the entire algebra tree, finding all variables,
 * and stopping when a project function is found.
 * @param {Operation} op - Input algebra tree.
 * @param visitor the visitor to be used to traverse the various nodes.
 * Allows you to provide a visitor with different default preVisitor cotexts.
 * @returns {Variable[]} - List of unique in-scope variables.
 */
export function inScopeVariables(
  op: A.BaseOperation,
  visitor: typeof visitOperation = visitOperation,
): RDF.Variable[] {
  const variables: Record<string, RDF.Variable> = {};

  function addVariable(v: RDF.Variable): void {
    variables[v.value] = v;
  }

  function recurseTerm(quad: RDF.BaseQuad): void {
    // Subject
    if (quad.subject.termType === 'Variable') {
      addVariable(quad.subject);
    }
    if (quad.subject.termType === 'Quad') {
      recurseTerm(quad.subject);
    }

    // Predicate
    if (quad.predicate.termType === 'Variable') {
      addVariable(quad.predicate);
    }
    if (quad.predicate.termType === 'Quad') {
      recurseTerm(quad.predicate);
    }

    // Object
    if (quad.object.termType === 'Variable') {
      addVariable(quad.object);
    }
    if (quad.object.termType === 'Quad') {
      recurseTerm(quad.object);
    }

    // Graph
    if (quad.graph.termType === 'Variable') {
      addVariable(quad.graph);
    }
    if (quad.graph.termType === 'Quad') {
      recurseTerm(quad.graph);
    }
  }

  // https://www.w3.org/TR/sparql11-query/#variableScope
  visitor(op, {
    [Types.EXPRESSION]: { visitor: (op: A.Expression & { variable?: RDF.Variable }) => {
      if (op.subType === ExpressionTypes.AGGREGATE && (op).variable) {
        addVariable((op).variable);
      }
    } },
    [Types.EXTEND]: { visitor: op =>
      addVariable(op.variable),
    },
    [Types.GRAPH]: { visitor: (op) => {
      if (op.name.termType === 'Variable') {
        addVariable(op.name);
      }
    } },
    [Types.GROUP]: { visitor: (op) => {
      for (const v of op.variables) {
        addVariable(v);
      }
    } },
    [Types.PATH]: { visitor: (op) => {
      if (op.subject.termType === 'Variable') {
        addVariable(op.subject);
      }
      if (op.object.termType === 'Variable') {
        addVariable(op.object);
      }
      if (op.graph.termType === 'Variable') {
        addVariable(op.graph);
      }
      if (op.subject.termType === 'Quad') {
        recurseTerm(op.subject);
      }
      if (op.object.termType === 'Quad') {
        recurseTerm(op.object);
      }
      if (op.graph.termType === 'Quad') {
        recurseTerm(op.graph);
      }
    } },
    [Types.PATTERN]: { visitor: op => recurseTerm(op) },
    [Types.PROJECT]: {
      preVisitor: () => ({ continue: false }),
      visitor: (op) => {
        for (const v of op.variables) {
          addVariable(v);
        }
      },
    },
    [Types.SERVICE]: { visitor: (op) => {
      if (op.name.termType === 'Variable') {
        addVariable(op.name);
      }
    } },
    [Types.VALUES]: { visitor: (op) => {
      for (const v of op.variables) {
        addVariable(v);
      }
    } },
  });

  return Object.values(variables);
}
