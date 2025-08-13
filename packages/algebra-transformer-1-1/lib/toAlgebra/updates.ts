import type * as RDF from '@rdfjs/types';
import type {
  GraphQuads,
  GraphRef,
  GraphRefAll,
  GraphRefDefault,
  GraphRefNamed,
  PatternBgp,
  TermIri,
  Update,
  UpdateOperation,
  UpdateOperationClear,
  UpdateOperationCreate,
  UpdateOperationDeleteData,
  UpdateOperationDeleteWhere,
  UpdateOperationDrop,
  UpdateOperationInsertData,
  UpdateOperationLoad,
  UpdateOperationModify,
} from '@traqula/rules-sparql-1-1';
import type { Algebra } from '..';
import type { AlgebraContext, FlattenedTriple } from './core';
import { registerContextDefinitions, translateDatasetClause, translateTerm } from './general';
import { translateGraphPattern } from './patterns';
import { recurseGraph, translateBasicGraphPattern, translateQuad } from './tripleAndQuad';

export function translateUpdate(c: AlgebraContext, thingy: Update): Algebra.Operation {
  const updates: Algebra.Update[] = thingy.updates.flatMap((update) => {
    registerContextDefinitions(c, update.context);
    return update.operation ? [ translateSingleUpdate(c, update.operation) ] : [];
  });
  if (updates.length === 0) {
    return c.factory.createNop();
  }
  if (updates.length === 1) {
    return updates[0];
  }
  return c.factory.createCompositeUpdate(updates);
}

export function translateSingleUpdate(c: AlgebraContext, op: UpdateOperation): Algebra.Update {
  const F = c.astFactory;
  if (F.isUpdateOperationLoad(op)) {
    return translateUpdateGraphLoad(c, op);
  }
  if (F.isUpdateOperationClear(op)) {
    return c.factory.createClear(translateGraphRef(c, op.destination), op.silent);
  }
  if (F.isUpdateOperationCreate(op)) {
    return c.factory.createCreate(translateGraphRef(c, op.destination), op.silent);
  }
  if (F.isUpdateOperationDrop(op)) {
    return c.factory.createDrop(translateGraphRef(c, op.destination), op.silent);
  }
  if (F.isUpdateOperationAdd(op)) {
    return c.factory.createAdd(
      translateGraphRef(c, op.source),
      translateGraphRef(c, op.destination),
      op.silent,
    );
  }
  if (F.isUpdateOperationCopy(op)) {
    return c.factory.createCopy(
      translateGraphRef(c, op.source),
      translateGraphRef(c, op.destination),
      op.silent,
    );
  }
  if (F.isUpdateOperationMove(op)) {
    return c.factory.createMove(
      translateGraphRef(c, op.source),
      translateGraphRef(c, op.destination),
      op.silent,
    );
  }
  if (F.isUpdateOperationInsertData(op) || F.isUpdateOperationDeleteData(op) || F.isUpdateOperationDeleteWhere(op) ||
    F.isUpdateOperationModify(op)) {
    return translateInsertDelete(c, op);
  }

  throw new Error(`Unknown update type ${JSON.stringify(op)}`);
}

export function translateInsertDelete(
  c: AlgebraContext,
  op: UpdateOperationInsertData | UpdateOperationDeleteData | UpdateOperationDeleteWhere | UpdateOperationModify,
): Algebra.Update {
  if (!c.useQuads) {
    throw new Error('INSERT/DELETE operations are only supported with quads option enabled');
  }

  const F = c.astFactory;
  const deleteTriples: Algebra.Pattern[] = [];
  const insertTriples: Algebra.Pattern[] = [];
  let where: Algebra.Operation | undefined;
  if (F.isUpdateOperationDeleteData(op) || F.isUpdateOperationDeleteWhere(op)) {
    deleteTriples.push(...op.data.flatMap(quad => translateUpdateTriplesBlock(c, quad)));
    if (F.isUpdateOperationDeleteWhere(op)) {
      where = c.factory.createBgp(deleteTriples);
    }
  } else if (F.isUpdateOperationInsertData(op)) {
    insertTriples.push(...op.data.flatMap(quad => translateUpdateTriplesBlock(c, quad)));
  } else {
    deleteTriples.push(...op.delete.flatMap(quad =>
      translateUpdateTriplesBlock(c, quad, op.graph ? translateTerm(c, op.graph) : op.graph)));
    insertTriples.push(...op.insert.flatMap(quad =>
      translateUpdateTriplesBlock(c, quad, op.graph ? translateTerm(c, op.graph) : op.graph)));
    if (op.where.patterns.length > 0) {
      where = translateGraphPattern(c, op.where);
      const use: { default: RDF.NamedNode[]; named: RDF.NamedNode[] } = translateDatasetClause(c, op.from);
      if (use.default.length > 0 || use.named.length > 0) {
        where = c.factory.createFrom(where, use.default, use.named);
      } else if (F.isUpdateOperationModify(op) && op.graph) {
        // This is equivalent
        where = recurseGraph(c, where, translateTerm(c, op.graph));
      }
    }
  }

  return c.factory.createDeleteInsert(
    deleteTriples.length > 0 ? deleteTriples : undefined,
    insertTriples.length > 0 ? insertTriples : undefined,
    where,
  );
}

// UPDATE parsing will always return quads and have no GRAPH elements
export function translateUpdateTriplesBlock(
  c: AlgebraContext,
  thingy: PatternBgp | GraphQuads,
  graph: RDF.NamedNode | undefined = undefined,
): Algebra.Pattern[] {
  const F = c.astFactory;
  let currentGraph: RDF.NamedNode | RDF.Variable | undefined = graph;
  let patternBgp: PatternBgp;
  if (F.isGraphQuads(thingy)) {
    currentGraph = translateTerm(c, thingy.graph);
    patternBgp = thingy.triples;
  } else {
    patternBgp = thingy;
  }
  let triples: FlattenedTriple[] = [];
  translateBasicGraphPattern(c, patternBgp.triples, triples);
  if (currentGraph) {
    triples = triples.map(triple => Object.assign(triple, { graph: currentGraph }));
  }
  return triples.map(triple => translateQuad(c, triple));
}

type TransformGraphRef<T extends GraphRef> = T extends GraphRefDefault ? 'DEFAULT' : T extends GraphRefNamed ? 'NAMED' :
  T extends GraphRefAll ? 'ALL' : T extends TermIri ? RDF.NamedNode : never;

export function translateGraphRef<T extends GraphRef>(c: AlgebraContext, graph: T): TransformGraphRef<T> {
  const F = c.astFactory;
  if (F.isGraphRefAll(graph)) {
    return <TransformGraphRef<T>> 'ALL';
  }
  if (F.isGraphRefDefault(graph)) {
    return <TransformGraphRef<T>> 'DEFAULT';
  }
  if (F.isGraphRefNamed(graph)) {
    return <TransformGraphRef<T>> 'NAMED';
  }
  return <TransformGraphRef<T>> translateTerm(c, graph.graph);
}

export function translateUpdateGraph(
  c: AlgebraContext,
  op: UpdateOperationClear | UpdateOperationDrop | UpdateOperationCreate,
): Algebra.Update {
  const F = c.astFactory;
  let source: 'DEFAULT' | 'NAMED' | 'ALL' | RDF.NamedNode;
  const dest = op.destination;
  if (F.isGraphRefAll(dest)) {
    source = 'ALL';
  } else if (F.isGraphRefDefault(dest)) {
    source = 'DEFAULT';
  } else if (F.isGraphRefNamed(dest)) {
    source = 'NAMED';
  } else {
    source = translateTerm(c, dest.graph);
  }

  switch (op.subType) {
    case 'clear': return c.factory.createClear(source, op.silent);
    case 'create': return c.factory.createCreate(<RDF.NamedNode> source, op.silent);
    case 'drop': return c.factory.createDrop(source, op.silent);
  }
}

export function translateUpdateGraphLoad(c: AlgebraContext, op: UpdateOperationLoad): Algebra.Load {
  return c.factory.createLoad(
    translateTerm(c, op.source),
    op.destination ? translateTerm(c, op.destination.graph) : undefined,
    op.silent,
  );
}
