import type {
  PatternGroup,
  SparqlQuery,
} from '@traqula/rules-sparql-1-1';
import type * as Algebra from '../algebra';
import type { AstContext } from './core';
import { createAstContext, resetContext } from './core';
import { translateOperation } from './pattern';
import { removeQuads } from './quads';
import { toUpdate } from './updateUnit';

export function toSparql(op: Algebra.Operation): SparqlQuery {
  const c = createAstContext();
  return toSparqlJs(c, op);
}

export function toSparqlJs(c: AstContext, op: Algebra.Operation): SparqlQuery {
  const F = c.astFactory;
  resetContext(c);
  op = removeQuads(c, op);
  const result = <SparqlQuery | PatternGroup> translateOperation(c, op);
  if (F.isPatternGroup(result)) {
    return <SparqlQuery> result.patterns[0];
  }
  if (Object.keys(result).length === 0) {
    return toUpdate(c, []);
  }
  if (F.isUpdateOperation(result)) {
    return toUpdate(c, [ result ]);
  }
  return result;
}
