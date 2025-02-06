import { Builder } from '@traqula/core';
import type { Query, SparqlQuery, Update, SparqlGrammarRule } from '@traqula/rules-sparql-1-1';
import { gram, lex as l, SparqlParser } from '@traqula/rules-sparql-1-1';
import { queryUnitParserBuilder } from './queryUnitParser';
import { updateParserBuilder } from './updateUnitParser';

// Create merge of
// ```
// Prologue
// ( SelectQuery | ConstructQuery | DescribeQuery | AskQuery )
// ValuesClause
// ```
// and:
// ```
// Prologue ( Update1 ( ';' Update )? )?
// ```
const queryOrUpdate: SparqlGrammarRule<'queryOrUpdate', Query | Update | Pick<Update, 'base' | 'prefixes'>> = {
  name: 'queryOrUpdate',
  impl: ({ ACTION, SUBRULE, SUBRULE2, OR1, OR2, CONSUME, OPTION1, MANY }) => () => {
    const prologueValues = SUBRULE(gram.prologue, undefined);
    return OR1<Query | Update | Pick<Update, 'base' | 'prefixes'>>([
      { ALT: () => {
        const queryType = OR2<Omit<Query, gram.HandledByBase>>([
          { ALT: () => SUBRULE(gram.selectQuery, undefined) },
          { ALT: () => SUBRULE(gram.constructQuery, undefined) },
          { ALT: () => SUBRULE(gram.describeQuery, undefined) },
          { ALT: () => SUBRULE(gram.askQuery, undefined) },
        ]);
        const values = SUBRULE(gram.valuesClause, undefined);
        return ACTION(() => (<Query>{
          ...prologueValues,
          ...queryType,
          type: 'query',
          ...(values && { values }),
        }));
      } },
      { ALT: () => {
        // Prologue ( Update1 ( ';' Update )? )?
        // Is equivalent to:

        let parsedSemi = true;
        const updateResult: Update = {
          ...prologueValues,
          type: 'update',
          updates: [],
        };
        MANY({
          GATE: () => parsedSemi,
          DEF: () => {
            parsedSemi = false;
            const updateOperation = SUBRULE(gram.update1, undefined);

            updateResult.updates.push(updateOperation);

            OPTION1(() => {
              CONSUME(l.symbols.semi);
              const prologueValues = SUBRULE2(gram.prologue, undefined);

              ACTION(() => {
                updateResult.base = prologueValues.base ?? updateResult.base;
                updateResult.prefixes = prologueValues.prefixes ?
                    { ...updateResult.prefixes, ...prologueValues.prefixes } :
                  updateResult.prefixes;
              });

              parsedSemi = true;
            });
          },
        });

        ACTION(() => {
          const blankLabelsUsedInInsertData = new Set<string>();
          for (const updateOperation of updateResult.updates) {
            const iterBlankNodes = (callback: (blankNodeLabel: string) => void): void => {
              if ('updateType' in updateOperation && updateOperation.updateType === 'insert') {
                for (const quad of updateOperation.insert) {
                  for (const triple of quad.triples) {
                    for (const position of <const> [ 'subject', 'object' ]) {
                      if (triple[position].termType === 'BlankNode') {
                        callback(triple[position].value);
                      }
                    }
                  }
                }
              }
            };
            iterBlankNodes((label) => {
              if (blankLabelsUsedInInsertData.has(label)) {
                throw new Error('Detected reuse blank node across different INSERT DATA clauses');
              }
            });
            iterBlankNodes(label => blankLabelsUsedInInsertData.add(label));
          }
        });

        return updateResult.updates.length > 0 ? updateResult : prologueValues;
      } },
    ]);
  },
};

export const sparql11ParserBuilder = Builder.createBuilder(queryUnitParserBuilder)
  .merge(updateParserBuilder, <const> [])
  .deleteRule('queryUnit')
  .deleteRule('query')
  .deleteRule('updateUnit')
  .addRule(queryOrUpdate);

export class Parser extends SparqlParser<SparqlQuery> {
  public constructor() {
    const parser = sparql11ParserBuilder.consumeToParser({
      tokenVocabulary: l.sparql11Tokens.build(),
    });
    super(parser);
  }
}
