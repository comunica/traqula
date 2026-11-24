import type { Expression } from '@traqula/rules-sparql-1-1';
import type * as SparqlJs from 'sparqljs';
import type { SparqlJsCompatIndir, SparqlJsTermToTraqula } from './core.js';
import { isSparqlJsTerm, isSparqlJsWildcard } from './core.js';
import { ensurePatternGroup, patternFromSparqlJs } from './pattern.js';
import { termFromSparqlJs } from './term.js';

/**
 * Converts a SPARQL.js expression.
 */
export const expressionFromSparqlJs: SparqlJsCompatIndir<
  'expressionFromSparqlJs',
  Expression,
  [SparqlJs.Expression]
> = {
  name: 'expressionFromSparqlJs',
  fun: ({ SUBRULE }) => (context, expression) => {
    const { astFactory: F } = context;
    if (Array.isArray(expression)) {
      throw new TypeError(
        'A bare Tuple can only occur as the right-hand side of IN / NOT IN, not as a standalone expression',
      );
    }
    if (isSparqlJsTerm(expression)) {
      return <SparqlJsTermToTraqula<typeof expression>> SUBRULE(termFromSparqlJs, expression);
    }
    switch (expression.type) {
      case 'aggregate': {
        const distinct = Boolean(expression.distinct);
        if (isSparqlJsWildcard(expression.expression)) {
          return F.aggregate(expression.aggregation, distinct, F.wildcard(F.gen()), undefined, F.gen());
        }
        const argument = SUBRULE(expressionFromSparqlJs, expression.expression);
        if (typeof expression.separator === 'string') {
          return F.aggregate(expression.aggregation, distinct, argument, expression.separator, F.gen());
        }
        return F.aggregate(expression.aggregation, distinct, argument, undefined, F.gen());
      }
      case 'functionCall': {
        // Usually an IRI term, but the SPARQL.js types also allow a plain string.
        const functionName = typeof expression.function === 'string' ?
          F.termNamed(F.gen(), expression.function) :
          <SparqlJsTermToTraqula<typeof expression.function>> SUBRULE(termFromSparqlJs, expression.function);
        return F.expressionFunctionCall(
          functionName,
          expression.args.map(argument => SUBRULE(expressionFromSparqlJs, argument)),
          Boolean(expression.distinct),
          F.gen(),
        );
      }
      case 'operation': {
        const operator = expression.operator.toLowerCase();
        if (operator === 'exists' || operator === 'notexists') {
          const [ patternArg ] = <[SparqlJs.Pattern]> expression.args;
          return F.expressionPatternOperation(
            operator,
            SUBRULE(ensurePatternGroup, SUBRULE(patternFromSparqlJs, patternArg)),
            F.gen(),
          );
        }
        if (operator === 'in' || operator === 'notin') {
          const [ left, list ] = <[SparqlJs.Expression, SparqlJs.Expression[]]> expression.args;
          const args = [
            SUBRULE(expressionFromSparqlJs, left),
            ...list.map(item => SUBRULE(expressionFromSparqlJs, item)),
          ];
          return F.expressionOperation(operator, args, F.gen());
        }
        const args = (<SparqlJs.Expression[]> expression.args)
          .map(argument => SUBRULE(expressionFromSparqlJs, argument));
        return F.expressionOperation(operator, args, F.gen());
      }
      default:
        throw new Error(`Cannot convert sparqljs expression of type '${(<{ type: string }> expression).type}'`);
    }
  },
};
