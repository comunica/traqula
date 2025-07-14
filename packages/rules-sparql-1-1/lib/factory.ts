import type { SourceLocation } from '@traqula/core';
import { CoreFactory } from '@traqula/core';

import type {
  BasicGraphPattern,
  ContextDefinition,
  ContextDefinitionBase,
  ContextDefinitionPrefix,
  DatasetClauses,
  Expression,
  ExpressionAggregate,
  ExpressionAggregateDefault,
  ExpressionAggregateOnWildcard,
  ExpressionAggregateSeparator,
  ExpressionFunctionCall,
  ExpressionOperation,
  ExpressionPatternOperation,
  GraphNode,
  GraphRef,
  GraphRefAll,
  GraphRefDefault,
  GraphRefNamed,
  GraphRefSpecific,
  Ordering,
  Path,
  PathAlternativeLimited,
  PathModified,
  PathNegated,
  PathNegatedElt,
  Pattern,
  PatternBgp,
  PatternBind,
  PatternFilter,
  PatternGraph,
  PatternGroup,
  PatternMinus,
  PatternOptional,
  PatternService,
  PatternUnion,
  PatternValues,
  PropertyPathChain,
  Quads,
  Query,
  QueryAsk,
  QueryConstruct,
  QueryDescribe,
  QuerySelect,
  SolutionModifierHaving,
  SolutionModifierLimitOffset,
  SolutionModifierOrder,
  Term,
  TermBlank,
  TermIri,
  TermIriFull,
  TermIriPrefixed,
  TermLiteral,
  TermLiteralLangStr,
  TermLiteralStr,
  TermLiteralTyped,
  TermVariable,
  TripleCollection,
  TripleCollectionBlankNodeProperties,
  TripleCollectionList,
  TripleNesting,
  UpdateOperationAdd,
  UpdateOperationClear,
  UpdateOperationCopy,
  UpdateOperationCreate,
  UpdateOperationDeleteData,
  UpdateOperationDeleteWhere,
  UpdateOperationDrop,
  UpdateOperationInsertData,
  UpdateOperationLoad,
  UpdateOperationModify,
  UpdateOperationMove,
  ValuePatternRow,
  Wildcard,
} from './RoundTripTypes';

export class TraqulaFactory extends CoreFactory {
  private blankNodeCounter = 0;

  public isContextDefinitionPrefix(contextDef: ContextDefinition): contextDef is ContextDefinitionPrefix {
    return contextDef.subType === 'prefix';
  }

  public isContextDefinitionBase(contextDef: ContextDefinition): contextDef is ContextDefinitionBase {
    return contextDef.subType === 'base';
  }

  public contextDefinitionPrefix(loc: SourceLocation, key: string, value: TermIriFull): ContextDefinitionPrefix {
    return {
      type: 'contextDef',
      subType: 'prefix',
      key,
      value,
      loc,
    };
  }

  public contextDefinitionBase(loc: SourceLocation, value: TermIriFull): ContextDefinitionBase {
    return {
      type: 'contextDef',
      subType: 'base',
      value,
      loc,
    };
  }

  public graphNodeIdentifier(graphNode: GraphNode): Term {
    return graphNode.type === 'tripleCollection' ? graphNode.identifier : graphNode;
  }

  public isBaseDecl(x: ContextDefinition): x is ContextDefinitionBase {
    return x.subType === 'base';
  }

  public isPrefixDecl(x: ContextDefinition): x is ContextDefinitionBase {
    return x.subType === 'prefix';
  }

  public variable(value: string, loc: SourceLocation): TermVariable {
    return {
      type: 'term',
      subType: 'variable',
      value,
      loc,
    };
  }

  public isTerm(x: object): x is Term {
    return 'type' in x && x.type === 'term';
  }

  public isTermIriPrefixed(x: TermIri): x is TermIriPrefixed {
    return 'prefix' in x;
  }

  public isExpression(x: object): x is Expression {
    if ('type' in x) {
      if (x.type === 'expression') {
        return true;
      }
      if (this.isTerm(x)) {
        return this.isTermIri(x) || this.isTermVariable(x) || this.isTermLiteral(x);
      }
    }
    return false;
  }

  public isExpressionOperator(x: Expression): x is ExpressionOperation {
    return x.type === 'expression' && x.subType === 'operation';
  }

  public isExpressionPatternOperator(x: Expression): x is ExpressionPatternOperation {
    return x.type === 'expression' && x.subType === 'patternOperation';
  }

  public isExpressionAggregate(x: Expression): x is ExpressionAggregate {
    return x.type === 'expression' && x.subType === 'aggregate';
  }

  public isTermIri(x: Expression | Term): x is TermIri {
    return this.isTerm(x) && x.subType === 'namedNode';
  }

  public isTermVariable(x: Expression | Term): x is TermVariable {
    return this.isTerm(x) && x.subType === 'variable';
  }

  public isTermLiteral(x: Expression | Term): x is TermLiteral {
    return this.isTerm(x) && x.subType === 'literal';
  }

  public isTermLiteralLangStr(x: TermLiteral): x is TermLiteralLangStr {
    return 'langOrIri' in x && typeof x.langOrIri === 'string';
  }

  public isTermLiteralTyped(x: TermLiteral): x is TermLiteralTyped {
    return 'langOrIri' in x && typeof x.langOrIri === 'object' &&
      this.isTerm(x.langOrIri) && this.isTermIri(x.langOrIri);
  }

  public isTermLiteralStr(x: TermLiteral): x is TermLiteralStr {
    return !('langOrIri' in x) || x.langOrIri === undefined;
  }

  public isTermBlankNode(x: Expression | Term): x is TermBlank {
    return this.isTerm(x) && x.subType === 'blankNode';
  }

  public isExpressionFunctionCall(x: Expression): x is ExpressionFunctionCall {
    return x.type === 'expression' && x.subType === 'functionCall';
  }

  public isExpressionAggregateSeparator(x: ExpressionAggregate): x is ExpressionAggregateSeparator {
    return 'separator' in x;
  }

  public isExpressionAggregateOnWildcard(x: ExpressionAggregate): x is ExpressionAggregateOnWildcard {
    return x.expression.length === 1 && this.isWildcard(x.expression[0]);
  }

  public isExpressionAggregateDefault(x: ExpressionAggregate): x is ExpressionAggregateDefault {
    return !this.isExpressionAggregateOnWildcard(x);
  }

  public formatOperator(operator: string): string {
    return operator.toLowerCase().replaceAll(' ', '');
  }

  public expressionOperation<Args extends Expression[]>(
    operator: string,
    args: Args,
    loc: SourceLocation,
  ): ExpressionOperation & { args: Args } {
    return {
      type: 'expression',
      subType: 'operation',
      operator: this.formatOperator(operator),
      args,
      loc,
    };
  }

  public expressionFunctionCall<Args extends Expression[]>(
    functionOp: TermIri,
    args: Args,
    distinct: boolean,
    loc: SourceLocation,
  ): ExpressionFunctionCall & { args: Args } {
    return {
      type: 'expression',
      subType: 'functionCall',
      function: functionOp,
      args,
      distinct,
      loc,
    };
  }

  public expressionPatternOperation(
    operator: string,
    args: PatternGroup,
    loc: SourceLocation,
  ): ExpressionPatternOperation {
    return {
      type: 'expression',
      subType: 'patternOperation',
      operator: this.formatOperator(operator),
      args,
      loc,
    };
  }

  public triple(
    subject: TripleNesting['subject'],
    predicate: TripleNesting['predicate'],
    object: TripleNesting['object'],
    loc?: SourceLocation,
  ): TripleNesting {
    return {
      type: 'triple',
      subject,
      predicate,
      object,
      loc: loc ?? this.sourceLocation(subject, predicate, object),
    };
  }

  public isTriple(x: object): x is TripleNesting {
    return 'type' in x && x.type === 'triple';
  }

  public isPatternGroup(x: Pattern): x is PatternGroup {
    return x.type === 'pattern' && x.subType === 'group';
  }

  public isPatternUnion(x: Pattern): x is PatternUnion {
    return x.type === 'pattern' && x.subType === 'union';
  }

  public isPatternOptional(x: Pattern): x is PatternOptional {
    return x.type === 'pattern' && x.subType === 'optional';
  }

  public isPatternGraph(x: Pattern): x is PatternGraph {
    return x.type === 'pattern' && x.subType === 'graph';
  }

  public isPatternBgp(x: Pattern): x is PatternBgp {
    return x.type === 'pattern' && x.subType === 'bgp';
  }

  public isPatternBind(x: Pattern): x is PatternBind {
    return x.type === 'pattern' && x.subType === 'bind';
  }

  public isPatternService(x: Pattern): x is PatternService {
    return x.type === 'pattern' && x.subType === 'service';
  }

  public isPatternValues(x: Pattern): x is PatternValues {
    return x.type === 'pattern' && x.subType === 'values';
  }

  public isPattern(x: any): x is Pattern {
    return x.type === 'pattern';
  }

  public isQuery(x: any): x is Query {
    return x.type === 'query';
  }

  public isQuerySelect(query: Query): query is QuerySelect {
    return query.subType === 'select';
  }

  public isQueryConstruc(query: Query): query is QueryConstruct {
    return query.subType === 'construct';
  }

  public isQueryDescribe(query: Query): query is QueryDescribe {
    return query.subType === 'describe';
  }

  public isQueryAsk(query: Query): query is QueryAsk {
    return query.subType === 'ask';
  }

  public querySelect(arg: Omit<QuerySelect, 'type' | 'subType' | 'loc'>, loc: SourceLocation): QuerySelect {
    return {
      type: 'query',
      subType: 'select',
      ...arg,
      loc,
    };
  }

  public datasetClauses(clauses: DatasetClauses['clauses'], loc: SourceLocation): DatasetClauses {
    return {
      type: 'datasetClauses',
      clauses,
      loc,
    };
  }

  public patternBgp(triples: BasicGraphPattern, loc: SourceLocation): PatternBgp {
    return { type: 'pattern', subType: 'bgp', triples, loc };
  }

  public patternGroup(patterns: Pattern[], loc: SourceLocation): PatternGroup {
    return { type: 'pattern', subType: 'group', patterns, loc };
  }

  public patternGraph(name: TermIri | TermVariable, patterns: Pattern[], loc: SourceLocation): PatternGraph {
    return { type: 'pattern', subType: 'graph', name, patterns, loc };
  }

  public patternOptional(patterns: Pattern[], loc: SourceLocation): PatternOptional {
    return { type: 'pattern', subType: 'optional', patterns, loc };
  }

  public patternValues(values: ValuePatternRow[], loc: SourceLocation): PatternValues {
    return { type: 'pattern', subType: 'values', values, loc };
  }

  public patternFilter(expression: Expression, loc: SourceLocation): PatternFilter {
    return {
      type: 'pattern',
      subType: 'filter',
      expression,
      loc,
    };
  }

  public patternBind(
    expression: Expression,
    variable: TermVariable,
    loc: SourceLocation,
  ): PatternBind {
    return {
      type: 'pattern',
      subType: 'bind',
      expression,
      variable,
      loc,
    };
  }

  public patternUnion(patterns: PatternGroup[], loc: SourceLocation): PatternUnion {
    return {
      type: 'pattern',
      subType: 'union',
      patterns,
      loc,
    };
  }

  public patternMinus(patterns: Pattern[], loc: SourceLocation): PatternMinus {
    return {
      type: 'pattern',
      subType: 'minus',
      patterns,
      loc,
    };
  }

  public patternService(
    name: TermIri | TermVariable,
    patterns: Pattern[],
    silent: boolean,
    loc: SourceLocation,
  ): PatternService {
    return {
      type: 'pattern',
      subType: 'service',
      silent,
      name,
      patterns,
      loc,
    };
  }

  public isGraphRefSpecific(graphRef: GraphRef): graphRef is GraphRefSpecific {
    return graphRef.subType === 'specific';
  }

  public isGraphRefDefault(graphRef: GraphRef): graphRef is GraphRefDefault {
    return graphRef.subType === 'default';
  }

  public isGraphRefNamed(graphRef: GraphRef): graphRef is GraphRefNamed {
    return graphRef.subType === 'named';
  }

  public isGraphRefAll(graphRef: GraphRef): graphRef is GraphRefAll {
    return graphRef.subType === 'all';
  }

  public graphRefSpecific(graph: TermIri, loc: SourceLocation): GraphRefSpecific {
    return {
      type: 'graphRef',
      subType: 'specific',
      graph,
      loc,
    };
  }

  public graphRefDefault(loc: SourceLocation): GraphRefDefault {
    return {
      type: 'graphRef',
      subType: 'default',
      loc,
    };
  }

  public graphRefNamed(loc: SourceLocation): GraphRefNamed {
    return {
      type: 'graphRef',
      subType: 'named',
      loc,
    };
  }

  public graphRefAll(loc: SourceLocation): GraphRefAll {
    return {
      type: 'graphRef',
      subType: 'all',
      loc,
    };
  }

  public aggregate(
    aggregation: string,
    distinct: boolean,
    arg: Expression,
    separator: undefined,
    loc: SourceLocation
  ): ExpressionAggregateDefault;
  public aggregate(
    aggregation: string,
    distinct: boolean,
    arg: Wildcard,
    separator: undefined,
    loc: SourceLocation
  ): ExpressionAggregateOnWildcard;
  public aggregate(
    aggregation: string,
    distinct: boolean,
    arg: Expression,
    separator: string,
    loc: SourceLocation
  ): ExpressionAggregateSeparator;
  public aggregate(
    aggregation: string,
    distinct: boolean,
    arg: Expression | Wildcard,
    separator: string | undefined,
    loc: SourceLocation,
  ): ExpressionAggregate {
    const base = <const> {
      type: 'expression',
      subType: 'aggregate',
      aggregation: this.formatOperator(aggregation),
      distinct,
      loc,
    };
    if (this.isExpression(arg)) {
      if (separator === undefined) {
        return { ...base, expression: [ arg ]} satisfies ExpressionAggregateDefault;
      }
      return { ...base, expression: [ arg ], separator } satisfies ExpressionAggregateSeparator;
    }
    return { ...base, expression: [ arg ]} satisfies ExpressionAggregateOnWildcard;
  }

  public wildcard(loc: SourceLocation): Wildcard {
    return { type: 'wildcard', loc };
  }

  public isWildcard(x: object): x is Wildcard {
    return 'type' in x && x.type === 'wildcard';
  }

  public path(
    subType: '|',
    items: [TermIri | PathNegatedElt, ...(TermIri | PathNegatedElt)[]],
    loc: SourceLocation
  ): PathAlternativeLimited;
  public path(
    subType: '!',
    items: [TermIri | PathNegatedElt | PathAlternativeLimited],
    loc: SourceLocation
  ): PathNegated;
  public path(subType: '^', items: [TermIri], loc: SourceLocation): PathNegatedElt;
  public path(subType: PathModified['subType'], item: [Path], loc: SourceLocation): PathModified;
  public path(subType: '|' | '/', items: [Path, ...Path[]], loc: SourceLocation):
  PropertyPathChain;
  public path(
    subType: (PropertyPathChain | PathModified | PathNegated)['subType'],
    items: [Path, ...Path[]],
    loc: SourceLocation,
  ): Path {
    const base = <const> {
      type: 'path',
      loc,
      items,
    };
    if (subType === '|' || subType === '/') {
      return {
        ...base,
        subType,
      } satisfies PropertyPathChain;
    }
    if ((subType === '?' || subType === '*' || subType === '+' || subType === '^') && items.length === 1) {
      return {
        ...base,
        subType,
        items: <[Path]> items,
      } satisfies PathModified;
    }
    if (subType === '^' && items.length === 1 && this.isTerm(items[0])) {
      return {
        ...base,
        subType,
        items: <[TermIri]> items,
      } satisfies PathNegatedElt;
    }
    if (subType === '!' && items.length === 1 && (
      this.isPathAlternativeLimited(items[0]) || this.isTerm(items[0]) || this.isPathNegatedElt(items[0]))) {
      return {
        ...base,
        subType,
        items: <[TermIri | PathNegatedElt | PathAlternativeLimited]> items,
      } satisfies PathNegated;
    }
    throw new Error('Invalid path type');
  }

  public isPath(x: object): x is Path {
    return ('type' in x && x.type === 'path') || (this.isTerm(x) && this.isTermIri(x));
  }

  public isPathPure(x: object): x is Exclude<Path, TermIri> {
    return 'type' in x && x.type === 'path';
  }

  public isPathChain(x: Path): x is PropertyPathChain {
    return 'subType' in x && (x.subType === '|' || x.subType === '/');
  }

  public isPathModified(x: Path): x is PathModified {
    return 'subType' in x && (x.subType === '?' || x.subType === '*' || x.subType === '+' || x.subType === '^');
  }

  public isPathNegatedElt(x: Path): x is PathNegatedElt {
    return 'subType' in x && x.subType === '^' && x.items.every(path => this.isTerm(path));
  }

  public isPathNegated(x: Path): x is PathNegated {
    return 'subType' in x && x.subType === '!';
  }

  public isPathAlternativeLimited(x: Path): x is PathAlternativeLimited {
    return 'subType' in x && x.subType === '|' &&
      x.items.every(path => this.isTerm(path) || this.isPathNegatedElt(path));
  }

  /**
   * A namednode with fully defined with a uri.
   */
  public namedNode(loc: SourceLocation, value: string, prefix?: undefined): TermIriFull;
  /**
   * A namednode defined using a prefix
   */
  public namedNode(loc: SourceLocation, value: string, prefix: string): TermIriPrefixed;
  public namedNode(loc: SourceLocation, value: string, prefix?: string): TermIriFull | TermIriPrefixed {
    const base = <const> {
      type: 'term',
      subType: 'namedNode',
      value,
      loc,
    };
    if (prefix === undefined) {
      return base;
    }
    return { ...base, prefix };
  }

  public blankNode(label: undefined | string, loc: SourceLocation): TermBlank {
    const base = <const> {
      type: 'term',
      subType: 'blankNode',
      loc,
    };
    if (label === undefined) {
      return { ...base, label: `g_${this.blankNodeCounter++}` };
    }
    return { ...base, label: `e_${label}` };
  }

  public tripleCollectionBlankNodeProperties(
    identifier: TermBlank,
    triples: TripleNesting[],
    loc: SourceLocation,
  ): TripleCollectionBlankNodeProperties {
    return {
      type: 'tripleCollection',
      subType: 'blankNodeProperties',
      identifier,
      triples,
      loc,
    };
  }

  public tripleCollectionList(
    identifier: TermBlank,
    triples: TripleNesting[],
    loc: SourceLocation,
  ): TripleCollectionList {
    return {
      type: 'tripleCollection',
      subType: 'list',
      identifier,
      triples,
      loc,
    };
  }

  public isTripleCollection(collection: object): collection is TripleCollection {
    return 'type' in collection && collection.type === 'tripleCollection';
  }

  public isTripleCollectionList(collection: TripleCollection): collection is TripleCollectionList {
    return collection.subType === 'list';
  }

  public isTripleCollectionBlankNodeProperties(collection: TripleCollection):
    collection is TripleCollectionBlankNodeProperties {
    return collection.subType === 'blankNodeProperties';
  }

  public resetBlankNodeCounter(): void {
    this.blankNodeCounter = 0;
  }

  public updateOperationLoad(
    loc: SourceLocation,
    source: TermIri,
    silent: boolean,
    destination?: GraphRefSpecific | undefined,
  ): UpdateOperationLoad {
    return {
      type: 'updateOperation',
      subType: 'load',
      silent,
      source,
      ...(destination && { destination }),
      loc,
    };
  }

  public updateOperationClearDrop(subType: 'clear', silent: boolean, destination: GraphRef, loc: SourceLocation):
  UpdateOperationClear;
  public updateOperationClearDrop(subType: 'drop', silent: boolean, destination: GraphRef, loc: SourceLocation):
  UpdateOperationDrop;
  public updateOperationClearDrop(
    subType: 'clear' | 'drop',
    silent: boolean,
    destination: GraphRef,
    loc: SourceLocation
  ): UpdateOperationClear | UpdateOperationDrop;
  public updateOperationClearDrop(
    subType: 'clear' | 'drop',
    silent: boolean,
    destination: GraphRef,
    loc: SourceLocation,
  ): UpdateOperationClear | UpdateOperationDrop {
    return {
      type: 'updateOperation',
      subType,
      silent,
      destination,
      loc,
    };
  }

  public updateOperationClear(
    destination: GraphRef,
    silent: boolean,
    loc: SourceLocation,
  ): UpdateOperationClear {
    return this.updateOperationClearDrop('clear', silent, destination, loc);
  };

  public updateOperationDrop(
    destination: GraphRef,
    silent: boolean,
    loc: SourceLocation,
  ): UpdateOperationDrop {
    return this.updateOperationClearDrop('drop', silent, destination, loc);
  }

  public updateOperationCreate(
    destination: GraphRefSpecific,
    silent: boolean,
    loc: SourceLocation,
  ): UpdateOperationCreate {
    return {
      type: 'updateOperation',
      subType: 'create',
      silent,
      destination,
      loc,
    };
  }

  public updateOperationAddMoveCopy(
    subType: 'add',
    source: GraphRefDefault | GraphRefSpecific,
    destination: GraphRefDefault | GraphRefSpecific,
    silent: boolean,
    loc: SourceLocation,
  ): UpdateOperationAdd;
  public updateOperationAddMoveCopy(
    subType: 'move',
    source: GraphRefDefault | GraphRefSpecific,
    destination: GraphRefDefault | GraphRefSpecific,
    silent: boolean,
    loc: SourceLocation,
  ): UpdateOperationMove ;
  public updateOperationAddMoveCopy(
    subType: 'copy',
    source: GraphRefDefault | GraphRefSpecific,
    destination: GraphRefDefault | GraphRefSpecific,
    silent: boolean,
    loc: SourceLocation,
  ): UpdateOperationCopy;
  public updateOperationAddMoveCopy(
    subType: 'add' | 'move' | 'copy',
    source: GraphRefDefault | GraphRefSpecific,
    destination: GraphRefDefault | GraphRefSpecific,
    silent: boolean,
    loc: SourceLocation,
  ): UpdateOperationAdd | UpdateOperationMove | UpdateOperationCopy;
  public updateOperationAddMoveCopy(
    subType: 'add' | 'move' | 'copy',
    source: GraphRefDefault | GraphRefSpecific,
    destination: GraphRefDefault | GraphRefSpecific,
    silent: boolean,
    loc: SourceLocation,
  ): UpdateOperationAdd | UpdateOperationMove | UpdateOperationCopy {
    return {
      type: 'updateOperation',
      subType,
      silent,
      source,
      destination,
      loc,
    };
  }

  public updateOperationAdd(
    source: GraphRefDefault | GraphRefSpecific,
    destination: GraphRefDefault | GraphRefSpecific,
    silent: boolean,
    loc: SourceLocation,
  ): UpdateOperationAdd {
    return this.updateOperationAddMoveCopy('add', source, destination, silent, loc);
  }

  public updateOperationMove(
    source: GraphRefDefault | GraphRefSpecific,
    destination: GraphRefDefault | GraphRefSpecific,
    silent: boolean,
    loc: SourceLocation,
  ): UpdateOperationMove {
    return this.updateOperationAddMoveCopy('move', source, destination, silent, loc);
  }

  public updateOperationCopy(
    source: GraphRefDefault | GraphRefSpecific,
    destination: GraphRefDefault | GraphRefSpecific,
    silent: boolean,
    loc: SourceLocation,
  ): UpdateOperationCopy {
    return this.updateOperationAddMoveCopy('copy', source, destination, silent, loc);
  }

  public updateOperationInsDelDataWhere(subType: 'insertdata', data: Quads[], loc: SourceLocation):
  UpdateOperationInsertData;
  public updateOperationInsDelDataWhere(subType: 'deletedata', data: Quads[], loc: SourceLocation):
  UpdateOperationDeleteData;
  public updateOperationInsDelDataWhere(subType: 'deletewhere', data: Quads[], loc: SourceLocation):
  UpdateOperationDeleteWhere;
  public updateOperationInsDelDataWhere(
    subType: 'insertdata' | 'deletedata' | 'deletewhere',
    data: Quads[],
    loc: SourceLocation,
  ): UpdateOperationInsertData | UpdateOperationDeleteData | UpdateOperationDeleteWhere;
  public updateOperationInsDelDataWhere(
    subType: 'insertdata' | 'deletedata' | 'deletewhere',
    data: Quads[],
    loc: SourceLocation,
  ): UpdateOperationInsertData | UpdateOperationDeleteData | UpdateOperationDeleteWhere {
    return {
      type: 'updateOperation',
      subType,
      data,
      loc,
    };
  }

  public updateOperationInsertData(data: Quads[], loc: SourceLocation): UpdateOperationInsertData {
    return this.updateOperationInsDelDataWhere('insertdata', data, loc);
  }

  public updateOperationDeleteData(data: Quads[], loc: SourceLocation): UpdateOperationDeleteData {
    return this.updateOperationInsDelDataWhere('deletedata', data, loc);
  }

  public updateOperationDeleteWhere(data: Quads[], loc: SourceLocation): UpdateOperationDeleteWhere {
    return this.updateOperationInsDelDataWhere('deletewhere', data, loc);
  }

  public updateOperationModify(
    loc: SourceLocation,
    insert: Quads[] | undefined,
    del: Quads[] | undefined,
    where: Pattern[],
    from: DatasetClauses,
    graph?: TermIri | undefined,
  ): UpdateOperationModify {
    return {
      type: 'updateOperation',
      subType: 'modify',
      insert: insert ?? [],
      delete: del ?? [],
      graph,
      where,
      from,
      loc,
    };
  }

  /**
   * String, no lang, no type
   */
  public literalTerm(loc: SourceLocation, value: string, lang?: undefined): TermLiteralStr;
  /**
   * String with a language tag
   */
  public literalTerm(loc: SourceLocation, value: string, lang: string): TermLiteralLangStr;
  /**
   * Lexical form with a type
   */
  public literalTerm(loc: SourceLocation, value: string, iri: TermIri,): TermLiteralTyped;
  public literalTerm(loc: SourceLocation, value: string, langOrIri?: string | TermIri): TermLiteral {
    return {
      type: 'term',
      subType: 'literal',
      value,
      langOrIri,
      loc,
    };
  }

  public solutionModifierHaving(having: Expression[], loc: SourceLocation): SolutionModifierHaving {
    return {
      type: 'solutionModifier',
      subType: 'having',
      having,
      loc,
    };
  }

  public solutionModifierOrder(orderDefs: Ordering[], loc: SourceLocation): SolutionModifierOrder {
    return {
      type: 'solutionModifier',
      subType: 'order',
      orderDefs,
      loc,
    };
  }

  public solutionModifierLimitOffset(
    limit: number | undefined,
    offset: number | undefined,
    loc: SourceLocation,
  ): SolutionModifierLimitOffset {
    return {
      type: 'solutionModifier',
      subType: 'limitOffset',
      limit,
      offset,
      loc,
    };
  }
}
