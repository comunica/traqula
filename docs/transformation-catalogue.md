# Transformation Catalogue

This is a living document listing implementations of AST and algebra transformations powered by Traqula.

## Ast transformations

1. Default pretty and compact print through Traqula generators (for [SPARQL 1.1](../engines/generator-sparql-1-1) and [SPARQL 1.2](../engines/generator-sparql-1-2)).

## Algebra transformations

1. [Comunica: assign source](https://github.com/comunica/comunica/blob/master/packages/actor-optimize-query-operation-assign-sources-exhaustive/lib/ActorOptimizeQueryOperationAssignSourcesExhaustive.ts#L68)
2. [Comunica: Bgp to join](https://github.com/comunica/comunica/blob/master/packages/actor-optimize-query-operation-bgp-to-join/lib/ActorOptimizeQueryOperationBgpToJoin.ts)
3. [Comunica: construct distinct](https://github.com/comunica/comunica/blob/master/packages/actor-optimize-query-operation-construct-distinct/lib/ActorOptimizeQueryOperationConstructDistinct.ts)
4. [Comunica: describe to construct](https://github.com/comunica/comunica/blob/master/packages/actor-optimize-query-operation-describe-to-constructs-subject/lib/ActorOptimizeQueryOperationDescribeToConstructsSubject.ts)
5. [Comunica: filter pushdown](https://github.com/comunica/comunica/blob/master/packages/actor-optimize-query-operation-filter-pushdown/lib/ActorOptimizeQueryOperationFilterPushdown.ts)
6. [Comunica: join BGPs](https://github.com/comunica/comunica/blob/master/packages/actor-optimize-query-operation-join-bgp/lib/ActorOptimizeQueryOperationJoinBgp.ts)
7. [Comunica: join connected](https://github.com/comunica/comunica/blob/master/packages/actor-optimize-query-operation-join-connected/lib/ActorOptimizeQueryOperationJoinConnected.ts)
8. [Comunica: left join expression pushdown](https://github.com/comunica/comunica/blob/master/packages/actor-optimize-query-operation-leftjoin-expression-pushdown/lib/ActorOptimizeQueryOperationLeftjoinExpressionPushdown.ts)
9. [Comunica: prune empty sources](https://github.com/comunica/comunica/blob/master/packages/actor-optimize-query-operation-prune-empty-source-operations/lib/ActorOptimizeQueryOperationPruneEmptySourceOperations.ts)
10. Comunica: rewrite [add](https://github.com/comunica/comunica/blob/master/packages/actor-optimize-query-operation-rewrite-add/lib/ActorOptimizeQueryOperationRewriteAdd.ts), [copy](https://github.com/comunica/comunica/blob/master/packages/actor-optimize-query-operation-rewrite-copy/lib/ActorOptimizeQueryOperationRewriteCopy.ts), [move](https://github.com/comunica/comunica/blob/master/packages/actor-optimize-query-operation-rewrite-move/lib/ActorOptimizeQueryOperationRewriteMove.ts)
11. [GraphQl to SPARQL: blank nodes inside the query to variables](https://github.com/rubensworks/graphql-to-sparql.js/blob/63128866805d4da23330f4adc1e92265ec772c66/lib/handler/NodeHandlerDocument.ts#L66)
