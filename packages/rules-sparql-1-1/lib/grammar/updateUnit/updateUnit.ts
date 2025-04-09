import type { RuleDefReturn } from '@traqula/core';
import { unCapitalize } from '@traqula/core';
import type { TokenType } from 'chevrotain';
import * as l from '../../lexer';
import type {
  ClearDropOperation,
  CopyMoveAddOperation,
  CreateOperation,
  DeleteOperation,
  DeleteWhereOperation,
  GraphOrDefault,
  GraphQuads,
  GraphReference,
  InsertOperation,
  IriTerm,
  LoadOperation,
  ModifyOperation,
  Quads,
  SparqlGrammarRule,
  SparqlRule,
  Update,
  UpdateOperation,
} from '../../Sparql11types';
import { prologue, varOrIri, varOrTerm } from '../general';
import { iri } from '../literals';
import { triplesBlock, triplesTemplate } from '../tripleBlock';
import { groupGraphPattern } from '../whereClause';

/**
 * [[3]](https://www.w3.org/TR/sparql11-query/#rUpdateUnit)
 */
export const updateUnit: SparqlGrammarRule<'updateUnit', Update> = <const> {
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
export const update: SparqlRule<'update', Update> = <const> {
  name: 'update',
  impl: ({ ACTION, SUBRULE, SUBRULE1, SUBRULE2, CONSUME, OPTION1, MANY }) => () => {
    const prologueValues = SUBRULE1(prologue, undefined);
    const result: Update = {
      type: 'update',
      base: prologueValues.base,
      prefixes: prologueValues.prefixes,
      updates: [],
    };

    let parsedSemi = true;
    MANY({
      GATE: () => parsedSemi,
      DEF: () => {
        const updateOperation = SUBRULE(update1, undefined);
        result.updates.push(updateOperation);

        OPTION1(() => {
          CONSUME(l.symbols.semi);
          parsedSemi = true;
          SUBRULE2(prologue, undefined);

          ACTION(() => {
            result.base = prologueValues.base ?? result.base;
            result.prefixes = prologueValues.prefixes ?
                { ...result.prefixes, ...prologueValues.prefixes } :
              result.prefixes;
          });
        });
      },
    });
    return result;
  },
  gImpl: ({ SUBRULE }) => (ast) => {
    const prologueString = SUBRULE(prologue, ast, undefined);
    const updates = ast.updates.map(update => SUBRULE(update1, update, undefined)).join(' ;\n');
    return `${prologueString} ${updates}`;
  },
};

/**
 * [[30]](https://www.w3.org/TR/sparql11-query/#rUpdate1)
 */
export const update1: SparqlRule<'update1', UpdateOperation> = <const> {
  name: 'update1',
  impl: ({ SUBRULE, OR }) => () => OR<UpdateOperation>([
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
  gImpl: ({ SUBRULE }) => (ast) => {
    if ('type' in ast) {
      // ManagementOperation
      switch (ast.type) {
        case 'load':
          return SUBRULE(load, ast, undefined);
        case 'clear':
          return SUBRULE(clear, ast, undefined);
        case 'drop':
          return SUBRULE(drop, ast, undefined);
        case 'add':
          return SUBRULE(add, ast, undefined);
        case 'move':
          return SUBRULE(move, ast, undefined);
        case 'copy':
          return SUBRULE(copy, ast, undefined);
        case 'create':
          return SUBRULE(create, ast, undefined);
      }
    }
    // InsertDeleteOperation
    switch (ast.updateType) {
      case 'insert':
        return SUBRULE(insertData, ast, undefined);
      case 'delete':
        return SUBRULE(deleteData, ast, undefined);
      case 'deletewhere':
        return SUBRULE(deleteWhere, ast, undefined);
      case 'insertdelete':
        return SUBRULE(modify, ast, undefined);
    }
  },
};

/**
 * [[31]](https://www.w3.org/TR/sparql11-query/#rLoad)
 */
export const load: SparqlRule<'load', LoadOperation> = <const> {
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
  gImpl: ({ SUBRULE }) => (ast) => {
    const builder = [ 'LOAD' ];
    if (ast.silent) {
      builder.push('SILENT');
    }
    builder.push(SUBRULE(iri, ast.source, undefined));
    if (ast.destination) {
      builder.push('INTO', SUBRULE(graphRef, ast.destination, undefined));
    }
    return builder.join(' ');
  },
};

/**
 * [[32]](https://www.w3.org/TR/sparql11-query/#rClear)
 */
export const clear: SparqlRule<'clear', ClearDropOperation> = <const> {
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
  gImpl: ({ SUBRULE }) => (ast) => {
    const builder = [ 'CLEAR' ];
    if (ast.silent) {
      builder.push('SILENT');
    }
    builder.push(SUBRULE(graphRefAll, ast.graph, undefined));
    return builder.join(' ');
  },
};

/**
 * [[33]](https://www.w3.org/TR/sparql11-query/#rDrop)
 */
export const drop: SparqlRule<'drop', ClearDropOperation> = <const> {
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
  gImpl: ({ SUBRULE }) => (ast) => {
    const builder = [ 'DROP' ];
    if (ast.silent) {
      builder.push('SILENT');
    }
    builder.push(SUBRULE(graphRefAll, ast.graph, undefined));
    return builder.join(' ');
  },
};

/**
 * [[34]](https://www.w3.org/TR/sparql11-query/#rCreate)
 */
export const create: SparqlRule<'create', CreateOperation> = <const> {
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
  gImpl: ({ SUBRULE }) => (ast) => {
    const builder = [ 'CREATE' ];
    if (ast.silent) {
      builder.push('SILENT');
    }
    builder.push(SUBRULE(graphRef, <IriTerm> ast.graph.name, undefined));
    return builder.join(' ');
  },
};

function copyMoveAddOperation<T extends 'Copy' | 'Move' | 'Add'>(operation: TokenType & { name: T }):
SparqlRule<Uncapitalize<T>, CopyMoveAddOperation> {
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
    gImpl: ({ SUBRULE }) => (ast) => {
      const builder = [ operation.name.toUpperCase() ];
      if (ast.silent) {
        builder.push('SILENT');
      }
      builder.push(SUBRULE(graphOrDefault, ast.source, undefined));
      builder.push('TO', SUBRULE(graphOrDefault, ast.destination, undefined));
      return builder.join(' ');
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
export const insertData: SparqlRule<'insertData', InsertOperation> = <const> {
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
  gImpl: ({ SUBRULE }) => ast =>
    `INSERT DATA ${SUBRULE(quadData, ast.insert, undefined)}`,
};

/**
 * [[39]](https://www.w3.org/TR/sparql11-query/#rDeleteData)
 */
export const deleteData: SparqlRule<'deleteData', DeleteOperation> = <const> {
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
  gImpl: ({ SUBRULE }) => ast =>
    `DELETE DATA ${SUBRULE(quadData, ast.delete, undefined)}`,
};

/**
 * [[40]](https://www.w3.org/TR/sparql11-query/#rDeleteWhere)
 */
export const deleteWhere: SparqlRule<'deleteWhere', DeleteWhereOperation> = <const> {
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
  gImpl: ({ SUBRULE }) => ast =>
    `DELETE WHERE ${SUBRULE(quadData, ast.delete, undefined)}`,
};

/**
 * [[41]](https://www.w3.org/TR/sparql11-query/#rModify)
 */
export const modify: SparqlRule<'modify', ModifyOperation> = <const> {
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
  gImpl: ({ SUBRULE }) => (ast) => {
    const builder: string[] = [];
    if (ast.graph) {
      builder.push(`WITH ${SUBRULE(iri, ast.graph, undefined)}`);
    }
    if (ast.delete.length > 0) {
      builder.push(`DELETE ${SUBRULE(quadData, ast.delete, undefined)}`);
    }
    if (ast.insert.length > 0) {
      builder.push(`INSERT ${SUBRULE(quadData, ast.insert, undefined)}`);
    }
    if (ast.using) {
      builder.push(...ast.using.default.map(val => `USING ${SUBRULE(iri, val, undefined)}`));
      builder.push(...ast.using.named.map(val => `USING NAMED ${SUBRULE(iri, val, undefined)}`));
    }
    builder.push('WHERE', SUBRULE(groupGraphPattern, { type: 'group', patterns: ast.where }, undefined));
    return builder.join(' ');
  },
};

/**
 * [[42]](https://www.w3.org/TR/sparql11-query/#rDeleteClause)
 */
export const deleteClause: SparqlGrammarRule<'deleteClause', Quads[]> = <const> {
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
export const insertClause: SparqlGrammarRule<'insertClause', Quads[]> = <const> {
  name: 'insertClause',
  impl: ({ SUBRULE, CONSUME }) => () => {
    CONSUME(l.insertClause);
    return SUBRULE(quadPattern, undefined);
  },
};

/**
 * [[44]](https://www.w3.org/TR/sparql11-query/#rUsingClause)
 */
export const usingClause: SparqlGrammarRule<'usingClause', { value: IriTerm; type: 'default' | 'named' }> = <const> {
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
export const graphOrDefault: SparqlRule<'graphOrDefault', GraphOrDefault> = <const> {
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
  gImpl: ({ SUBRULE }) => (ast) => {
    if (ast.default) {
      return 'DEFAULT';
    }
    return SUBRULE(iri, <IriTerm> ast.name, undefined);
  },
};

/**
 * [[46]](https://www.w3.org/TR/sparql11-query/#rGraphRef)
 */
export const graphRef: SparqlRule<'graphRef', IriTerm> = <const> {
  name: 'graphRef',
  impl: ({ SUBRULE, CONSUME }) => () => {
    CONSUME(l.graph.graph);
    return SUBRULE(iri, undefined);
  },
  gImpl: ({ SUBRULE }) => ast =>
    `GRAPH ${SUBRULE(iri, ast, undefined)}`,
};

/**
 * [[47]](https://www.w3.org/TR/sparql11-query/#rGraphRefAll)
 */
export const graphRefAll: SparqlRule<'graphRefAll', GraphReference> = <const> {
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
  gImpl: ({ SUBRULE }) => (ast) => {
    if (ast.all) {
      return 'ALL';
    }
    if (ast.default) {
      return 'DEFAULT';
    }
    if (ast.named) {
      return 'NAMED';
    }
    return SUBRULE(graphRef, <IriTerm> ast.name, undefined);
  },
};

/**
 * [[48]](https://www.w3.org/TR/sparql11-query/#rQuadPattern)
 */
export const quadPattern: SparqlGrammarRule<'quadPattern', Quads[]> = <const> {
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
export const quadData: SparqlRule<'quadData', Quads[]> = <const> {
  name: 'quadData',
  impl: ({ ACTION, SUBRULE, CONSUME }) => (C) => {
    CONSUME(l.symbols.LCurly);

    const couldParseVars = ACTION(() => C.parseMode.delete('canParseVars'));
    const val = SUBRULE(quads, undefined);
    ACTION(() => couldParseVars && C.parseMode.add('canParseVars'));

    CONSUME(l.symbols.RCurly);
    return val;
  },
  gImpl: ({ SUBRULE }) => ast =>
    `{ ${SUBRULE(quads, ast, undefined)} }`,
};

/**
 * [[50]](https://www.w3.org/TR/sparql11-query/#rQuads)
 */
export const quads: SparqlRule<'quads', Quads[]> = <const> {
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
  gImpl: ({ SUBRULE }) => ast =>
    ast.map((quad) => {
      if (quad.type === 'bgp') {
        return SUBRULE(triplesBlock, quad, undefined);
      }
      return SUBRULE(quadsNotTriples, quad, undefined);
    }).join(' '),
};

/**
 * [[51]](https://www.w3.org/TR/sparql11-query/#rQuadsNotTriples)
 */
export const quadsNotTriples: SparqlRule<'quadsNotTriples', GraphQuads> = <const> {
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
  gImpl: ({ SUBRULE }) => ast =>
    `GRAPH ${SUBRULE(varOrTerm, ast.name, undefined)} {
${SUBRULE(triplesBlock, { ...ast, type: 'bgp' }, undefined)}
}`,
};
