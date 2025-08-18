import { IndirBuilder } from '@traqula/core';
import type { Query, SparqlQuery } from '@traqula/rules-sparql-1-1';
import type * as Algebra from '../algebra';
import { types } from '../toAlgebra/core';
import type { AstIndir } from './core';
import { registerProjection, createAstContext, resetContext } from './core';
import {
  translateAggregateExpression,
  translateAnyExpression,
  translateExistenceExpression,
  translateExpressionOrOrdering,
  translateExpressionOrWild,
  translateNamedExpression,
  translateOperatorExpression,
  translatePureExpression,
  translatePureOperatorExpression,
  translateWildcardExpression,
} from './expression';
import {
  translateDatasetClauses,
  translateDistinct,
  translateExtend,
  translateOrderBy,
  translatePattern,
  translateReduced,
  translateTerm,
} from './general';
import {
  translateAlt,
  translateInv,
  translateLink,
  translateNps,
  translateOneOrMorePath,
  translatePathComponent,
  translateSeq,
  translateZeroOrMorePath,
  translateZeroOrOnePath,
} from './path';
import {
  operationInputAsPatternList,
  translateBgp,
  translateBoundAggregate,
  translateFilter,
  translateFrom,
  translateGraph,
  translateGroup,
  translateJoin,
  translateLeftJoin,
  translateMinus,
  translatePath,
  translatePatternIntoGroup,
  translatePatternNew,
  translateService,
  translateSinglePattern,
  translateSlice,
  translateUnion,
  translateValues,
  wrapInPatternGroup,
} from './pattern';
import { removeQuads, removeQuadsRecursive, splitBgpToGraphs } from './quads';
import {
  filterReplace,
  objectContainsVariable,
  putExtensionsInGroup,
  registerGroupBy,
  registerOrderBy,
  registerVariables,
  replaceAggregatorVariables,
  translateConstruct,
  translateProject,
} from './queryUnit';
import {
  cleanUpUpdateOperationModify,
  convertUpdatePatterns,
  toUpdate,
  translateAdd,
  translateClear,
  translateCompositeUpdate,
  translateCopy,
  translateCreate,
  translateDeleteInsert,
  translateDrop,
  translateGraphRef,
  translateLoad,
  translateMove,
  translateUpdateOperation,
} from './updateUnit';

export const toSparqlJs: AstIndir<'toSparqlJs', SparqlQuery, [Algebra.Operation]> = {
  name: 'toSparqlJs',
  fun: ({ SUBRULE }) => (_, op) => {
    SUBRULE(resetContext);
    op = SUBRULE(removeQuads, op);
    if (op.type === types.COMPOSITE_UPDATE) {
      return SUBRULE(translateCompositeUpdate, op);
    }
    if (op.type === types.NOP) {
      return SUBRULE(toUpdate, []);
    }
    try {
      return SUBRULE(toUpdate, [ SUBRULE(translateUpdateOperation, op) ]);
    } catch { /* That's okay, it's not an update */}
    // If no Update, must be query.
    const result = SUBRULE(translatePatternIntoGroup, op);
    return <Query> result.patterns[0];
  },
};

export const toAstBuilder = IndirBuilder
  .create(<const> [ resetContext, registerProjection ])
  .addMany(
    translatePureExpression,
    translateExpressionOrWild,
    translateExpressionOrOrdering,
    translateAnyExpression,
    translateAggregateExpression,
    translateExistenceExpression,
    translateNamedExpression,
    translatePureOperatorExpression,
    translateOperatorExpression,
    translateWildcardExpression,
    // General
    translateTerm,
    translateExtend,
    translateDatasetClauses,
    translateOrderBy,
    translatePattern,
    translateReduced,
    translateDistinct,
    // Path
    translatePathComponent,
    translateAlt,
    translateInv,
    translateLink,
    translateNps,
    translateOneOrMorePath,
    translateSeq,
    translateZeroOrMorePath,
    translateZeroOrOnePath,
  )
  .addMany(
    // Pattern
    translatePatternIntoGroup,
    translateSinglePattern,
    translatePatternNew,
    translateBoundAggregate,
    translateBgp,
    translatePath,
    translateFrom,
    translateFilter,
    translateGraph,
    translateGroup,
    translateJoin,
    translateLeftJoin,
    translateMinus,
    translateService,
    operationInputAsPatternList,
    translateSlice,
    wrapInPatternGroup,
    translateUnion,
    translateValues,
    // Quads
    removeQuads,
    removeQuadsRecursive,
    splitBgpToGraphs,
    // QueryUnit
    translateConstruct,
    replaceAggregatorVariables,
    translateProject,
    registerGroupBy,
    registerOrderBy,
    registerVariables,
    putExtensionsInGroup,
    filterReplace,
    objectContainsVariable,
    // UpdateUnit
    translateUpdateOperation,
    toUpdate,
    translateCompositeUpdate,
    translateDeleteInsert,
    cleanUpUpdateOperationModify,
    translateLoad,
    translateGraphRef,
    translateClear,
    translateCreate,
    translateDrop,
    translateAdd,
    translateMove,
    translateCopy,
    convertUpdatePatterns,
    // ToAst
    toSparqlJs,
  );

export function toSparql(op: Algebra.Operation): SparqlQuery {
  const c = createAstContext();
  const transformer = toAstBuilder.build();
  return transformer.toSparqlJs(c, op);
}
