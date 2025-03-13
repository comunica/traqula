import type { RuleDefReturn } from '@traqula/core';
import { unCapitalize } from '@traqula/core';
import type { TokenType } from 'chevrotain';
import * as l from '../../lexer';
import type {
  ContextDefinition,
  GraphQuads,
  GraphRef,
  GraphRefAll,
  GraphRefDefault,
  GraphRefNamed,
  GraphRefSpecific,
  Quads,
  Update,
  UpdateOperation,
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
import { usingClauses } from '../dataSetClause';
import { blank, prologue, varOrIri } from '../general';
import { iri } from '../literals';
import { triplesTemplate } from '../tripleBlock';
import { groupGraphPattern } from '../whereClause';

/**
 * [[3]](https://www.w3.org/TR/sparql11-query/#rUpdateUnit)
 */
export const updateUnit: SparqlGrammarRule<'updateUnit', Update | ContextDefinition[]> = <const> {
  name: 'updateUnit',
  impl: ({ SUBRULE }) => () => SUBRULE(update, undefined),
};

/**
 * [[29]](https://www.w3.org/TR/sparql11-query/#rUpdate)
 */
export const update: SparqlRule<'update', Update | ContextDefinition[]> = <const> {
  name: 'update',
  impl: ({ SUBRULE, SUBRULE1, SUBRULE2, CONSUME, OPTION1, MANY }) => () => {
    let prologueValues = SUBRULE1(prologue, undefined);
    const updates: Update['updates'] = [];

    let parsedSemi = true;
    MANY({
      GATE: () => parsedSemi,
      DEF: () => {
        const updateOperation = SUBRULE(update1, undefined);

        updates.push({
          context: prologueValues,
          operation: updateOperation,
          i0: [],
        });

        OPTION1(() => {
          const ix = SUBRULE(blank, undefined);
          CONSUME(l.symbols.semi);
          updates.at(-1)!.i0 = ix;

          parsedSemi = true;
          prologueValues = SUBRULE2(prologue, undefined);
        });
      },
    });
    return {
      type: 'update',
      updates,
    };
  },
  gImpl: () => () => '',
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
  gImpl: () => () => '',
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
  impl: ({ CONSUME, SUBRULE1, SUBRULE2, SUBRULE3, OPTION1, OPTION2, OR }) => ({ factory: F }) => {
    const graph = OPTION1(() => {
      const i0 = SUBRULE1(blank, undefined);
      const img1 = CONSUME(l.modifyWith).image;
      const graph = SUBRULE1(iri, undefined);
      return { i0, img1, graph };
    });
    const { insert, del } = OR<{
      del: RuleDefReturn<typeof deleteClause> | undefined;
      insert: RuleDefReturn<typeof insertClause> | undefined;
    }>([
      { ALT: () => {
        const del = SUBRULE1(deleteClause, undefined);
        const insert = OPTION2(() => SUBRULE1(insertClause, undefined));
        return { del, insert };
      } },
      { ALT: () => {
        const insert = SUBRULE2(insertClause, undefined);
        return { insert, del: undefined };
      } },
    ]);
    const using = SUBRULE1(usingClauses, undefined);
    const i3 = SUBRULE3(blank, undefined);
    const img4 = CONSUME(l.where).image;
    const where = SUBRULE1(groupGraphPattern, undefined);

    return F.updateOperationModify({
      graph: graph?.graph,
      insert: insert?.val ?? [],
      delete: del?.val ?? [],
      from: using,
      where: where.patterns,
      i0: graph?.i0 ?? [],
      img1: graph?.img1 ?? '',
      i1: del?.i0 ?? [],
      img2: del?.img1 ?? '',
      deleteBraces: del?.deleteBraces ?? [],
      i2: insert?.i0 ?? [],
      img3: insert?.img1 ?? '',
      insertBraces: insert?.insertBraces ?? [],
      i3,
      img4,
      patternBraces: [],
    });
  },
  gImpl: () => () => '',
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
 * [[45]](https://www.w3.org/TR/sparql11-query/#rGraphOrDefault)
 */
export const graphOrDefault: SparqlRule<'graphOrDefault', GraphRefDefault | GraphRefSpecific> = <const> {
  name: 'graphOrDefault',
  impl: ({ SUBRULE1, SUBRULE2, CONSUME, OPTION, OR }) => () => OR<GraphRefDefault | GraphRefSpecific>([
    { ALT: () => {
      const i0 = SUBRULE1(blank, undefined);
      const img1 = CONSUME(l.graph.default_).image;
      return { type: 'graphRef', graphRefType: 'default', RTT: { i0, img1 }} satisfies GraphRefDefault;
    } },
    { ALT: () => {
      const graph = OPTION(() => {
        const i0 = SUBRULE2(blank, undefined);
        const img1 = CONSUME(l.graph.graph).image;
        return <const> [ i0, img1 ];
      }) ?? [[], '' ];
      const name = SUBRULE1(iri, undefined);
      return {
        type: 'graphRef',
        graphRefType: 'specific',
        graph: name,
        RTT: {
          i0: graph[0],
          img1: graph[1],
        },
      } satisfies GraphRefSpecific;
    } },
  ]),
  gImpl: () => () => '',
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
  impl: ({ SUBRULE, CONSUME, OR1, OR2 }) => () => OR1<GraphRef>([
    { ALT: () => SUBRULE(graphRef, undefined) },
    { ALT: () => {
      const i0 = SUBRULE(blank, undefined);
      return OR2<GraphRef>([
        { ALT: () => {
          const img1 = CONSUME(l.graph.default_).image;
          return { type: 'graphRef', graphRefType: 'default', RTT: { i0, img1 }} satisfies GraphRefDefault;
        } },
        { ALT: () => {
          const img1 = CONSUME(l.graph.named).image;
          return { type: 'graphRef', graphRefType: 'named', RTT: { i0, img1 }} satisfies GraphRefNamed;
        } },
        { ALT: () => {
          const img1 = CONSUME(l.graph.graphAll).image;
          return { type: 'graphRef', graphRefType: 'all', RTT: { i0, img1 }} satisfies GraphRefAll;
        } },
      ]);
    } },

  ]),
  gImpl: () => () => '',
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
