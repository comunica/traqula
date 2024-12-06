import type { RuleDef } from '../../grammar/parserBuilder.js';
import { Builder } from '../../grammar/parserBuilder.js';
import { prologue } from '../../grammar/sparql11/general.js';
import type { HandledByBase } from '../../grammar/sparql11/queryUnit/queryUnit';
import {
  askQuery,
  constructQuery,
  describeQuery,
  selectQuery,
  valuesClause,
} from '../../grammar/sparql11/queryUnit/queryUnit';
import { update, update1 } from '../../grammar/sparql11/updateUnit/updateUnit';
import type { Query, Update } from '../../grammar/sparqlJSTypes.js';
import * as l from '../../lexer/sparql11/index.js';
import { queryUnitParserBuilder } from './queryUnitParser.js';
import { updateParserBuilder } from './updateUnitParser.js';

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
const queryOrUpdate: RuleDef<'queryOrUpdate', Query | Update | Pick<Update, 'base' | 'prefixes'>> = {
  name: 'queryOrUpdate',
  impl: ({ ACTION, SUBRULE, OR1, OR2, CONSUME, OPTION1, OPTION2 }) => () => {
    const prologueValues = SUBRULE(prologue);
    return OR1<Query | Update | Pick<Update, 'base' | 'prefixes'>>([
      { ALT: () => {
        const queryType = OR2<Omit<Query, HandledByBase>>([
          { ALT: () => SUBRULE(selectQuery) },
          { ALT: () => SUBRULE(constructQuery) },
          { ALT: () => SUBRULE(describeQuery) },
          { ALT: () => SUBRULE(askQuery) },
        ]);
        const values = SUBRULE(valuesClause);
        return ACTION(() => (<Query>{
          ...prologueValues,
          ...queryType,
          type: 'query',
          ...(values && { values }),
        }));
      } },
      { ALT: () => {
        let result: Update | Pick<Update, 'base' | 'prefixes'> = prologueValues;
        OPTION1(() => {
          const updateOperation = SUBRULE(update1);
          const recursiveRes = OPTION2(() => {
            CONSUME(l.symbols.semi);
            return SUBRULE(update);
          });

          return ACTION(() => {
            const updateResult: Update = {
              ...result,
              type: 'update',
              updates: [ updateOperation ],
            };
            if (recursiveRes) {
              updateResult.updates.push(...recursiveRes.updates);
              updateResult.base = recursiveRes.base ?? result.base;
              updateResult.prefixes = recursiveRes.prefixes ?
                  { ...result.prefixes, ...recursiveRes.prefixes } :
                updateResult.prefixes;
            }
            result = updateResult;
          });
        });
        return result;
      } },
    ]);
  },
};

export const sparqlParserBuilder = Builder.createBuilder()
  .merge(queryUnitParserBuilder)
  .merge(updateParserBuilder)
  .deleteRule('queryUnit')
  .deleteRule('query')
  .deleteRule('updateUnit')
  .addRule(queryOrUpdate);
