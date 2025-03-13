import type { RuleDefReturn } from '@traqula/core';
import { unCapitalize } from '@traqula/core';
import type { TokenType } from 'chevrotain';
import * as l from '../../lexer';
import type {
  GraphQuads,
  GraphRef,
  GraphRefSpecific,
  Quads,
  UpdateOperationAddMoveCopy,
  UpdateOperationClearDrop,
  UpdateOperationCreate,
  UpdateOperationInsertDeleteDelWhere,
  UpdateOperationLoad,
  UpdateOperationModify,
} from '../../RoundTripTypes';
import type {
  SparqlGrammarRule,
  SparqlRule,
} from '../../Sparql11types';
import type { Ignores1, ITOS, Reconstruct, Wrap } from '../../TypeHelpersRTT';
import { blank, prologue, varOrIri } from '../general';
import { iri } from '../literals';
import { triplesTemplate } from '../tripleBlock';
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
    const updates = ast.updates.map(update => SUBRULE(update1, update, undefined)).join(' ; ');
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
export const load: SparqlRule<'load', UpdateOperationLoad> = <const> {
  name: 'load',
  impl: ({ SUBRULE, CONSUME, OPTION1, OPTION2 }) => ({ factory: F }) => {
    const i0 = SUBRULE(blank, undefined);
    const img1 = CONSUME(l.load).image;
    const silent = OPTION1(() => {
      const i1 = SUBRULE(blank, undefined);
      const img2 = CONSUME(l.silent).image;
      return <const> [ i1, img2 ];
    }) ?? [[], '' ];
    const source = SUBRULE(iri, undefined);
    const destination = OPTION2(() => {
      const i2 = SUBRULE(blank, undefined);
      const img3 = CONSUME(l.loadInto).image;
      const graph = SUBRULE(graphRef, undefined);
      return <const> [ i2, img3, graph ];
    }) ?? [[], '', undefined ];
    return F.updateOperationLoad({
      source,
      ...(destination[2] && { destination: destination[2] }),
      i0,
      img1,
      img2: silent[1],
      i1: silent[0],
      i2: destination[0],
      img3: destination[1],
    });
  },
  gImpl: () => () => '',
};

function clearOrDrop<T extends 'Clear' | 'Drop'>(operation: TokenType & { name: T }):
SparqlGrammarRule<Uncapitalize<T>, UpdateOperationClearDrop> {
  return {
    name: unCapitalize(operation.name),
    impl: ({ SUBRULE, CONSUME, OPTION }) => ({ factory: F }) => {
      const i0 = SUBRULE(blank, undefined);
      const img1 = CONSUME(operation).image;
      const silent = (OPTION(() => {
        const i1 = SUBRULE(blank, undefined);
        const img2 = CONSUME(l.silent).image;
        return <const> [ i1, img2 ];
      }) ?? [[], '' ]);
      const destination = SUBRULE(graphRefAll, undefined);
      return F.updateOperationClearDrop({ i0, img1, destination, i1: silent[0], img2: silent[1] });
    },
  };
}

/**
 * [[32]](https://www.w3.org/TR/sparql11-query/#rClear)
 */
export const clear = clearOrDrop(l.clear);

/**
 * [[33]](https://www.w3.org/TR/sparql11-query/#rDrop)
 */
export const drop = clearOrDrop(l.drop);

/**
 * [[34]](https://www.w3.org/TR/sparql11-query/#rCreate)
 */
export const create: SparqlRule<'create', UpdateOperationCreate> = <const> {
  name: 'create',
  impl: ({ SUBRULE, CONSUME, OPTION }) => ({ factory: F }) => {
    const i0 = SUBRULE(blank, undefined);
    const img1 = CONSUME(l.create).image;
    const silent = OPTION(() => {
      const i1 = SUBRULE(blank, undefined);
      const img2 = CONSUME(l.silent).image;
      return <const> [ i1, img2 ];
    }) ?? [[], '' ];
    const destination = SUBRULE(graphRef, undefined);
    return F.updateOperationCreate({ i0, img1, img2: silent[1], i1: silent[0], destination });
  },
  gImpl: () => () => '',
};

function copyMoveAddOperation<T extends 'Copy' | 'Move' | 'Add'>(operation: TokenType & { name: T }):
SparqlRule<Uncapitalize<T>, UpdateOperationAddMoveCopy> {
  return {
    name: unCapitalize(operation.name),
    impl: ({ CONSUME, SUBRULE1, SUBRULE2, SUBRULE3, OPTION }) => ({ factory: F }) => {
      const i0 = SUBRULE1(blank, undefined);
      const img1 = CONSUME(operation).image;
      const silent = OPTION(() => {
        const i1 = SUBRULE2(blank, undefined);
        const img2 = CONSUME(l.silent).image;
        return <const> [ i1, img2 ];
      }) ?? [[], '' ];
      const source = SUBRULE1(graphOrDefault, undefined);
      const i2 = SUBRULE3(blank, undefined);
      const img3 = CONSUME(l.to).image;
      const destination = SUBRULE2(graphOrDefault, undefined);
      return F.updateOperationAddMoveCopy({
        i0,
        img1,
        i1: silent[0],
        img2: silent[1],
        source,
        i2,
        img3,
        destination,
      });
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
 * [[48]](https://www.w3.org/TR/sparql11-query/#rQuadPattern)
 */
export const quadPattern: SparqlGrammarRule<'quadPattern', Wrap<Quads[]> & Ignores1> = <const> {
  name: 'quadPattern',
  impl: ({ SUBRULE1, SUBRULE2, CONSUME }) => () => {
    const i0 = SUBRULE1(blank, undefined);
    CONSUME(l.symbols.LCurly);
    const val = SUBRULE1(quads, undefined);
    const i1 = SUBRULE2(blank, undefined);
    CONSUME(l.symbols.RCurly);
    return { i0, val, i1 };
  },
};

/**
 * [[49]](https://www.w3.org/TR/sparql11-query/#rQuadData)
 */
export const quadData: SparqlRule<'quadData', Wrap<Quads[]> & Ignores1> = <const> {
  name: 'quadData',
  impl: ({ ACTION, SUBRULE1, SUBRULE2, CONSUME }) => (C) => {
    const i0 = SUBRULE1(blank, undefined);
    CONSUME(l.symbols.LCurly);

    const couldParseVars = ACTION(() => C.parseMode.delete('canParseVars'));
    const val = SUBRULE1(quads, undefined);
    ACTION(() => couldParseVars && C.parseMode.add('canParseVars'));

    const i1 = SUBRULE2(blank, undefined);
    CONSUME(l.symbols.RCurly);
    return {
      val,
      i0,
      i1,
    };
  },
  gImpl: () => () => '',
};

function insertDeleteDelWhere<T extends 'insertData' | 'deleteData' | 'deleteWhere'>(
  name: T,
  cons1: TokenType,
  cons2: TokenType,
  dataRule: SparqlGrammarRule<any, Wrap<Quads[]> & Ignores1>,
): SparqlGrammarRule<T, UpdateOperationInsertDeleteDelWhere> {
  return {
    name,
    impl: ({ ACTION, SUBRULE1, SUBRULE2, CONSUME }) => (C) => {
      const i0 = SUBRULE1(blank, undefined);
      const img1 = CONSUME(cons1).image;
      const i1 = SUBRULE2(blank, undefined);
      const img2 = CONSUME(cons2).image;

      let couldCreateBlankNodes = true;
      if (name !== 'insertData') {
        couldCreateBlankNodes = ACTION(() => C.parseMode.delete('canCreateBlankNodes'));
      }
      const data = SUBRULE1(dataRule, undefined);
      if (name !== 'insertData') {
        ACTION(() => couldCreateBlankNodes && C.parseMode.add('canCreateBlankNodes'));
      }

      return ACTION(() => {
        const { val, i0: di0, i1: di1 } = data;
        return C.factory.updateOperationInsertDeleteDelWhere({
          data: val,
          i0,
          img1,
          i1,
          img2,
          dataBraces: [ di0, di1 ],
        });
      });
    },
  };
}

/**
 * [[38]](https://www.w3.org/TR/sparql11-query/#rInsertData)
 */
export const insertData = insertDeleteDelWhere('insertData', l.insertClause, l.dataClause, quadData);

/**
 * [[39]](https://www.w3.org/TR/sparql11-query/#rDeleteData)
 */
export const deleteData = insertDeleteDelWhere('deleteData', l.deleteClause, l.dataClause, quadData);

/**
 * [[40]](https://www.w3.org/TR/sparql11-query/#rDeleteWhere)
 */
export const deleteWhere = insertDeleteDelWhere('deleteWhere', l.deleteClause, l.where, quadPattern);

/**
 * [[41]](https://www.w3.org/TR/sparql11-query/#rModify)
 */
export const modify: SparqlRule<'modify', UpdateOperationModify> = <const> {
  name: 'modify',
  impl: ({ ACTION, CONSUME, MANY, SUBRULE1, SUBRULE2, SUBRULE3, SUBRULE4, SUBRULE5, OPTION1, OPTION2, OR }) => () => {
    const graph = OPTION1(() => {
      const i0 = SUBRULE1(blank, undefined);
      const img1 = CONSUME(l.modifyWith).image;
      const graph = SUBRULE1(iri, undefined);
      return { i0, img1, graph };
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
      builder.push(`DELETE { ${SUBRULE(quadData, ast.delete, undefined)} }`);
    }
    if (ast.insert.length > 0) {
      builder.push(`INSERT { ${SUBRULE(quadData, ast.insert, undefined)} }`);
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
export const deleteClause:
SparqlGrammarRule<'deleteClause', Wrap<Quads[]> & Reconstruct & { deleteBraces: [ITOS, ITOS]}> = <const> {
  name: 'deleteClause',
  impl: ({ ACTION, SUBRULE, CONSUME }) => (C) => {
    const i0 = SUBRULE(blank, undefined);
    const img1 = CONSUME(l.deleteClause).image;

    const couldCreateBlankNodes = ACTION(() => C.parseMode.delete('canCreateBlankNodes'));
    const del = SUBRULE(quadPattern, undefined);
    ACTION(() => couldCreateBlankNodes && C.parseMode.add('canCreateBlankNodes'));

    return ACTION(() => {
      const { i0: di0, i1: di1, val } = del;
      return {
        val,
        i0,
        img1,
        deleteBraces: [ di0, di1 ],
      };
    });
  },
};

/**
 * [[43]](https://www.w3.org/TR/sparql11-query/#rInsertClause)
 */
export const insertClause:
SparqlGrammarRule<'insertClause', Wrap<Quads[]> & Reconstruct & { insertBraces: [ITOS, ITOS]}> = <const> {
  name: 'insertClause',
  impl: ({ ACTION, SUBRULE, CONSUME }) => () => {
    const i0 = SUBRULE(blank, undefined);
    const img1 = CONSUME(l.insertClause).image;
    const insert = SUBRULE(quadPattern, undefined);

    return ACTION(() => {
      const { i0: di0, i1: di1, val } = insert;
      return {
        val,
        i0,
        img1,
        insertBraces: [ di0, di1 ],
      };
    });
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
export const graphOrDefault: SparqlRule<'graphOrDefault', GraphOrDefault | GraphRefSpecific> = <const> {
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
export const graphRef: SparqlRule<'graphRef', GraphRefSpecific> = <const> {
  name: 'graphRef',
  impl: ({ SUBRULE, CONSUME }) => () => {
    const i0 = SUBRULE(blank, undefined);
    const img1 = CONSUME(l.graph.graph).image;
    const val = SUBRULE(iri, undefined);
    return {
      graph: val,
      type: 'graphRef',
      graphRefType: 'specific',
      RTT: { img1, i0 },
    };
  },
  gImpl: () => () => '',
};

/**
 * [[47]](https://www.w3.org/TR/sparql11-query/#rGraphRefAll)
 */
export const graphRefAll: SparqlRule<'graphRefAll', GraphRef> = <const> {
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
 * [[50]](https://www.w3.org/TR/sparql11-query/#rQuads)
 */
export const quads: SparqlRule<'quads', Quads[]> = <const> {
  name: 'quads',
  impl: ({ SUBRULE, CONSUME, MANY, SUBRULE1, SUBRULE2, OPTION1, OPTION2, OPTION3 }) => () => {
    const quads: Quads[] = [];

    OPTION1(() => {
      const triples = SUBRULE1(triplesTemplate, undefined);
      quads.push({
        type: 'pattern',
        patternType: 'bgp',
        triples: triples.val,
        RTT: {
          ignored: triples.ignored,
        },
      });
    });

    MANY(() => {
      const notTriples = SUBRULE(quadsNotTriples, undefined);
      OPTION2(() => {
        const ix = SUBRULE2(blank, undefined);
        CONSUME(l.symbols.dot);
        notTriples.RTT.ignored.push(ix);
      });
      quads.push(notTriples);
      OPTION3(() => {
        const triples = SUBRULE2(triplesTemplate, undefined);
        quads.push({
          type: 'pattern',
          patternType: 'bgp',
          triples: triples.val,
          RTT: {
            ignored: triples.ignored,
          },
        });
      });
    });

    return quads;
  },
  gImpl: () => () => '',
};

/**
 * [[51]](https://www.w3.org/TR/sparql11-query/#rQuadsNotTriples)
 */
export const quadsNotTriples: SparqlRule<'quadsNotTriples', GraphQuads> = <const> {
  name: 'quadsNotTriples',
  impl: ({ SUBRULE1, SUBRULE2, SUBRULE3, CONSUME, OPTION }) => () => {
    const i0 = SUBRULE1(blank, undefined);
    const img1 = CONSUME(l.graph.graph).image;
    const name = SUBRULE1(varOrIri, undefined);
    const i1 = SUBRULE2(blank, undefined);
    CONSUME(l.symbols.LCurly);
    const triples = OPTION(() => SUBRULE1(triplesTemplate, undefined));
    const i2 = SUBRULE3(blank, undefined);
    CONSUME(l.symbols.RCurly);

    return {
      type: 'graph',
      graph: name,
      triples: triples?.val ?? [],
      RTT: {
        i0,
        img1,
        tripleBraces: [ i1, i2 ],
        ignored: triples?.ignored ?? [],
      },
    };
  },
  gImpl: () => () => '',
};
