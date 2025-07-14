import { Builder } from '@traqula/core';
import { sparql11ParserBuilder } from '@traqula/parser-sparql-1-1';
import { gram as g11 } from '@traqula/rules-sparql-1-1';
import { completeParseContext, gram as S12, lex as l12 } from '@traqula/rules-sparql-1-2';
import type { SparqlContext, Query, Update } from '@traqula/rules-sparql-1-2';

export const sparql12ParserBuilder = Builder.createBuilder(sparql11ParserBuilder)
  .widenContext<SparqlContext>()
  .addRuleRedundant(g11.object)
  .addMany(
    S12.reifiedTripleBlock,
    S12.reifiedTripleBlockPath,
    S12.reifier,
    S12.varOrReifierId,
    S12.annotation,
    S12.annotationPath,
    S12.annotationBlockPath,
    S12.annotationBlock,
    S12.reifiedTriple,
    S12.reifiedTripleSubject,
    S12.reifiedTripleObject,
    S12.tripleTerm,
    S12.tripleTermSubject,
    S12.tripleTermObject,
    S12.tripleTermData,
    S12.tripleTermDataSubject,
    S12.tripleTermDataObject,
    S12.exprTripleTerm,
    S12.exprTripleTermSubject,
    S12.exprTripleTermObject,
    S12.builtinLangDir,
    S12.builtinLangStrDir,
    S12.builtinHasLang,
    S12.builtinHasLangDir,
    S12.builtinIsTriple,
    S12.builtinTriple,
    S12.builtinSubject,
    S12.builtinPredicate,
    S12.builtinObject,
  )
  .patchRule(S12.dataBlockValue)
  .patchRule(S12.triplesSameSubject)
  .patchRule(S12.triplesSameSubjectPath)
  .patchRule(S12.object)
  .patchRule(S12.objectPath)
  .patchRule(S12.graphNode)
  .patchRule(S12.graphNodePath)
  .patchRule(S12.varOrTerm)
  .patchRule(S12.primaryExpression)
  .patchRule(S12.builtInCall)
  .patchRule(S12.rdfLiteral);

export class Parser {
  private readonly parser: {
    queryOrUpdate: (input: string, context: SparqlContext, arg: undefined) => Query | Update;
  };

  public constructor() {
    this.parser = sparql12ParserBuilder.consumeToParser({
      tokenVocabulary: l12.sparql12Tokens.build(),
    });
  }

  public parse(query: string, context: Partial<SparqlContext> = {}): Query | Update {
    return this.parser.queryOrUpdate(query, completeParseContext(context), undefined);
  }
}
