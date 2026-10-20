import type { GraphRefSpecific, SparqlQuery, Update, UpdateOperation } from '@traqula/rules-sparql-1-1';
import type * as SparqlJs from 'sparqljs';
import type { SparqlJsCompatIndir, SparqlJsTermToTraqula } from './core.js';
import { graphOrDefaultToGraphRef, graphReferenceToGraphRef } from './graphRef.js';
import { groupPatternsFromSparqlJs } from './pattern.js';
import { contextFromSparqlJs, datasetClausesFromSparqlJs, queryFromSparqlJs } from './query.js';
import { termFromSparqlJs } from './term.js';
import { quadsFromSparqlJs } from './triple.js';

/**
 * Converts a single update operation: INSERT/DELETE DATA, DELETE WHERE, INSERT/DELETE ... WHERE,
 * or a graph management operation (LOAD, CLEAR, CREATE, DROP, ADD, MOVE, COPY).
 */
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
            F.patternGroup(SUBRULE(groupPatternsFromSparqlJs, operation.where), F.gen()),
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

/**
 * Converts an update request. The SPARQL.js AST has a single PREFIX/BASE map for the whole request,
 * so the same context is attached to every operation.
 */
export const updateFromSparqlJs: SparqlJsCompatIndir<'updateFromSparqlJs', Update, [SparqlJs.Update]> = {
  name: 'updateFromSparqlJs',
  fun: ({ SUBRULE }) => (context, update) => {
    const { astFactory: F } = context;
    const updateContext = SUBRULE(contextFromSparqlJs, update.prefixes, update.base);
    // An update without operations (e.g. only a PREFIX) may lack `updates` or have it empty - the SPARQL.js
    // parser omits it, hand-built input may do either. Traqula's parser represents this as a single entry
    // holding just the context.
    const operations = update.updates ?? [];
    return {
      type: 'update',
      updates: operations.length > 0 ?
        operations.map(operation => ({
          operation: SUBRULE(updateOperationFromSparqlJs, operation),
          context: updateContext,
        })) :
          [{ context: updateContext }],
      loc: F.gen(),
    };
  },
};

/**
 * Converts a SPARQL.js-compatible query or update (a SPARQL.js parse result or a hand-built equivalent)
 * into a Traqula {@link SparqlQuery}.
 */
export const sparqlQueryFromSparqlJs: SparqlJsCompatIndir<
  'sparqlQueryFromSparqlJs',
  SparqlQuery,
  [SparqlJs.SparqlQuery]
> = {
  name: 'sparqlQueryFromSparqlJs',
  // An update without operations may lack `type` (the SPARQL.js parser omits it), so anything that is not a
  // query is treated as an update.
  fun: ({ SUBRULE }) => (_, query) =>
    'queryType' in query ? SUBRULE(queryFromSparqlJs, query) : SUBRULE(updateFromSparqlJs, query),
};
