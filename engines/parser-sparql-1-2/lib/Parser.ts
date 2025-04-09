import type { Patch } from '@traqula/core';
import { ParserBuilder } from '@traqula/core';
import { sparql11ParserBuilder } from '@traqula/parser-sparql-1-1';
import {
  sparqlCodepointEscape,
  gram as g11,
  SparqlParser,
} from '@traqula/rules-sparql-1-1';

import type { types as T12 } from '@traqula/rules-sparql-1-2';
import { gram as S12, lex as l12 } from '@traqula/rules-sparql-1-2';

export const sparql12ParserBuilder = ParserBuilder.createBuilder(sparql11ParserBuilder)
  .addRuleRedundant(g11.object)
  .typePatch<{
    /// GeneralFile
    queryOrUpdate: T12.Query | T12.Update | Pick<T12.Update, 'base' | 'prefixes'>;
    /// Query Unit file
    [g11.selectQuery.name]: Omit<T12.SelectQuery, g11.HandledByBase>;
    [g11.subSelect.name]: Omit<T12.SelectQuery, 'prefixes'>;
    [g11.selectClause.name]: g11.ISelectClause;
    [g11.constructQuery.name]: Omit<T12.ConstructQuery, g11.HandledByBase>;
    [g11.describeQuery.name]: Omit<T12.DescribeQuery, g11.HandledByBase>;
    [g11.askQuery.name]: Omit<T12.AskQuery, g11.HandledByBase>;
    [g11.valuesClause.name]: T12.ValuePatternRow[] | undefined;
    [g11.constructTemplate.name]: T12.Triple[] | undefined;
    [g11.constructTriples.name]: T12.Triple[];
    /// Update Unit file
    [g11.update1.name]: T12.UpdateOperation;
    [g11.load.name]: T12.LoadOperation;
    [g11.clear.name]: T12.ClearDropOperation;
    [g11.drop.name]: T12.ClearDropOperation;
    [g11.create.name]: T12.CreateOperation;
    [g11.add.name]: T12.CopyMoveAddOperation & { type: 'add' };
    [g11.move.name]: T12.CopyMoveAddOperation & { type: 'move' };
    [g11.copy.name]: T12.CopyMoveAddOperation & { type: 'copy' };
    [g11.insertData.name]: T12.InsertOperation;
    [g11.deleteData.name]: T12.DeleteOperation;
    [g11.deleteWhere.name]: T12.DeleteWhereOperation;
    [g11.modify.name]: T12.ModifyOperation;
    [g11.deleteClause.name]: T12.Quads;
    [g11.insertClause.name]: T12.Quads;
    // [g11.usingClause.name]: // untouched
    [g11.graphOrDefault.name]: T12.GraphOrDefault;
    [g11.graphRef.name]: T12.IriTerm;
    [g11.graphRefAll.name]: T12.GraphReference;
    [g11.quadPattern.name]: T12.Quads[];
    [g11.quadData.name]: T12.Quads[];
    [g11.quads.name]: T12.Quads[];
    [g11.quadsNotTriples.name]: T12.GraphQuads[];
    /// Built-in functions
    [g11.builtInStr.name]: T12.OperationExpression;
    [g11.builtInLang.name]: T12.OperationExpression;
    [g11.builtInLangmatches.name]: T12.OperationExpression;
    [g11.builtInDatatype.name]: T12.OperationExpression;
    [g11.builtInBound.name]: T12.OperationExpression;
    [g11.builtInIri.name]: T12.OperationExpression;
    [g11.builtInUri.name]: T12.OperationExpression;
    [g11.builtInBnodeSparqlJs.name]: T12.OperationExpression;
    [g11.builtInRand.name]: T12.OperationExpression;
    [g11.builtInAbs.name]: T12.OperationExpression;
    [g11.builtInCeil.name]: T12.OperationExpression;
    [g11.builtInFloor.name]: T12.OperationExpression;
    [g11.builtInRound.name]: T12.OperationExpression;
    [g11.builtInConcat.name]: T12.OperationExpression;
    [g11.substringExpression.name]: T12.OperationExpression;
    [g11.builtInStrlen.name]: T12.OperationExpression;
    [g11.strReplaceExpression.name]: T12.OperationExpression;
    [g11.builtInUcase.name]: T12.OperationExpression;
    [g11.builtInLcase.name]: T12.OperationExpression;
    [g11.builtInEncode_for_uri.name]: T12.OperationExpression;
    [g11.builtInContains.name]: T12.OperationExpression;
    [g11.builtInStrstarts.name]: T12.OperationExpression;
    [g11.builtInStrends.name]: T12.OperationExpression;
    [g11.builtInStrbefore.name]: T12.OperationExpression;
    [g11.builtInStrafter.name]: T12.OperationExpression;
    [g11.builtInYear.name]: T12.OperationExpression;
    [g11.builtInMonth.name]: T12.OperationExpression;
    [g11.builtInDay.name]: T12.OperationExpression;
    [g11.builtInHours.name]: T12.OperationExpression;
    [g11.builtInMinutes.name]: T12.OperationExpression;
    [g11.builtInSeconds.name]: T12.OperationExpression;
    [g11.builtInTimezone.name]: T12.OperationExpression;
    [g11.builtInTz.name]: T12.OperationExpression;
    [g11.builtInNow.name]: T12.OperationExpression;
    [g11.builtInUuid.name]: T12.OperationExpression;
    [g11.builtInStruuid.name]: T12.OperationExpression;
    [g11.builtInMd5.name]: T12.OperationExpression;
    [g11.builtInSha1.name]: T12.OperationExpression;
    [g11.builtInSha256.name]: T12.OperationExpression;
    [g11.builtInSha384.name]: T12.OperationExpression;
    [g11.builtInSha512.name]: T12.OperationExpression;
    [g11.builtInCoalesce.name]: T12.OperationExpression;
    [g11.builtInIf.name]: T12.OperationExpression;
    [g11.builtInStrlang.name]: T12.OperationExpression;
    [g11.builtInStrdt.name]: T12.OperationExpression;
    [g11.builtInSameterm.name]: T12.OperationExpression;
    [g11.builtInIsiri.name]: T12.OperationExpression;
    [g11.builtInIsuri.name]: T12.OperationExpression;
    [g11.builtInIsblank.name]: T12.OperationExpression;
    [g11.builtInIsliteral.name]: T12.OperationExpression;
    [g11.builtInIsnumeric.name]: T12.OperationExpression;
    [g11.existsFunc.name]: T12.OperationExpression;
    [g11.notExistsFunc.name]: T12.OperationExpression;
    [g11.aggregateCount.name]: T12.AggregateExpression;
    [g11.aggregateSum.name]: T12.AggregateExpression;
    [g11.aggregateMin.name]: T12.AggregateExpression;
    [g11.aggregateMax.name]: T12.AggregateExpression;
    [g11.aggregateAvg.name]: T12.AggregateExpression;
    [g11.aggregateSample.name]: T12.AggregateExpression;
    [g11.aggregateGroup_concat.name]: T12.AggregateExpression;
    [g11.aggregate.name]: T12.AggregateExpression;
    [g11.builtInCall.name]: T12.Expression;
    /// DatasetClause
    // [g11.datasetClause.name]: // unchanged
    [g11.defaultGraphClause.name]: T12.IriTerm;
    [g11.namedGraphClause.name]: T12.IriTerm;
    [g11.sourceSelector.name]: T12.IriTerm;
    // Expression file
    [g11.argList.name]: Patch<g11.IArgList, { args: T12.Expression[] }>;
    [g11.expressionList.name]: T12.Expression[];
    [g11.expression.name]: T12.Expression;
    [g11.conditionalOrExpression.name]: T12.Expression;
    [g11.conditionalAndExpression.name]: T12.Expression;
    [g11.valueLogical.name]: T12.Expression;
    [g11.relationalExpression.name]: T12.Expression;
    [g11.numericExpression.name]: T12.Expression;
    [g11.additiveExpression.name]: T12.Expression;
    [g11.multiplicativeExpression.name]: T12.Expression;
    [g11.unaryExpression.name]: T12.Expression;
    [g11.primaryExpression.name]: T12.Expression;
    [g11.brackettedExpression.name]: T12.Expression;
    [g11.iriOrFunction.name]:
      T12.IriTerm | (Patch<g11.IArgList, { args: T12.Expression[] }> & { function: T12.IriTerm });
    /// General
    [g11.prologue.name]: Pick<T12.BaseQuery, 'base' | 'prefixes'>;
    // [g11.baseDecl.name]: // unchanged;
    // [g11.prefixDecl.name]: // unchanged;
    // [g11.verb.name]: unchanged
    // [g11.verbA.name]: unchanged
    [g11.varOrTerm.name]: T12.Term;
    // [g11.varOrIri.name]: unchanged
    // [g11.var_.name]: unchanged
    [g11.graphTerm.name]: T12.GraphTerm;
    /// Literals
    [g11.rdfLiteral.name]: T12.LiteralTerm;
    [g11.numericLiteral.name]: T12.LiteralTerm;
    [g11.numericLiteralUnsigned.name]: T12.LiteralTerm;
    [g11.numericLiteralPositive.name]: T12.LiteralTerm;
    [g11.numericLiteralNegative.name]: T12.LiteralTerm;
    [g11.booleanLiteral.name]: T12.LiteralTerm;
    // [g11.string.name]: unchanged;
    // [g11.iri.name]: unchanged
    // [g11.prefixedName.name]: unchanged
    // [g11.blankNode.name]: unchanged
    /// / Paths: unchanged
    /// / SolutionModifiers
    [g11.solutionModifier.name]: Pick<T12.SelectQuery, 'group' | 'having' | 'order' | 'limit' | 'offset'>;
    [g11.groupClause.name]: T12.Grouping[];
    [g11.groupCondition.name]: T12.Grouping;
    [g11.havingClause.name]: T12.Expression[];
    [g11.havingCondition.name]: T12.Expression;
    [g11.orderClause.name]: T12.Ordering[];
    [g11.orderCondition.name]: T12.Ordering;
    [g11.limitOffsetClauses.name]: Pick<T12.SelectQuery, 'limit' | 'offset'>;
    // [g11.limitClause.name]: Unchanged
    // [g11.offsetClause.name]: Unchanged
    [g11.triplesBlock.name]: T12.BgpPattern;
    [g11.triplesSameSubject.name]: T12.Triple[];
    [g11.triplesSameSubjectPath.name]: T12.Triple[];
    [g11.triplesTemplate.name]: T12.Triple[];
    [g11.propertyList.name]: T12.Triple[];
    [g11.propertyListPath.name]: T12.Triple[];
    [g11.propertyListNotEmpty.name]: T12.Triple[];
    [g11.propertyListPathNotEmpty.name]: T12.Triple[];
    // [g11.verbPath.name]: unchanged
    // [g11.verbSimple.name]: unchanged
    [g11.objectList.name]: T12.Triple[];
    [g11.objectListPath.name]: T12.Triple[];
    [g11.triplesNode.name]: T12.ITriplesNode;
    [g11.triplesNodePath.name]: T12.ITriplesNode;
    [g11.blankNodePropertyList.name]: T12.ITriplesNode;
    [g11.blankNodePropertyListPath.name]: T12.ITriplesNode;
    [g11.collection.name]: T12.ITriplesNode;
    [g11.collectionPath.name]: T12.ITriplesNode;
    [g11.graphNode.name]: T12.IGraphNode;
    [g11.graphNodePath.name]: T12.IGraphNode;
    /// WhereClause
    [g11.whereClause.name]: T12.Pattern;
    [g11.groupGraphPattern.name]: T12.GroupPattern;
    [g11.groupGraphPatternSub.name]: T12.Pattern[];
    [g11.graphPatternNotTriples.name]: T12.ValuesPattern | T12.BindPattern | T12.FilterPattern | T12.BlockPattern;
    [g11.optionalGraphPattern.name]: T12.OptionalPattern;
    [g11.graphGraphPattern.name]: T12.GraphPattern;
    [g11.serviceGraphPattern.name]: T12.ServicePattern;
    [g11.bind.name]: T12.BindPattern;
    [g11.inlineData.name]: T12.ValuesPattern;
    [g11.dataBlock.name]: T12.ValuePatternRow[];
    [g11.inlineDataOneVar.name]: T12.ValuePatternRow[];
    [g11.inlineDataFull.name]: T12.ValuePatternRow[];
    [g11.dataBlockValue.name]: T12.IriTerm | T12.BlankTerm | T12.LiteralTerm | undefined;
    [g11.minusGraphPattern.name]: T12.MinusPattern;
    [g11.groupOrUnionGraphPattern.name]: T12.GroupPattern | T12.UnionPattern;
    [g11.filter.name]: T12.FilterPattern;
    [g11.constraint.name]: T12.Expression;
    [g11.functionCall.name]: T12.FunctionCallExpression;
  }>()
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
  .deleteRule(g11.graphTerm.name)
  .patchRule(S12.primaryExpression)
  .patchRule(S12.builtInCall)
  .patchRule(S12.rdfLiteral);

export class Parser extends SparqlParser<T12.SparqlQuery> {
  public constructor() {
    const parser = sparql12ParserBuilder.build({
      tokenVocabulary: l12.sparql12Tokens.tokenVocabulary,
      queryPreProcessor: sparqlCodepointEscape,
      parserConfig: {
        skipValidations: true,
      },
    });
    super(parser);
  }
}
