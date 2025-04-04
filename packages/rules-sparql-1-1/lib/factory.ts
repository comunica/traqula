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
  SourceLocation,
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
} from './RoundTripTypes';
import { Wildcard } from './Wildcard';

export class TraqulaFactory {
  private blankNodeCounter = 0;
  public constructor() {}

  public prefixDecl(key: string, value: TermIriFull, location?: SourceLocation): ContextDefinitionPrefixDecl {
    return {
      type: 'contextDef',
      contextType: 'prefix',
      key,
      value,
      location,
    };
  }

  public baseDecl(img1: string, value: TermIriFull, location?: SourceLocation): ContextDefinitionBaseDecl {
    return {
      type: 'contextDef',
      contextType: 'base',
      value,
      location,
    };
  }

  public isBaseDecl(x: ContextDefinition): x is ContextDefinitionBaseDecl {
    return x.contextType === 'base';
  }

  public isPrefixDecl(x: ContextDefinition): x is ContextDefinitionBaseDecl {
    return x.contextType === 'prefix';
  }

  public variable(image: string, location?: SourceLocation): TermVariable {
    return {
      type: 'term',
      termType: 'Variable',
      value: image,
      location,
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
    return x.expression.length === 1 && this.isTerm(x.expression[0]) && new Wildcard().equals(x.expression[0]);
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
    location?: SourceLocation,
  ): ExpressionOperation & { args: Args } {
    return {
      type: 'expression',
      expressionType: 'operation',
      operator: this.formatOperator(operator),
      args,
      location,
    };
  }

  public expressionPatternOperation<Args extends Pattern[]>(
    operator: string,
    args: Args,
    location?: SourceLocation,
  ): ExpressionPatternOperation & { args: Args } {
    return {
      type: 'expression',
      expressionType: 'patternOperation',
      operator: this.formatOperator(operator),
      args,
      location,
    };
  }

  public triple(
    subject: Triple['subject'],
    predicate: Triple['predicate'],
    object: Triple['object'],
    location?: SourceLocation,
  ): Triple {
    return {
      type: 'triple',
      subject,
      predicate,
      object,
      location,
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

  public patternFilter(expression: Expression, location?: SourceLocation): PatternFilter {
    return {
      type: 'pattern',
      patternType: 'filter',
      expression,
      location,
    };
  }

  public patternBind(
    expression: Expression,
    variable: TermVariable,
    location?: SourceLocation,
  ): PatternBind {
    return {
      type: 'pattern',
      patternType: 'bind',
      expression,
      variable,
      location,
    };
  }

  public patternUnion(patterns: Pattern[], location?: SourceLocation): PatternUnion {
    return {
      type: 'pattern',
      patternType: 'union',
      patterns,
      location,
    };
  }

  public patternMinus(patterns: Pattern[], location?: SourceLocation): PatternMinus {
    return {
      type: 'pattern',
      patternType: 'minus',
      patterns,
      location,
    };
  }

  public patternService(
    name: TermIri | TermVariable,
    patterns: Pattern[],
    silent: boolean,
    location?: SourceLocation,
  ): PatternService {
    return {
      type: 'pattern',
      patternType: 'service',
      silent,
      name,
      patterns,
      location,
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
    location?: SourceLocation
  ): ExpressionAggregateDefault;
  public aggregate(
    aggregation: string,
    distinct: boolean,
    arg: Wildcard,
    separator: undefined,
    location?: SourceLocation
  ): ExpressionAggregateOnWildcard;
  public aggregate(
    aggregation: string,
    distinct: boolean,
    arg: Expression,
    separator: string,
    location?: SourceLocation
  ): ExpressionAggregateSeparator;
  public aggregate(
    aggregation: string,
    distinct: boolean,
    arg: Expression | Wildcard,
    separator: string | undefined,
    location?: SourceLocation,
  ): ExpressionAggregate {
    const base = <const> {
      type: 'expression',
      expressionType: 'aggregate',
      aggregation: this.formatOperator(aggregation),
      distinct,
      location,
    };
    if (this.isExpression(arg)) {
      if (separator === undefined) {
        return { ...base, expression: [ arg ]} satisfies ExpressionAggregateDefault;
      }
      return { ...base, expression: [ arg ], separator } satisfies ExpressionAggregateSeparator;
    }
    return { ...base, expression: [ arg ]} satisfies ExpressionAggregateOnWildcard;
  }

  public path(
    pathType: '|',
    items: [TermIri | PathNegatedElt, ...(TermIri | PathNegatedElt)[]],
    location?: SourceLocation
  ): PathAlternativeLimited;
  public path(
    pathType: '!',
    items: [TermIri | PathNegatedElt | PathAlternativeLimited],
    location?: SourceLocation
  ): PathNegated;
  public path(pathType: '^', items: [TermIri], location?: SourceLocation): PathNegatedElt;
  public path(pathType: PathModified['pathType'], item: [Path], location?: SourceLocation): PathModified;
  public path(pathType: '|' | '/', items: [Path, ...Path[]], location?: SourceLocation):
  PropertyPathChain;
  public path(
    pathType: (PropertyPathChain | PathModified | PathNegated)['pathType'],
    items: [Path, ...Path[]],
    location?: SourceLocation,
  ): Path {
    const base = <const> {
      type: 'path',
      location,
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
  public namedNode(value: string, prefix: undefined, location?: SourceLocation): TermIriFull;
  /**
   * A namednode defined using a prefix
   */
  public namedNode(value: string, prefix: string, location?: SourceLocation): TermIriPrefixed;
  public namedNode(value: string, prefix?: string, location?: SourceLocation): TermIriFull | TermIriPrefixed {
    const base = <const> {
      type: 'term',
      termType: 'NamedNode',
      value,
      location,
    };
    if (prefix === undefined) {
      return base;
    }
    return { ...base, prefix };
  }

  public blankNode(label: undefined | string, location?: SourceLocation): TermBlank {
    const base = <const> {
      type: 'term',
      termType: 'BlankNode',
      location,
    };
    if (label === undefined) {
      return { ...base, label: `g_${this.blankNodeCounter++}` };
    }
    return { ...base, label: `e_${label}` };
  }

  public updateOperationLoad(
    source: TermIri,
    silent: boolean,
    destination?: GraphRefSpecific | undefined,
    location?: SourceLocation,
  ): UpdateOperationLoad {
    return {
      type: 'updateOperation',
      operationType: 'load',
      silent,
      source,
      ...(destination && { destination }),
      location,
    };
  }

  private updateOperationClearDrop<T extends 'clear' | 'drop' | 'create', Dest extends GraphRef>(
    operationType: T,
    silent: boolean,
    destination: Dest,
    location?: SourceLocation,
  ): Omit<UpdateOperationDrop, 'destination' | 'operationType'> & { operationType: T; destination: Dest } {
    return {
      type: 'updateOperation',
      operationType,
      silent,
      destination,
      location,
    };
  }

  public updateOperationClear(
    destination: GraphRef,
    silent: boolean,
    location?: SourceLocation,
  ): UpdateOperationClear {
    return this.updateOperationClearDrop('clear', silent, destination, location);
  };

  public updateOperationDrop(
    destination: GraphRef,
    silent: boolean,
    location?: SourceLocation,
  ): UpdateOperationDrop {
    return this.updateOperationClearDrop('drop', silent, destination, location);
  }

  public updateOperationCreate(
    destination: GraphRefSpecific,
    silent: boolean,
    location?: SourceLocation,
  ): UpdateOperationCreate {
    return this.updateOperationClearDrop('create', silent, destination, location);
  }

  private updateOperationAddMoveCopy<T extends 'add' | 'move' | 'copy'>(
    operationType: T,
    source: GraphRefDefault | GraphRefSpecific,
    destination: GraphRefDefault | GraphRefSpecific,
    silent: boolean,
    location?: SourceLocation,
  ): Omit<UpdateOperationAdd, 'operationType'> & { operationType: T } {
    return {
      type: 'updateOperation',
      operationType,
      silent,
      source,
      destination,
      location,
    };
  }

  public updateOperationAdd(
    source: GraphRefDefault | GraphRefSpecific,
    destination: GraphRefDefault | GraphRefSpecific,
    silent: boolean,
    location?: SourceLocation,
  ): UpdateOperationAdd {
    return this.updateOperationAddMoveCopy('add', source, destination, silent, location);
  }

  public updateOperationMove(
    source: GraphRefDefault | GraphRefSpecific,
    destination: GraphRefDefault | GraphRefSpecific,
    silent: boolean,
    location?: SourceLocation,
  ): UpdateOperationMove {
    return this.updateOperationAddMoveCopy('move', source, destination, silent, location);
  }

  public updateOperationCopy(
    source: GraphRefDefault | GraphRefSpecific,
    destination: GraphRefDefault | GraphRefSpecific,
    silent: boolean,
    location?: SourceLocation,
  ): UpdateOperationCopy {
    return this.updateOperationAddMoveCopy('copy', source, destination, silent, location);
  }

  private updateOperationInsertDeleteDelWhere<T extends 'insertdata' | 'deletedata' | 'deletewhere'>(
    operationType: T,
    data: Quads[],
    location?: SourceLocation,
  ): Omit<UpdateOperationInsertData, 'operationType'> & { operationType: T } {
    return { type: 'updateOperation', operationType, data, location };
  }

  public updateOperationInsertData(data: Quads[], location?: SourceLocation): UpdateOperationInsertData {
    return this.updateOperationInsertDeleteDelWhere('insertdata', data, location);
  }

  public updateOperationDeleteData(data: Quads[], location?: SourceLocation): UpdateOperationDeleteData {
    return this.updateOperationInsertDeleteDelWhere('deletedata', data, location);
  }

  public updateOperationDeleteWhere(data: Quads[], location?: SourceLocation): UpdateOperationDeleteWhere {
    return this.updateOperationInsertDeleteDelWhere('deletewhere', data, location);
  }

  public updateOperationModify(
    insert: Quads[],
    del: Quads[],
    where: Pattern[],
    from: DatasetClauses,
    graph?: TermIri | undefined,
    location?: SourceLocation,
  ): UpdateOperationModify {
    return {
      type: 'updateOperation',
      operationType: 'modify',
      insert,
      delete: del,
      graph,
      where,
      from,
      location,
    };
  }

  /**
   * String, no lang, no type
   */
  public literalTerm(value: string, lang?: undefined, location?: SourceLocation): TermLiteralStr;
  /**
   * String with a language tag
   */
  public literalTerm(value: string, lang: string, location?: SourceLocation,): TermLiteralLangStr;
  /**
   * Lexical form with a type
   */
  public literalTerm(value: string, iri: TermIri, location?: SourceLocation,): TermLiteralTyped;
  public literalTerm(value: string, langOrIri?: string | TermIri, location?: SourceLocation): TermLiteral {
    return {
      type: 'term',
      termType: 'Literal',
      value,
      langOrIri,
      location,
    };
  }
}
