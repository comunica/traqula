import type { IToken } from 'chevrotain';
import { CommonIRIs } from '../grammar-helpers/utils';
import * as l from '../lexer';
import type { Path, PatternBgp, TermVariable, Triple, Wrap } from '../RoundTripTypes';
import type {
  SparqlGrammarRule,
  SparqlRule,
} from '../Sparql11types';
import { var_, varOrTerm, verb } from './general';
import { path } from './propertyPaths';

export interface TriplePart {
  node: Triple['subject'] | Triple['object'];
  triples: Triple[];
}

function triplesDotSeperated(triplesSameSubjectSubrule: SparqlGrammarRule<string, Triple[]>):
SparqlGrammarRule<string, Wrap<Triple[]>>['impl'] {
  return ({ ACTION, AT_LEAST_ONE, SUBRULE, CONSUME, OPTION }) => () => {
    const triples: Triple[] = [];

    let parsedDot = true;
    let dotToken: undefined | IToken;
    AT_LEAST_ONE({
      GATE: () => parsedDot,
      DEF: () => {
        parsedDot = false;
        const template = SUBRULE(triplesSameSubjectSubrule, undefined);
        ACTION(() => {
          triples.push(...template);
        });
        OPTION(() => {
          dotToken = CONSUME(l.symbols.dot);
        });
      },
    });
    return ACTION(() => {
      const start = triples[0].loc!.start;
      const end = dotToken === undefined ? triples.at(-1)!.loc!.end : dotToken.endOffset!;
      return { val: triples, start, end };
    });
  };
}

/**
 * [[55]](https://www.w3.org/TR/sparql11-query/#rTriplesBlock)
 */
export const triplesBlock: SparqlRule<'triplesBlock', PatternBgp> = <const>{
  name: 'triplesBlock',
  impl: implArgs => (C) => {
    const triples = triplesDotSeperated(triplesSameSubjectPath)(implArgs)(C, undefined);
    return implArgs.ACTION(() => C.factory.patternBgp(triples.val, C.factory.sourceLocation(triples)));
  },
  gImpl: () => () => {},
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
export const triplesTemplate: SparqlGrammarRule<'triplesTemplate', Wrap<Triple[]>> = <const> {
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

          MANY2(() => {
            CONSUME(l.symbols.semi);
            parsedSemi = true;
          });

          ACTION(() => {
            result.push(...triples);
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
      let parsedComma = true;
      AT_LEAST_ONE({
        GATE: () => parsedComma,
        DEF: () => {
          parsedComma = false;
          const objectTriples = SUBRULE(allowPaths ? objectPath : object, arg);

          OPTION(() => {
            CONSUME(l.symbols.comma);
            parsedComma = true;
          });

          ACTION(() => {
            objects.push(...objectTriples);
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
    impl: ({ ACTION, SUBRULE, CONSUME }) => (C) => {
      const startToken = CONSUME(l.symbols.LSquare);

      const blankNode = ACTION(() =>
        C.factory.blankNode(undefined, C.factory.sourceLocation(startToken)));

      const propList = SUBRULE(
        allowPaths ? propertyListPathNotEmpty : propertyListNotEmpty,
        { subject: blankNode },
      );
      const endToken = CONSUME(l.symbols.RSquare);

      return ACTION(() => {
        blankNode.loc!.end = endToken.endOffset!;
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
    impl: ({ ACTION, AT_LEAST_ONE, SUBRULE, CONSUME }) => (C) => {
      // Construct a [cons list](https://en.wikipedia.org/wiki/Cons#Lists),
      // here called a [RDF collection](https://www.w3.org/TR/sparql11-query/#collections).
      const terms: TriplePart[] = [];

      const startToken = CONSUME(l.symbols.LParen);

      AT_LEAST_ONE(() => {
        terms.push(SUBRULE(allowPaths ? graphNodePath : graphNode, undefined));
      });
      const endToken = CONSUME(l.symbols.RParen);

      return ACTION(() => {
        const F = C.factory;
        const triples: Triple[] = [];
        // The triples created in your recursion
        const appendTriples: Triple[] = [];
        const predFirst = F.namedNode(CommonIRIs.FIRST, undefined, F.noStringMaterialization());
        const predRest = F.namedNode(CommonIRIs.REST, undefined, F.noStringMaterialization());
        const predNil = F.namedNode(CommonIRIs.NIL, undefined, F.noStringMaterialization());

        const listHead = F.blankNode(undefined, F.sourceLocation(startToken, endToken));
        let iterHead: Triple['object'] = listHead;
        for (const [ index, term ] of terms.entries()) {
          const lastInList = index === terms.length - 1;

          const headTriple: Triple = F.triple(iterHead, predFirst, term.node);
          triples.push(headTriple);
          appendTriples.push(...term.triples);

          // If not the last, create new iterHead, otherwise, close list
          if (lastInList) {
            const nilTriple: Triple = F.triple(iterHead, predRest, predNil);
            triples.push(nilTriple);
          } else {
            const tail = F.blankNode(undefined, F.noStringMaterialization());
            const linkTriple: Triple = F.triple(iterHead, predRest, tail);
            triples.push(linkTriple);
            iterHead = tail;
          }
        }
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
