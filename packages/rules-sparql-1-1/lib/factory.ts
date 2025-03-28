import { BlankSpaceFactory } from './BlankSpaceFactory';
import type {
  TermBlankAnon,
  TermBlankImplicit,
  TermBlankLabeled,
  TermIriFull,
  TermIri,
  TermLiteral,
  TermLiteralLangStr,
  TermLiteralPrimitive,
  TermLiteralStr,
  TermLiteralTyped,
  ContextDefinitionPrefixDecl,
  TermIriPrefixed,
  TermVariable,
  ContextDefinitionBaseDecl,
  TermIriPrimitive,
  PathNegatedElt,
  Path,
  PathModified,
  PropertyPathChain,
  PathAlternativeLimited,
  PathNegated,
  ContextDefinition,
  Term,
  ExpressionAggregateDefault,
  Expression,
  ExpressionAggregateOnWildcard,
  ExpressionAggregateSeparator,
  ExpressionAggregate,
  Pattern,
  ExpressionFunctionCall,
  ExpressionOperation,
  ExpressionPatternOperation,
  Triple,
  PatternFilter,
  PatternUnion,
  PatternGroup,
  PatternMinus,
  PatternBind,
  PatternService,
  TermBlank,
  UpdateOperationLoad,
  GraphRefSpecific,
  UpdateOperationClearDrop,
  GraphRef,
  UpdateOperationCreate,
  GraphRefDefault,
  UpdateOperationAddMoveCopy,
  UpdateOperationInsertDeleteDelWhere,
  Quads,
  UpdateOperationModify,
  BracketWrapper,
  EmptyGroup,
  Query,
} from './RoundTripTypes';
import type * as r from './TypeHelpersRTT';
import { Wildcard } from './Wildcard';

export class TraqulaFactory extends BlankSpaceFactory {
  private blankNodeCounter = 0;
  public constructor() {
    super();
  }

  public prefix(i0: r.ITOS, img1: string, i1: r.ITOS, i2: r.ITOS, key: string, value: TermIriFull):
  ContextDefinitionPrefixDecl {
    return this.rttImage(this.rttIgnore({
      type: 'contextDef',
      contextType: 'prefix',
      key,
      value,
    }, i0, i1, i2), img1);
  }

  public baseDecl(i0: r.ITOS, img1: string, value: TermIriFull): ContextDefinitionBaseDecl {
    return this.rttImage(this.rttIgnore({
      type: 'contextDef',
      contextType: 'base',
      value,
    }, i0), img1);
  }

  public isBaseDecl(x: ContextDefinition): x is ContextDefinitionBaseDecl {
    return x.contextType === 'base';
  }

  public variable(i0: r.ITOS, img1: string): TermVariable {
    return this.rttImage(this.rttIgnore({
      type: 'term',
      termType: 'Variable',
      value: img1.slice(1),
    }, i0), img1);
  }

  public isTerm(x: object): x is Term {
    return 'type' in x && x.type === 'term';
  }

  public isTermIriPrimitive(x: TermIri): x is TermIriPrimitive {
    return 'img1' in x.RTT;
  }

  public isTermIriPrefixed(x: TermIri): x is TermIriPrefixed {
    return 'prefix' in x;
  }

  public isTermBlankImplicit(x: TermBlank): x is TermBlankImplicit {
    return 'count' in x;
  }

  public isBrackettedRTT(x: { RTT: object }): x is { RTT: { preBracket: [r.ITOS, r.ITOS][] }} {
    return 'preBracket' in x.RTT;
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
    return !this.isExpressionAggregateOnWildcard(x) && !this.isExpressionAggregateSeparator(x);
  }

  public formatOperator(operator: string): string {
    return operator.toLowerCase().replaceAll(' ', '');
  }

  public expressionOperation<Args extends Expression[]>(
    arg: { args: Args } & Pick<ExpressionOperation['RTT'], 'img1' | 'ignored'>,
  ): ExpressionOperation & { args: Args } {
    return {
      type: 'expression',
      expressionType: 'operation',
      operator: this.formatOperator(arg.img1),
      args: arg.args,
      RTT: {
        ignored: arg.ignored,
        img1: arg.img1,
      },
    };
  }

  public expressionPatternOperation<Args extends Pattern[]>(
    arg: { args: Args } & Pick<ExpressionPatternOperation['RTT'], 'i0' | 'img1'>,
  ): ExpressionPatternOperation & { args: Args } {
    return {
      type: 'expression',
      expressionType: 'patternOperation',
      operator: this.formatOperator(arg.img1),
      args: arg.args,
      RTT: {
        i0: arg.i0,
        img1: arg.img1,
      },
    };
  }

  public triple(
    subject: Triple['subject'],
    predicate: Triple['predicate'],
    object: Triple['object'],
    RTT?: Triple['RTT'],
  ): Triple {
    return {
      subject,
      predicate,
      object,
      RTT: RTT ?? {
        shareSubjectDef: false,
        sharePrefixDef: false,
      },
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

  public patternFilter(i0: r.ITOS, img1: string, expression: Expression): PatternFilter {
    return this.rttImage(this.rttIgnore({
      type: 'pattern',
      patternType: 'filter',
      expression,
    }, i0), img1);
  }

  public patternBind(
    i0: r.ITOS,
    i1: r.ITOS,
    i2: r.ITOS,
    i3: r.ITOS,
    img1: string,
    img2: string,
    expression: Expression,
    variable: TermVariable,
  ): PatternBind {
    return this.rttImage(this.rttIgnore({
      type: 'pattern',
      patternType: 'bind',
      expression,
      variable,
    }, i0, i1, i2, i3), img1, img2);
  }

  public patternUnion(ignores: r.ITOS[], images: string[], patterns: Pattern[]): PatternUnion {
    return {
      type: 'pattern',
      patternType: 'union',
      patterns,
      RTT: { ignores, images },
    };
  }

  public patternMinus(i0: r.ITOS, i1: r.ITOS, i2: r.ITOS, img1: string, patterns: Pattern[]): PatternMinus {
    return {
      type: 'pattern',
      patternType: 'minus',
      patterns,
      RTT: { i0, i1, i2, img1 },
    };
  }

  public patternService(
    i0: r.ITOS,
    i1: r.ITOS,
    i2: r.ITOS,
    i3: r.ITOS,
    img1: string,
    img2: string,
    name: TermIri | TermVariable,
    patterns: Pattern[],
  ): PatternService {
    return {
      type: 'pattern',
      patternType: 'service',
      silent: img2.toLowerCase() === 'silent',
      name,
      patterns,
      RTT: { i0, i1, i2, i3, img1, img2 },
    };
  }

  public deGroupSingle(group: PatternGroup & Pattern): (dot: r.ITOS | undefined) => Pattern {
    if (group.patterns.length === 1) {
      const preEmpty = group.RTT.emptyGroups[0] ?? [];
      const postEmpty = group.RTT.emptyGroups[1] ?? [];
      const patternDot = group.RTT.dotTracker[0] ?? undefined;
      return (dot) => {
        const pattern = group.patterns[0];
        const container = {
          preEmpty,
          postEmpty,
          preBrace: group.RTT.i0,
          postBrace: group.RTT.i1,
          dot,
        };
        if ('unGroupedInfo' in pattern.RTT && pattern.RTT.unGroupedInfo !== undefined) {
          pattern.RTT.unGroupedInfo.containedIn.push(container);
        } else {
          pattern.RTT.unGroupedInfo = {
            containedIn: [ container ],
            patternDot,
          };
        }
        return pattern;
      };
    }
    return () => group;
  }

  /**
   * 1. An empty group results in an {@link EmptyGroup} describing itself
   * 2. A group with one pattern is useless - It returns
   *  a. the pattern,
   *  b. its now orphaned dot,
   *  c. Empty groups, and
   *  d. its braces.
   * 3. A group with more than one pattern is returned as is.
   */
  public deGroup(group: PatternGroup & Pattern): ((dot: r.ITOS | undefined) => EmptyGroup | Pattern) {
    if (group.patterns.length === 0) {
      return dot => ({
        patterns: group.RTT.emptyGroups[0] ?? [],
        braces: [ group.RTT.i0, group.RTT.i1 ],
        dotIgnore: dot,
      } satisfies EmptyGroup);
    }
    return this.deGroupSingle(group);
  }

  public aggregate(i0: r.ITOS, i1: r.ITOS, i2: r.ITOS | undefined, i3: r.ITOS, img1: string, img2: string | undefined,
    expression: Expression): ExpressionAggregateDefault;
  public aggregate(i0: r.ITOS, i1: r.ITOS, i2: r.ITOS | undefined, i3: r.ITOS, i4: r.ITOS, img1: string,
    img2: string | undefined, expression: Wildcard): ExpressionAggregateOnWildcard;
  public aggregate(i0: r.ITOS, i1: r.ITOS, i2: r.ITOS | undefined, i3: r.ITOS, i4: r.ITOS, i5: r.ITOS, i6: r.ITOS,
    i7: r.ITOS, img1: string, img2: string | undefined, img3: string, img4: string, expression: Expression,
    separator: string): ExpressionAggregateSeparator;
  public aggregate(
    i0: r.ITOS,
    i1: r.ITOS,
    i2: r.ITOS | undefined,
    i3: r.ITOS,
    img1ori4: string | r.ITOS,
    img2or1ori5: string | r.ITOS | undefined,
    expressionOrImg2Ori6: Expression | string | r.ITOS | undefined,
    expressionOri7?: Wildcard | r.ITOS,
    img1?: string,
    img2?: string,
    img3?: string,
    img4?: string,
    expression?: Expression,
    separator?: string,
  ): ExpressionAggregate {
    if (typeof img1ori4 === 'string' &&
      (img2or1ori5 === undefined || typeof img2or1ori5 === 'string') &&
      Array.isArray(expressionOrImg2Ori6)
    ) {
      return {
        type: 'expression',
        expressionType: 'aggregate',
        aggregation: img1ori4.toLowerCase(),
        distinct: img2or1ori5 !== undefined,
        expression: [ <Expression> <unknown> expressionOrImg2Ori6 ],
        RTT: this.ignores(this.images({}, img1ori4, img2or1ori5 ?? ''), i0, i1, i2 ?? [], i3),
      } satisfies ExpressionAggregateDefault;
    }
    if (Array.isArray(img1ori4) &&
      typeof img2or1ori5 === 'string' &&
      (expressionOrImg2Ori6 === undefined || typeof expressionOrImg2Ori6 === 'string')
    ) {
      return {
        type: 'expression',
        expressionType: 'aggregate',
        aggregation: img2or1ori5.toLowerCase(),
        distinct: expressionOrImg2Ori6 !== undefined,
        expression: [ <Wildcard> expressionOri7 ],
        RTT: this.ignores(this.images({}, img2or1ori5, expressionOrImg2Ori6 ?? ''), i0, i1, i2 ?? [], i3, img1ori4),
      } satisfies ExpressionAggregateOnWildcard;
    }
    if (Array.isArray(img1ori4) &&
      Array.isArray(img2or1ori5) &&
      Array.isArray(expressionOrImg2Ori6) &&
      expressionOri7 !== undefined &&
      img1 !== undefined &&
      img3 !== undefined &&
      img4 !== undefined &&
      expression !== undefined &&
      separator !== undefined
    ) {
      return {
        type: 'expression',
        expressionType: 'aggregate',
        aggregation: img1.toLowerCase(),
        distinct: img2 !== undefined,
        expression: [ expression ],
        separator,
        RTT: this.ignores(
          this.images({}, img1, img2 ?? '', img3, img4),
          i0,
          i1,
          i2 ?? [],
          i3,
          img1ori4,
          img2or1ori5,
          expressionOrImg2Ori6,
          <r.ITOS> expressionOri7,
        ),
      } satisfies ExpressionAggregateSeparator;
    }
    throw new Error('Invalid arguments');
  }

  /**
   * If PreBracketed exists, this function will append the current values to it.
   */
  public bracketted<T extends object & { RTT?: { preBracket?: [r.ITOS, r.ITOS][] }}>(x: T, i0: r.ITOS, i1: r.ITOS):
    T & { RTT: { preBracket: [r.ITOS, r.ITOS][] }} {
    if (x.RTT !== undefined && x.RTT.preBracket !== undefined) {
      x.RTT.preBracket.push([ i0, i1 ]);
      return <T & { RTT: { preBracket: [r.ITOS, r.ITOS][] }}> x;
    }
    return {
      ...x,
      RTT: {
        ...x.RTT,
        preBracket: [[ i0, i1 ]],
      },
    };
  }

  public curlied<T extends object & { RTT?: { preCurls?: BracketWrapper }}>(x: T, i0: r.ITOS, i1: r.ITOS):
    T & { RTT: { preCurls: [r.ITOS, r.ITOS][] }} {
    if (x.RTT !== undefined && x.RTT.preCurls !== undefined) {
      return <T & { RTT: { preCurls: [r.ITOS, r.ITOS][] }}> x;
    }
    return {
      ...x,
      RTT: {
        ...x.RTT,
        preCurls: [[ i0, i1 ]],
      },
    };
  }

  public path(pathType: '!', items: TermIri | PathNegatedElt | PathAlternativeLimited, ignored: r.ITOS):
  PathNegated;
  public path(pathType: '!', items: TermIri | PathNegatedElt | PathAlternativeLimited,
    ignored: [r.ITOS, r.ITOS, r.ITOS]): PathNegated;
  public path(pathType: '^', items: TermIri, i0: r.ITOS): PathNegatedElt;
  public path(pathType: '?' | '*' | '+' | '^', item: Path, i0: r.ITOS): PathModified;
  public path(pathType: '|', items: [TermIri | PathNegatedElt, ...(TermIri | PathNegatedElt)[]],
    ignored: [r.ITOS, ...r.ITOS[]]): PathAlternativeLimited;
  public path(pathType: '|' | '/', items: [Path, ...Path[]], ignored: [r.ITOS, ...r.ITOS[]]):
  PropertyPathChain;
  public path(
    pathType: '?' | '*' | '+' | '^' | '|' | '/' | '!',
    items: Path | Path[],
    ignored: r.ITOS | r.ITOS[],
  ): Path {
    if (pathType === '!') {
      if (Array.isArray(ignored[0])) {
        const [ i0, i1, i2 ] = <[r.ITOS, r.ITOS, r.ITOS]> ignored;
        const RTT = this.ignores({}, i0, i1, i2);
        return {
          type: 'path',
          pathType,
          items: <[TermIri | PathNegatedElt | PathAlternativeLimited]> [ items ],
          RTT,
        };
      }
      const RTT = this.ignores({}, <r.ITOS> ignored);
      return {
        type: 'path',
        pathType,
        items: <[TermIri | PathNegatedElt]> [ items ],
        RTT,
      };
    }
    if (pathType === '|' || pathType === '/') {
      return {
        type: 'path',
        pathType,
        items: <[Path, ...Path[]]> items,
        RTT: {
          preSepIgnores: <[r.ITOS, ...r.ITOS[]]> ignored,
        },
      };
    }
    return {
      type: 'path',
      pathType,
      items: <[Path]> items,
      RTT: {
        i0: <r.ITOS> ignored,
      },
    };
  }

  /**
   * A namednode with fully defined with a uri.
   */
  public namedNode(i0: r.ITOS, value: string): TermIriFull;
  /**
   * A namednode defined using a prefix
   */
  public namedNode(i0: r.ITOS, value: string, prefix: string): TermIriPrefixed;
  public namedNode(i0: r.ITOS, value: string, prefix?: string): TermIriFull | TermIriPrefixed {
    if (prefix === undefined) {
      return this.rttIgnore({
        type: 'term',
        termType: 'NamedNode',
        value,
      }, i0);
    }
    return this.rttIgnore({
      type: 'term',
      termType: 'NamedNode',
      value,
      prefix,
    }, i0);
  }

  public namedNodePrimitive(i0: r.ITOS, img1: string, value: string): TermIriPrimitive {
    return {
      ...this.namedNode(i0, value),
      RTT: {
        i0,
        img1,
      },
    };
  }

  public blankNode(i0: r.ITOS, label: string): TermBlankLabeled;
  public blankNode(i0: r.ITOS, label: undefined, image: string): TermBlankAnon;
  public blankNode(i0: r.ITOS, label: string | undefined, image?: string): TermBlankAnon | TermBlankLabeled {
    return label === undefined ?
      this.rttIgnore(this.rttImage({
        type: 'term',
        termType: 'BlankNode',
        label: undefined,
      }, image!), i0) :
      this.rttIgnore({
        type: 'term',
        termType: 'BlankNode',
        label,
      }, i0);
  }

  public blankNodeImplicit(count?: number): TermBlankImplicit {
    return {
      type: 'term',
      termType: 'BlankNode',
      count: count ?? this.blankNodeCounter++,
    };
  }

  public updateOperationLoad(arg: { source: TermIri; destination?: GraphRefSpecific } & r.Ignores2 & r.Images3):
  UpdateOperationLoad {
    const { source, destination = undefined, ...RTT } = arg;
    return {
      type: 'updateOperation',
      operationType: 'load',
      silent: arg.img2.toLowerCase() === 'silent',
      source,
      ...(destination && { destination }),
      RTT,
    };
  }

  public updateOperationClearDrop(arg: { destination: GraphRef } & r.Ignores1 & r.Images2):
  UpdateOperationClearDrop {
    const { destination, ...RTT } = arg;
    return {
      type: 'updateOperation',
      operationType: RTT.img1.toLowerCase() === 'clear' ? 'clear' : 'drop',
      silent: arg.img2.toLowerCase() === 'silent',
      destination,
      RTT,
    };
  }

  public updateOperationCreate(arg: { destination: GraphRefSpecific } & r.Ignores1 & r.Images2): UpdateOperationCreate {
    const { destination, ...RTT } = arg;
    return {
      type: 'updateOperation',
      operationType: 'create',
      silent: arg.img2.toLowerCase() === 'silent',
      destination,
      RTT,
    };
  }

  public updateOperationAddMoveCopy(arg: {
    source: GraphRefDefault | GraphRefSpecific;
    destination: GraphRefDefault | GraphRefSpecific;
  } & r.Ignores2 & r.Images3):
    UpdateOperationAddMoveCopy {
    const { source, destination, ...RTT } = arg;
    const operationType = arg.img1.toLowerCase();
    return {
      type: 'updateOperation',
      operationType: operationType === 'add' ? 'add' : (operationType === 'move' ? 'move' : 'copy'),
      silent: arg.img2.toLowerCase() === 'silent',
      source,
      destination,
      RTT,
    };
  }

  public updateOperationInsertDeleteDelWhere(arg: {
    data: Quads[];
    dataBraces: [r.ITOS, r.ITOS];
  } & r.Ignores1 & r.Images2):
    UpdateOperationInsertDeleteDelWhere {
    const { data, ...RTT } = arg;
    const op1 = arg.img1.toLowerCase();
    const op2 = arg.img2.toLowerCase();
    return {
      type: 'updateOperation',
      operationType: op1 === 'insert' ? 'insertdata' : (op2 === 'data' ? 'deletedata' : 'deletewhere'),
      data,
      RTT,
    };
  }

  public updateOperationModify(arg: Omit<UpdateOperationModify, 'type' | 'operationType' | 'RTT'> &
    Pick<UpdateOperationModify['RTT'], 'deleteBraces' | 'insertBraces' | 'patternBraces'> & r.Ignores3 & r.Images4):
    UpdateOperationModify {
    const { insert, delete: del, graph, where, from, ...RTT } = arg;
    return {
      type: 'updateOperation',
      operationType: 'modify',
      insert,
      delete: del,
      graph,
      where,
      from,
      RTT,
    };
  }

  public literalTerm(i0: r.ITOS, img: string, value: string): TermLiteralStr;
  public literalTerm(i0: r.ITOS, img: string, value: string, iri: TermIri): TermLiteralPrimitive;
  public literalTerm(i0: r.ITOS, img: string, i1: r.ITOS, value: string, lang: string): TermLiteralLangStr;
  public literalTerm(i0: r.ITOS, img: string, i1: r.ITOS, value: string, iri: TermIri): TermLiteralTyped;
  public literalTerm(
    i0: r.ITOS,
    img: string,
    i1OrValue: string | r.ITOS,
    valueOrIri?: string | TermIri,
    langOrIri?: string | TermIri,
  ): TermLiteral {
    if (typeof i1OrValue === 'string') {
      if (valueOrIri === undefined) {
        return this.rttImage(this.rttIgnore({
          type: 'term',
          termType: 'Literal',
          value: i1OrValue,
          langOrIri: valueOrIri,
        }, i0), img);
      }
      if (typeof valueOrIri === 'object') {
        return this.rttImage(this.rttIgnore({
          type: 'term',
          termType: 'Literal',
          value: i1OrValue,
          langOrIri: valueOrIri,
        }, i0), img);
      }
    } else if (typeof valueOrIri === 'string' && langOrIri !== undefined) {
      return this.rttImage(this.rttIgnore({
        type: 'term',
        termType: 'Literal',
        value: valueOrIri,
        langOrIri,
      }, i0, i1OrValue), img);
    }
    throw new Error('Invalid arguments');
  }
}
