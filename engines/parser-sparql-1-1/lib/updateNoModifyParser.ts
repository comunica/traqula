import { Builder } from '@traqula/core';
import type { UpdateOperation } from '@traqula/rules-sparql-1-1';
import { gram } from '@traqula/rules-sparql-1-1';
import { triplesTemplateParserBuilder } from './triplesTemplateParserBuilder';

const update1Patch: typeof gram.update1 = {
  name: 'update1',
  impl: ({ SUBRULE, OR }) => () => OR<UpdateOperation>([
    { ALT: () => SUBRULE(gram.load, undefined) },
    { ALT: () => SUBRULE(gram.clear, undefined) },
    { ALT: () => SUBRULE(gram.drop, undefined) },
    { ALT: () => SUBRULE(gram.add, undefined) },
    { ALT: () => SUBRULE(gram.move, undefined) },
    { ALT: () => SUBRULE(gram.copy, undefined) },
    { ALT: () => SUBRULE(gram.create, undefined) },
    { ALT: () => SUBRULE(gram.insertData, undefined) },
    { ALT: () => SUBRULE(gram.deleteData, undefined) },
    { ALT: () => SUBRULE(gram.deleteWhere, undefined) },
  ]),
  gImpl: gram.update1.gImpl,
};

const rulesNoUpdate1 = <const>[
  gram.updateUnit,
  gram.update,
  gram.prologue,
  // Update1,
  gram.baseDecl,
  gram.prefixDecl,
  gram.load,
  gram.clear,
  gram.drop,
  gram.add,
  gram.move,
  gram.copy,
  gram.create,
  gram.insertData,
  gram.deleteData,
  gram.deleteWhere,
  gram.iri,
  gram.prefixedName,
  gram.graphRef,
  gram.graphRefAll,
  gram.graphOrDefault,
  gram.quadData,
  gram.quads,
];

/**
 * Simple SPARQL 1.1 Update parser excluding MODIFY operations.
 * Top enable MODIFY, you need to path the update1 rule.
 */
export const updateNoModifyParserBuilder = Builder
  .createBuilder(rulesNoUpdate1)
  .addRule(update1Patch)
  .merge(triplesTemplateParserBuilder, <const> [])
  .addRule(gram.quadPattern)
  .addRule(gram.quadsNotTriples);
