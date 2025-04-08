import { ParserBuilder } from '@traqula/core';

import { gram } from '@traqula/rules-sparql-1-1';
import { objectListBuilder } from './objectListParser';
import { subSelectParserBuilder } from './subSelectParser';
import { updateNoModifyParserBuilder } from './updateNoModifyParser';

export const updateParserBuilder = ParserBuilder.createBuilder(updateNoModifyParserBuilder)
  .patchRule(gram.update1)
  .addMany(
    gram.modify,
    gram.deleteClause,
    gram.insertClause,
    gram.usingClause,
    gram.groupGraphPattern,
  )
  // This substitutes all of propertyListNotEmpty
  .merge(objectListBuilder, <const> [])
  .merge(subSelectParserBuilder, <const> []);
