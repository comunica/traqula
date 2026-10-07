import type { SparqlGrammarRule } from '../sparql11HelperTypes.js';
import type { Pattern, Query, SubSelect, Update } from '../Sparql11types.js';
import {
  checkBlankNodeBGPScope,
  checkNote13,
  queryProjectionIsGood,
  updateNoReuseBlankNodeLabels,
} from '../validation/validators.js';

/**
 * Validation rules wrap the validator functions so a parser builder can patch them.
 * They do not consume any tokens and only validate when `skipValidation` is false.
 */

/**
 * Validates the projection of a SELECT query, including its trailing VALUES clause, see {@link queryProjectionIsGood}.
 * Other query forms are ignored.
 */
export const validateSelectQuery: SparqlGrammarRule<'validateSelectQuery', void, [Query]> = {
  name: 'validateSelectQuery',
  impl: ({ ACTION }) => (C, query) => {
    ACTION(() => !C.skipValidation && C.astFactory.isQuerySelect(query) && queryProjectionIsGood(query));
  },
};

/**
 * Validates the projection of a sub-SELECT, including its VALUES clause, see {@link queryProjectionIsGood}.
 */
export const validateSubSelect: SparqlGrammarRule<'validateSubSelect', void, [SubSelect]> = {
  name: 'validateSubSelect',
  impl: ({ ACTION }) => (C, query) => {
    ACTION(() => !C.skipValidation && queryProjectionIsGood(query));
  },
};

/**
 * Validates a query, including its trailing VALUES clause, see {@link validateSelectQuery}.
 * The trailing VALUES clause is joined before the projection (18.2.4.3),
 * so the projection can only be validated once it is parsed.
 */
export const validateQuery: SparqlGrammarRule<'validateQuery', void, [Query]> = {
  name: 'validateQuery',
  impl: ({ SUBRULE }) => (_, query) => {
    SUBRULE(validateSelectQuery, query);
  },
};

/**
 * Validates an update request, see {@link updateNoReuseBlankNodeLabels}.
 */
export const validateUpdate: SparqlGrammarRule<'validateUpdate', void, [Update]> = {
  name: 'validateUpdate',
  impl: ({ ACTION }) => (C, update) => {
    ACTION(() => !C.skipValidation && updateNoReuseBlankNodeLabels(update));
  },
};

/**
 * Validates the patterns of a group graph pattern, see {@link checkBlankNodeBGPScope}.
 */
export const validateGroupGraphPattern: SparqlGrammarRule<'validateGroupGraphPattern', void, [Pattern[]]> = {
  name: 'validateGroupGraphPattern',
  impl: ({ ACTION }) => (C, patterns) => {
    ACTION(() => !C.skipValidation && checkBlankNodeBGPScope(patterns));
  },
};

/**
 * Validates the BINDs in the patterns of a group graph pattern, see {@link checkNote13}.
 */
export const validateGroupGraphPatternSub: SparqlGrammarRule<'validateGroupGraphPatternSub', void, [Pattern[]]> = {
  name: 'validateGroupGraphPatternSub',
  impl: ({ ACTION }) => (C, patterns) => {
    ACTION(() => !C.skipValidation && checkNote13(patterns));
  },
};
