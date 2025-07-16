import { ParserBuilder } from '@traqula/core';
import type * as T11 from '@traqula/rules-sparql-1-1';
import {
  sparqlCodepointEscape,
  lex as l,
  SparqlParser,
  gram,
  updateNoReuseBlankNodeLabels,
} from '@traqula/rules-sparql-1-1';
import { queryUnitParserBuilder } from './queryUnitParser';
import { updateParserBuilder } from './updateUnitParser';

/**
 * Query or update, optimized for the Query case.
 * One could implement a new rule that does not use BACKTRACK.
 */
const queryOrUpdate: T11.SparqlGrammarRule<'queryOrUpdate', T11.SparqlQuery> = {
  name: 'queryOrUpdate',
  impl: ({ ACTION, SUBRULE, OR1, OR2, MANY, OPTION1, CONSUME, SUBRULE2 }) => (C) => {
    const prologueValues = SUBRULE(gram.prologue, undefined);
    return OR1<T11.Query | T11.Update>([
      { ALT: () => {
        const subType = OR2<Omit<T11.Query, T11.gram.HandledByBase>>([
          { ALT: () => SUBRULE(gram.selectQuery, undefined) },
          { ALT: () => SUBRULE(gram.constructQuery, undefined) },
          { ALT: () => SUBRULE(gram.describeQuery, undefined) },
          { ALT: () => SUBRULE(gram.askQuery, undefined) },
        ]);
        const values = SUBRULE(gram.valuesClause, undefined);
        return ACTION(() => (<T11.Query>{
          context: prologueValues,
          ...subType,
          type: 'query',
          ...(values && { values }),
          loc: C.factory.sourceLocation(
            prologueValues.at(0),
            subType,
            values,
          ),
        }));
      } },
      { ALT: () => {
        const updates: T11.Update['updates'] = [];
        updates.push({ context: prologueValues });
        let parsedSemi = true;
        MANY({
          GATE: () => parsedSemi,
          DEF: () => {
            parsedSemi = false;
            updates.at(-1)!.operation = SUBRULE(gram.update1, undefined);

            OPTION1(() => {
              CONSUME(l.symbols.semi);

              parsedSemi = true;
              const innerPrologue = SUBRULE2(gram.prologue, undefined);
              updates.push({ context: innerPrologue });
            });
          },
        });
        return ACTION(() => {
          const update = {
            type: 'update',
            updates,
            loc: C.factory.sourceLocation(
              ...updates[0].context,
              updates[0].operation,
              ...updates.at(-1)!.context,
              updates.at(-1)?.operation,
            ),
          } satisfies T11.Update;
          updateNoReuseBlankNodeLabels(update);
          return update;
        });
      } },
    ]);
  },
};

export const sparql11ParserBuilder = ParserBuilder.create(queryUnitParserBuilder)
  .merge(updateParserBuilder, <const> [])
  .addRule(queryOrUpdate);

export class Parser extends SparqlParser<T11.SparqlQuery> {
  public constructor() {
    const parser = sparql11ParserBuilder.build({
      tokenVocabulary: l.sparql11Tokens.tokenVocabulary,
      queryPreProcessor: sparqlCodepointEscape,
    });
    super(parser);
  }
}
