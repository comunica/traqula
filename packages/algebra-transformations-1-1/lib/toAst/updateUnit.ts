import type * as RDF from '@rdfjs/types';
import type {
  DatasetClauses,
  GraphRef,
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
import { isVariable, types } from '../toAlgebra';
import type { AstIndir } from './core';
import type { RdfTermToAst } from './general';
import { translateAlgDatasetClauses, translateAlgPattern, translateAlgTerm } from './general';
import { translateAlgPatternNew, algWrapInPatternGroup } from './pattern';
import { removeAlgQuadsRecursive } from './quads';

export const translateAlgUpdateOperation: AstIndir<'translateUpdateOperation', UpdateOperation, [Algebra.Operation]> = {
  name: 'translateUpdateOperation',
  fun: ({ SUBRULE }) => (_, op) => {
    switch (op.type) {
      case types.DELETE_INSERT:
        return SUBRULE(translateAlgDeleteInsert, op);
      case types.LOAD:
        return SUBRULE(translateAlgLoad, op);
      case types.CLEAR:
        return SUBRULE(translateAlgClear, op);
      case types.CREATE:
        return SUBRULE(translateAlgCreate, op);
      case types.DROP:
        return SUBRULE(translateAlgDrop, op);
      case types.ADD:
        return SUBRULE(translateAlgAdd, op);
      case types.MOVE:
        return SUBRULE(translateAlgMove, op);
      case types.COPY:
        return SUBRULE(translateAlgCopy, op);
      default:
        throw new Error(`Unknown Operation type ${op.type}`);
    }
  },
};

export const toUpdate: AstIndir<'toUpdate', Update, [UpdateOperation[]]> = {
  name: 'toUpdate',
  fun: () => ({ astFactory: F }, ops) => ({
    type: 'update',
    updates: ops.map(op => ({ context: [], operation: op })),
    loc: F.gen(),
  } satisfies Update),
};

export const translateAlgCompositeUpdate: AstIndir<'translateCompositeUpdate', Update, [Algebra.CompositeUpdate]> = {
  name: 'translateCompositeUpdate',
  fun: ({ SUBRULE }) => (_, op) =>
    SUBRULE(toUpdate, op.updates.map(update => SUBRULE(translateAlgUpdateOperation, update))),
};

type LikeModify = UpdateOperationModify
  | UpdateOperationDeleteData
  | UpdateOperationDeleteWhere
  | UpdateOperationInsertData;

export const translateAlgDeleteInsert: AstIndir<'translateDeleteInsert', LikeModify, [Algebra.DeleteInsert]> = {
  name: 'translateDeleteInsert',
  fun: ({ SUBRULE }) => ({ astFactory: F }, op) => {
    let where: Algebra.Operation | undefined = op.where;
    let use: DatasetClauses | undefined;
    if (where && where.type === types.FROM) {
      const from = where;
      where = from.input;
      use = SUBRULE(translateAlgDatasetClauses, from.default, from.named);
    }

    const update: UpdateOperationModify = {
      type: 'updateOperation',
      subType: 'modify',
      delete: SUBRULE(convertAlgUpdatePatterns, op.delete ?? []),
      insert: SUBRULE(convertAlgUpdatePatterns, op.insert ?? []),
      where: F.patternGroup([], F.gen()),
      from: use ?? F.datasetClauses([], F.gen()),
      loc: F.gen(),
      graph: undefined,
    };

    // If not an empty where pattern, handle quads
    if (where && (where.type !== types.BGP || where.patterns.length > 0)) {
      const graphs: (RDF.NamedNode | RDF.DefaultGraph)[] = [];
      const result = SUBRULE(translateAlgPatternNew, <typeof where> SUBRULE(removeAlgQuadsRecursive, where, graphs));
      update.where = SUBRULE(algWrapInPatternGroup, result);
      // Graph might not be applied yet since there was no project
      // this can only happen if there was a single graph
      if (graphs.length > 0) {
        if (graphs.length === 1) {
          // Ignore if default graph
          if (graphs.at(0)?.value !== '') {
            update.where.patterns = [
              F.patternGraph(<RdfTermToAst<typeof graphs[0]>>
                SUBRULE(translateAlgTerm, graphs[0]), update.where.patterns, F.gen()),
            ];
          }
        } else {
          throw new Error('This is unexpected and might indicate an error in graph handling for updates.');
        }
      }
    }

    return SUBRULE(cleanupAlgUpdateOperationModify, update, op);
  },
};

/**
 * Return the minimal version of the UpdateOperationModify.
 * Not really necessary but can give cleaner looking queries
 */
export const cleanupAlgUpdateOperationModify:
AstIndir<'cleanUpUpdateOperationModify', LikeModify, [UpdateOperationModify, Algebra.DeleteInsert]> = {
  name: 'cleanUpUpdateOperationModify',
  fun: () => (_, update, op) => {
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
  },
};

export const translateAlgLoad: AstIndir<'translateLoad', UpdateOperationLoad, [Algebra.Load]> = {
  name: 'translateLoad',
  fun: ({ SUBRULE }) => ({ astFactory: F }, op) =>
    F.updateOperationLoad(
      F.gen(),
      <RdfTermToAst<typeof op.source>>SUBRULE(translateAlgTerm, op.source),
      Boolean(op.silent),
      op.destination ?
        F.graphRefSpecific(<RdfTermToAst<typeof op.destination>>SUBRULE(translateAlgTerm, op.destination), F.gen()) :
        undefined,
    ),
};

type GraphToGraphRef<T extends 'DEFAULT' | 'NAMED' | 'ALL' | RDF.NamedNode> = T extends 'DEFAULT' ? GraphRefDefault :
  T extends 'NAMED' ? GraphRefNamed : T extends 'ALL' ? GraphRefAll : GraphRefSpecific;

export const translateAlgGraphRef:
AstIndir<'translateGraphRef', GraphRef, ['DEFAULT' | 'NAMED' | 'ALL' | RDF.NamedNode]> = {
  name: 'translateGraphRef',
  fun: ({ SUBRULE }) => ({ astFactory: F }, graphRef) => {
    if (graphRef === 'DEFAULT') {
      return F.graphRefDefault(F.gen());
    }
    if (graphRef === 'NAMED') {
      return F.graphRefNamed(F.gen());
    }
    if (graphRef === 'ALL') {
      return F.graphRefAll(F.gen());
    }
    return F.graphRefSpecific(<TermIri> SUBRULE(translateAlgTerm, graphRef), F.gen());
  },
};

export const translateAlgClear: AstIndir<'translateClear', UpdateOperationClear, [Algebra.Clear]> = {
  name: 'translateClear',
  fun: ({ SUBRULE }) => ({ astFactory: F }, op) =>
    F.updateOperationClear(SUBRULE(translateAlgGraphRef, op.source), op.silent ?? false, F.gen()),
};

export const translateAlgCreate: AstIndir<'translateCreate', UpdateOperationCreate, [Algebra.Create]> = {
  name: 'translateCreate',
  fun: ({ SUBRULE }) => ({ astFactory: F }, op) =>
    F.updateOperationCreate(
      <GraphToGraphRef<typeof op.source>>SUBRULE(translateAlgGraphRef, op.source),
      op.silent ?? false,
      F.gen(),
    ),
};

export const translateAlgDrop: AstIndir<'translateDrop', UpdateOperationDrop, [Algebra.Drop]> = {
  name: 'translateDrop',
  fun: ({ SUBRULE }) => ({ astFactory: F }, op) =>
    F.updateOperationDrop(SUBRULE(translateAlgGraphRef, op.source), op.silent ?? false, F.gen()),
};

export const translateAlgAdd: AstIndir<'translateAdd', UpdateOperationAdd, [Algebra.Add]> = {
  name: 'translateAdd',
  fun: ({ SUBRULE }) => ({ astFactory: F }, op) =>
    F.updateOperationAdd(
      <GraphToGraphRef<typeof op.source>> SUBRULE(translateAlgGraphRef, op.source),
      <GraphToGraphRef<typeof op.destination>> SUBRULE(translateAlgGraphRef, op.destination),
      op.silent ?? false,
      F.gen(),
    ),
};

export const translateAlgMove: AstIndir<'translateMove', UpdateOperationMove, [Algebra.Move]> = {
  name: 'translateMove',
  fun: ({ SUBRULE }) => ({ astFactory: F }, op) =>
    F.updateOperationMove(
      <GraphToGraphRef<typeof op.source>> SUBRULE(translateAlgGraphRef, op.source),
      <GraphToGraphRef<typeof op.destination>> SUBRULE(translateAlgGraphRef, op.destination),
      op.silent ?? false,
      F.gen(),
    ),
};

export const translateAlgCopy: AstIndir<'translateCopy', UpdateOperationCopy, [Algebra.Copy]> = {
  name: 'translateCopy',
  fun: ({ SUBRULE }) => ({ astFactory: F }, op) =>
    F.updateOperationCopy(
      <GraphToGraphRef<typeof op.source>> SUBRULE(translateAlgGraphRef, op.source),
      <GraphToGraphRef<typeof op.destination>> SUBRULE(translateAlgGraphRef, op.destination),
      op.silent ?? false,
      F.gen(),
    ),
};

/**
 * Similar to removeQuads but more simplified for UPDATES
 */
export const convertAlgUpdatePatterns: AstIndir<'convertUpdatePatterns', Quads[], [Algebra.Pattern[]]> = {
  name: 'convertUpdatePatterns',
  fun: ({ SUBRULE }) => ({ astFactory: F }, patterns) => {
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
      const patternBgp = F.patternBgp(graphs[graph].map(x => SUBRULE(translateAlgPattern, x)), F.gen());
      // If DefaultGraph, de not wrap
      if (graph === '') {
        return patternBgp;
      }
      return F.graphQuads(
        <TermIri | TermVariable> SUBRULE(translateAlgTerm, graphs[graph][0].graph),
        patternBgp,
        F.gen(),
      );
    });
  },
};
