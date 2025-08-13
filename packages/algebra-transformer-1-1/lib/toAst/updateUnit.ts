import type * as RDF from '@rdfjs/types';
import type {
  Pattern,
  Update,
  UpdateOperation,
  UpdateOperationDeleteData,
  UpdateOperationDeleteWhere,
  UpdateOperationInsertData,
  UpdateOperationLoad,
  UpdateOperationModify,

  GraphRefAll,
  GraphRefDefault,
  GraphRefNamed,
  GraphRefSpecific,
  TermIri,
  UpdateOperationCreate,
  UpdateOperationDrop,
  UpdateOperationAdd,
  UpdateOperationMove,
  UpdateOperationCopy,
  UpdateOperationClear,
  Quads,
  TermVariable,
} from '@traqula/rules-sparql-1-1';
import { isomorphic } from 'rdf-isomorphic';
import type { Algebra } from '../index';
import { types } from '../toAlgebra/core';
import type { AstContext } from './core';
import { arrayToPattern } from './expression';
import { translateDatasetClauses, translatePattern, translateTerm } from './general';
import { translateOperation } from './pattern';
import { removeQuadsRecursive } from './quads';

export function toUpdate(c: AstContext, ops: UpdateOperation[]): Update {
  const F = c.astFactory;
  return {
    type: 'update',
    updates: ops.map(op => ({ context: [], operation: op })),
    loc: F.gen(),
  } satisfies Update;
}

export function translateCompositeUpdate(c: AstContext, op: Algebra.CompositeUpdate): Update {
  return toUpdate(c, op.updates.map(update => <UpdateOperation> translateOperation(c, update)));
}

export function translateDeleteInsert(c: AstContext, op: Algebra.DeleteInsert): UpdateOperationModify {
  const F = c.astFactory;
  let where: Algebra.Operation | undefined = op.where;
  let use;
  if (where && where.type === types.FROM) {
    const from = where;
    where = from.input;
    use = translateDatasetClauses(c, from.default, from.named);
  }

  const updates = <[UpdateOperationModify & { where?: unknown; delete?: unknown; insert?: unknown }]> [{
    type: 'updateOperation',
    subType: 'modify',
    delete: convertUpdatePatterns(c, op.delete ?? []),
    insert: convertUpdatePatterns(c, op.insert ?? []),
    where: F.patternGroup([], F.gen()),
    from: use ?? F.datasetClauses([], F.gen()),
    loc: F.gen(),
  }];

  // Corresponds to empty array in SPARQL.js
  if (!where || (where.type === types.BGP && where.patterns.length === 0)) {
    updates[0].where = F.patternGroup([], F.gen());
  } else {
    const graphs: RDF.NamedNode[] = [];
    const result = <Pattern[]> translateOperation(c, removeQuadsRecursive(c, where, graphs));
    updates[0].where = arrayToPattern(c, result);
    // Graph might not be applied yet since there was no project
    // this can only happen if there was a single graph
    if (graphs.length > 0) {
      if (graphs.length !== 1) {
        throw new Error('This is unexpected and might indicate an error in graph handling for updates.');
      }
      // Ignore if default graph
      if (graphs[0]?.value !== '') {
        updates[0].where.patterns = [
          F.patternGraph(translateTerm(c, graphs[0]), updates[0].where.patterns, F.gen()),
        ];
      }
    }
  }

  // Not really necessary but can give cleaner looking queries
  if (!op.delete && !op.where) {
    const asInsert = <UpdateOperationInsertData & { delete?: unknown; where?: unknown }> <unknown> updates[0];
    asInsert.subType = 'insertdata';
    asInsert.data = updates[0].insert;
    delete asInsert.delete;
    delete asInsert.where;
  } else if (!op.insert && !op.where) {
    const asCasted =
      <(UpdateOperationDeleteData | UpdateOperationDeleteWhere) & { insert?: unknown; where?: unknown }>
        <unknown> updates[0];
    asCasted.data = updates[0].delete;
    delete asCasted.insert;
    delete asCasted.where;
    if (op.delete!.some(pattern =>
      pattern.subject.termType === 'Variable' ||
      pattern.predicate.termType === 'Variable' ||
      pattern.object.termType === 'Variable')) {
      asCasted.subType = 'deletewhere';
    } else {
      asCasted.subType = 'deletedata';
    }
  } else if (!op.insert && op.where && op.where.type === 'bgp' && isomorphic(op.delete!, op.where.patterns)) {
    const asCasted = <UpdateOperationDeleteWhere & { where?: unknown; delete?: unknown }> <unknown> updates[0];
    asCasted.data = updates[0].delete;
    delete asCasted.where;
    delete asCasted.delete;
    asCasted.subType = 'deletewhere';
  }

  return updates[0];
}

export function translateLoad(c: AstContext, op: Algebra.Load): UpdateOperationLoad {
  const F = c.astFactory;
  return F.updateOperationLoad(
    F.gen(),
    translateTerm(c, op.source),
    Boolean(op.silent),
    op.destination ? F.graphRefSpecific(translateTerm(c, op.destination), F.gen()) : undefined,
  );
}

type GraphToGraphRef<T extends 'DEFAULT' | 'NAMED' | 'ALL' | RDF.NamedNode> = T extends 'DEFAULT' ? GraphRefDefault :
  T extends 'NAMED' ? GraphRefNamed : T extends 'ALL' ? GraphRefAll : GraphRefSpecific;

export function translateGraphRef<T extends 'DEFAULT' | 'NAMED' | 'ALL' | RDF.NamedNode>(
  c: AstContext,
  graphRef: T,
): GraphToGraphRef<T> {
  const F = c.astFactory;
  if (graphRef === 'DEFAULT') {
    return <GraphToGraphRef<T>> F.graphRefDefault(F.gen());
  }
  if (graphRef === 'NAMED') {
    return <GraphToGraphRef<T>> F.graphRefNamed(F.gen());
  }
  if (graphRef === 'ALL') {
    return <GraphToGraphRef<T>> F.graphRefAll(F.gen());
  }
  return <GraphToGraphRef<T>> F.graphRefSpecific(<TermIri> translateTerm(c, graphRef), F.gen());
}

export function translateClear(c: AstContext, op: Algebra.Clear): UpdateOperationClear {
  const F = c.astFactory;
  return F.updateOperationClear(translateGraphRef(c, op.source), op.silent ?? false, F.gen());
}

export function translateCreate(c: AstContext, op: Algebra.Create): UpdateOperationCreate {
  const F = c.astFactory;
  return F.updateOperationCreate(translateGraphRef(c, op.source), op.silent ?? false, F.gen());
}

export function translateDrop(c: AstContext, op: Algebra.Drop): UpdateOperationDrop {
  const F = c.astFactory;
  return F.updateOperationDrop(translateGraphRef(c, op.source), op.silent ?? false, F.gen());
}

export function translateAdd(c: AstContext, op: Algebra.Add): UpdateOperationAdd {
  const F = c.astFactory;
  return F.updateOperationAdd(
    translateGraphRef(c, op.source),
    translateGraphRef(c, op.destination),
    op.silent ?? false,
    F.gen(),
  );
}

export function translateMove(c: AstContext, op: Algebra.Move): UpdateOperationMove {
  const F = c.astFactory;
  return F.updateOperationMove(
    translateGraphRef(c, op.source),
    translateGraphRef(c, op.destination),
    op.silent ?? false,
    F.gen(),
  );
}

export function translateCopy(c: AstContext, op: Algebra.Copy): UpdateOperationCopy {
  const F = c.astFactory;
  return F.updateOperationCopy(
    translateGraphRef(c, op.source),
    translateGraphRef(c, op.destination),
    op.silent ?? false,
    F.gen(),
  );
}

/**
 * Similar to removeQuads but more simplified for UPDATEs
 */
export function convertUpdatePatterns(c: AstContext, patterns: Algebra.Pattern[]): Quads[] {
  const F = c.astFactory;
  if (!patterns) {
    return [];
  }
  const graphs: Record<string, Algebra.Pattern[]> = {};
  for (const pattern of patterns) {
    const graph = pattern.graph.value;
    if (!graphs[graph]) {
      graphs[graph] = [];
    }
    graphs[graph].push(pattern);
  }
  return Object.keys(graphs).map((graph) => {
    const patternBgp = F.patternBgp(graphs[graph].map(x => translatePattern(c, x)), F.gen());
    if (graph === '') {
      return patternBgp;
    }
    return F.graphQuads(<TermIri | TermVariable> translateTerm(c, graphs[graph][0].graph), patternBgp, F.gen());
  });
}
