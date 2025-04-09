/**
 * This module will define patch rules that should be used in combination with the sparql11 grammar to create
 * a sparql12 grammar.
 * Rules in this module redefine the return type of core grammar rules.
 * It is therefore essential that the parser retypes the rules from the core grammar.
 */

import type { DirectionalLanguage } from '@rdfjs/types';
import type { RuleDefReturn } from '@traqula/core';
import { funcExpr1, funcExpr3, gram as S11, lex as l11, CommonIRIs } from '@traqula/rules-sparql-1-1';
import type * as T11 from '@traqula/rules-sparql-1-1';
import type { NamedNode } from 'rdf-data-factory';
import * as l12 from './lexer';
import type {
  BaseQuadTerm,
  Expression,
  IGraphNode,
  Term,
  Triple,
} from './sparql12Types';

function reifiedTripleBlockImpl<T extends string>(name: T, allowPath: boolean): T11.SparqlGrammarRule<T, Triple[]> {
  return <const> {
    name,
    impl: ({ ACTION, SUBRULE }) => () => {
      const triple = SUBRULE(reifiedTriple, undefined);
      const properties = SUBRULE(allowPath ? S11.propertyListPath : S11.propertyList, { subject: triple.node });

      return ACTION(() => [
        ...triple.triples,
        ...properties,
      ]);
    },
  };
}
/**
 * [[56]](https://www.w3.org/TR/sparql12-query/#rReifiedTripleBlock) Used by triplesSameSubject
 */
export const reifiedTripleBlock = reifiedTripleBlockImpl('reifiedTripleBlock', false);
/**
 * [[57]](https://www.w3.org/TR/sparql12-query/#rReifiedTripleBlockPath) Used by TriplesSameSubjectPath
 */
export const reifiedTripleBlockPath = reifiedTripleBlockImpl('reifiedTripleBlockPath', true);

/**
 * OVERRIDING RULE: {@link S11.dataBlockValue}.
 * [[67]](https://www.w3.org/TR/sparql12-query/#rDataBlockValue)
 */
export const dataBlockValue:
T11.SparqlRule<'dataBlockValue', RuleDefReturn<typeof S11.dataBlockValue> | BaseQuadTerm> = <const> {
  name: 'dataBlockValue',
  impl: $ => C => $.OR2<RuleDefReturn<typeof S11.dataBlockValue> | BaseQuadTerm>([
    { ALT: () => S11.dataBlockValue.impl($)(C, undefined) },
    { ALT: () => $.SUBRULE(tripleTermData, undefined) },
  ]),
  gImpl: ({ SUBRULE }) => (ast) => {
    if (ast) {
      return SUBRULE(varOrTerm, ast, undefined);
    }
    return 'UNDEF';
  },
};

/**
 * [[68]](https://www.w3.org/TR/sparql12-query/#rReifier)
 */
export const reifier: T11.SparqlGrammarRule<'reifier', T11.VariableTerm | T11.IriTerm | T11.BlankTerm> = <const> {
  name: 'reifier',
  impl: ({ ACTION, CONSUME, SUBRULE, OPTION }) => (C) => {
    CONSUME(l12.tilde);
    const reifier = OPTION(() => SUBRULE(varOrReifierId, undefined));
    return ACTION(() => {
      if (reifier === undefined && !C.parseMode.has('canCreateBlankNodes')) {
        throw new Error('Cannot create blanknodes in current parse mode');
      }
      return reifier ?? C.dataFactory.blankNode();
    });
  },
};

/**
 * [[68]](https://www.w3.org/TR/sparql12-query/#rVarOrReifierId)
 */
export const varOrReifierId: T11.SparqlGrammarRule<'varOrReifierId', T11.VariableTerm | T11.IriTerm | T11.BlankTerm> =
  <const> {
    name: 'varOrReifierId',
    impl: ({ SUBRULE, OR }) => () => OR<T11.VariableTerm | T11.IriTerm | T11.BlankTerm>([
      { ALT: () => SUBRULE(S11.var_, undefined) },
      { ALT: () => SUBRULE(S11.iri, undefined) },
      { ALT: () => SUBRULE(S11.blankNode, undefined) },
    ]),
  };

function triplesSameSubjectImpl<T extends string>(name: T, allowPaths: boolean): T11.SparqlGrammarRule<T, Triple[]> {
  return <const> {
    name,
    impl: $ => C => $.OR2([
      { ALT: () => allowPaths ?
        S11.triplesSameSubjectPath.impl($)(C, undefined) :
        S11.triplesSameSubject.impl($)(C, undefined) },
      { ALT: () => $.SUBRULE(allowPaths ? reifiedTripleBlockPath : reifiedTripleBlock, undefined) },
    ]),
  };
}
/**
 * OVERRIDING RULE {@link S11.triplesSameSubject}
 * [[79]](https://www.w3.org/TR/sparql12-query/#rTriplesSameSubject)
 */
export const triplesSameSubject = triplesSameSubjectImpl('triplesSameSubject', false);
/**
 * OVERRIDING RULE {@link S11.triplesSameSubjectPath}
 * [[85]](https://www.w3.org/TR/sparql12-query/#rTriplesSameSubjectPath)
 */
export const triplesSameSubjectPath = triplesSameSubjectImpl('triplesSameSubjectPath', true);

function objectImpl<T extends string>(name: T, allowPaths: boolean):
T11.SparqlGrammarRule<T, Triple[], Pick<Triple, 'subject' | 'predicate'>> {
  return <const>{
    name,
    impl: ({ ACTION, SUBRULE }) => (C, arg) => {
      const objectVal = SUBRULE(allowPaths ? graphNodePath : graphNode, undefined);
      const annotationVal = SUBRULE(allowPaths ? annotationPath : annotation, undefined);

      // This rule knows the annotation. And for each annotation node, we need to make a triple:
      // <annotationNode, reifies, parsedSubjectAndObject>

      return ACTION(() => {
        const { subject, predicate } = arg;
        if ('type' in predicate && predicate.type === 'path' && annotationVal.length > 0) {
          throw new Error('Note 17 violation');
        }

        const result: Triple[] = [
          // You parse the object
          { subject, predicate, object: objectVal.node },
          // You might get some additional triples from parsing the object (like when it's a collection)
          ...objectVal.triples,
        ];
        for (const annotation of annotationVal) {
          result.push(<Triple> C.dataFactory.quad(
            annotation.node,
            C.dataFactory.namedNode(CommonIRIs.REIFIES),
            C.dataFactory.quad(
              subject,
              <Exclude<typeof predicate, T11.PropertyPath>>predicate,
              objectVal.node,
            ),
          ));
          result.push(...annotation.triples);
        }
        return result;
      });
    },
  };
}
/**
 * OVERRIDING RULE: {@link S11.object}.
 * [[84]](https://www.w3.org/TR/sparql12-query/#rObject) Used by ObjectList
 */
export const object = objectImpl('object', false);
/**
 * OVERRIDING RULE: {@link S11.objectPath}.
 * [[91]](https://www.w3.org/TR/sparql12-query/#rTriplesSameSubjectPath) Used by ObjectListPath
 */
export const objectPath = objectImpl('objectPath', true);

function annotationImpl<T extends string>(name: T, allowPaths: boolean): T11.SparqlGrammarRule<T, IGraphNode[]> {
  return <const> {
    name,
    impl: ({ ACTION, SUBRULE, OR, MANY }) => (C) => {
      const annotations: IGraphNode[] = [];
      let currentReifier: T11.BlankTerm | T11.VariableTerm | T11.IriTerm | undefined;

      function flush(): void {
        if (currentReifier) {
          annotations.push({ node: currentReifier, triples: []});
          currentReifier = undefined;
        }
      }

      MANY(() => {
        OR([
          { ALT: () => {
            const node = SUBRULE(reifier, undefined);
            ACTION(() => flush());
            currentReifier = node;
          } },
          { ALT: () => {
            let node: Triple['subject'];
            const block = SUBRULE(
              allowPaths ? annotationBlockPath : annotationBlock,
              { subject: ACTION(() => {
                if (currentReifier === undefined && !C.parseMode.has('canCreateBlankNodes')) {
                  throw new Error('Cannot create blanknodes in current parse mode');
                }
                node = currentReifier ?? C.dataFactory.blankNode();
                return node;
              }) },
            );
            ACTION(() => {
              annotations.push({
                node,
                triples: block,
              });
              currentReifier = undefined;
            });
          } },
        ]);
      });
      return ACTION(() => {
        flush();
        return annotations;
      });
    },
  };
}
/**
 * [[107]](https://www.w3.org/TR/sparql12-query/#rAnnotationPath)
 */
export const annotationPath = annotationImpl('annotationPath', true);
/**
 * [[109]](https://www.w3.org/TR/sparql12-query/#rAnnotation)
 */
export const annotation = annotationImpl('annotation', false);

function annotationBlockImpl<T extends string>(name: T, allowPaths: boolean):
T11.SparqlGrammarRule<T, Triple[], Pick<Triple, 'subject'>> {
  return <const> {
    name,
    impl: ({ ACTION, SUBRULE, CONSUME }) => (_, arg) => {
      CONSUME(l12.annotationOpen);
      const res = SUBRULE(
        allowPaths ? S11.propertyListPathNotEmpty : S11.propertyListNotEmpty,
        { subject: <T11.Term> ACTION(() => arg.subject) },
      );
      CONSUME(l12.annotationClose);

      return res;
    },
  };
}
/**
 * [[108]](https://www.w3.org/TR/sparql12-query/#rAnnotationBlockPath)
 */
export const annotationBlockPath = annotationBlockImpl('annotationBlockPath', true);
/**
 * [[110]](https://www.w3.org/TR/sparql12-query/#rAnnotationBlock)
 */
export const annotationBlock = annotationBlockImpl('annotationBlock', false);

/**
 * OVERRIDING RULE: {@link S11.graphNode}.
 * [[111]](https://www.w3.org/TR/sparql12-query/#rGraphNode)
 */
export const graphNode: T11.SparqlGrammarRule<'graphNode', IGraphNode> = <const> {
  name: 'graphNode',
  impl: $ => C => $.OR2 <IGraphNode>([
    { ALT: () => S11.graphNode.impl($)(C, undefined) },
    { ALT: () => $.SUBRULE(reifiedTriple, undefined) },
  ]),
};
/**
 * OVERRIDING RULE: {@link S11.graphNodePath}.
 * [[112]](https://www.w3.org/TR/sparql12-query/#rGraphNodePath)
 */
export const graphNodePath: T11.SparqlGrammarRule<'graphNodePath', IGraphNode> = <const> {
  name: 'graphNodePath',
  impl: $ => C => $.OR2<IGraphNode>([
    { ALT: () => S11.graphNodePath.impl($)(C, undefined) },
    { ALT: () => $.SUBRULE(reifiedTriple, undefined) },
  ]),
};

/**
 * OVERRIDING RULE: {@link S11.varOrTerm}.
 * [[113]](https://www.w3.org/TR/sparql12-query/#rVarOrTerm)
 */
export const varOrTerm: T11.SparqlRule<'varOrTerm', Term> = <const> {
  name: 'varOrTerm',
  impl: ({ ACTION, SUBRULE, OR, CONSUME }) => C => OR<Term>([
    { ALT: () => SUBRULE(S11.var_, undefined) },
    { ALT: () => SUBRULE(S11.iri, undefined) },
    { ALT: () => SUBRULE(rdfLiteral, undefined) },
    { ALT: () => SUBRULE(S11.numericLiteral, undefined) },
    { ALT: () => SUBRULE(S11.booleanLiteral, undefined) },
    { ALT: () => SUBRULE(S11.blankNode, undefined) },
    { ALT: () => {
      CONSUME(l11.terminals.nil);
      return ACTION(() => C.dataFactory.namedNode(CommonIRIs.NIL));
    } },
    { ALT: () => SUBRULE(tripleTerm, undefined) },
  ]),
  gImpl: ({ SUBRULE }) => (ast) => {
    if (ast.termType === 'Variable') {
      return SUBRULE(S11.var_, ast, undefined);
    }
    if (ast.termType === 'NamedNode') {
      return SUBRULE(S11.iri, ast, undefined);
    }
    if (ast.termType === 'BlankNode') {
      return SUBRULE(S11.blankNode, ast, undefined);
    }
    if (ast.termType === 'Quad') {
      return SUBRULE(tripleTerm, ast, undefined);
    }
    return SUBRULE(S11.rdfLiteral, ast, undefined);
  },
};

/**
 * [[114]](https://www.w3.org/TR/sparql12-query/#rReifiedTriple)
 */
export const reifiedTriple: T11.SparqlGrammarRule<
  'reifiedTriple',
  IGraphNode & { node: T11.BlankTerm | T11.VariableTerm | T11.IriTerm }
> = <const> {
  name: 'reifiedTriple',
  impl: ({ ACTION, CONSUME, SUBRULE, OPTION }) => (C) => {
    CONSUME(l12.reificationOpen);
    const subject = SUBRULE(reifiedTripleSubject, undefined);
    const predicate = SUBRULE(S11.verb, undefined);
    const object = SUBRULE(reifiedTripleObject, undefined);
    const reifierVal = OPTION(() => SUBRULE(reifier, undefined));
    CONSUME(l12.reificationClose);

    return ACTION(() => {
      if (reifierVal === undefined && !C.parseMode.has('canCreateBlankNodes')) {
        throw new Error('Cannot create blanknodes in current parse mode');
      }
      const reifier = reifierVal ?? C.dataFactory.blankNode();
      const tripleTerm = C.dataFactory.quad(subject.node, predicate, object.node);
      return {
        node: reifier,
        triples: [
          ...subject.triples,
          <Triple> C.dataFactory.quad(reifier, C.dataFactory.namedNode(CommonIRIs.REIFIES), tripleTerm),
          ...object.triples,
        ],
      };
    });
  },
};

/**
 * [[115]](https://www.w3.org/TR/sparql12-query/#rReifiedTripleSubject)
 */
export const reifiedTripleSubject:
T11.SparqlGrammarRule<'reifiedTripleSubject', IGraphNode> =
  <const> {
    name: 'reifiedTripleSubject',
    impl: ({ OR, SUBRULE }) => () => OR<IGraphNode>([
      { ALT: () => ({ node: SUBRULE(S11.var_, undefined), triples: []}) },
      { ALT: () => ({ node: SUBRULE(S11.iri, undefined), triples: []}) },
      { ALT: () => ({ node: SUBRULE(rdfLiteral, undefined), triples: []}) },
      { ALT: () => ({ node: SUBRULE(S11.numericLiteral, undefined), triples: []}) },
      { ALT: () => ({ node: SUBRULE(S11.booleanLiteral, undefined), triples: []}) },
      { ALT: () => ({ node: SUBRULE(S11.blankNode, undefined), triples: []}) },
      { ALT: () => SUBRULE(reifiedTriple, undefined) },
    ]),
  };

/**
 * [[116]](https://www.w3.org/TR/sparql12-query/#rReifiedTripleObject)
 */
export const reifiedTripleObject:
T11.SparqlGrammarRule<'reifiedTripleObject', RuleDefReturn<typeof reifiedTripleSubject>> =
  <const> {
    name: 'reifiedTripleObject',
    impl: $ => C => $.OR2([
      { ALT: () => reifiedTripleSubject.impl($)(C, undefined) },
      { ALT: () => ({ node: $.SUBRULE(tripleTerm, undefined), triples: []}) },
    ]),
  };

/**
 * [[117]](https://www.w3.org/TR/sparql12-query/#rTripleTerm)
 */
export const tripleTerm: T11.SparqlRule<'tripleTerm', BaseQuadTerm> = <const> {
  name: 'tripleTerm',
  impl: ({ ACTION, CONSUME, SUBRULE }) => (C) => {
    CONSUME(l12.tripleTermOpen);
    const subject = SUBRULE(tripleTermSubject, undefined);
    const predicate = SUBRULE(S11.verb, undefined);
    const object = SUBRULE(tripleTermObject, undefined);
    CONSUME(l12.tripleTermClose);
    return ACTION(() => C.dataFactory.quad(subject, predicate, object));
  },
  gImpl: ({ SUBRULE }) => ast =>
    `<<( ${SUBRULE(varOrTerm, ast.subject, undefined)} ${SUBRULE(varOrTerm, ast.predicate, undefined)} ${SUBRULE(varOrTerm, ast.object, undefined)}  )>>`,
};

/**
 * [[118]](https://www.w3.org/TR/sparql12-query/#rTripleTermSubject)
 */
export const tripleTermSubject:
T11.SparqlGrammarRule<'tripleTermSubject', T11.VariableTerm | T11.IriTerm | T11.LiteralTerm | T11.BlankTerm> = <const> {
  name: 'tripleTermSubject',
  impl: ({ SUBRULE, OR }) => () => OR<T11.VariableTerm | T11.IriTerm | T11.LiteralTerm | T11.BlankTerm>([
    { ALT: () => SUBRULE(S11.var_, undefined) },
    { ALT: () => SUBRULE(S11.iri, undefined) },
    { ALT: () => SUBRULE(rdfLiteral, undefined) },
    { ALT: () => SUBRULE(S11.numericLiteral, undefined) },
    { ALT: () => SUBRULE(S11.booleanLiteral, undefined) },
    { ALT: () => SUBRULE(S11.blankNode, undefined) },
  ]),
};

/**
 * [[119]](https://www.w3.org/TR/sparql12-query/#rTripleTermObject)
 */
export const tripleTermObject:
T11.SparqlGrammarRule<'tripleTermObject', RuleDefReturn<typeof tripleTermSubject> | BaseQuadTerm> = <const> {
  name: 'tripleTermObject',
  impl: $ => C => $.OR2<T11.VariableTerm | T11.IriTerm | T11.LiteralTerm | T11.BlankTerm | BaseQuadTerm>([
    { ALT: () => tripleTermSubject.impl($)(C, undefined) },
    { ALT: () => $.SUBRULE(tripleTerm, undefined) },
  ]),
};

/**
 * [[120]](https://www.w3.org/TR/sparql12-query/#rTripleTermData)
 */
export const tripleTermData: T11.SparqlGrammarRule<'tripleTermData', BaseQuadTerm> = <const> {
  name: 'tripleTermData',
  impl: ({ ACTION, CONSUME, OR, SUBRULE }) => (C) => {
    CONSUME(l12.tripleTermOpen);
    const subject = SUBRULE(tripleTermDataSubject, undefined);
    const predicate = OR([
      { ALT: () => SUBRULE(S11.iri, undefined) },
      { ALT: () => {
        CONSUME(l11.a);
        return ACTION(() => C.dataFactory.namedNode(CommonIRIs.TYPE));
      } },
    ]);
    const object = SUBRULE(tripleTermDataObject, undefined);
    CONSUME(l12.tripleTermClose);

    return ACTION(() => C.dataFactory.quad(subject, predicate, object));
  },
};

/**
 * [[121]](https://www.w3.org/TR/sparql12-query/#rTripleTermDataSubject)
 */
export const tripleTermDataSubject: T11.SparqlGrammarRule<'tripleTermDataSubject', T11.IriTerm | T11.LiteralTerm> =
  <const> {
    name: 'tripleTermDataSubject',
    impl: ({ OR, SUBRULE }) => () => OR<T11.IriTerm | T11.LiteralTerm>([
      { ALT: () => SUBRULE(S11.iri, undefined) },
      { ALT: () => SUBRULE(rdfLiteral, undefined) },
      { ALT: () => SUBRULE(S11.numericLiteral, undefined) },
      { ALT: () => SUBRULE(S11.booleanLiteral, undefined) },
    ]),
  };

/**
 * [[122]](https://www.w3.org/TR/sparql12-query/#rTripleTermDataObject)
 */
export const tripleTermDataObject:
T11.SparqlGrammarRule<'tripleTermDataObject', RuleDefReturn<typeof tripleTermDataSubject> | BaseQuadTerm> = <const> {
  name: 'tripleTermDataObject',
  impl: $ => C => $.OR2<T11.IriTerm | T11.LiteralTerm | BaseQuadTerm>([
    { ALT: () => tripleTermDataSubject.impl($)(C, undefined) },
    { ALT: () => $.SUBRULE(tripleTermData, undefined) },
  ]),
};

/**
 * OVERRIDING RULE: {@link S11.primaryExpression}.
 * [[134]](https://www.w3.org/TR/sparql12-query/#rPrimaryExpression)
 */
export const primaryExpression: T11.SparqlGrammarRule<'primaryExpression', Expression> = <const> {
  name: 'primaryExpression',
  impl: $ => C => $.OR2<Expression>([
    { ALT: () => S11.primaryExpression.impl($)(C, undefined) },
    { ALT: () => $.SUBRULE(exprTripleTerm, undefined) },
  ]),
};

/**
 * [[135]](https://www.w3.org/TR/sparql12-query/#rExprTripleTerm)
 */
export const exprTripleTerm: T11.SparqlGrammarRule<'exprTripleTerm', BaseQuadTerm> = <const> {
  name: 'exprTripleTerm',
  impl: ({ ACTION, CONSUME, SUBRULE }) => (C) => {
    CONSUME(l12.tripleTermOpen);
    const subject = SUBRULE(exprTripleTermSubject, undefined);
    const predicate = SUBRULE(S11.verb, undefined);
    const object = SUBRULE(exprTripleTermObject, undefined);
    CONSUME(l12.tripleTermClose);

    return ACTION(() => C.dataFactory.quad(subject, predicate, object));
  },
};

/**
 * [[136]](https://www.w3.org/TR/sparql12-query/#rExprTripleTermSubject)
 */
export const exprTripleTermSubject:
T11.SparqlGrammarRule<'exprTripleTermSubject', T11.IriTerm | T11.VariableTerm | T11.LiteralTerm> = <const> {
  name: 'exprTripleTermSubject',
  impl: ({ OR, SUBRULE }) => () =>
    OR<T11.IriTerm | T11.VariableTerm | T11.LiteralTerm>([
      { ALT: () => SUBRULE(S11.iri, undefined) },
      { ALT: () => SUBRULE(rdfLiteral, undefined) },
      { ALT: () => SUBRULE(S11.numericLiteral, undefined) },
      { ALT: () => SUBRULE(S11.booleanLiteral, undefined) },
      { ALT: () => SUBRULE(S11.var_, undefined) },
    ]),
};

/**
 * [[137]](https://www.w3.org/TR/sparql12-query/#rExprTripleTermObject)
 */
export const exprTripleTermObject:
T11.SparqlGrammarRule<'exprTripleTermObject', RuleDefReturn<typeof exprTripleTermSubject> | BaseQuadTerm> = <const> {
  name: 'exprTripleTermObject',
  impl: $ => C =>
    $.OR2<T11.IriTerm | T11.VariableTerm | T11.LiteralTerm | BaseQuadTerm>([
      { ALT: () => exprTripleTermSubject.impl($)(C, undefined) },
      { ALT: () => $.SUBRULE(exprTripleTerm, undefined) },
    ]),
};

export const builtinLangDir = funcExpr1(l12.builtinLangDir);
export const builtinLangStrDir = funcExpr3(l12.builtinStrLangDir);
export const builtinHasLang = funcExpr1(l12.builtinHasLang);
export const builtinHasLangDir = funcExpr1(l12.builtinHasLangDir);
export const builtinIsTriple = funcExpr1(l12.builtinIsTRIPLE);
export const builtinTriple = funcExpr3(l12.builtinTRIPLE);
export const builtinSubject = funcExpr1(l12.builtinSUBJECT);
export const builtinPredicate = funcExpr1(l12.builtinPREDICATE);
export const builtinObject = funcExpr1(l12.builtinOBJECT);

/**
 * OVERRIDING RULE: {@link S11.builtInCall}.
 * [[139]](https://www.w3.org/TR/sparql12-query/#rBuiltInCall)
 */
export const builtInCall: typeof S11.builtInCall = <const> {
  name: 'builtInCall',
  impl: $ => C => $.OR2<T11.Expression>([
    { ALT: () => S11.builtInCall.impl($)(C, undefined) },
    { ALT: () => $.SUBRULE(builtinLangDir, undefined) },
    { ALT: () => $.SUBRULE(builtinLangStrDir, undefined) },
    { ALT: () => $.SUBRULE(builtinHasLang, undefined) },
    { ALT: () => $.SUBRULE(builtinHasLangDir, undefined) },
    { ALT: () => $.SUBRULE(builtinIsTriple, undefined) },
    { ALT: () => $.SUBRULE(builtinTriple, undefined) },
    { ALT: () => $.SUBRULE(builtinSubject, undefined) },
    { ALT: () => $.SUBRULE(builtinPredicate, undefined) },
    { ALT: () => $.SUBRULE(builtinObject, undefined) },
  ]),
};

function isLangDir(dir: string): dir is 'ltr' | 'rtl' {
  return dir === 'ltr' || dir === 'rtl';
}

/**
 * OVERRIDING RULE: {@link S11.rdfLiteral}.
 * No retyping is needed since the return type is the same
 * [[147]](https://www.w3.org/TR/sparql12-query/#rRDFLiteral)
 */
export const rdfLiteral: T11.SparqlGrammarRule<'rdfLiteral', T11.LiteralTerm> = <const> {
  name: 'rdfLiteral',
  impl: ({ ACTION, SUBRULE, OPTION, CONSUME, OR }) => (C) => {
    const value = SUBRULE(S11.string, undefined);
    const langOrDataType = OPTION(() => OR<string | NamedNode | DirectionalLanguage>([
      { ALT: () => {
        const langTag = CONSUME(l12.LANG_DIR).image.slice(1);

        return ACTION(() => {
          const dirSplit = langTag.split('--');
          if (dirSplit.length > 1) {
            const [ language, direction ] = dirSplit;
            if (!isLangDir(direction)) {
              throw new Error(`language direction "${direction}" of literal "${value}@${langTag}" is not is required range 'ltr' | 'rtl'.`);
            }
            return {
              language,
              direction,
            };
          }
          return langTag;
        });
      } },
      { ALT: () => {
        CONSUME(l11.symbols.hathat);
        return SUBRULE(S11.iri, undefined);
      } },
    ]));
    return ACTION(() => C.dataFactory.literal(value, langOrDataType));
  },
};
