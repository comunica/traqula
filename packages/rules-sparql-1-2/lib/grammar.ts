/**
 * This module will define patch rules that should be used in combination with the sparql11 grammar to create
 * a sparql12 grammar.
 * Rules in this module redefine the return type of core grammar rules.
 * It is therefore essential that the parser retypes the rules from the core grammar.
 */

import type { RuleDefReturn, Wrap } from '@traqula/core';
import {
  funcExpr1,
  funcExpr3,
  gram as S11,
  lex as l11,
  CommonIRIs,
} from '@traqula/rules-sparql-1-1';
import type * as T11 from '@traqula/rules-sparql-1-1';
import * as l12 from './lexer';
import type { SparqlGeneratorRule, SparqlGrammarRule, SparqlRule } from './sparql12HelperTypes';
import type {
  Annotation,
  ContextDefinition,
  ContextDefinitionVersion,
  Expression,
  GraphNode,
  GraphTerm,
  PatternBgp,
  Term,
  TermBlank,
  TermIri,
  TermLiteral,
  TermTriple,
  TermVariable,
  TripleCollectionBlankNodeProperties,
  TripleCollectionReifiedTriple,
  TripleNesting,
} from './sparql12Types';
import { langTagHasCorrectDomain } from './validator';

/**
 *[[7]](https://www.w3.org/TR/sparql12-query/#rVersionDecl)
 */
export const versionDecl: SparqlRule<'versionDecl', ContextDefinitionVersion> = {
  name: 'versionDecl',
  impl: ({ ACTION, SUBRULE, CONSUME }) => (C) => {
    const versionToken = CONSUME(l12.version);
    const identifier = SUBRULE(versionSpecifier, undefined);
    return ACTION(() =>
      C.factory.contextDefinitionVersion(identifier.val, C.factory.sourceLocation(versionToken, identifier)));
  },
  gImpl: ({ PRINT_WORDS }) => (ast, { factory: F }) => {
    F.printFilter(ast, () => {
      PRINT_WORDS('VERSION', `${S11.stringEscapedLexical(ast.version)}`);
    });
  },
};

/**
 * [[8]](https://www.w3.org/TR/sparql12-query/#rVersionSpecifier)
 */
export const versionSpecifier: SparqlGrammarRule<'versionSpecifier', Wrap<string>> = {
  name: 'versionSpecifier',
  impl: ({ ACTION, CONSUME, OR }) => (C) => {
    const token = OR([
      { ALT: () => CONSUME(l11.terminals.stringLiteral1) },
      { ALT: () => CONSUME(l11.terminals.stringLiteral2) },
    ]);
    return ACTION(() => C.factory.wrap(token.image.slice(1, -1), C.factory.sourceLocation(token)));
  },
};

/**
 * OVERRIDING RULE {@link S11.prologue}
 * [[8]](https://www.w3.org/TR/sparql12-query/#rVersionSpecifier)
 */
export const prologue: SparqlRule<'prologue', ContextDefinition[]> = {
  name: 'prologue',
  impl: ({ SUBRULE, MANY, OR }) => () => {
    const result: ContextDefinition[] = [];
    MANY(() => OR([
      { ALT: () => result.push(SUBRULE(S11.baseDecl, undefined)) },
      // TODO: the [spec](https://www.w3.org/TR/sparql11-query/#iriRefs) says you cannot redefine prefixes.
      //  We might need to check this.
      { ALT: () => result.push(SUBRULE(S11.prefixDecl, undefined)) },
      { ALT: () => result.push(SUBRULE(versionDecl, undefined)) },
    ]));
    return result;
  },
  gImpl: ({ SUBRULE }) => (ast, { factory: F }) => {
    for (const context of ast) {
      if (F.isContextDefinitionBase(context)) {
        SUBRULE(S11.baseDecl, context, undefined);
      } else if (F.isContextDefinitionPrefix(context)) {
        SUBRULE(S11.prefixDecl, context, undefined);
      } else if (F.isContextDefinitionVersion(context)) {
        SUBRULE(versionDecl, context, undefined);
      }
    }
  },
};

function reifiedTripleBlockImpl<T extends string>(name: T, allowPath: boolean):
T11.SparqlGrammarRule<T, T11.BasicGraphPattern> {
  return <const> {
    name,
    impl: ({ ACTION, SUBRULE }) => (C) => {
      const triple = SUBRULE(reifiedTriple, undefined);
      const properties = SUBRULE(
        allowPath ? S11.propertyListPath : S11.propertyList,
        { subject: ACTION(() => C.factory.dematerialized(triple.identifier)) },
      );

      return ACTION(() => <T11.BasicGraphPattern> [ triple, ...properties ]);
    },
  };
}
/**
 * [[58]](https://www.w3.org/TR/sparql12-query/#rReifiedTripleBlock) Used by triplesSameSubject
 */
export const reifiedTripleBlock = reifiedTripleBlockImpl('reifiedTripleBlock', false);
/**
 * [[59]](https://www.w3.org/TR/sparql12-query/#rReifiedTripleBlockPath) Used by TriplesSameSubjectPath
 */
export const reifiedTripleBlockPath = reifiedTripleBlockImpl('reifiedTripleBlockPath', true);

/**
 * OVERRIDING RULE: {@link S11.dataBlockValue}.
 * [[69]](https://www.w3.org/TR/sparql12-query/#rDataBlockValue)
 */
export const dataBlockValue:
T11.SparqlGrammarRule<'dataBlockValue', RuleDefReturn<typeof S11.dataBlockValue> | TermTriple> = <const> {
  name: 'dataBlockValue',
  impl: $ => C => $.OR2<RuleDefReturn<typeof dataBlockValue>>([
    { ALT: () => S11.dataBlockValue.impl($)(C, undefined) },
    { ALT: () => $.SUBRULE(tripleTermData, undefined) },
  ]),
};

/**
 * [[70]](https://www.w3.org/TR/sparql12-query/#rReifier)
 */
export const reifier: T11.SparqlGrammarRule<'reifier', RuleDefReturn<typeof varOrReifierId>> = <const> {
  name: 'reifier',
  impl: ({ ACTION, CONSUME, SUBRULE, OPTION }) => (C) => {
    CONSUME(l12.tilde);
    const reifier = OPTION(() => SUBRULE(varOrReifierId, undefined));
    return ACTION(() => {
      if (reifier === undefined && !C.parseMode.has('canCreateBlankNodes')) {
        throw new Error('Cannot create blanknodes in current parse mode');
      }
      return reifier ?? C.factory.blankNode(undefined, C.factory.sourceLocation());
    });
  },
};

/**
 * [[71]](https://www.w3.org/TR/sparql12-query/#rVarOrReifierId)
 */
export const varOrReifierId: T11.SparqlGrammarRule<'varOrReifierId', TermVariable | TermIri | TermBlank> =
  <const> {
    name: 'varOrReifierId',
    impl: ({ SUBRULE, OR }) => C => OR<RuleDefReturn<typeof varOrReifierId>>([
      { GATE: () => C.parseMode.has('canParseVars'), ALT: () => SUBRULE(S11.var_, undefined) },
      { ALT: () => SUBRULE(S11.iri, undefined) },
      { ALT: () => SUBRULE(S11.blankNode, undefined) },
    ]),
  };

function triplesSameSubjectImpl<T extends string>(name: T, allowPaths: boolean):
T11.SparqlGrammarRule<T, T11.BasicGraphPattern> {
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
 * [[81]](https://www.w3.org/TR/sparql12-query/#rTriplesSameSubject)
 */
export const triplesSameSubject = triplesSameSubjectImpl('triplesSameSubject', false);
/**
 * OVERRIDING RULE {@link S11.triplesSameSubjectPath}
 * [[87]](https://www.w3.org/TR/sparql12-query/#rTriplesSameSubjectPath)
 */
export const triplesSameSubjectPath = triplesSameSubjectImpl('triplesSameSubjectPath', true);

function objectImpl<T extends string>(name: T, allowPaths: boolean):
SparqlGrammarRule<T, TripleNesting, Pick<TripleNesting, 'subject' | 'predicate'>> {
  return <const>{
    name,
    impl: ({ ACTION, SUBRULE }) => (C, arg) => {
      const objectVal = SUBRULE(allowPaths ? graphNodePath : graphNode, undefined);
      const annotationVal = SUBRULE(allowPaths ? annotationPath : annotation, undefined);

      return ACTION(() => {
        const { subject, predicate } = arg;
        const F = C.factory;
        if (F.isPathPure(predicate) && annotationVal.length > 0) {
          throw new Error('Note 17 violation');
        }
        return F.annotatedTriple(
          subject,
          predicate,
          objectVal,
          annotationVal,
        );
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

function annotationImpl<T extends string>(name: T, allowPaths: boolean): SparqlRule<T, Annotation[]> {
  return <const> {
    name,
    impl: ({ ACTION, SUBRULE, OR, MANY }) => (C) => {
      const annotations: Annotation[] = [];
      let currentReifier: TermBlank | TermVariable | TermIri | undefined;

      MANY(() => {
        OR([
          { ALT: () => {
            const node = SUBRULE(reifier, undefined);
            annotations.push(node);
            currentReifier = node;
          } },
          { ALT: () => {
            ACTION(() => {
              if (!currentReifier && !C.parseMode.has('canCreateBlankNodes')) {
                throw new Error('Cannot create blanknodes in current parse mode');
              }
              currentReifier = currentReifier ?? C.factory.blankNode(undefined, C.factory.sourceLocation());
            });
            const block = SUBRULE(
              allowPaths ? annotationBlockPath : annotationBlock,

              currentReifier!,
            );
            ACTION(() => {
              annotations.push(block);
              currentReifier = undefined;
            });
          } },
        ]);
      });
      return annotations;
    },
    gImpl: ({ SUBRULE, PRINT_WORD }) => (ast, { factory: F }) => {
      for (const annotation of ast) {
        if (F.isTerm(annotation)) {
          F.printFilter(annotation, () => PRINT_WORD('~'));
          SUBRULE(graphNodePath, annotation, undefined);
        } else {
          SUBRULE(annotationBlockPath, annotation, undefined);
        }
      }
    },
  };
}
/**
 * [[107]](https://www.w3.org/TR/sparql12-query/#rAnnotationPath)
 */
export const annotationPath = annotationImpl('annotationPath', true);
/**
 * [[111]](https://www.w3.org/TR/sparql12-query/#rAnnotation)
 */
export const annotation = annotationImpl('annotation', false);

function annotationBlockImpl<T extends string>(name: T, allowPaths: boolean):
  SparqlGrammarRule<T, TripleCollectionBlankNodeProperties, TripleCollectionBlankNodeProperties['identifier']> &
  SparqlGeneratorRule<T, TripleCollectionBlankNodeProperties> {
  return <const> {
    name,
    impl: ({ ACTION, SUBRULE, CONSUME }) => (C, arg) => {
      const open = CONSUME(l12.annotationOpen);
      const res = SUBRULE(
        allowPaths ? S11.propertyListPathNotEmpty : S11.propertyListNotEmpty,
        { subject: arg },
      );
      const close = CONSUME(l12.annotationClose);

      return ACTION(() => C.factory.tripleCollectionBlankNodeProperties(
        arg,
        res,
        C.factory.sourceLocation(open, close),
      ));
    },
    gImpl: ({ SUBRULE, PRINT_WORD, HANDLE_LOC }) => (ast, { factory: F }) => {
      F.printFilter(ast, () => PRINT_WORD('{|'));
      for (const triple of ast.triples) {
        HANDLE_LOC(triple, () => {
          if (F.isTerm(triple.predicate)) {
            SUBRULE(graphNodePath, triple.predicate, undefined);
          } else {
            SUBRULE(S11.path, triple.predicate, undefined);
          }
          SUBRULE(graphNodePath, triple.object, undefined);

          F.printFilter(ast, () => PRINT_WORD(';'));
        });
      }
      F.printFilter(ast, () => PRINT_WORD('|}'));
    },
  };
}
/**
 * [[110]](https://www.w3.org/TR/sparql12-query/#rAnnotationBlockPath)
 */
export const annotationBlockPath = annotationBlockImpl('annotationBlockPath', true);
/**
 * [[112]](https://www.w3.org/TR/sparql12-query/#rAnnotationBlock)
 */
export const annotationBlock = annotationBlockImpl('annotationBlock', false);

/**
 * OVERRIDING RULE: {@link S11.graphNode}.
 * [[111]](https://www.w3.org/TR/sparql12-query/#rGraphNode)
 */
export const graphNode: SparqlGrammarRule<'graphNode', GraphNode> = <const> {
  name: 'graphNode',
  impl: $ => C => $.OR2<RuleDefReturn<typeof graphNode>>([
    { ALT: () => S11.graphNode.impl($)(C, undefined) },
    { ALT: () => $.SUBRULE(reifiedTriple, undefined) },
  ]),
};
/**
 * OVERRIDING RULE: {@link S11.graphNodePath}.
 * [[114]](https://www.w3.org/TR/sparql12-query/#rGraphNodePath)
 */
export const graphNodePath: SparqlRule<'graphNodePath', GraphNode> = <const> {
  name: 'graphNodePath',
  impl: $ => C => $.OR2<RuleDefReturn<typeof graphNodePath>>([
    { ALT: () => S11.graphNodePath.impl($)(C, undefined) },
    { ALT: () => $.SUBRULE(reifiedTriple, undefined) },
  ]),
  gImpl: $ => (ast, C, params) => {
    if (C.factory.isTripleCollectionReifiedTriple(ast)) {
      $.SUBRULE(reifiedTriple, ast, undefined);
    } else {
      S11.graphNodePath.gImpl($)(<T11.Term | T11.TripleCollection> ast, C, params);
    }
  },
};

/**
 * OVERRIDING RULE: {@link S11.varOrTerm}.
 * [[115]](https://www.w3.org/TR/sparql12-query/#rVarOrTerm)
 */
export const varOrTerm: SparqlGrammarRule<'varOrTerm', Term> = <const> {
  name: 'varOrTerm',
  impl: ({ ACTION, SUBRULE, OR, CONSUME }) => C => OR<Term>([
    { GATE: () => C.parseMode.has('canParseVars'), ALT: () => SUBRULE(S11.var_, undefined) },
    { ALT: () => SUBRULE(S11.iri, undefined) },
    { ALT: () => SUBRULE(rdfLiteral, undefined) },
    { ALT: () => SUBRULE(S11.numericLiteral, undefined) },
    { ALT: () => SUBRULE(S11.booleanLiteral, undefined) },
    { ALT: () => SUBRULE(S11.blankNode, undefined) },
    { ALT: () => {
      const token = CONSUME(l11.terminals.nil);
      return ACTION(() => C.factory.namedNode(C.factory.sourceLocation(token), CommonIRIs.NIL));
    } },
    { ALT: () => SUBRULE(tripleTerm, undefined) },
  ]),
  // Generation remains untouched - go through graphTerm
};

/**
 * [[114]](https://www.w3.org/TR/sparql12-query/#rReifiedTriple)
 */
export const reifiedTriple: SparqlRule<'reifiedTriple', TripleCollectionReifiedTriple> = <const> {
  name: 'reifiedTriple',
  impl: ({ ACTION, CONSUME, SUBRULE, OPTION }) => (C) => {
    const open = CONSUME(l12.reificationOpen);
    const subject = SUBRULE(reifiedTripleSubject, undefined);
    const predicate = SUBRULE(S11.verb, undefined);
    const object = SUBRULE(reifiedTripleObject, undefined);
    const reifierVal = OPTION(() => SUBRULE(reifier, undefined));
    const close = CONSUME(l12.reificationClose);

    return ACTION(() => {
      // A reifier would be auto generated in this case, but we are not allowed to use them.
      if (reifierVal === undefined && !C.parseMode.has('canCreateBlankNodes')) {
        throw new Error('Cannot create blanknodes in current parse mode');
      }
      return C.factory.tripleCollectionReifiedTriple(
        C.factory.sourceLocation(open, close),
        subject,
        predicate,
        object,
        reifierVal,
      );
    });
  },
  gImpl: ({ SUBRULE, PRINT_WORD }) => (ast, { factory: F }) => {
    F.printFilter(ast, () => PRINT_WORD('<<'));
    const triple = ast.triples[0];
    SUBRULE(graphNodePath, triple.subject, undefined);
    if (F.isPathPure(triple.predicate)) {
      SUBRULE(S11.path, triple.predicate, undefined);
    } else {
      SUBRULE(graphNodePath, triple.predicate, undefined);
    }
    SUBRULE(graphNodePath, triple.object, undefined);
    SUBRULE(annotationPath, [ ast.identifier ], undefined);
    F.printFilter(ast, () => PRINT_WORD('>>'));
  },
};

/**
 * [[115]](https://www.w3.org/TR/sparql12-query/#rReifiedTripleSubject)
 */
export const reifiedTripleSubject:
T11.SparqlGrammarRule<'reifiedTripleSubject', Term | TripleCollectionReifiedTriple> = <const> {
  name: 'reifiedTripleSubject',
  impl: ({ OR, SUBRULE }) => C => OR<RuleDefReturn<typeof reifiedTripleSubject>>([
    { GATE: () => C.parseMode.has('canParseVars'), ALT: () => SUBRULE(S11.var_, undefined) },
    { ALT: () => SUBRULE(S11.iri, undefined) },
    { ALT: () => SUBRULE(rdfLiteral, undefined) },
    { ALT: () => SUBRULE(S11.numericLiteral, undefined) },
    { ALT: () => SUBRULE(S11.booleanLiteral, undefined) },
    { ALT: () => SUBRULE(S11.blankNode, undefined) },
    { ALT: () => SUBRULE(reifiedTriple, undefined) },
    { ALT: () => SUBRULE(tripleTerm, undefined) },
  ]),
};

/**
 * [[116]](https://www.w3.org/TR/sparql12-query/#rReifiedTripleObject)
 */
export const reifiedTripleObject:
T11.SparqlGrammarRule<'reifiedTripleObject', RuleDefReturn<typeof reifiedTripleSubject>> =
  <const> {
    name: 'reifiedTripleObject',
    impl: reifiedTripleSubject.impl,
  };

/**
 * [[117]](https://www.w3.org/TR/sparql12-query/#rTripleTerm)
 */
export const tripleTerm: SparqlRule<'tripleTerm', TermTriple> = <const> {
  name: 'tripleTerm',
  impl: ({ ACTION, CONSUME, SUBRULE }) => (C) => {
    const open = CONSUME(l12.tripleTermOpen);
    const subject = SUBRULE(tripleTermSubject, undefined);
    const predicate = SUBRULE(S11.verb, undefined);
    const object = SUBRULE(tripleTermObject, undefined);
    const close = CONSUME(l12.tripleTermClose);
    return ACTION(() => C.factory.termTriple(subject, predicate, object, C.factory.sourceLocation(open, close)));
  },
  gImpl: ({ SUBRULE, PRINT_WORD }) => (ast, { factory: F }) => {
    F.printFilter(ast, () => PRINT_WORD('<<('));
    SUBRULE(graphNodePath, ast.subject, undefined);
    SUBRULE(graphNodePath, ast.predicate, undefined);
    SUBRULE(graphNodePath, ast.object, undefined);
    F.printFilter(ast, () => PRINT_WORD(')>>'));
  },
};

/**
 * [[120]](https://www.w3.org/TR/sparql12-query/#rTripleTermSubject)
 */
export const tripleTermSubject:
T11.SparqlGrammarRule<'tripleTermSubject', TermVariable | TermIri | TermLiteral | TermBlank | TermTriple> = <const> {
  name: 'tripleTermSubject',
  impl: ({ SUBRULE, OR }) => C => OR<RuleDefReturn<typeof tripleTermSubject>>([
    { GATE: () => C.parseMode.has('canParseVars'), ALT: () => SUBRULE(S11.var_, undefined) },
    { ALT: () => SUBRULE(S11.iri, undefined) },
    { ALT: () => SUBRULE(rdfLiteral, undefined) },
    { ALT: () => SUBRULE(S11.numericLiteral, undefined) },
    { ALT: () => SUBRULE(S11.booleanLiteral, undefined) },
    { ALT: () => SUBRULE(S11.blankNode, undefined) },
    { ALT: () => SUBRULE(tripleTerm, undefined) },
  ]),
};

/**
 * [[121]](https://www.w3.org/TR/sparql12-query/#rTripleTermObject)
 */
export const tripleTermObject:
T11.SparqlGrammarRule<'tripleTermObject', RuleDefReturn<typeof tripleTermSubject>> = <const> {
  name: 'tripleTermObject',
  impl: tripleTermSubject.impl,
};

/**
 * [[122]](https://www.w3.org/TR/sparql12-query/#rTripleTermData)
 */
export const tripleTermData: SparqlGrammarRule<'tripleTermData', TermTriple> = <const> {
  name: 'tripleTermData',
  impl: ({ ACTION, CONSUME, OR, SUBRULE }) => (C) => {
    const open = CONSUME(l12.tripleTermOpen);
    const subject = SUBRULE(tripleTermDataSubject, undefined);
    const predicate = OR([
      { ALT: () => SUBRULE(S11.iri, undefined) },
      { ALT: () => {
        const token = CONSUME(l11.a);
        return ACTION(() => C.factory.namedNode(C.factory.sourceLocation(token), CommonIRIs.TYPE));
      } },
    ]);
    const object = SUBRULE(tripleTermDataObject, undefined);
    const close = CONSUME(l12.tripleTermClose);

    return ACTION(() => C.factory.termTriple(subject, predicate, object, C.factory.sourceLocation(open, close)));
  },
};

/**
 * [[123]](https://www.w3.org/TR/sparql12-query/#rTripleTermDataSubject)
 */
export const tripleTermDataSubject: T11.SparqlGrammarRule<'tripleTermDataSubject', TermIri | TermLiteral | TermTriple> =
  <const> {
    name: 'tripleTermDataSubject',
    impl: ({ OR, SUBRULE }) => () => OR<RuleDefReturn<typeof tripleTermDataSubject>>([
      { ALT: () => SUBRULE(S11.iri, undefined) },
      { ALT: () => SUBRULE(rdfLiteral, undefined) },
      { ALT: () => SUBRULE(S11.numericLiteral, undefined) },
      { ALT: () => SUBRULE(S11.booleanLiteral, undefined) },
      { ALT: () => SUBRULE(tripleTermData, undefined) },
    ]),
  };

/**
 * [[124]](https://www.w3.org/TR/sparql12-query/#rTripleTermDataObject)
 */
export const tripleTermDataObject:
T11.SparqlGrammarRule<'tripleTermDataObject', RuleDefReturn<typeof tripleTermDataSubject>> = <const> {
  name: 'tripleTermDataObject',
  impl: tripleTermDataSubject.impl,
};

/**
 * OVERRIDING RULE: {@link S11.primaryExpression}.
 * [[136]](https://www.w3.org/TR/sparql12-query/#rPrimaryExpression)
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
export const exprTripleTerm: SparqlGrammarRule<'exprTripleTerm', TermTriple> = <const> {
  name: 'exprTripleTerm',
  impl: ({ ACTION, CONSUME, SUBRULE }) => (C) => {
    const open = CONSUME(l12.tripleTermOpen);
    const subject = SUBRULE(exprTripleTermSubject, undefined);
    const predicate = SUBRULE(S11.verb, undefined);
    const object = SUBRULE(exprTripleTermObject, undefined);
    const close = CONSUME(l12.tripleTermClose);

    return ACTION(() => C.factory.termTriple(
      subject,
      predicate,
      object,
      C.factory.sourceLocation(open, close),
    ));
  },
};

/**
 * [[138]](https://www.w3.org/TR/sparql12-query/#rExprTripleTermSubject)
 */
export const exprTripleTermSubject:
T11.SparqlGrammarRule<'exprTripleTermSubject', TermIri | TermVariable | TermLiteral | TermTriple> = <const> {
  name: 'exprTripleTermSubject',
  impl: ({ OR, SUBRULE }) => C =>
    OR<RuleDefReturn<typeof exprTripleTermSubject>>([
      { ALT: () => SUBRULE(S11.iri, undefined) },
      { ALT: () => SUBRULE(rdfLiteral, undefined) },
      { ALT: () => SUBRULE(S11.numericLiteral, undefined) },
      { ALT: () => SUBRULE(S11.booleanLiteral, undefined) },
      { GATE: () => C.parseMode.has('canParseVars'), ALT: () => SUBRULE(S11.var_, undefined) },
      { ALT: () => SUBRULE(exprTripleTerm, undefined) },
    ]),
};

/**
 * [[139]](https://www.w3.org/TR/sparql12-query/#rExprTripleTermObject)
 */
export const exprTripleTermObject:
T11.SparqlGrammarRule<'exprTripleTermObject', RuleDefReturn<typeof exprTripleTermSubject> | TermTriple> = <const> {
  name: 'exprTripleTermObject',
  impl: exprTripleTermSubject.impl,
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
 * [[141]](https://www.w3.org/TR/sparql12-query/#rBuiltInCall)
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

/**
 * OVERRIDING RULE: {@link S11.rdfLiteral}.
 * No retyping is needed since the return type is the same
 * [[149]](https://www.w3.org/TR/sparql12-query/#rRDFLiteral)
 */
export const rdfLiteral: SparqlGrammarRule<'rdfLiteral', RuleDefReturn<typeof S11.rdfLiteral>> = <const> {
  name: 'rdfLiteral',
  impl: ({ ACTION, SUBRULE, OPTION, CONSUME, OR }) => (C) => {
    const value = SUBRULE(S11.string, undefined);
    return OPTION(() => OR<RuleDefReturn<typeof rdfLiteral>>([
      { ALT: () => {
        const langTag = CONSUME(l12.LANG_DIR);
        return ACTION(() => {
          const literal = C.factory.literalTerm(
            C.factory.sourceLocation(value, langTag),
            value.value,
            langTag.image.slice(1).toLowerCase(),
          );
          langTagHasCorrectDomain(literal);
          return literal;
        });
      } },
      { ALT: () => {
        CONSUME(l11.symbols.hathat);
        const iriVal = SUBRULE(S11.iri, undefined);
        return ACTION(() => C.factory.literalTerm(
          C.factory.sourceLocation(value, iriVal),
          value.value,
          iriVal,
        ));
      } },
    ])) ?? value;
  },
};

/**
 * OVERRIDING RULE: {@link S11.triplesBlock}.
 */
export const generateTriplesBlock: SparqlGeneratorRule<'triplesBlock', PatternBgp> = {
  name: 'triplesBlock',
  gImpl: ({ SUBRULE, PRINT_WORD, HANDLE_LOC }) => (ast, { factory: F }) => {
    for (const [ index, triple ] of ast.triples.entries()) {
      HANDLE_LOC(triple, () => {
        const nextTriple = ast.triples.at(index);
        if (F.isTripleCollection(triple)) {
          SUBRULE(graphNodePath, triple, undefined);
          // A top level tripleCollection block means that it is not used in a triple. So you end with DOT.
          F.printFilter(triple, () => PRINT_WORD('.'));
        } else {
          // Subject
          SUBRULE(graphNodePath, triple.subject, undefined);
          // Predicate
          if (F.isPathPure(triple.predicate)) {
            SUBRULE(S11.path, triple.predicate, undefined);
          } else {
            SUBRULE(graphNodePath, triple.predicate, undefined);
          }
          // Object
          SUBRULE(graphNodePath, triple.object, undefined);
          SUBRULE(annotationPath, triple.annotations ?? [], undefined);

          // If no more things, or a top level collection (only possible if new block was part), or new subject: add DOT
          if (nextTriple === undefined || F.isTripleCollection(nextTriple) ||
            !F.isSourceLocationNoMaterialize(nextTriple.subject.loc)) {
            F.printFilter(ast, () => PRINT_WORD('.'));
          } else if (F.isSourceLocationNoMaterialize(nextTriple.predicate.loc)) {
            F.printFilter(ast, () => PRINT_WORD(','));
          } else {
            F.printFilter(ast, () => PRINT_WORD(';'));
          }
        }
      });
    }
  },
};

/**
 * OVERRIDING RULE: {@link S11.graphTerm}.
 * No retyping is needed since the return type is the same
 * [[149]](https://www.w3.org/TR/sparql12-query/#rRDFLiteral)
 */
export const generateGraphTerm: SparqlGeneratorRule<'graphTerm', GraphTerm> = {
  name: 'graphTerm',
  gImpl: $ => (ast, C, par) => {
    if (C.factory.isTermTriple(ast)) {
      $.SUBRULE(tripleTerm, ast, undefined);
    } else {
      S11.graphTerm.gImpl($)(ast, C, par);
    }
  },
};
