import type { Query, SparqlQuery } from '@traqula/rules-sparql-1-1';
import type * as Algebra from '../algebra';
import { types } from '../toAlgebra/core';
import type { AstIndir } from './core';
import { resetContext } from './core';

import {
  translateAlgPatternIntoGroup,
} from './pattern';
import { removeAlgQuads } from './quads';

import {
  toUpdate,
  translateAlgCompositeUpdate,
  translateAlgUpdateOperation,
} from './updateUnit';

export const algToSparql: AstIndir<'toSparqlJs', SparqlQuery, [Algebra.Operation]> = {
  name: 'toSparqlJs',
  fun: ({ SUBRULE }) => (_, op) => {
    SUBRULE(resetContext);
    op = SUBRULE(removeAlgQuads, op);
    if (op.type === types.COMPOSITE_UPDATE) {
      return SUBRULE(translateAlgCompositeUpdate, op);
    }
    if (op.type === types.NOP) {
      return SUBRULE(toUpdate, []);
    }
    try {
      return SUBRULE(toUpdate, [ SUBRULE(translateAlgUpdateOperation, op) ]);
    } catch { /* That's okay, it's not an update */}
    // If no Update, must be query.
    const result = SUBRULE(translateAlgPatternIntoGroup, op);
    return <Query> result.patterns[0];
  },
};
