import type { SourceLocation } from '@traqula/core';
import { CoreFactory } from '@traqula/core';

import type {
  ContextDefinition,
  ContextDefinitionBaseDecl,
  ContextDefinitionPrefixDecl,
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

  public prefixDecl(loc: SourceLocation, key: string, value: TermIriFull): ContextDefinitionPrefixDecl {
    return {
      type: 'contextDef',
      contextType: 'prefix',
      key,
      value,
      loc,
    };
  }

  public baseDecl(loc: SourceLocation, value: TermIriFull): ContextDefinitionBaseDecl {
    return {
      type: 'contextDef',
      contextType: 'base',
      value,
      loc,
    };
  }

  public graphNodeIdentifier(graphNode: GraphNode): Term {
    return graphNode.type === 'tripleCollection' ? graphNode.identifier : graphNode;
  }

  public isBaseDecl(x: ContextDefinition): x is ContextDefinitionBaseDecl {
    return x.contextType === 'base';
  }

  public isPrefixDecl(x: ContextDefinition): x is ContextDefinitionBaseDecl {
    return x.contextType === 'prefix';
  }

  public variable(value: string, loc: SourceLocation): TermVariable {
    return {
      type: 'term',
      termType: 'Variable',
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
    return x.type === 'expression' && x.expressionType === 'operation';
  }

  public isExpressionPatternOperator(x: Expression): x is ExpressionPatternOperation {
    return x.type === 'expression' && x.expressionType === 'patternOperation';
  }

  public isExpressionAggregate(x: Expression): x is ExpressionAggregate {
    return x.type === 'expression' && x.expressionType === 'aggregate';
  }

  public isTermIri(x: Expression | Term): x is TermIri {
    return this.isTerm(x) && x.termType === 'NamedNode';
  }

  public isTermVariable(x: Expression | Term): x is TermVariable {
    return this.isTerm(x) && x.termType === 'Variable';
  }

  public isTermLiteral(x: Expression | Term): x is TermLiteral {
    return this.isTerm(x) && x.termType === 'Literal';
  }

  public isExpressionFunctionCall(x: Expression): x is ExpressionFunctionCall {
    return x.type === 'expression' && x.expressionType === 'functionCall';
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
      expressionType: 'operation',
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
      expressionType: 'functionCall',
      function: functionOp,
      args,
      distinct,
      loc,
    };
  }

  public expressionPatternOperation<Args extends Pattern[]>(
    operator: string,
    args: Args,
    loc: SourceLocation,
  ): ExpressionPatternOperation & { args: Args } {
    return {
      type: 'expression',
      expressionType: 'patternOperation',
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
      loc: loc ?? this.sourceLocation(subject.loc, predicate.loc, object.loc),
    };
  }

  public isPatternGroup(x: Pattern): x is PatternGroup {
    return x.type === 'pattern' && x.patternType === 'group';
  }

  public isPattern(x: any): x is Pattern {
    return x.type === 'pattern';
  }

  public isQuery(x: any): x is Query {
    return x.type === 'query';
  }

  public patternBgp(triples: TripleNesting[], loc: SourceLocation): PatternBgp {
    return { type: 'pattern', patternType: 'bgp', triples, loc };
  }

  public patternGroup(patterns: Pattern[], loc: SourceLocation): PatternGroup {
    return { type: 'pattern', patternType: 'group', patterns, loc };
  }

  public patternGraph(name: TermIri | TermVariable, patterns: Pattern[], loc: SourceLocation): PatternGraph {
    return { type: 'pattern', patternType: 'graph', name, patterns, loc };
  }

  public patternOptional(patterns: Pattern[], loc: SourceLocation): PatternOptional {
    return { type: 'pattern', patternType: 'optional', patterns, loc };
  }

  public patternValues(values: ValuePatternRow[], loc: SourceLocation): PatternValues {
    return { type: 'pattern', patternType: 'values', values, loc };
  }

  public patternFilter(expression: Expression, loc: SourceLocation): PatternFilter {
    return {
      type: 'pattern',
      patternType: 'filter',
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
      patternType: 'bind',
      expression,
      variable,
      loc,
    };
  }

  public patternUnion(patterns: Pattern[], loc: SourceLocation): PatternUnion {
    return {
      type: 'pattern',
      patternType: 'union',
      patterns,
      loc,
    };
  }

  public patternMinus(patterns: Pattern[], loc: SourceLocation): PatternMinus {
    return {
      type: 'pattern',
      patternType: 'minus',
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
      patternType: 'service',
      silent,
      name,
      patterns,
      loc,
    };
  }

  public graphRefSpecific(graph: TermIri, loc: SourceLocation): GraphRefSpecific {
    return {
      type: 'graphRef',
      graphRefType: 'specific',
      graph,
      loc,
    };
  }

  public graphRefDefault(loc: SourceLocation): GraphRefDefault {
    return {
      type: 'graphRef',
      graphRefType: 'default',
      loc,
    };
  }

  public graphRefNamed(loc: SourceLocation): GraphRefNamed {
    return {
      type: 'graphRef',
      graphRefType: 'named',
      loc,
    };
  }

  public graphRefAll(loc: SourceLocation): GraphRefAll {
    return {
      type: 'graphRef',
      graphRefType: 'all',
      loc,
    };
  }

  public deGroupSingle(group: PatternGroup & Pattern): Pattern {
    if (group.patterns.length === 1) {
      return group.patterns[0];
    }
    return group;
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
      expressionType: 'aggregate',
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
    pathType: '|',
    items: [TermIri | PathNegatedElt, ...(TermIri | PathNegatedElt)[]],
    loc: SourceLocation
  ): PathAlternativeLimited;
  public path(
    pathType: '!',
    items: [TermIri | PathNegatedElt | PathAlternativeLimited],
    loc: SourceLocation
  ): PathNegated;
  public path(pathType: '^', items: [TermIri], loc: SourceLocation): PathNegatedElt;
  public path(pathType: PathModified['pathType'], item: [Path], loc: SourceLocation): PathModified;
  public path(pathType: '|' | '/', items: [Path, ...Path[]], loc: SourceLocation):
  PropertyPathChain;
  public path(
    pathType: (PropertyPathChain | PathModified | PathNegated)['pathType'],
    items: [Path, ...Path[]],
    loc: SourceLocation,
  ): Path {
    const base = <const> {
      type: 'path',
      loc,
      items,
    };
    if (pathType === '|' || pathType === '/') {
      return {
        ...base,
        pathType,
      } satisfies PropertyPathChain;
    }
    if ((pathType === '?' || pathType === '*' || pathType === '+' || pathType === '^') && items.length === 1) {
      return {
        ...base,
        pathType,
        items: <[Path]> items,
      } satisfies PathModified;
    }
    if (pathType === '^' && items.length === 1 && this.isTerm(items[0])) {
      return {
        ...base,
        pathType,
        items: <[TermIri]> items,
      } satisfies PathNegatedElt;
    }
    if (pathType === '!' && items.length === 1 && (
      this.isPathAlternativeLimited(items[0]) || this.isTerm(items[0]) || this.isPathNegatedElt(items[0]))) {
      return {
        ...base,
        pathType,
        items: <[TermIri | PathNegatedElt | PathAlternativeLimited]> items,
      } satisfies PathNegated;
    }
    throw new Error('Invalid path type');
  }

  public isPathChain(x: Path): x is PropertyPathChain {
    return 'pathType' in x && (x.pathType === '|' || x.pathType === '/');
  }

  public isPathModified(x: Path): x is PathModified {
    return 'pathType' in x && (x.pathType === '?' || x.pathType === '*' || x.pathType === '+' || x.pathType === '^');
  }

  public isPathNegatedElt(x: Path): x is PathNegatedElt {
    return 'pathType' in x && x.pathType === '^' && x.items.every(path => this.isTerm(path));
  }

  public isPathNegated(x: Path): x is PathNegated {
    return 'pathType' in x && x.pathType === '!';
  }

  public isPathAlternativeLimited(x: Path): x is PathAlternativeLimited {
    return 'pathType' in x && x.pathType === '|' &&
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
      termType: 'NamedNode',
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
      termType: 'BlankNode',
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
      tripleCollectionType: 'blankNodeProperties',
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
      tripleCollectionType: 'list',
      identifier,
      triples,
      loc,
    };
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
      operationType: 'load',
      silent,
      source,
      ...(destination && { destination }),
      loc,
    };
  }

  public updateOperationClearDrop(operationType: 'clear', silent: boolean, destination: GraphRef, loc: SourceLocation):
  UpdateOperationClear;
  public updateOperationClearDrop(operationType: 'drop', silent: boolean, destination: GraphRef, loc: SourceLocation):
  UpdateOperationDrop;
  public updateOperationClearDrop(
    operationType: 'clear' | 'drop',
    silent: boolean,
    destination: GraphRef,
    loc: SourceLocation
  ): UpdateOperationClear | UpdateOperationDrop;
  public updateOperationClearDrop(
    operationType: 'clear' | 'drop',
    silent: boolean,
    destination: GraphRef,
    loc: SourceLocation,
  ): UpdateOperationClear | UpdateOperationDrop {
    return {
      type: 'updateOperation',
      operationType,
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
      operationType: 'create',
      silent,
      destination,
      loc,
    };
  }

  public updateOperationAddMoveCopy(
    operationType: 'add',
    source: GraphRefDefault | GraphRefSpecific,
    destination: GraphRefDefault | GraphRefSpecific,
    silent: boolean,
    loc: SourceLocation,
  ): UpdateOperationAdd;
  public updateOperationAddMoveCopy(
    operationType: 'move',
    source: GraphRefDefault | GraphRefSpecific,
    destination: GraphRefDefault | GraphRefSpecific,
    silent: boolean,
    loc: SourceLocation,
  ): UpdateOperationMove ;
  public updateOperationAddMoveCopy(
    operationType: 'copy',
    source: GraphRefDefault | GraphRefSpecific,
    destination: GraphRefDefault | GraphRefSpecific,
    silent: boolean,
    loc: SourceLocation,
  ): UpdateOperationCopy;
  public updateOperationAddMoveCopy(
    operationType: 'add' | 'move' | 'copy',
    source: GraphRefDefault | GraphRefSpecific,
    destination: GraphRefDefault | GraphRefSpecific,
    silent: boolean,
    loc: SourceLocation,
  ): UpdateOperationAdd | UpdateOperationMove | UpdateOperationCopy;
  public updateOperationAddMoveCopy(
    operationType: 'add' | 'move' | 'copy',
    source: GraphRefDefault | GraphRefSpecific,
    destination: GraphRefDefault | GraphRefSpecific,
    silent: boolean,
    loc: SourceLocation,
  ): UpdateOperationAdd | UpdateOperationMove | UpdateOperationCopy {
    return {
      type: 'updateOperation',
      operationType,
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

  public updateOperationInsDelDataWhere(operationType: 'insertdata', data: Quads[], loc: SourceLocation):
  UpdateOperationInsertData;
  public updateOperationInsDelDataWhere(operationType: 'deletedata', data: Quads[], loc: SourceLocation):
  UpdateOperationDeleteData;
  public updateOperationInsDelDataWhere(operationType: 'deletewhere', data: Quads[], loc: SourceLocation):
  UpdateOperationDeleteWhere;
  public updateOperationInsDelDataWhere(
    operationType: 'insertdata' | 'deletedata' | 'deletewhere',
    data: Quads[],
    loc: SourceLocation,
  ): UpdateOperationInsertData | UpdateOperationDeleteData | UpdateOperationDeleteWhere;
  public updateOperationInsDelDataWhere(
    operationType: 'insertdata' | 'deletedata' | 'deletewhere',
    data: Quads[],
    loc: SourceLocation,
  ): UpdateOperationInsertData | UpdateOperationDeleteData | UpdateOperationDeleteWhere {
    return {
      type: 'updateOperation',
      operationType,
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
      operationType: 'modify',
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
      termType: 'Literal',
      value,
      langOrIri,
      loc,
    };
  }

  public solutionModifierHaving(having: Expression[], loc: SourceLocation): SolutionModifierHaving {
    return {
      type: 'solutionModifier',
      modifierType: 'having',
      having,
      loc,
    };
  }

  public solutionModifierOrder(orderDefs: Ordering[], loc: SourceLocation): SolutionModifierOrder {
    return {
      type: 'solutionModifier',
      modifierType: 'order',
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
      modifierType: 'limitOffset',
      limit,
      offset,
      loc,
    };
  }
}
