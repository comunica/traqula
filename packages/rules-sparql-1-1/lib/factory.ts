import type { SourceLocation, Node } from '@traqula/core';
import type { IToken } from 'chevrotain';

import type {
  Wildcard,

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
  GraphRef,
  GraphRefDefault,
  GraphRefSpecific,
  Path,
  PathAlternativeLimited,
  PathModified,
  PathNegated,
  PathNegatedElt,
  Pattern,
  PatternBind,
  PatternFilter,
  PatternGroup,
  PatternMinus,
  PatternService,
  PatternUnion,
  PropertyPathChain,
  Quads,
  Query,
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
  Triple,
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
  PatternBgp,
} from './RoundTripTypes';

export class TraqulaFactory {
  private blankNodeCounter = 0;
  public constructor() {}

  public sourceLocation(source: string): SourceLocation;
  public sourceLocation(...tokens: IToken[]): SourceLocation | undefined;
  public sourceLocation(...location: SourceLocation []): SourceLocation | undefined;
  public sourceLocation(...args: IToken[] | SourceLocation [] | [string]): SourceLocation | undefined {
    if (args.length === 0) {
      return undefined;
    }
    if (typeof args[0] === 'string') {
      const source = args[0];
      return { source, start: 0, end: source.length };
    }
    if (this.isSourceLocation(args[0])) {
      const cast = <SourceLocation[]> args;
      const start = cast.find(x => x.source === undefined)?.start;
      const end = cast.reverse().find(x => x.source === undefined)?.end;
      return start && end ? { start, end } : undefined;
    }
    const cast = <IToken[]> args;
    return {
      source: undefined,
      start: cast[0].startOffset,
      end: cast.at(-1)!.endOffset! + 1,
    };
  }

  public isSourceLocation(x: object): x is SourceLocation {
    return 'start' in x && 'end' in x && typeof x.start === 'number' && typeof x.end === 'number';
  }

  public hasSourceLocation(x: object): x is Pick<Node, 'loc'> {
    return 'loc' in x && typeof x.loc === 'object' && x.loc !== null && this.isSourceLocation(x.loc);
  }

  public noStringMaterialization(): SourceLocation {
    return { noStringManifestation: true, start: 0, end: 0 };
  }

  public prefixDecl(key: string, value: TermIriFull, loc?: SourceLocation): ContextDefinitionPrefixDecl {
    return {
      type: 'contextDef',
      contextType: 'prefix',
      key,
      value,
      loc,
    };
  }

  public baseDecl(img1: string, value: TermIriFull, loc?: SourceLocation): ContextDefinitionBaseDecl {
    return {
      type: 'contextDef',
      contextType: 'base',
      value,
      loc,
    };
  }

  public isBaseDecl(x: ContextDefinition): x is ContextDefinitionBaseDecl {
    return x.contextType === 'base';
  }

  public isPrefixDecl(x: ContextDefinition): x is ContextDefinitionBaseDecl {
    return x.contextType === 'prefix';
  }

  public variable(value: string, loc?: SourceLocation): TermVariable {
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
    loc?: SourceLocation,
  ): ExpressionOperation & { args: Args } {
    return {
      type: 'expression',
      expressionType: 'operation',
      operator: this.formatOperator(operator),
      args,
      loc,
    };
  }

  public expressionPatternOperation<Args extends Pattern[]>(
    operator: string,
    args: Args,
    loc?: SourceLocation,
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
    subject: Triple['subject'],
    predicate: Triple['predicate'],
    object: Triple['object'],
    loc?: SourceLocation,
  ): Triple {
    return {
      type: 'triple',
      subject,
      predicate,
      object,
      loc,
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

  public patternBgp(triples: Triple[], loc?: SourceLocation): PatternBgp {
    return { type: 'pattern', patternType: 'bgp', triples, loc };
  }

  public patternFilter(expression: Expression, loc?: SourceLocation): PatternFilter {
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
    loc?: SourceLocation,
  ): PatternBind {
    return {
      type: 'pattern',
      patternType: 'bind',
      expression,
      variable,
      loc,
    };
  }

  public patternUnion(patterns: Pattern[], loc?: SourceLocation): PatternUnion {
    return {
      type: 'pattern',
      patternType: 'union',
      patterns,
      loc,
    };
  }

  public patternMinus(patterns: Pattern[], loc?: SourceLocation): PatternMinus {
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
    loc?: SourceLocation,
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
    loc?: SourceLocation
  ): ExpressionAggregateDefault;
  public aggregate(
    aggregation: string,
    distinct: boolean,
    arg: Wildcard,
    separator: undefined,
    loc?: SourceLocation
  ): ExpressionAggregateOnWildcard;
  public aggregate(
    aggregation: string,
    distinct: boolean,
    arg: Expression,
    separator: string,
    loc?: SourceLocation
  ): ExpressionAggregateSeparator;
  public aggregate(
    aggregation: string,
    distinct: boolean,
    arg: Expression | Wildcard,
    separator: string | undefined,
    loc?: SourceLocation,
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

  public wildcard(loc?: SourceLocation): Wildcard {
    return { type: 'wildcard', loc };
  }

  public isWildcard(x: object): x is Wildcard {
    return 'type' in x && x.type === 'wildcard';
  }

  public path(
    pathType: '|',
    items: [TermIri | PathNegatedElt, ...(TermIri | PathNegatedElt)[]],
    loc?: SourceLocation
  ): PathAlternativeLimited;
  public path(
    pathType: '!',
    items: [TermIri | PathNegatedElt | PathAlternativeLimited],
    loc?: SourceLocation
  ): PathNegated;
  public path(pathType: '^', items: [TermIri], loc?: SourceLocation): PathNegatedElt;
  public path(pathType: PathModified['pathType'], item: [Path], loc?: SourceLocation): PathModified;
  public path(pathType: '|' | '/', items: [Path, ...Path[]], loc?: SourceLocation):
  PropertyPathChain;
  public path(
    pathType: (PropertyPathChain | PathModified | PathNegated)['pathType'],
    items: [Path, ...Path[]],
    loc?: SourceLocation,
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
  public namedNode(value: string, prefix?: undefined, loc?: SourceLocation): TermIriFull;
  /**
   * A namednode defined using a prefix
   */
  public namedNode(value: string, prefix: string, loc?: SourceLocation): TermIriPrefixed;
  public namedNode(value: string, prefix?: string, loc?: SourceLocation): TermIriFull | TermIriPrefixed {
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

  public blankNode(label: undefined | string, loc?: SourceLocation): TermBlank {
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

  public resetBlankNodeCounter(): void {
    this.blankNodeCounter = 0;
  }

  public updateOperationLoad(
    source: TermIri,
    silent: boolean,
    destination?: GraphRefSpecific | undefined,
    loc?: SourceLocation,
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

  private updateOperationClearDrop<T extends 'clear' | 'drop' | 'create', Dest extends GraphRef>(
    operationType: T,
    silent: boolean,
    destination: Dest,
    loc?: SourceLocation,
  ): Omit<UpdateOperationDrop, 'destination' | 'operationType'> & { operationType: T; destination: Dest } {
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
    loc?: SourceLocation,
  ): UpdateOperationClear {
    return this.updateOperationClearDrop('clear', silent, destination, loc);
  };

  public updateOperationDrop(
    destination: GraphRef,
    silent: boolean,
    loc?: SourceLocation,
  ): UpdateOperationDrop {
    return this.updateOperationClearDrop('drop', silent, destination, loc);
  }

  public updateOperationCreate(
    destination: GraphRefSpecific,
    silent: boolean,
    loc?: SourceLocation,
  ): UpdateOperationCreate {
    return this.updateOperationClearDrop('create', silent, destination, loc);
  }

  private updateOperationAddMoveCopy<T extends 'add' | 'move' | 'copy'>(
    operationType: T,
    source: GraphRefDefault | GraphRefSpecific,
    destination: GraphRefDefault | GraphRefSpecific,
    silent: boolean,
    loc?: SourceLocation,
  ): Omit<UpdateOperationAdd, 'operationType'> & { operationType: T } {
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
    loc?: SourceLocation,
  ): UpdateOperationAdd {
    return this.updateOperationAddMoveCopy('add', source, destination, silent, loc);
  }

  public updateOperationMove(
    source: GraphRefDefault | GraphRefSpecific,
    destination: GraphRefDefault | GraphRefSpecific,
    silent: boolean,
    loc?: SourceLocation,
  ): UpdateOperationMove {
    return this.updateOperationAddMoveCopy('move', source, destination, silent, loc);
  }

  public updateOperationCopy(
    source: GraphRefDefault | GraphRefSpecific,
    destination: GraphRefDefault | GraphRefSpecific,
    silent: boolean,
    loc?: SourceLocation,
  ): UpdateOperationCopy {
    return this.updateOperationAddMoveCopy('copy', source, destination, silent, loc);
  }

  private updateOperationInsertDeleteDelWhere<T extends 'insertdata' | 'deletedata' | 'deletewhere'>(
    operationType: T,
    data: Quads[],
    loc?: SourceLocation,
  ): Omit<UpdateOperationInsertData, 'operationType'> & { operationType: T } {
    return { type: 'updateOperation', operationType, data, loc };
  }

  public updateOperationInsertData(data: Quads[], loc?: SourceLocation): UpdateOperationInsertData {
    return this.updateOperationInsertDeleteDelWhere('insertdata', data, loc);
  }

  public updateOperationDeleteData(data: Quads[], loc?: SourceLocation): UpdateOperationDeleteData {
    return this.updateOperationInsertDeleteDelWhere('deletedata', data, loc);
  }

  public updateOperationDeleteWhere(data: Quads[], loc?: SourceLocation): UpdateOperationDeleteWhere {
    return this.updateOperationInsertDeleteDelWhere('deletewhere', data, loc);
  }

  public updateOperationModify(
    insert: Quads[],
    del: Quads[],
    where: Pattern[],
    from: DatasetClauses,
    graph?: TermIri | undefined,
    loc?: SourceLocation,
  ): UpdateOperationModify {
    return {
      type: 'updateOperation',
      operationType: 'modify',
      insert,
      delete: del,
      graph,
      where,
      from,
      loc,
    };
  }

  /**
   * String, no lang, no type
   */
  public literalTerm(value: string, lang?: undefined, loc?: SourceLocation): TermLiteralStr;
  /**
   * String with a language tag
   */
  public literalTerm(value: string, lang: string, loc?: SourceLocation): TermLiteralLangStr;
  /**
   * Lexical form with a type
   */
  public literalTerm(value: string, iri: TermIri, loc?: SourceLocation,): TermLiteralTyped;
  public literalTerm(value: string, langOrIri?: string | TermIri, loc?: SourceLocation): TermLiteral {
    return {
      type: 'term',
      termType: 'Literal',
      value,
      langOrIri,
      loc,
    };
  }
}
