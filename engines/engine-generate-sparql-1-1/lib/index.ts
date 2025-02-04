import { GeneratorBuilder } from '@traqula/core';
import { gram } from '@traqula/rules-sparql-1-1';
import type * as T11 from '@traqula/rules-sparql-1-1';

const sparql11GeneratorBuilder = GeneratorBuilder.createBuilder(<const> [
  gram.query,
  gram.selectQuery,
  gram.constructQuery,
  gram.describeQuery,
  gram.askQuery,
  gram.valuesClause,
  gram.selectClause,
  gram.constructTemplate,
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
    gram.graphOrDefault,
    gram.graphRef,
    gram.graphRefAll,
    gram.quadData,
    gram.quads,
    gram.quadsNotTriples,
  )
  .addRule(gram.aggregate)
  .addRule(gram.datasetClause)
  .addMany(
    gram.argList,
    gram.expression,
    gram.iriOrFunction,
  )
  .addMany(
    gram.prologue,
    gram.varOrTerm,
    gram.var_,
    gram.graphTerm,
  )
  .addMany(
    gram.rdfLiteral,
    gram.string,
    gram.iri,
    gram.blankNode,
  )
  .addRule(gram.path)
  .addMany(
    gram.solutionModifier,
    gram.groupClause,
    gram.groupCondition,
    gram.havingClause,
    gram.orderClause,
    gram.orderCondition,
    gram.limitOffsetClauses,
  )
  .addRule(gram.triplesBlock)
  .addMany(
    gram.groupGraphPattern,
    gram.graphPatternNotTriples,
    gram.optionalGraphPattern,
    gram.graphGraphPattern,
    gram.serviceGraphPattern,
    gram.bind,
    gram.inlineDataFull,
    gram.dataBlockValue,
    gram.minusGraphPattern,
    gram.groupOrUnionGraphPattern,
    gram.filter,
  );

export class Generator {
  private readonly generator = sparql11GeneratorBuilder.build();

  public generate(ast: T11.Query): string {
    return this.generator.query(ast, undefined, undefined);
  }
}
