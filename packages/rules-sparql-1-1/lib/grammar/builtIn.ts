import type { IOrAlt } from '@chevrotain/types';
import type { ImplArgs } from '@traqula/core';
import {
  unCapitalize,
} from '@traqula/core';
import {
  funcExprOrNil1,
  baseAggregateFunc,
  funcExpr1,
  funcExpr2,
  funcExpr2or3,
  funcExpr3,
  funcExpr3or4,
  funcExprList1,
  funcGroupGraphPattern,
  funcNil1,
  funcVar1,
} from '../expressionHelpers';
import * as l from '../lexer';
import type {
  Expression,
  ExpressionAggregate,
  ExpressionAggregateDefault,
  ExpressionAggregateOnWildcard,
  ExpressionAggregateSeparator,
  Wildcard,
} from '../RoundTripTypes';
import type { SparqlGrammarRule, SparqlRule } from '../Sparql11types';
import { expression } from './expression';
import { string, stringEscapedLexical } from './literals';

export const builtInStr = funcExpr1(l.builtIn.str);
export const builtInLang = funcExpr1(l.builtIn.lang);
export const builtInLangmatches = funcExpr2(l.builtIn.langmatches);
export const builtInDatatype = funcExpr1(l.builtIn.datatype);
export const builtInBound = funcVar1(l.builtIn.bound);
export const builtInIri = funcExpr1(l.builtIn.iri);
export const builtInUri = funcExpr1(l.builtIn.uri);
export const builtInBnodeSparqlJs = funcExprOrNil1(l.builtIn.bnode);
export const builtInRand = funcNil1(l.builtIn.rand);
export const builtInAbs = funcExpr1(l.builtIn.abs);
export const builtInCeil = funcExpr1(l.builtIn.ceil);
export const builtInFloor = funcExpr1(l.builtIn.floor);
export const builtInRound = funcExpr1(l.builtIn.round);
export const builtInConcat = funcExprList1(l.builtIn.concat);
export const builtInStrlen = funcExpr1(l.builtIn.strlen);
export const builtInUcase = funcExpr1(l.builtIn.ucase);
export const builtInLcase = funcExpr1(l.builtIn.lcase);
export const builtInEncode_for_uri = funcExpr1(l.builtIn.encode_for_uri);
export const builtInContains = funcExpr2(l.builtIn.contains);
export const builtInStrstarts = funcExpr2(l.builtIn.strstarts);
export const builtInStrends = funcExpr2(l.builtIn.strends);
export const builtInStrbefore = funcExpr2(l.builtIn.strbefore);
export const builtInStrafter = funcExpr2(l.builtIn.strafter);
export const builtInYear = funcExpr1(l.builtIn.year);
export const builtInMonth = funcExpr1(l.builtIn.month);
export const builtInDay = funcExpr1(l.builtIn.day);
export const builtInHours = funcExpr1(l.builtIn.hours);
export const builtInMinutes = funcExpr1(l.builtIn.minutes);
export const builtInSeconds = funcExpr1(l.builtIn.seconds);
export const builtInTimezone = funcExpr1(l.builtIn.timezone);
export const builtInTz = funcExpr1(l.builtIn.tz);
export const builtInNow = funcNil1(l.builtIn.now);
export const builtInUuid = funcNil1(l.builtIn.uuid);
export const builtInStruuid = funcNil1(l.builtIn.struuid);
export const builtInMd5 = funcExpr1(l.builtIn.md5);
export const builtInSha1 = funcExpr1(l.builtIn.sha1);
export const builtInSha256 = funcExpr1(l.builtIn.sha256);
export const builtInSha384 = funcExpr1(l.builtIn.sha384);
export const builtInSha512 = funcExpr1(l.builtIn.sha512);
export const builtInCoalesce = funcExprList1(l.builtIn.coalesce);
export const builtInIf = funcExpr3(l.builtIn.if_);
export const builtInStrlang = funcExpr2(l.builtIn.strlang);
export const builtInStrdt = funcExpr2(l.builtIn.strdt);
export const builtInSameterm = funcExpr2(l.builtIn.sameterm);
export const builtInIsiri = funcExpr1(l.builtIn.isiri);
export const builtInIsuri = funcExpr1(l.builtIn.isuri);
export const builtInIsblank = funcExpr1(l.builtIn.isblank);
export const builtInIsliteral = funcExpr1(l.builtIn.isliteral);
export const builtInIsnumeric = funcExpr1(l.builtIn.isnumeric);

export function builtInCallList(SUBRULE: ImplArgs['SUBRULE']): IOrAlt<Expression>[] {
  return [
    { ALT: () => SUBRULE(aggregate, undefined) },
    { ALT: () => SUBRULE(builtInStr, undefined) },
    { ALT: () => SUBRULE(builtInLang, undefined) },
    { ALT: () => SUBRULE(builtInLangmatches, undefined) },
    { ALT: () => SUBRULE(builtInDatatype, undefined) },
    { ALT: () => SUBRULE(builtInBound, undefined) },
    { ALT: () => SUBRULE(builtInIri, undefined) },
    { ALT: () => SUBRULE(builtInUri, undefined) },
    { ALT: () => SUBRULE(builtInBnodeSparqlJs, undefined) },
    { ALT: () => SUBRULE(builtInRand, undefined) },
    { ALT: () => SUBRULE(builtInAbs, undefined) },
    { ALT: () => SUBRULE(builtInCeil, undefined) },
    { ALT: () => SUBRULE(builtInFloor, undefined) },
    { ALT: () => SUBRULE(builtInRound, undefined) },
    { ALT: () => SUBRULE(builtInConcat, undefined) },
    { ALT: () => SUBRULE(substringExpression, undefined) },
    { ALT: () => SUBRULE(builtInStrlen, undefined) },
    { ALT: () => SUBRULE(strReplaceExpression, undefined) },
    { ALT: () => SUBRULE(builtInUcase, undefined) },
    { ALT: () => SUBRULE(builtInLcase, undefined) },
    { ALT: () => SUBRULE(builtInEncode_for_uri, undefined) },
    { ALT: () => SUBRULE(builtInContains, undefined) },
    { ALT: () => SUBRULE(builtInStrstarts, undefined) },
    { ALT: () => SUBRULE(builtInStrends, undefined) },
    { ALT: () => SUBRULE(builtInStrbefore, undefined) },
    { ALT: () => SUBRULE(builtInStrafter, undefined) },
    { ALT: () => SUBRULE(builtInYear, undefined) },
    { ALT: () => SUBRULE(builtInMonth, undefined) },
    { ALT: () => SUBRULE(builtInDay, undefined) },
    { ALT: () => SUBRULE(builtInHours, undefined) },
    { ALT: () => SUBRULE(builtInMinutes, undefined) },
    { ALT: () => SUBRULE(builtInSeconds, undefined) },
    { ALT: () => SUBRULE(builtInTimezone, undefined) },
    { ALT: () => SUBRULE(builtInTz, undefined) },
    { ALT: () => SUBRULE(builtInNow, undefined) },
    { ALT: () => SUBRULE(builtInUuid, undefined) },
    { ALT: () => SUBRULE(builtInStruuid, undefined) },
    { ALT: () => SUBRULE(builtInMd5, undefined) },
    { ALT: () => SUBRULE(builtInSha1, undefined) },
    { ALT: () => SUBRULE(builtInSha256, undefined) },
    { ALT: () => SUBRULE(builtInSha384, undefined) },
    { ALT: () => SUBRULE(builtInSha512, undefined) },
    { ALT: () => SUBRULE(builtInCoalesce, undefined) },
    { ALT: () => SUBRULE(builtInIf, undefined) },
    { ALT: () => SUBRULE(builtInStrlang, undefined) },
    { ALT: () => SUBRULE(builtInStrdt, undefined) },
    { ALT: () => SUBRULE(builtInSameterm, undefined) },
    { ALT: () => SUBRULE(builtInIsiri, undefined) },
    { ALT: () => SUBRULE(builtInIsuri, undefined) },
    { ALT: () => SUBRULE(builtInIsblank, undefined) },
    { ALT: () => SUBRULE(builtInIsliteral, undefined) },
    { ALT: () => SUBRULE(builtInIsnumeric, undefined) },
    { ALT: () => SUBRULE(regexExpression, undefined) },
    { ALT: () => SUBRULE(existsFunc, undefined) },
    { ALT: () => SUBRULE(notExistsFunc, undefined) },
  ];
}

/**
 * [[121]](https://www.w3.org/TR/sparql11-query/#rBuiltInCall)
 */
export const builtInCall: SparqlGrammarRule<'builtInCall', Expression> = <const>{
  name: 'builtInCall',
  impl: ({ OR, SUBRULE, cache }) => () => {
    const cached = <IOrAlt<Expression>[]>cache.get(builtInCall);
    if (cached) {
      return OR<Expression>(cached);
    }
    const builtIns = builtInCallList(SUBRULE);
    cache.set(builtInCall, builtIns);
    return OR<Expression>(builtIns);
  },
};

/**
 * [[122]](https://www.w3.org/TR/sparql11-query/#rBuiltInCall)
 */
export const regexExpression = funcExpr2or3(l.builtIn.regex);

/**
 * [[123]](https://www.w3.org/TR/sparql11-query/#rBuiltInCall)
 */
export const substringExpression = funcExpr2or3(l.builtIn.substr);

/**
 * [[124]](https://www.w3.org/TR/sparql11-query/#rBuiltInCall)
 */
export const strReplaceExpression = funcExpr3or4(l.builtIn.replace);

/**
 * [[125]](https://www.w3.org/TR/sparql11-query/#rBuiltInCall)
 */
export const existsFunc = funcGroupGraphPattern(l.builtIn.exists);

/**
 * [[126]](https://www.w3.org/TR/sparql11-query/#rBuiltInCall)
 */
export const notExistsFunc = funcGroupGraphPattern(l.builtIn.notexists);

export const aggregateCount:
SparqlGrammarRule<'builtInCount', ExpressionAggregateOnWildcard | ExpressionAggregateDefault> = {
  name: unCapitalize(l.builtIn.count.name),
  impl: ({ ACTION, CONSUME, SUBRULE, OR, OPTION }) => (C) => {
    const operatorToken = CONSUME(l.builtIn.count);
    CONSUME(l.symbols.LParen);
    const distinctToken = OPTION(() => CONSUME(l.distinct));

    const expressionVal = OR<Expression | Wildcard>([
      { ALT: () => {
        const starToken = CONSUME(l.symbols.star);
        return ACTION(() => C.factory.wildcard(C.factory.sourceLocation(starToken)));
      } },
      { ALT: () => SUBRULE(expression, undefined) },
    ]);
    const closeToken = CONSUME(l.symbols.RParen);

    return ACTION(() => {
      const F = C.factory;
      if (C.factory.isWildcard(expressionVal)) {
        return F.aggregate(
          operatorToken.image,
          Boolean(distinctToken),
          expressionVal,
          undefined,
          C.factory.sourceLocation(operatorToken, closeToken),
        );
      }
      return F.aggregate(
        operatorToken.image,
        Boolean(distinctToken),
        expressionVal,
        undefined,
        C.factory.sourceLocation(operatorToken, closeToken),
      );
    });
  },
};
export const aggregateSum = baseAggregateFunc(l.builtIn.sum);
export const aggregateMin = baseAggregateFunc(l.builtIn.min);
export const aggregateMax = baseAggregateFunc(l.builtIn.max);
export const aggregateAvg = baseAggregateFunc(l.builtIn.avg);
export const aggregateSample = baseAggregateFunc(l.builtIn.sample);
export const aggregateGroup_concat:
SparqlGrammarRule<'builtInGroup_concat', ExpressionAggregateDefault | ExpressionAggregateSeparator> = <const>{
  name: unCapitalize(l.builtIn.groupConcat.name),
  impl: ({ ACTION, CONSUME, OPTION1, SUBRULE, OPTION2 }) =>
    (C) => {
      const operatorToken = CONSUME(l.builtIn.groupConcat);
      CONSUME(l.symbols.LParen);
      const distinctToken = OPTION1(() => CONSUME(l.distinct));

      const expr = SUBRULE(expression, undefined);
      const sep = OPTION2(() => {
        CONSUME(l.symbols.semi);
        CONSUME(l.separator);
        CONSUME(l.symbols.equal);
        return SUBRULE(string, undefined);
      });
      const closeToken = CONSUME(l.symbols.RParen);

      return ACTION(() => {
        const F = C.factory;
        return sep ?
          F.aggregate(
            operatorToken.image,
            Boolean(distinctToken),
            expr,
            sep.value,
            F.sourceLocation(operatorToken, closeToken),
          ) :
          F.aggregate(
            operatorToken.image,
            Boolean(distinctToken),
            expr,
            ' ',
            F.sourceLocation(operatorToken, closeToken),
          );
      });
    },
};

/**
 * [[127]](https://www.w3.org/TR/sparql11-query/#rBuiltInCall)
 */
export const aggregate: SparqlRule<'aggregate', ExpressionAggregate> = <const>{
  name: 'aggregate',
  impl: ({ ACTION, SUBRULE, OR }) => (C) => {
    // https://www.w3.org/2013/sparql-errata#errata-query-5 - Or note 15 in SPARQL1.2 spec
    //  An aggregate function is not allowed within an aggregate function.
    const wasInAggregate = ACTION(() => C.parseMode.has('inAggregate'));
    ACTION(() => C.parseMode.add('inAggregate'));
    const result = OR<ExpressionAggregate>([
      { ALT: () => SUBRULE(aggregateCount, undefined) },
      { ALT: () => SUBRULE(aggregateSum, undefined) },
      { ALT: () => SUBRULE(aggregateMin, undefined) },
      { ALT: () => SUBRULE(aggregateMax, undefined) },
      { ALT: () => SUBRULE(aggregateAvg, undefined) },
      { ALT: () => SUBRULE(aggregateSample, undefined) },
      { ALT: () => SUBRULE(aggregateGroup_concat, undefined) },
    ]);
    ACTION(() => !wasInAggregate && C.parseMode.delete('inAggregate'));

    ACTION(() => {
      if (!C.parseMode.has('canParseAggregate')) {
        throw new Error('Aggregates are only allowed in SELECT, HAVING, and ORDER BY clauses.');
      }
      if (C.parseMode.has('inAggregate')) {
        throw new Error('An aggregate function is not allowed within an aggregate function.');
      }
    });

    return result;
  },
  gImpl: ({ SUBRULE, PRINT_WORD }) => (ast, { factory: F }) => {
    F.printFilter(ast, () => {
      PRINT_WORD(ast.aggregation, '(');
      if (ast.distinct) {
        PRINT_WORD('DISTINCT');
      }
    });
    const arg = ast.expression[0];
    if (F.isWildcard(arg)) {
      F.printFilter(ast, () => PRINT_WORD('*'));
    } else {
      SUBRULE(expression, arg, undefined);
    }
    if (F.isExpressionAggregateSeparator(ast)) {
      F.printFilter(ast, () => PRINT_WORD(';', 'SEPARATOR', '=', stringEscapedLexical(ast.separator)));
    }
    F.printFilter(ast, () => PRINT_WORD(')'));
  },
};
