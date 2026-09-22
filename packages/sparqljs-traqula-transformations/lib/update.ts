import type { GraphRefSpecific, SparqlQuery, Update, UpdateOperation } from '@traqula/rules-sparql-1-1';
import type * as SparqlJs from 'sparqljs';
import type { SparqlJsCompatIndir, SparqlJsTermToTraqula } from './core.js';
import { graphOrDefaultToGraphRef, graphReferenceToGraphRef } from './graphRef.js';
import { patternFromSparqlJs } from './pattern.js';
import { contextFromSparqlJs, datasetClausesFromSparqlJs, queryFromSparqlJs } from './query.js';
import { termFromSparqlJs } from './term.js';
import { quadsFromSparqlJs } from './triple.js';

export const updateOperationFromSparqlJs: SparqlJsCompatIndir<
  'updateOperationFromSparqlJs',
  UpdateOperation,
  [SparqlJs.UpdateOperation]
> = {
  name: 'updateOperationFromSparqlJs',
  fun: ({ SUBRULE }) => (context, operation) => {
    const { astFactory: F } = context;
    if ('updateType' in operation) {
      switch (operation.updateType) {
        case 'insert':
          return F.updateOperationInsertData(SUBRULE(quadsFromSparqlJs, operation.insert), F.gen());
        case 'delete':
          return F.updateOperationDeleteData(SUBRULE(quadsFromSparqlJs, operation.delete), F.gen());
        case 'deletewhere':
          return F.updateOperationDeleteWhere(SUBRULE(quadsFromSparqlJs, operation.delete), F.gen());
        case 'insertdelete':
          return F.updateOperationModify(
            F.gen(),
            SUBRULE(quadsFromSparqlJs, operation.insert),
            SUBRULE(quadsFromSparqlJs, operation.delete),
            F.patternGroup(operation.where.map(p => SUBRULE(patternFromSparqlJs, p)), F.gen()),
            SUBRULE(datasetClausesFromSparqlJs, operation.using),
            operation.graph ?
              <SparqlJsTermToTraqula<typeof operation.graph>> SUBRULE(termFromSparqlJs, operation.graph) :
              undefined,
          );
        default:
          throw new Error(`Cannot convert sparqljs update of updateType '${(<{ updateType: string }> operation).updateType}'`);
      }
    }
    switch (operation.type) {
      case 'load': {
        const destination = operation.destination ?
          F.graphRefSpecific(
            <SparqlJsTermToTraqula<typeof operation.destination>> SUBRULE(termFromSparqlJs, operation.destination),
            F.gen(),
          ) :
          undefined;
        const source = <SparqlJsTermToTraqula<typeof operation.source>> SUBRULE(termFromSparqlJs, operation.source);
        return F.updateOperationLoad(F.gen(), source, operation.silent, destination);
      }
      case 'create':
        return F.updateOperationCreate(
          <GraphRefSpecific> SUBRULE(graphOrDefaultToGraphRef, operation.graph),
          operation.silent,
          F.gen(),
        );
      case 'clear':
        return F.updateOperationClear(SUBRULE(graphReferenceToGraphRef, operation.graph), operation.silent, F.gen());
      case 'drop':
        return F.updateOperationDrop(SUBRULE(graphReferenceToGraphRef, operation.graph), operation.silent, F.gen());
      case 'add':
        return F.updateOperationAdd(
          SUBRULE(graphOrDefaultToGraphRef, operation.source),
          SUBRULE(graphOrDefaultToGraphRef, operation.destination),
          operation.silent,
          F.gen(),
        );
      case 'move':
        return F.updateOperationMove(
          SUBRULE(graphOrDefaultToGraphRef, operation.source),
          SUBRULE(graphOrDefaultToGraphRef, operation.destination),
          operation.silent,
          F.gen(),
        );
      case 'copy':
        return F.updateOperationCopy(
          SUBRULE(graphOrDefaultToGraphRef, operation.source),
          SUBRULE(graphOrDefaultToGraphRef, operation.destination),
          operation.silent,
          F.gen(),
        );
      default:
        throw new Error(`Cannot convert sparqljs update of type '${(<{ type: string }> operation).type}'`);
    }
  },
};

export const updateFromSparqlJs: SparqlJsCompatIndir<'updateFromSparqlJs', Update, [SparqlJs.Update]> = {
  name: 'updateFromSparqlJs',
  fun: ({ SUBRULE }) => (context, update) => {
    const { astFactory: F } = context;
    // Sparqljs merges every PREFIX/BASE declaration in the whole update into one flat map, so - unlike a
    // native Traqula parse - the same (flattened) context ends up attached to every operation.
    const updateContext = SUBRULE(contextFromSparqlJs, update.prefixes, update.base);
    return {
      type: 'update',
      updates: update.updates.map(operation => ({
        operation: SUBRULE(updateOperationFromSparqlJs, operation),
        context: updateContext,
      })),
      loc: F.gen(),
    };
  },
};

/**
 * Converts a full sparqljs parse result (`new (require('sparqljs').Parser)().parse(queryString)`) into a
 * Traqula {@link SparqlQuery} AST.
 */
export const sparqlQueryFromSparqlJs: SparqlJsCompatIndir<
  'sparqlQueryFromSparqlJs',
  SparqlQuery,
  [SparqlJs.SparqlQuery]
> = {
  name: 'sparqlQueryFromSparqlJs',
  fun: ({ SUBRULE }) => (context, query) =>
    query.type === 'update' ? SUBRULE(updateFromSparqlJs, query) : SUBRULE(queryFromSparqlJs, query),
};
