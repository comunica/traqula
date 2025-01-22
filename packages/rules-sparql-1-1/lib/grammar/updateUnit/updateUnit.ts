import type {TokenType} from 'chevrotain';
import * as l from '../../lexer';
import type {RuleDefReturn} from '@traqula/core';
import {unCapitalize} from '@traqula/core';
import {prologue, triplesTemplate, varOrIri} from '../general';
import {iri} from '../literals';
import type {
  ClearDropOperation,
  GraphOrDefault,
  GraphQuads,
  GraphReference,
  InsertDeleteOperation,
  IriTerm,
  LoadOperation,
  Quads,
  SparqlRuleDef,
  Update,
  UpdateOperation,
} from '../../Sparql11types';
import {groupGraphPattern} from '../whereClause';

/**
 * [[3]](https://www.w3.org/TR/sparql11-query/#rUpdateUnit)
 */
export const updateUnit: SparqlRuleDef<'updateUnit', Update> = <const> {
  name: 'updateUnit',
  impl: ({ ACTION, SUBRULE }) => () => {
    const data = SUBRULE(update, undefined);

    ACTION(() => data.updates.reverse());
    return data;
  },
};

/**
 * [[29]](https://www.w3.org/TR/sparql11-query/#rUpdate)
 */
export const update: SparqlRuleDef<'update', Update> = <const> {
  name: 'update',
  impl: ({ ACTION, SUBRULE, CONSUME, OPTION1, OPTION2 }) => () => {
    const prologueValues = SUBRULE(prologue, undefined);
    const result: Update = {
      type: 'update',
      base: prologueValues.base,
      prefixes: prologueValues.prefixes,
      updates: [],
    };
    OPTION1(() => {
      const updateOperation = SUBRULE(update1, undefined);

      const recursiveRes = OPTION2(() => {
        CONSUME(l.symbols.semi);
        return SUBRULE(update, undefined);
      });

      ACTION(() => {
        result.updates.push(updateOperation);
        if (recursiveRes) {
          result.updates.push(...recursiveRes.updates);
          result.base = recursiveRes.base ?? result.base;
          result.prefixes = { ...result.prefixes, ...recursiveRes.prefixes };
        }
      });
    });
    return result;
  },
};

/**
 * [[30]](https://www.w3.org/TR/sparql11-query/#rUpdate1)
 */
export const update1: SparqlRuleDef<'update1', UpdateOperation> = <const> {
  name: 'update1',
  impl: ({ SUBRULE, OR }) => () => OR([
    { ALT: () => SUBRULE(load, undefined) },
    { ALT: () => SUBRULE(clear, undefined) },
    { ALT: () => SUBRULE(drop, undefined) },
    { ALT: () => SUBRULE(add, undefined) },
    { ALT: () => SUBRULE(move, undefined) },
    { ALT: () => SUBRULE(copy, undefined) },
    { ALT: () => SUBRULE(create, undefined) },
    { ALT: () => SUBRULE(insertData, undefined) },
    { ALT: () => SUBRULE(deleteData, undefined) },
    { ALT: () => SUBRULE(deleteWhere, undefined) },
    { ALT: () => SUBRULE(modify, undefined) },
  ]),
};

/**
 * [[31]](https://www.w3.org/TR/sparql11-query/#rLoad)
 */
export const load: SparqlRuleDef<'load', LoadOperation> = <const> {
  name: 'load',
  impl: ({ SUBRULE, CONSUME, OPTION1, OPTION2 }) => () => {
    CONSUME(l.load);
    const silent = Boolean(OPTION1(() => CONSUME(l.silent)));
    const source = SUBRULE(iri, undefined);
    const destination = OPTION2(() => {
      CONSUME(l.loadInto);
      return SUBRULE(graphRef, undefined);
    });
    return {
      type: 'load',
      silent,
      source,
      ...(destination && { destination }),
    };
  },
};

/**
 * [[32]](https://www.w3.org/TR/sparql11-query/#rClear)
 */
export const clear: SparqlRuleDef<'clear', ClearDropOperation> = <const> {
  name: 'clear',
  impl: ({ SUBRULE, CONSUME, OPTION }) => () => {
    CONSUME(l.clear);
    const silent = Boolean(OPTION(() => CONSUME(l.silent)));
    const graph = SUBRULE(graphRefAll, undefined);
    return {
      type: 'clear',
      silent,
      graph,
    };
  },
};

/**
 * [[33]](https://www.w3.org/TR/sparql11-query/#rDrop)
 */
export const drop: SparqlRuleDef<'drop', UpdateOperation> = <const> {
  name: 'drop',
  impl: ({ SUBRULE, CONSUME, OPTION }) => () => {
    CONSUME(l.drop);
    const silent = Boolean(OPTION(() => CONSUME(l.silent)));
    const graph = SUBRULE(graphRefAll, undefined);
    return {
      type: 'drop',
      silent,
      graph,
    };
  },
};

/**
 * [[34]](https://www.w3.org/TR/sparql11-query/#rCreate)
 */
export const create: SparqlRuleDef<'create', UpdateOperation> = <const> {
  name: 'create',
  impl: ({ SUBRULE, CONSUME, OPTION }) => () => {
    CONSUME(l.create);
    const silent = Boolean(OPTION(() => CONSUME(l.silent)));
    const graph = SUBRULE(graphRef, undefined);
    return {
      type: 'create',
      silent,
      graph: {
        type: 'graph',
        name: graph,
      },
    };
  },
};

function copyMoveAddOperation<T extends 'Copy' | 'Move' | 'Add'>(operation: TokenType & { name: T }):
SparqlRuleDef<Uncapitalize<T>, UpdateOperation> {
  return {
    name: unCapitalize(operation.name),
    impl: ({ CONSUME, SUBRULE1, SUBRULE2, OPTION }) => () => {
      CONSUME(operation);
      const silent = Boolean(OPTION(() => CONSUME(l.silent)));
      const source = SUBRULE1(graphOrDefault, undefined);
      CONSUME(l.to);
      const destination = SUBRULE2(graphOrDefault, undefined);
      return {
        type: unCapitalize(operation.name),
        silent,
        source,
        destination,
      };
    },
  };
}

/**
 * [[35]](https://www.w3.org/TR/sparql11-query/#rAdd)
 */
export const add = copyMoveAddOperation(l.add);

/**
 * [[36]](https://www.w3.org/TR/sparql11-query/#rMove)
 */
export const move = copyMoveAddOperation(l.move);

/**
 * [[37]](https://www.w3.org/TR/sparql11-query/#rCopy)
 */
export const copy = copyMoveAddOperation(l.copy);

/**
 * [[38]](https://www.w3.org/TR/sparql11-query/#rInsertData)
 */
export const insertData: SparqlRuleDef<'insertData', InsertDeleteOperation> = <const> {
  name: 'insertData',
  impl: ({ SUBRULE, CONSUME }) => () => {
    CONSUME(l.insertClause);
    CONSUME(l.dataClause);
    const insert = SUBRULE(quadData, undefined);
    return {
      updateType: 'insert',
      insert,
    };
  },
};

/**
 * [[39]](https://www.w3.org/TR/sparql11-query/#rDeleteData)
 */
export const deleteData: SparqlRuleDef<'deleteData', InsertDeleteOperation> = <const> {
  name: 'deleteData',
  impl: ({ ACTION, SUBRULE, CONSUME }) => (C) => {
    CONSUME(l.deleteClause);
    CONSUME(l.dataClause);

    const couldCreateBlankNodes = ACTION(() => C.parseMode.delete('canCreateBlankNodes'));
    const del = SUBRULE(quadData, undefined);
    ACTION(() => couldCreateBlankNodes && C.parseMode.add('canCreateBlankNodes'));

    return {
      updateType: 'delete',
      delete: del,
    };
  },
};

/**
 * [[40]](https://www.w3.org/TR/sparql11-query/#rDeleteWhere)
 */
export const deleteWhere: SparqlRuleDef<'deleteWhere', InsertDeleteOperation> = <const> {
  name: 'deleteWhere',
  impl: ({ ACTION, SUBRULE, CONSUME }) => (C) => {
    CONSUME(l.deleteClause);
    CONSUME(l.where);

    const couldCreateBlankNodes = ACTION(() => C.parseMode.delete('canCreateBlankNodes'));
    const del = SUBRULE(quadPattern, undefined);
    ACTION(() => couldCreateBlankNodes && C.parseMode.add('canCreateBlankNodes'));

    return {
      updateType: 'deletewhere',
      delete: del,
    };
  },
};

/**
 * [[41]](https://www.w3.org/TR/sparql11-query/#rModify)
 */
export const modify: SparqlRuleDef<'modify', UpdateOperation> = <const> {
  name: 'modify',
  impl: ({ ACTION, SUBRULE, CONSUME, MANY, SUBRULE1, SUBRULE2, OPTION1, OPTION2, OR }) => () => {
    const graph = OPTION1(() => {
      CONSUME(l.modifyWith);
      return SUBRULE(iri, undefined);
    });
    const { insert, delete: del } = OR([
      {
        ALT: () => {
          const del = SUBRULE(deleteClause, undefined);
          const insert = OPTION2(() => SUBRULE1(insertClause, undefined)) ?? [];
          return { delete: del, insert };
        },
      },
      { ALT: () => {
        const insert = SUBRULE2(insertClause, undefined);
        return { insert, delete: []};
      } },
    ]);
    const usingArr: RuleDefReturn<typeof usingClause>[] = [];
    MANY(() => {
      usingArr.push(SUBRULE(usingClause, undefined));
    });
    CONSUME(l.where);
    const where = SUBRULE(groupGraphPattern, undefined);

    return ACTION(() => {
      const def: IriTerm[] = [];
      const named: IriTerm[] = [];
      for (const { value, type } of usingArr) {
        if (type === 'default') {
          def.push(value);
        } else {
          named.push(value);
        }
      }
      return {
        updateType: 'insertdelete',
        graph,
        insert,
        delete: del,
        using: usingArr.length > 0 ? { default: def, named } : undefined,
        where: where.patterns,
      };
    });
  },
};

/**
 * [[42]](https://www.w3.org/TR/sparql11-query/#rDeleteClause)
 */
export const deleteClause: SparqlRuleDef<'deleteClause', Quads[]> = <const> {
  name: 'deleteClause',
  impl: ({ ACTION, SUBRULE, CONSUME }) => (C) => {
    CONSUME(l.deleteClause);

    const couldCreateBlankNodes = ACTION(() => C.parseMode.delete('canCreateBlankNodes'));
    const del = SUBRULE(quadPattern, undefined);
    ACTION(() => couldCreateBlankNodes && C.parseMode.add('canCreateBlankNodes'));

    return del;
  },
};

/**
 * [[43]](https://www.w3.org/TR/sparql11-query/#rInsertClause)
 */
export const insertClause: SparqlRuleDef<'insertClause', Quads[]> = <const> {
  name: 'insertClause',
  impl: ({ SUBRULE, CONSUME }) => () => {
    CONSUME(l.insertClause);
    return SUBRULE(quadPattern, undefined);
  },
};

/**
 * [[44]](https://www.w3.org/TR/sparql11-query/#rUsingClause)
 */
export const usingClause: SparqlRuleDef<'usingClause', { value: IriTerm; type: 'default' | 'named' }> = <const> {
  name: 'usingClause',
  impl: ({ CONSUME, SUBRULE1, SUBRULE2, OR }) => () => {
    CONSUME(l.usingClause);
    return OR<RuleDefReturn<typeof usingClause>>([
      { ALT: () => {
        const value = SUBRULE1(iri, undefined);
        return { value, type: 'default' };
      } },
      {
        ALT: () => {
          CONSUME(l.graph.named);
          const value = SUBRULE2(iri, undefined);
          return { value, type: 'named' };
        },
      },
    ]);
  },
};

/**
 * [[45]](https://www.w3.org/TR/sparql11-query/#rGraphOrDefault)
 */
export const graphOrDefault: SparqlRuleDef<'graphOrDefault', GraphOrDefault> = <const> {
  name: 'graphOrDefault',
  impl: ({ SUBRULE, CONSUME, OPTION, OR }) => () => OR<GraphOrDefault>([
    { ALT: () => {
      CONSUME(l.graph.default_);
      return { type: 'graph', default: true };
    } },
    {
      ALT: () => {
        OPTION(() => CONSUME(l.graph.graph));
        const name = SUBRULE(iri, undefined);
        return {
          type: 'graph',
          name,
        };
      },
    },
  ]),
};

/**
 * [[46]](https://www.w3.org/TR/sparql11-query/#rGraphRef)
 */
export const graphRef: SparqlRuleDef<'graphRef', IriTerm> = <const> {
  name: 'graphRef',
  impl: ({ SUBRULE, CONSUME }) => () => {
    CONSUME(l.graph.graph);
    return SUBRULE(iri, undefined);
  },
};

/**
 * [[47]](https://www.w3.org/TR/sparql11-query/#rGraphRefAll)
 */
export const graphRefAll: SparqlRuleDef<'graphRefAll', GraphReference> = <const> {
  name: 'graphRefAll',
  impl: ({ SUBRULE, CONSUME, OR }) => () => OR<GraphReference>([
    { ALT: () => {
      const name = SUBRULE(graphRef, undefined);
      return { type: 'graph', name };
    } },
    { ALT: () => {
      CONSUME(l.graph.default_);
      return { default: true };
    } },
    { ALT: () => {
      CONSUME(l.graph.named);
      return { named: true };
    } },
    { ALT: () => {
      CONSUME(l.graph.graphAll);
      return { all: true };
    } },
  ]),
};

/**
 * [[48]](https://www.w3.org/TR/sparql11-query/#rQuadPattern)
 */
export const quadPattern: SparqlRuleDef<'quadPattern', Quads[]> = <const> {
  name: 'quadPattern',
  impl: ({ SUBRULE, CONSUME }) => () => {
    CONSUME(l.symbols.LCurly);
    const val = SUBRULE(quads, undefined);
    CONSUME(l.symbols.RCurly);
    return val;
  },
};

/**
 * [[49]](https://www.w3.org/TR/sparql11-query/#rQuadData)
 */
export const quadData: SparqlRuleDef<'quadData', Quads[]> = <const> {
  name: 'quadData',
  impl: ({ ACTION, SUBRULE, CONSUME }) => (C) => {
    CONSUME(l.symbols.LCurly);

    const couldParseVars = ACTION(() => C.parseMode.delete('canParseVars'));
    const val = SUBRULE(quads, undefined);
    ACTION(() => couldParseVars && C.parseMode.add('canParseVars'));

    CONSUME(l.symbols.RCurly);
    return val;
  },
};

/**
 * [[50]](https://www.w3.org/TR/sparql11-query/#rQuads)
 */
export const quads: SparqlRuleDef<'quads', Quads[]> = <const> {
  name: 'quads',
  impl: ({ SUBRULE, CONSUME, MANY, SUBRULE1, SUBRULE2, OPTION1, OPTION2, OPTION3 }) => () => {
    const quads: Quads[] = [];

    OPTION1(() => {
      const triples = SUBRULE1(triplesTemplate, undefined);
      quads.push({
        type: 'bgp',
        triples,
      });
    });

    MANY(() => {
      quads.push(SUBRULE(quadsNotTriples, undefined));
      OPTION2(() => CONSUME(l.symbols.dot));
      OPTION3(() => {
        const triples = SUBRULE2(triplesTemplate, undefined);
        quads.push({
          type: 'bgp',
          triples,
        });
      });
    });

    return quads;
  },
};

/**
 * [[51]](https://www.w3.org/TR/sparql11-query/#rQuadsNotTriples)
 */
export const quadsNotTriples: SparqlRuleDef<'quadsNotTriples', GraphQuads> = <const> {
  name: 'quadsNotTriples',
  impl: ({ SUBRULE, CONSUME, OPTION }) => () => {
    CONSUME(l.graph.graph);
    const name = SUBRULE(varOrIri, undefined);
    CONSUME(l.symbols.LCurly);
    const triples = OPTION(() => SUBRULE(triplesTemplate, undefined)) ?? [];
    CONSUME(l.symbols.RCurly);

    return {
      type: 'graph',
      name,
      triples,
    };
  },
};
