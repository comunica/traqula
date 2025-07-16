import { ParserBuilder } from '@traqula/core';
import { gram } from '@traqula/rules-sparql-1-1';
import { objectListBuilder } from './objectListParser';
import { subSelectParserBuilder } from './subSelectParser';
import { updateNoModifyParserBuilder } from './updateNoModifyParser';

export const updateParserBuilder = ParserBuilder.create(updateNoModifyParserBuilder)
  .patchRule(gram.update1)
  .addMany(
    gram.modify,
    gram.deleteClause,
    gram.insertClause,
    gram.usingClause,
    gram.defaultGraphClause,
    gram.namedGraphClause,
    gram.sourceSelector,
    gram.usingClauseStar,
    gram.groupGraphPattern,
  )
  // This substitutes all of propertyListNotEmpty
  .merge(objectListBuilder, <const> [])
  .merge(subSelectParserBuilder, <const> []);
