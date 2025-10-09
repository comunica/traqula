import { GeneratorBuilder } from '@traqula/core';
import type * as T11 from '@traqula/rules-sparql-1-1';
import { completeParseContext, AstFactory, gram } from '@traqula/rules-sparql-1-1';

export const sparql11GeneratorBuilder = GeneratorBuilder.create(<const> [
  gram.queryOrUpdate,
  gram.query,
  gram.selectQuery,
  gram.constructQuery,
  gram.describeQuery,
  gram.askQuery,
  gram.selectClause,
])
  .addMany(
    gram.update,
    gram.update1,
    gram.load,
    gram.clear,
    gram.drop,
    gram.create,
    gram.copy,
    gram.move,
    gram.add,
    gram.insertData,
    gram.deleteData,
    gram.deleteWhere,
    gram.modify,
    gram.graphRef,
    gram.graphRefAll,
    gram.quads,
    gram.quadsNotTriples,
  )
  .addRule(gram.aggregate)
  .addMany(
    gram.datasetClauseStar,
    gram.usingClauseStar,
  )
  .addMany(
    gram.argList,
    gram.expression,
    gram.iriOrFunction,
  )
  .addMany(
    gram.prologue,
    gram.prefixDecl,
    gram.baseDecl,
    gram.varOrTerm,
    gram.var_,
    gram.graphTerm,
  )
  .addMany(
    gram.rdfLiteral,
    gram.iri,
    gram.iriFull,
    gram.prefixedName,
    gram.blankNode,
  )
  .addRule(gram.pathGenerator)
  .addMany(
    gram.solutionModifier,
    gram.groupClause,
    gram.havingClause,
    gram.orderClause,
    gram.limitOffsetClauses,
  )
  .addMany(
    gram.triplesBlock,
    gram.collectionPath,
    gram.blankNodePropertyListPath,
    gram.triplesNodePath,
    gram.graphNodePath,
  )
  .addMany(
    gram.whereClause,
    gram.generatePattern,
    gram.groupGraphPattern,
    gram.graphPatternNotTriples,
    gram.optionalGraphPattern,
    gram.graphGraphPattern,
    gram.serviceGraphPattern,
    gram.bind,
    gram.inlineData,
    gram.minusGraphPattern,
    gram.groupOrUnionGraphPattern,
    gram.filter,
  );

export type SparqlGenerator = ReturnType<typeof sparql11GeneratorBuilder.build>;

export class Generator {
  public constructor(private readonly defaultContext: Partial<T11.SparqlGeneratorContext> = {}) {}

  private readonly generator: SparqlGenerator = sparql11GeneratorBuilder.build();
  private readonly factory = new AstFactory();

  public generate(ast: T11.Query | T11.Update, context: Partial<T11.SparqlGeneratorContext> = {}): string {
    return this.generator.queryOrUpdate(ast, completeParseContext({ ...this.defaultContext, ...context })).trim();
  }

  public generatePath(ast: T11.Path, context: Partial<T11.SparqlGeneratorContext> = {}): string {
    return this.generator.path(ast, completeParseContext({ ...this.defaultContext, ...context }), undefined).trim();
  }
}
