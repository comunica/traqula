import type { Query, SparqlQuery } from '@traqula/rules-sparql-1-1';
import type * as Algebra from '../algebra';
import { types } from '../toAlgebra/core';
import { createAstContext, resetContext } from './core';
import type { AstContext } from './core';
import { translatePatternIntoGroup } from './pattern';
import { removeQuads } from './quads';
import { toUpdate, translateCompositeUpdate, translateUpdateOperation } from './updateUnit';

export function toSparql(op: Algebra.Operation): SparqlQuery {
  const c = createAstContext();
  return toSparqlJs(c, op);
}

export function toSparqlJs(c: AstContext, op: Algebra.Operation): SparqlQuery {
  resetContext(c);
  op = removeQuads(c, op);
  if (op.type === types.COMPOSITE_UPDATE) {
    return translateCompositeUpdate(c, op);
  }
  if (op.type === types.NOP) {
    return toUpdate(c, []);
  }
  try {
    return toUpdate(c, [ translateUpdateOperation(c, op) ]);
  } catch { /* That's okay, it's not an update */}
  // If no Update, must be query.
  const result = translatePatternIntoGroup(c, op);
  return <Query> result.patterns[0];
}
