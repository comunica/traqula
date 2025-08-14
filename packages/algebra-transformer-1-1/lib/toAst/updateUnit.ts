import type * as RDF from '@rdfjs/types';
import type {
  DatasetClauses,
  GraphRefAll,
  GraphRefDefault,
  GraphRefNamed,
  GraphRefSpecific,
  Quads,
  TermIri,
  TermVariable,
  Update,
  UpdateOperation,
  UpdateOperationAdd,
  UpdateOperationClear,
  UpdateOperationCopy,
  UpdateOperationCreate,
  UpdateOperationDeleteData,
  UpdateOperationDeleteWhere,
  UpdateOperationDrop,
  UpdateOperationInsertData,
  UpdateOperationLoad,
  UpdateOperationModify,
  UpdateOperationMove,
} from '@traqula/rules-sparql-1-1';
import { isomorphic } from 'rdf-isomorphic';
import type { Algebra } from '../index';
import { isVariable, types } from '../toAlgebra/core';
import type { AstContext } from './core';
import { translateDatasetClauses, translatePattern, translateTerm } from './general';
import { translatePatternNew, wrapInPatternGroup } from './pattern';
import { removeQuadsRecursive } from './quads';

export function translateUpdateOperation(c: AstContext, op: Algebra.Operation): UpdateOperation {
  switch (op.type) {
    case types.DELETE_INSERT:
      return translateDeleteInsert(c, op);
    case types.LOAD:
      return translateLoad(c, op);
    case types.CLEAR:
      return translateClear(c, op);
    case types.CREATE:
      return translateCreate(c, op);
    case types.DROP:
      return translateDrop(c, op);
    case types.ADD:
      return translateAdd(c, op);
    case types.MOVE:
      return translateMove(c, op);
    case types.COPY:
      return translateCopy(c, op);
    default:
      throw new Error(`Unknown Operation type ${op.type}`);
  }
}

export function toUpdate(c: AstContext, ops: UpdateOperation[]): Update {
  const F = c.astFactory;
  return {
    type: 'update',
    updates: ops.map(op => ({ context: [], operation: op })),
    loc: F.gen(),
  } satisfies Update;
}

export function translateCompositeUpdate(c: AstContext, op: Algebra.CompositeUpdate): Update {
  return toUpdate(c, op.updates.map(update => translateUpdateOperation(c, update)));
}

function translateDeleteInsert(c: AstContext, op: Algebra.DeleteInsert):
ReturnType<typeof cleanUpUpdateOperationModify> {
  const F = c.astFactory;
  let where: Algebra.Operation | undefined = op.where;
  let use: DatasetClauses | undefined;
  if (where && where.type === types.FROM) {
    const from = where;
    where = from.input;
    use = translateDatasetClauses(c, from.default, from.named);
  }

  const update: UpdateOperationModify = {
    type: 'updateOperation',
    subType: 'modify',
    delete: convertUpdatePatterns(c, op.delete ?? []),
    insert: convertUpdatePatterns(c, op.insert ?? []),
    where: F.patternGroup([], F.gen()),
    from: use ?? F.datasetClauses([], F.gen()),
    loc: F.gen(),
    graph: undefined,
  };

  // If not an empty where pattern, handle quads
  if (where && (where.type !== types.BGP || where.patterns.length > 0)) {
    const graphs: (RDF.NamedNode | RDF.DefaultGraph)[] = [];
    const result = translatePatternNew(c, removeQuadsRecursive(c, where, graphs));
    update.where = wrapInPatternGroup(c, result);
    // Graph might not be applied yet since there was no project
    // this can only happen if there was a single graph
    if (graphs.length > 0) {
      if (graphs.length === 1) {
        // Ignore if default graph
        if (graphs.at(0)?.value !== '') {
          update.where.patterns = [
            F.patternGraph(translateTerm(c, graphs[0]), update.where.patterns, F.gen()),
          ];
        }
      } else {
        throw new Error('This is unexpected and might indicate an error in graph handling for updates.');
      }
    }
  }

  return cleanUpUpdateOperationModify(c, update, op);
}

/**
 * Return the minimal version of the UpdateOperationModify.
 * Not really necessary but can give cleaner looking queries
 */
function cleanUpUpdateOperationModify(c: AstContext, update: UpdateOperationModify, op: Algebra.DeleteInsert):
  UpdateOperationModify | UpdateOperationDeleteData | UpdateOperationDeleteWhere | UpdateOperationInsertData {
  const copy = { ...update };
  // Check Insert Data
  if (!op.delete && !op.where) {
    const asInsert = <UpdateOperationInsertData & { delete?: unknown; where?: unknown }> <unknown> copy;
    asInsert.subType = 'insertdata';
    asInsert.data = copy.insert;
    delete asInsert.delete;
    delete asInsert.where;
    return asInsert;
  }
  // Check DeleteWhere or DeleteData
  if (!op.insert && !op.where) {
    const asCasted =
      <(UpdateOperationDeleteData | UpdateOperationDeleteWhere) & { insert?: unknown; where?: unknown }>
        <unknown> copy;
    asCasted.data = copy.delete;
    delete asCasted.insert;
    delete asCasted.where;
    if (op.delete!.some(pattern =>
      isVariable(pattern.subject) || isVariable(pattern.predicate) || isVariable(pattern.object))) {
      asCasted.subType = 'deletewhere';
    } else {
      asCasted.subType = 'deletedata';
    }
    return asCasted;
  }
  // Check if deleteWhere when modify but isomorphic.
  if (!op.insert && op.where && op.where.type === 'bgp' && isomorphic(op.delete!, op.where.patterns)) {
    const asCasted = <UpdateOperationDeleteWhere & { where?: unknown; delete?: unknown }> <unknown> copy;
    asCasted.data = copy.delete;
    delete asCasted.where;
    delete asCasted.delete;
    asCasted.subType = 'deletewhere';
    return asCasted;
  }
  return update;
}

function translateLoad(c: AstContext, op: Algebra.Load): UpdateOperationLoad {
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

function translateGraphRef<T extends 'DEFAULT' | 'NAMED' | 'ALL' | RDF.NamedNode>(
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

function translateClear(c: AstContext, op: Algebra.Clear): UpdateOperationClear {
  const F = c.astFactory;
  return F.updateOperationClear(translateGraphRef(c, op.source), op.silent ?? false, F.gen());
}

function translateCreate(c: AstContext, op: Algebra.Create): UpdateOperationCreate {
  const F = c.astFactory;
  return F.updateOperationCreate(translateGraphRef(c, op.source), op.silent ?? false, F.gen());
}

function translateDrop(c: AstContext, op: Algebra.Drop): UpdateOperationDrop {
  const F = c.astFactory;
  return F.updateOperationDrop(translateGraphRef(c, op.source), op.silent ?? false, F.gen());
}

function translateAdd(c: AstContext, op: Algebra.Add): UpdateOperationAdd {
  const F = c.astFactory;
  return F.updateOperationAdd(
    translateGraphRef(c, op.source),
    translateGraphRef(c, op.destination),
    op.silent ?? false,
    F.gen(),
  );
}

function translateMove(c: AstContext, op: Algebra.Move): UpdateOperationMove {
  const F = c.astFactory;
  return F.updateOperationMove(
    translateGraphRef(c, op.source),
    translateGraphRef(c, op.destination),
    op.silent ?? false,
    F.gen(),
  );
}

function translateCopy(c: AstContext, op: Algebra.Copy): UpdateOperationCopy {
  const F = c.astFactory;
  return F.updateOperationCopy(
    translateGraphRef(c, op.source),
    translateGraphRef(c, op.destination),
    op.silent ?? false,
    F.gen(),
  );
}

/**
 * Similar to removeQuads but more simplified for UPDATES
 */
function convertUpdatePatterns(c: AstContext, patterns: Algebra.Pattern[]): Quads[] {
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
    // If DefaultGraph, de not wrap
    if (graph === '') {
      return patternBgp;
    }
    return F.graphQuads(<TermIri | TermVariable> translateTerm(c, graphs[graph][0].graph), patternBgp, F.gen());
  });
}
