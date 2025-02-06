import { CommonIRIs } from '../grammar-helpers/utils';
import * as l from '../lexer';
import type {
  BgpPattern,
  BlankTerm,
  IGraphNode,
  IriTerm,
  ITriplesNode,
  PropertyPath,
  SparqlGrammarRule,
  SparqlRule,
  Triple,
  VariableTerm,
} from '../Sparql11types';
import { var_, varOrTerm, verb } from './general';
import { path } from './propertyPaths';

function triplesDotSeperated(subRule: SparqlGrammarRule<any, Triple[]>): SparqlGrammarRule<any, Triple[]>['impl'] {
  return ({ ACTION, AT_LEAST_ONE, SUBRULE, CONSUME, OPTION }) => () => {
    const triples: Triple[] = [];

    let parsedDot = true;
    AT_LEAST_ONE({
      GATE: () => parsedDot,
      DEF: () => {
        parsedDot = false;
        const template = SUBRULE(subRule, undefined);
        ACTION(() => {
          triples.push(...template);
        });
        OPTION(() => {
          CONSUME(l.symbols.dot);
          parsedDot = true;
        });
      },
    });
    return triples;
  };
}

/**
 * [[55]](https://www.w3.org/TR/sparql11-query/#rTriplesBlock)
 */
export const triplesBlock: SparqlRule<'triplesBlock', BgpPattern> = <const> {
  name: 'triplesBlock',
  impl: implArgs => C => ({
    type: 'bgp',
    triples: triplesDotSeperated(triplesSameSubjectPath)(implArgs)(C, undefined),
  }),
  gImpl: ({ SUBRULE }) => ast => ast.triples.map((triple) => {
    const { subject, predicate, object } = triple;
    return [ subject, predicate, object ].map((part) => {
      if ('type' in part) {
        return SUBRULE(path, part, undefined);
      }
      return SUBRULE(varOrTerm, part, undefined);
    }).join(' ');
  }).join(' . '),
};

/**
 * [[75]](https://www.w3.org/TR/sparql11-query/#rTriplesSameSubject)
 * [[81]](https://www.w3.org/TR/sparql11-query/#rTriplesSameSubjectPath)
 */
function triplesSameSubjectImpl<T extends string>(name: T, allowPaths: boolean): SparqlGrammarRule<T, Triple[]> {
  return <const> {
    name,
    impl: ({ ACTION, SUBRULE, OR }) => () => OR<Triple[]>([
      {
        ALT: () => {
          const subject = SUBRULE(varOrTerm, undefined);
          return SUBRULE(allowPaths ? propertyListPathNotEmpty : propertyListNotEmpty, { subject });
        },
      },
      {
        ALT: () => {
          const subjectNode = SUBRULE(allowPaths ? triplesNodePath : triplesNode, undefined);
          const restNode = SUBRULE(allowPaths ? propertyListPath : propertyList, { subject: subjectNode.node });
          return ACTION(() => [
            ...restNode,
            ...subjectNode.triples,
          ]);
        },
      },
    ]),
  };
}
export const triplesSameSubject = triplesSameSubjectImpl('triplesSameSubject', false);
export const triplesSameSubjectPath = triplesSameSubjectImpl('triplesSameSubjectPath', true);

/**
 * [[52]](https://www.w3.org/TR/sparql11-query/#rTriplesTemplate)
 */
export const triplesTemplate: SparqlGrammarRule<'triplesTemplate', Triple[]> = <const> {
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
            OR1<IriTerm | VariableTerm | PropertyPath>([
              { ALT: () => SUBRULE1(verbPath, undefined) },
              { ALT: () => SUBRULE1(verbSimple, undefined) },
            ]) :
            SUBRULE1(verb, undefined);
          const triples = SUBRULE1(
            allowPaths ? objectListPath : objectList,
            ACTION(() => ({ subject: arg.subject, predicate })),
          );

          ACTION(() => result.push(...triples));

          MANY2(() => {
            CONSUME(l.symbols.semi);
            parsedSemi = true;
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
export const verbPath: SparqlGrammarRule<'verbPath', PropertyPath | IriTerm> = <const> {
  name: 'verbPath',
  impl: ({ SUBRULE }) => () => SUBRULE(path, undefined),
};

/**
 * [[85]](https://www.w3.org/TR/sparql11-query/#rVerbSimple)
 */
export const verbSimple: SparqlGrammarRule<'verbSimple', VariableTerm> = <const> {
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
    impl: ({ ACTION, SUBRULE, AT_LEAST_ONE_SEP }) => (_, arg) => {
      const objects: Triple[] = [];
      AT_LEAST_ONE_SEP({
        DEF: () => {
          const objectTriples = SUBRULE(allowPaths ? objectPath : object, arg);
          ACTION(() => objects.push(...objectTriples));
        },
        SEP: l.symbols.comma,
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
    impl: ({ ACTION, SUBRULE }) => (_, arg) => {
      const node = SUBRULE(allowPaths ? graphNodePath : graphNode, undefined);
      return ACTION(() => [
        { subject: arg.subject, predicate: arg.predicate, object: node.node },
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
export const triplesNode: SparqlGrammarRule<'triplesNode', ITriplesNode> = <const> {
  name: 'triplesNode',
  impl: ({ SUBRULE, OR }) => () => OR<ITriplesNode>([
    { ALT: () => SUBRULE(collection, undefined) },
    { ALT: () => SUBRULE(blankNodePropertyList, undefined) },
  ]),
};
export const triplesNodePath: SparqlGrammarRule<'triplesNodePath', ITriplesNode> = <const> {
  name: 'triplesNodePath',
  impl: ({ SUBRULE, OR }) => () => OR<ITriplesNode>([
    { ALT: () => SUBRULE(collectionPath, undefined) },
    { ALT: () => SUBRULE(blankNodePropertyListPath, undefined) },
  ]),
};

/**
 * [[99]](https://www.w3.org/TR/sparql11-query/#rBlankNodePropertyList)
 * [[101]](https://www.w3.org/TR/sparql11-query/#rBlankNodePropertyListPath)
 */
function blankNodePropertyListImpl<T extends string>(name: T, allowPaths: boolean): SparqlGrammarRule<T, ITriplesNode> {
  return {
    name,
    impl: ({ ACTION, SUBRULE, CONSUME }) => (C) => {
      CONSUME(l.symbols.LSquare);
      let blankNode: BlankTerm;
      const propList = SUBRULE(
        allowPaths ? propertyListPathNotEmpty : propertyListNotEmpty,
        { subject: ACTION(() => blankNode = C.dataFactory.blankNode()) },
      );
      CONSUME(l.symbols.RSquare);

      return ACTION(() => ({
        node: blankNode,
        triples: propList,
      }));
    },
  };
}
export const blankNodePropertyList = blankNodePropertyListImpl('blankNodePropertyList', false);
export const blankNodePropertyListPath = blankNodePropertyListImpl('blankNodePropertyListPath', true);

/**
 * [[102]](https://www.w3.org/TR/sparql11-query/#rCollection)
 * [[103]](https://www.w3.org/TR/sparql11-query/#rCollectionPath)
 */
function collectionImpl<T extends string>(name: T, allowPaths: boolean): SparqlGrammarRule<T, ITriplesNode> {
  return {
    name,
    impl: ({ ACTION, AT_LEAST_ONE, SUBRULE, CONSUME }) => (C) => {
      // Construct a [cons list](https://en.wikipedia.org/wiki/Cons#Lists),
      // here called a [RDF collection](https://www.w3.org/TR/sparql11-query/#collections).
      const terms: IGraphNode[] = [];
      CONSUME(l.symbols.LParen);
      AT_LEAST_ONE(() => {
        terms.push(SUBRULE(allowPaths ? graphNodePath : graphNode, undefined));
      });
      CONSUME(l.symbols.RParen);

      return ACTION(() => {
        const triples: Triple[] = [];
        const appendTriples: Triple[] = [];

        const listHead = C.dataFactory.blankNode();
        let iterHead = listHead;
        const predFirst = C.dataFactory.namedNode(CommonIRIs.FIRST);
        const predRest = C.dataFactory.namedNode(CommonIRIs.REST);
        for (const [ index, term ] of terms.entries()) {
          const headTriple: Triple = {
            subject: iterHead,
            predicate: predFirst,
            object: term.node,
          };
          triples.push(headTriple);
          appendTriples.push(...term.triples);

          // If not the last, create new iterHead, otherwise, close list
          if (index === terms.length - 1) {
            const nilTriple: Triple = {
              subject: iterHead,
              predicate: predRest,
              object: C.dataFactory.namedNode(CommonIRIs.NIL),
            };
            triples.push(nilTriple);
          } else {
            const tail = C.dataFactory.blankNode();
            const linkTriple: Triple = {
              subject: iterHead,
              predicate: predRest,
              object: tail,
            };
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
function graphNodeImpl<T extends string>(name: T, allowPaths: boolean): SparqlGrammarRule<T, IGraphNode> {
  return {
    name,
    impl: ({ SUBRULE, OR }) => C => OR<IGraphNode>([
      {
        ALT: () => {
          const val = SUBRULE(varOrTerm, undefined);
          return {
            node: val,
            triples: [],
          };
        },
      },
      {
        GATE: () => C.parseMode.has('canCreateBlankNodes'),
        ALT: () => SUBRULE(allowPaths ? triplesNodePath : triplesNode, undefined),
      },
    ]),
  };
}
export const graphNode = graphNodeImpl('graphNode', false);
export const graphNodePath = graphNodeImpl('graphNodePath', true);
