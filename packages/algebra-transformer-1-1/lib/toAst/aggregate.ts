import type { Sparql11Nodes } from '@traqula/rules-sparql-1-1';
import Util from '../util';
import type { AstContext } from './core';
import { translateTerm } from './general';

export function replaceAggregatorVariables(c: AstContext, s: any, map: any): any {
  const F = c.astFactory;
  const st: Sparql11Nodes = Util.isSimpleTerm(s) ? translateTerm(c, s) : s;

  // Look for TermVariable, if we find, replace it by the aggregator.
  if (F.isTermVariable(st)) {
    if (map[st.value]) {
      // Returns the ExpressionAggregate
      return map[st.value];
    }
  } else if (Array.isArray(s)) {
    s = s.map(e => replaceAggregatorVariables(c, e, map));
  } else if (typeof s === 'object') {
    for (const key of Object.keys(s)) {
      s[key] = replaceAggregatorVariables(c, s[key], map);
    }
  }
  return s;
}
