import type { Expression } from '@traqula/rules-sparql-1-1';
import type * as SparqlJs from 'sparqljs';
import type { SparqlJsCompatIndir, SparqlJsTermToTraqula } from './core.js';
import { ensurePatternGroup, isSparqlJsTerm, isSparqlJsWildcard } from './core.js';
import { patternFromSparqlJs } from './pattern.js';
import { termFromSparqlJs } from './term.js';

/**
 * Converts a sparqljs {@link SparqlJs.Expression} into a Traqula {@link Expression}.
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
        const arg = SUBRULE(expressionFromSparqlJs, expression.expression);
        if (typeof expression.separator === 'string') {
          return F.aggregate(expression.aggregation, distinct, arg, expression.separator, F.gen());
        }
        return F.aggregate(expression.aggregation, distinct, arg, undefined, F.gen());
      }
      case 'functionCall': {
        // Sparqljs' `function` is usually an IRI, but its own types allow a bare string too.
        const fn = typeof expression.function === 'string' ?
          F.termNamed(F.gen(), expression.function) :
          <SparqlJsTermToTraqula<typeof expression.function>> SUBRULE(termFromSparqlJs, expression.function);
        return F.expressionFunctionCall(
          fn,
          expression.args.map(arg => SUBRULE(expressionFromSparqlJs, arg)),
          Boolean(expression.distinct),
          F.gen(),
        );
      }
      case 'operation': {
        const operator = expression.operator.toLowerCase();
        if (operator === 'exists' || operator === 'notexists') {
          // Sparqljs' `degroupSingle` unwraps a `{ ... }` block down to its single inner pattern when it
          // contains exactly one, so `args[0]` is not necessarily of type 'group' (e.g. `NOT EXISTS { ?s ?p ?o }`).
          const [ patternArg ] = <[SparqlJs.Pattern]> expression.args;
          return F.expressionPatternOperation(
            operator,
            ensurePatternGroup(F, SUBRULE(patternFromSparqlJs, patternArg)),
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
        const args = (<SparqlJs.Expression[]> expression.args).map(arg => SUBRULE(expressionFromSparqlJs, arg));
        return F.expressionOperation(operator, args, F.gen());
      }
      default:
        throw new Error(`Cannot convert sparqljs expression of type '${(<{ type: string }> expression).type}'`);
    }
  },
};
