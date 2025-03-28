import { CommonIRIs } from '../grammar-helpers/utils';
import * as l from '../lexer';
import type { Path, PatternBgp, TermVariable, Triple } from '../RoundTripTypes';
import type {
  SparqlGrammarRule,
  SparqlRule,
} from '../Sparql11types';
import type { ITOS, Wrap } from '../TypeHelpersRTT';
import { blank, var_, varOrTerm, verb } from './general';
import { path } from './propertyPaths';

export interface TriplePart {
  node: Triple['subject'] | Triple['object'];
  triples: Triple[];
}

function triplesDotSeperated(triplesSameSubjectSubrule: SparqlGrammarRule<string, Triple[]>):
SparqlGrammarRule<string, Wrap<Triple[]> & { ignored: ITOS[] }>['impl'] {
  return ({ ACTION, AT_LEAST_ONE, SUBRULE, CONSUME, OPTION }) => () => {
    const triples: Triple[] = [];
    const ignored: ITOS[] = [];

    let parsedDot = true;
    AT_LEAST_ONE({
      GATE: () => parsedDot,
      DEF: () => {
        parsedDot = false;
        const template = SUBRULE(triplesSameSubjectSubrule, undefined);
        ACTION(() => {
          triples.push(...template);
        });
        OPTION(() => {
          CONSUME(l.symbols.dot);
          const i0 = SUBRULE(blank, undefined);
          ignored.push(i0);
          parsedDot = true;
        });
      },
    });
    return { val: triples, ignored };
  };
}

/**
 * [[55]](https://www.w3.org/TR/sparql11-query/#rTriplesBlock)
 */
export const triplesBlock: SparqlRule<'triplesBlock', PatternBgp> = <const>{
  name: 'triplesBlock',
  impl: implArgs => (C) => {
    const { val, ignored } = triplesDotSeperated(triplesSameSubjectPath)(implArgs)(C, undefined);
    return {
      type: 'pattern',
      patternType: 'bgp',
      triples: val,
      RTT: {
        ignored,
      },
    };
  },
  gImpl: () => ast => ast.triples.map((triple) => {
    const { RTT } = triple;
    // Discover kind of triple
    if (!RTT.shareSubjectDef && !RTT.sharePrefixDef) {
      return '';
    }
    if (RTT.shareSubjectDef && !RTT.sharePrefixDef) {
      return '';
    }
    return '';
  }).join(''),
};

/**
 * [[75]](https://www.w3.org/TR/sparql11-query/#rTriplesSameSubject)
 * [[81]](https://www.w3.org/TR/sparql11-query/#rTriplesSameSubjectPath)
 * CONTRACT: triples generated from the subject come first, then comes the main triple,
 *  and then come the triples from the object
 */
function triplesSameSubjectImpl<T extends string>(name: T, allowPaths: boolean): SparqlGrammarRule<T, Triple[]> {
  return <const> {
    name,
    impl: ({ ACTION, SUBRULE, OR }) => () => OR<Triple[]>([
      { ALT: () => {
        const subject = SUBRULE(varOrTerm, undefined);
        return SUBRULE(allowPaths ? propertyListPathNotEmpty : propertyListNotEmpty, { subject });
      } },
      { ALT: () => {
        const subjectNode = SUBRULE(allowPaths ? triplesNodePath : triplesNode, undefined);
        const restNode = SUBRULE(allowPaths ? propertyListPath : propertyList, { subject: subjectNode.node });
        return ACTION(() => [
          ...subjectNode.triples,
          ...restNode,
        ]);
      } },
    ]),
  };
}
export const triplesSameSubject = triplesSameSubjectImpl('triplesSameSubject', false);
export const triplesSameSubjectPath = triplesSameSubjectImpl('triplesSameSubjectPath', true);

/**
 * [[52]](https://www.w3.org/TR/sparql11-query/#rTriplesTemplate)
 */
export const triplesTemplate: SparqlGrammarRule<'triplesTemplate', Wrap<Triple[]> & { ignored: ITOS[] }> = <const> {
  name: 'triplesTemplate',
  impl: triplesDotSeperated(triplesSameSubject),
};

/**
 * [[76]](https://www.w3.org/TR/sparql11-query/#rPropertyList)
 * [[82]](https://www.w3.org/TR/sparql11-query/#rPropertyListPath)
 */
function propertyListImpl<T extends string>(name: T, allowPaths: boolean):
SparqlGrammarRule<T, Triple[], Pick<Triple, 'subject'>> {
  return {
    name,
    impl: ({ SUBRULE, OPTION }) => (_, arg) =>
      OPTION(() => SUBRULE(allowPaths ? propertyListPathNotEmpty : propertyListNotEmpty, arg)) ?? [],
  };
}
export const propertyList = propertyListImpl('propertyList', false);
export const propertyListPath = propertyListImpl('propertyListPath', true);

// We could use gates for this, but in that case,
// a grammar not in need of paths would still have to include the path rules
/**
 * [[77]](https://www.w3.org/TR/sparql11-query/#rPropertyListNotEmpty)
 * [[83]](https://www.w3.org/TR/sparql11-query/#rPropertyListPathNotEmpty)
 */
function propertyListNotEmptyImplementation<T extends string>(
  name: T,
  allowPaths: boolean,
): SparqlGrammarRule<T, Triple[], Pick<Triple, 'subject'>> {
  return {
    name,
    impl: ({ ACTION, CONSUME, AT_LEAST_ONE, SUBRULE1, MANY2, OR1 }) => (_, arg) => {
      const result: Triple[] = [];
      let i0: ITOS = [];
      let parsedSemi = true;

      AT_LEAST_ONE({
        GATE: () => parsedSemi,
        DEF: () => {
          parsedSemi = false;
          const predicate = allowPaths ?
            OR1<TermVariable | Path>([
              { ALT: () => SUBRULE1(verbPath, undefined) },
              { ALT: () => SUBRULE1(verbSimple, undefined) },
            ]) :
            SUBRULE1(verb, undefined);
          const triples = SUBRULE1(
            allowPaths ? objectListPath : objectList,
            ACTION(() => ({ subject: arg.subject, predicate })),
          );

          const ignored: ITOS[] = [];
          MANY2(() => {
            CONSUME(l.symbols.semi);
            const ix = SUBRULE1(blank, undefined);
            parsedSemi = true;
            ignored.push(ix);
          });

          ACTION(() => {
            const [ head, ...tail ] = triples;
            Object.assign(head.RTT, {
              shareSubjectDef: true,
              sharePrefixDef: false,
              i0,
              ignored,
            });
            result.push(head, ...tail);
            i0 = [];
          });
        },
      });
      return result;
    },
  };
}
export const propertyListNotEmpty = propertyListNotEmptyImplementation('propertyListNotEmpty', false);
export const propertyListPathNotEmpty = propertyListNotEmptyImplementation('propertyListPathNotEmpty', true);

/**
 * [[84]](https://www.w3.org/TR/sparql11-query/#rVerbPath)
 */
export const verbPath: SparqlGrammarRule<'verbPath', Path> = <const> {
  name: 'verbPath',
  impl: ({ SUBRULE }) => () => SUBRULE(path, undefined),
};

/**
 * [[85]](https://www.w3.org/TR/sparql11-query/#rVerbSimple)
 */
export const verbSimple: SparqlGrammarRule<'verbSimple', TermVariable> = <const> {
  name: 'verbSimple',
  impl: ({ SUBRULE }) => () => SUBRULE(var_, undefined),
};

/**
 * [[79]](https://www.w3.org/TR/sparql11-query/#rObjectList)
 * [[86]](https://www.w3.org/TR/sparql11-query/#rObjectListPath)
 */
function objectListImpl<T extends string>(name: T, allowPaths: boolean):
SparqlGrammarRule<T, Triple[], Pick<Triple, 'subject' | 'predicate'>> {
  return <const> {
    name,
    impl: ({ ACTION, SUBRULE, AT_LEAST_ONE, OPTION, CONSUME }) => (_, arg) => {
      const objects: Triple[] = [];
      let parsedComma = false;
      let first = true;
      let ix: ITOS = [];
      AT_LEAST_ONE({
        GATE: () => parsedComma || first,
        DEF: () => {
          first = false;
          parsedComma = false;
          const objectTriples = SUBRULE(allowPaths ? objectPath : object, arg);

          OPTION(() => {
            CONSUME(l.symbols.comma);
            ix = SUBRULE(blank, undefined);
            parsedComma = true;
          });

          ACTION(() => {
            const [ objectTriple, ...triples ] = objectTriples;
            Object.assign(objectTriple.RTT, {
              shareSubjectDef: true,
              sharePrefixDef: true,
              i0: ix,
            });
            objects.push(objectTriple, ...triples);
          });
        },
      });
      return objects;
    },
  };
}
export const objectList = objectListImpl('objectList', false);
export const objectListPath = objectListImpl('objectListPath', true);

function objectImpl<T extends string>(name: T, allowPaths: boolean):
SparqlGrammarRule<T, Triple[], Pick<Triple, 'subject' | 'predicate'>> {
  return {
    name,
    impl: ({ ACTION, SUBRULE }) => (C, arg) => {
      const node = SUBRULE(allowPaths ? graphNodePath : graphNode, undefined);
      return ACTION(() => [
        C.factory.triple(arg.subject, arg.predicate, node.node),
        ...node.triples,
      ]);
    },
  };
}
/**
 * [[80]](https://www.w3.org/TR/sparql11-query/#rObject)
 */
export const object = objectImpl('object', false);
/**
 * [[87]](https://www.w3.org/TR/sparql11-query/#rObjectPath)
 */
export const objectPath = objectImpl('objectPath', true);
/**
 * [[98]](https://www.w3.org/TR/sparql11-query/#rTriplesNode)
 * [[100]](https://www.w3.org/TR/sparql11-query/#rTriplesNodePath)
 */
export const triplesNode: SparqlGrammarRule<'triplesNode', TriplePart> = <const> {
  name: 'triplesNode',
  impl: ({ SUBRULE, OR }) => () => OR<TriplePart>([
    { ALT: () => SUBRULE(collection, undefined) },
    { ALT: () => SUBRULE(blankNodePropertyList, undefined) },
  ]),
};
export const triplesNodePath: SparqlGrammarRule<'triplesNodePath', TriplePart> = <const> {
  name: 'triplesNodePath',
  impl: ({ SUBRULE, OR }) => () => OR<TriplePart>([
    { ALT: () => SUBRULE(collectionPath, undefined) },
    { ALT: () => SUBRULE(blankNodePropertyListPath, undefined) },
  ]),
};

/**
 * [[99]](https://www.w3.org/TR/sparql11-query/#rBlankNodePropertyList)
 * [[101]](https://www.w3.org/TR/sparql11-query/#rBlankNodePropertyListPath)
 */
function blankNodePropertyListImpl<T extends string>(name: T, allowPaths: boolean): SparqlGrammarRule<T, TriplePart> {
  return {
    name,
    impl: ({ ACTION, SUBRULE, CONSUME, SUBRULE1, SUBRULE2 }) => (C) => {
      CONSUME(l.symbols.LSquare);
      const i0 = SUBRULE1(blank, undefined);
      const blankNode = ACTION(() => ({
        ...C.factory.blankNodeImplicit(),
        RTT: {
          triplePart: {
            i0,
            i1: C.factory.itos(),
            blankNodeListSize: 0,
          },
        },
      } satisfies TriplePart['node']));
      const propList = SUBRULE(
        allowPaths ? propertyListPathNotEmpty : propertyListNotEmpty,
        { subject: blankNode },
      );
      CONSUME(l.symbols.RSquare);
      const i1 = SUBRULE2(blank, undefined);

      return ACTION(() => {
        blankNode.RTT.triplePart.blankNodeListSize = propList.length;
        blankNode.RTT.triplePart.i1 = i1;
        return {
          node: blankNode,
          triples: propList,
        };
      });
    },
  };
}
export const blankNodePropertyList = blankNodePropertyListImpl('blankNodePropertyList', false);
export const blankNodePropertyListPath = blankNodePropertyListImpl('blankNodePropertyListPath', true);

/**
 * [[102]](https://www.w3.org/TR/sparql11-query/#rCollection)
 * [[103]](https://www.w3.org/TR/sparql11-query/#rCollectionPath)
 */
function collectionImpl<T extends string>(name: T, allowPaths: boolean): SparqlGrammarRule<T, TriplePart> {
  return {
    name,
    impl: ({ ACTION, AT_LEAST_ONE, SUBRULE, CONSUME, SUBRULE1, SUBRULE2 }) => (C) => {
      // Construct a [cons list](https://en.wikipedia.org/wiki/Cons#Lists),
      // here called a [RDF collection](https://www.w3.org/TR/sparql11-query/#collections).
      const terms: TriplePart[] = [];

      CONSUME(l.symbols.LParen);
      const i0 = SUBRULE1(blank, undefined);
      AT_LEAST_ONE(() => {
        terms.push(SUBRULE(allowPaths ? graphNodePath : graphNode, undefined));
      });
      CONSUME(l.symbols.RParen);
      const i1 = SUBRULE2(blank, undefined);

      return ACTION(() => {
        const triples: Triple[] = [];
        const appendTriples: Triple[] = [];

        const listHead = {
          ...C.factory.blankNodeImplicit(),
          RTT: {
            triplePart: {
              i0,
              i1,
              collectionSize: 0,
            },
          },
        } satisfies TriplePart['node'];
        let iterHead: Triple['object'] = listHead;
        const predFirst = C.factory.namedNode(C.factory.itos(), CommonIRIs.FIRST);
        const predRest = C.factory.namedNode(C.factory.itos(), CommonIRIs.REST);
        for (const [ index, term ] of terms.entries()) {
          const headTriple: Triple = C.factory.triple(iterHead, predFirst, term.node);
          triples.push(headTriple);
          appendTriples.push(...term.triples);

          // If not the last, create new iterHead, otherwise, close list
          if (index === terms.length - 1) {
            const nilTriple: Triple = C.factory.triple(
              iterHead,
              predRest,
              C.factory.namedNode(C.factory.itos(), CommonIRIs.NIL),
            );
            triples.push(nilTriple);
          } else {
            const tail = C.factory.blankNodeImplicit();
            const linkTriple: Triple = C.factory.triple(
              iterHead,
              predRest,
              tail,
            );
            triples.push(linkTriple);
            iterHead = tail;
          }
        }
        listHead.RTT.triplePart.collectionSize = terms.length;
        return {
          node: listHead,
          triples: [ ...triples, ...appendTriples ],
        };
      });
    },
  };
}
export const collection = collectionImpl('collection', false);
export const collectionPath = collectionImpl('collectionPath', true);

/**
 * [[103]](https://www.w3.org/TR/sparql11-query/#rGraphNode)
 * [[105]](https://www.w3.org/TR/sparql11-query/#rGraphNodePath)
 */
function graphNodeImpl<T extends string>(name: T, allowPaths: boolean): SparqlGrammarRule<T, TriplePart> {
  return {
    name,
    impl: ({ SUBRULE, OR }) => C => OR<TriplePart>([
      { ALT: () => {
        const val = SUBRULE(varOrTerm, undefined);
        return {
          node: val,
          triples: [],
        };
      } },
      {
        GATE: () => C.parseMode.has('canCreateBlankNodes'),
        ALT: () => SUBRULE(allowPaths ? triplesNodePath : triplesNode, undefined),
      },
    ]),
  };
}
export const graphNode = graphNodeImpl('graphNode', false);
export const graphNodePath = graphNodeImpl('graphNodePath', true);
