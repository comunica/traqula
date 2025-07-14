import type { Expression, SparqlGrammarRule } from '@traqula/rules-sparql-1-1';
import { funcExpr2, gram } from '@traqula/rules-sparql-1-1';
import { BuiltInAdjust } from './lexer';

export const builtInAdjust = funcExpr2(BuiltInAdjust);

export const existingBuildInCall: SparqlGrammarRule<'existingBuildInCall', Expression> = <const> {
  name: 'existingBuildInCall',
  impl: gram.builtInCall.impl,
};
