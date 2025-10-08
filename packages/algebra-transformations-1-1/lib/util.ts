import type * as RDF from '@rdfjs/types';
import { someTermsNested } from 'rdf-terms';
import * as A from './algebra.js';
import { ExpressionTypes, Types } from './algebra.js';

/**
 * Flattens an array of arrays to an array.
 * @param arr - Array of arrays
 */
export function flatten<T>(arr: (T[] | T)[]): T[] {
  return (<T[][]>arr).flat().filter(Boolean);
}

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
 * @returns {Variable[]} - List of unique in-scope variables.
 */
export function inScopeVariables(op: A.BaseOperation): RDF.Variable[] {
  const variables: Record<string, RDF.Variable> = {};

  function addVariable(v: RDF.Variable): void {
    variables[v.value] = v;
  }

  function recurseTerm(quad: RDF.BaseQuad): void {
    if (quad.subject.termType === 'Variable') {
      addVariable(quad.subject);
    }
    if (quad.predicate.termType === 'Variable') {
      addVariable(quad.predicate);
    }
    if (quad.object.termType === 'Variable') {
      addVariable(quad.object);
    }
    if (quad.graph.termType === 'Variable') {
      addVariable(quad.graph);
    }
    if (quad.subject.termType === 'Quad') {
      recurseTerm(quad.subject);
    }
    if (quad.predicate.termType === 'Quad') {
      recurseTerm(quad.predicate);
    }
    if (quad.object.termType === 'Quad') {
      recurseTerm(quad.object);
    }
    if (quad.graph.termType === 'Quad') {
      recurseTerm(quad.graph);
    }
  }

  // https://www.w3.org/TR/sparql11-query/#variableScope
  A.visitOperation(op, {
    [Types.EXPRESSION]: { visitor: (op) => {
      if (op.subType === ExpressionTypes.AGGREGATE && (<any> op).variable) {
        addVariable((<any> op).variable);
      }
    } },
    [Types.EXTEND]: { visitor: op => addVariable(op.variable) },
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
    [Types.PROJECT]: { visitor: (op) => {
      for (const v of op.variables) {
        addVariable(v);
      }
    } },
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

export function createUniqueVariable(
  label: string,
  variables: Set<string>,
  dataFactory: RDF.DataFactory<RDF.BaseQuad, RDF.BaseQuad>,
): RDF.Variable {
  let counter = 0;
  let labelLoop = label;
  while (variables.has(labelLoop)) {
    labelLoop = `${label}${counter++}`;
  }
  return dataFactory.variable!(labelLoop);
}

// Separate terms from wildcard since we handle them differently
export function isSimpleTerm(term: any): term is RDF.Term {
  return term.termType !== undefined && term.termType !== 'Quad' && term.termType !== 'wildcard' &&
    term.termType !== 'Wildcard';
}

export function isQuad(term: any): term is RDF.Quad {
  return term.termType === 'Quad';
}

export function hasQuadVariables(quad: RDF.Quad): boolean {
  return someTermsNested(quad, term => term.termType === 'Variable');
}

/**
 * @interface RecurseResult
 * @property {Operation} result - The resulting A.Operation.
 * @property {boolean} recurse - Whether to continue with recursion.
 * @property {boolean} copyMetadata - If the metadata object should be copied. Defaults to true.
 */
export interface RecurseResult {
  result: A.BaseOperation;
  recurse: boolean;
  copyMetadata?: boolean;
}

/**
 * @interface ExpressionRecurseResult
 * @property {Expression} result - The resulting A.Expression.
 * @property {boolean} recurse - Whether to continue with recursion.
 * @property {boolean} copyMetadata - If the metadata object should be copied. Defaults to true.
 */
export interface ExpressionRecurseResult {
  result: A.BaseExpression;
  recurse: boolean;
  copyMetadata?: boolean;
}
