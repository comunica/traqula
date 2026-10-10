import type { SparqlGrammarRule } from '../sparql11HelperTypes.js';
import type { Pattern, Query, QueryDescribe, QuerySelect, SubSelect, Update } from '../Sparql11types.js';
import {
  checkBlankNodeBGPScope,
  checkNote13,
  describeProjectionIsGood,
  queryProjectionIsGood,
  updateNoReuseBlankNodeLabels,
} from '../validation/validators.js';

/**
 * Validation rules wrap the validator functions so a parser builder can patch them.
 * They do not consume any tokens and only validate when `skipValidation` is false,
 * either themselves or through the validation rules they invoke.
 */

/**
 * Validates the projection of a SELECT query, including its trailing VALUES clause, see {@link queryProjectionIsGood}.
 * Invoked by {@link validateQuery} once the trailing VALUES clause is parsed.
 */
export const validateSelectQuery: SparqlGrammarRule<'validateSelectQuery', void, [
  Pick<QuerySelect, 'variables' | 'solutionModifiers' | 'where' | 'values'>,
]> = {
  name: 'validateSelectQuery',
  impl: ({ ACTION }) => (C, query) => {
    ACTION(() => !C.skipValidation && queryProjectionIsGood(query, C));
  },
};

/**
 * Validates the projection of a sub-SELECT, including its VALUES clause, see {@link queryProjectionIsGood}.
 */
export const validateSubSelect: SparqlGrammarRule<'validateSubSelect', void, [SubSelect]> = {
  name: 'validateSubSelect',
  impl: ({ ACTION }) => (C, query) => {
    ACTION(() => !C.skipValidation && queryProjectionIsGood(query, C));
  },
};

/**
 * Validates the variables of a DESCRIBE query, including its trailing VALUES clause,
 * see {@link describeProjectionIsGood}.
 * Invoked by {@link validateQuery} once the trailing VALUES clause is parsed.
 */
export const validateDescribeQuery: SparqlGrammarRule<'validateDescribeQuery', void, [QueryDescribe]> = {
  name: 'validateDescribeQuery',
  impl: ({ ACTION }) => (C, query) => {
    ACTION(() => !C.skipValidation && describeProjectionIsGood(query));
  },
};

/**
 * Validates a query, including its trailing VALUES clause,
 * see {@link validateSelectQuery} and {@link validateDescribeQuery}.
 * The trailing VALUES clause is joined before the projection (18.2.4.3),
 * so the projection can only be validated once it is parsed.
 */
export const validateQuery: SparqlGrammarRule<'validateQuery', void, [Query]> = {
  name: 'validateQuery',
  impl: ({ OPTION1, OPTION2, SUBRULE }) => (C, query) => {
    // Validation rules consume no tokens, and chevrotain only allows the last alternative of an OR to be empty,
    // so gated OPTIONs pick the validation of the query type.
    OPTION1({
      GATE: () => C.astFactory.isQuerySelect(query),
      DEF: () => SUBRULE(validateSelectQuery, <QuerySelect> query),
    });
    OPTION2({
      GATE: () => C.astFactory.isQueryDescribe(query),
      DEF: () => SUBRULE(validateDescribeQuery, <QueryDescribe> query),
    });
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
