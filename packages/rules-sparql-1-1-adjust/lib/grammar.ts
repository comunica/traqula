import type { Expression, SparqlGrammarRule } from '@traqula/rules-sparql-1-1';
import { funcExpr2, gram } from '@traqula/rules-sparql-1-1';
import { BuiltInAdjust } from './lexer';

export const builtInAdjust = funcExpr2(BuiltInAdjust);

export const existingBuiltInCall: SparqlGrammarRule<'existingBuiltInCall', Expression> = <const> {
  name: 'existingBuiltInCall',
  impl: gram.builtInCall.impl,
};
