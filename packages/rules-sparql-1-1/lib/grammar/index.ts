import { symbols } from '../lexer';
import type { SparqlRule } from '../sparql11HelperTypes';
import type { Query, SparqlQuery, Update } from '../Sparql11types';
import { updateNoReuseBlankNodeLabels } from '../validation/validators';
import { prologue } from './general';
import type { HandledByBase } from './queryUnit';
import { query, askQuery, constructQuery, describeQuery, selectQuery, valuesClause } from './queryUnit';
import { update, update1 } from './updateUnit';

export * from './queryUnit';
export * from './updateUnit';
export * from './builtIn';
export * from './dataSetClause';
export * from './expression';
export * from '../expressionHelpers';
export * from './general';
export * from './literals';
export * from './propertyPaths';
export * from './solutionModifier';
export * from './tripleBlock';
export * from './whereClause';

/**
 * Query or update, optimized for the Query case.
 * One could implement a new rule that does not use BACKTRACK.
 */
export const queryOrUpdate: SparqlRule<'queryOrUpdate', SparqlQuery> = {
  name: 'queryOrUpdate',
  impl: ({ ACTION, SUBRULE, OR1, OR2, MANY, OPTION1, CONSUME, SUBRULE2 }) => (C) => {
    const prologueValues = SUBRULE(prologue);
    return OR1<Query | Update>([
      { ALT: () => {
        const subType = OR2<Omit<Query, HandledByBase>>([
          { ALT: () => SUBRULE(selectQuery) },
          { ALT: () => SUBRULE(constructQuery) },
          { ALT: () => SUBRULE(describeQuery) },
          { ALT: () => SUBRULE(askQuery) },
        ]);
        const values = SUBRULE(valuesClause);
        return ACTION(() => (<Query>{
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
        const updates: Update['updates'] = [];
        updates.push({ context: prologueValues });
        let parsedSemi = true;
        MANY({
          GATE: () => parsedSemi,
          DEF: () => {
            parsedSemi = false;
            updates.at(-1)!.operation = SUBRULE(update1);

            OPTION1(() => {
              CONSUME(symbols.semi);

              parsedSemi = true;
              const innerPrologue = SUBRULE2(prologue);
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
          } satisfies Update;
          updateNoReuseBlankNodeLabels(update);
          return update;
        });
      } },
    ]);
  },
  gImpl: ({ SUBRULE }) => (ast, { factory: F }) => {
    if (F.isQuery(ast)) {
      SUBRULE(query, ast);
    } else {
      SUBRULE(update, ast);
    }
  },
};
