import { GeneratorBuilder } from '@traqula/core';
import type * as T11 from '@traqula/rules-sparql-1-1';
import { Factory, gram } from '@traqula/rules-sparql-1-1';

const queryOrUpdate: T11.SparqlGeneratorRule<'queryOrUpdate', T11.Query | T11.Update> = {
  name: 'queryOrUpdate',
  gImpl: ({ SUBRULE }) => (ast, { factory: F }) => {
    if (F.isQuery(ast)) {
      SUBRULE(gram.query, ast);
    } else {
      SUBRULE(gram.update, ast);
    }
  },
};

export const sparql11GeneratorBuilder = GeneratorBuilder.create(<const> [
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
  )
  .addRule(queryOrUpdate);

// TODO: document that each object can handle one parallel function call
export type SparqlGenerator = ReturnType<typeof sparql11GeneratorBuilder.build>;

export class Generator {
  private readonly generator: SparqlGenerator = sparql11GeneratorBuilder.build();
  private readonly factory = new Factory();

  public generate(ast: T11.Query | T11.Update, origSource = ''): string {
    return this.generator.queryOrUpdate(ast, {
      factory: this.factory,
      offset: 0,
      origSource,
    });
  }

  public generatePath(ast: T11.Path, origSource = ''): string {
    return this.generator.path(ast, {
      factory: this.factory,
      offset: 0,
      origSource,
    }, undefined);
  }
}
