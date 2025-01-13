import { Builder } from '@traqula/core';
import { gram } from '@traqula/rules-sparql-1-1';
import { subSelectParserBuilder } from './subSelectParser';
import { triplesTemplateParserBuilder } from './triplesTemplateParserBuilder';

const rules = <const> [
  gram.queryUnit,
  gram.query,
  gram.prologue,
  gram.selectQuery,
  gram.constructQuery,
  gram.describeQuery,
  gram.askQuery,
  gram.valuesClause,
  gram.baseDecl,
  gram.prefixDecl,
];

export const queryUnitParserBuilder = Builder.createBuilder(rules)
  // Select Query
  .merge(subSelectParserBuilder, <const> [])
  .addRule(gram.datasetClause)
  .addRule(gram.defaultGraphClause)
  .addRule(gram.namedGraphClause)
  .addRule(gram.sourceSelector)
  // Construct Query
  .addRule(gram.constructTemplate)
  .merge(triplesTemplateParserBuilder, <const> [])
  .addRule(gram.constructTriples);
