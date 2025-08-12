import type * as RDF from '@rdfjs/types';
import {
  Factory as AstFactory,
} from '@traqula/rules-sparql-1-1';
import type {
  Expression,
  ExpressionAggregate,
  ExpressionFunctionCall,
  ExpressionOperation,
  ExpressionPatternOperation,
  Ordering,
  Path,
  Pattern,
  PatternBgp,
  PatternBind,
  PatternGraph,
  PatternGroup,
  QueryBase,
  QueryConstruct,
  QuerySelect,
  SolutionModifierGroupBind,
  SparqlQuery,
  TermBlank,
  TermIri,
  TermLiteral,
  TermVariable,
  TripleNesting,
  Wildcard,
  PatternService,
  PatternUnion,
  PatternValues,
  ValuePatternRow,
  PathPure,
  PathNegatedElt,
  PathModified,
  PropertyPathChain,
  PathAlternativeLimited,
  Update,
  UpdateOperation,
  UpdateOperationClear,
  UpdateOperationCreate,
  UpdateOperationDrop,
  UpdateOperationLoad,
  UpdateOperationModify,
  UpdateOperationAdd,
  UpdateOperationCopy,
  UpdateOperationMove,
  GraphRefAll,
  GraphRefDefault,
  GraphRefNamed,
  GraphRefSpecific,
  UpdateOperationInsertData,
  UpdateOperationDeleteData,
  UpdateOperationDeleteWhere,
  Term,
  Sparql11Nodes,
  Quads,
  DatasetClauses,
  PatternFilter,
} from '@traqula/rules-sparql-1-1';
import { isomorphic } from 'rdf-isomorphic';
import * as Algebra from '../algebra';
import Factory from '../factory';
import Util from '../util';

const types = Algebra.Types;
const eTypes = Algebra.expressionTypes;

type RdfTermToAst<T extends RDF.Term> = T extends RDF.Variable ? TermVariable :
  T extends RDF.BlankNode ? TermBlank :
    T extends RDF.Literal ? TermLiteral :
      T extends RDF.NamedNode ? TermIri : never;
type GraphToGraphRef<T extends 'DEFAULT' | 'NAMED' | 'ALL' | RDF.NamedNode> = T extends 'DEFAULT' ? GraphRefDefault :
  T extends 'NAMED' ? GraphRefNamed : T extends 'ALL' ? GraphRefAll : GraphRefSpecific;

export function toSparql(op: Algebra.Operation): SparqlQuery {
  const translator = new Translator();
  return translator.toSparqlJs(op);
}

class Translator {
  private project: boolean;
  private extend: Algebra.Extend[];
  private group: RDF.Variable[];
  private aggregates: Algebra.BoundAggregate[];
  private order: Algebra.Expression[];
  private readonly factory = new Factory();
  private readonly astFactory = new AstFactory();

  public toSparqlJs(op: Algebra.Operation): SparqlQuery {
    const F = this.astFactory;
    this.resetContext();
    op = this.removeQuads(op);
    const result = <SparqlQuery | PatternGroup> this.translateOperation(op);
    if (F.isPatternGroup(result)) {
      return <SparqlQuery> result.patterns[0];
    }
    if (Object.keys(result).length === 0) {
      return this.toUpdate([]);
    }
    if (F.isUpdateOperation(result)) {
      return this.toUpdate([ result ]);
    }
    return result;
  }

  private resetContext(): void {
    this.project = false;
    this.extend = [];
    this.group = [];
    this.aggregates = [];
    this.order = [];
  }

  private translateOperation(op: Algebra.Operation): any {
    // This allows us to differentiate between BIND and SELECT when translating EXTEND
    // GRAPH was added because the way graphs get added back here is not the same as how they get added in the future
    // ^ seems fine but might have to be changed if problems get detected in the future
    if (op.type !== types.EXTEND && op.type !== types.ORDER_BY && op.type !== types.GRAPH) {
      this.project = false;
    }

    switch (op.type) {
      case types.EXPRESSION: return this.translateExpression(op);
      case types.ASK: return this.translateProject(op, types.ASK);
      case types.BGP: return this.translateBgp(op);
      case types.CONSTRUCT: return this.translateConstruct(op);
      case types.DESCRIBE: return this.translateProject(op, types.DESCRIBE);
      case types.DISTINCT: return this.translateDistinct(op);
      case types.EXTEND: return this.translateExtend(op);
      case types.FROM: return this.translateFrom(op);
      case types.FILTER: return this.translateFilter(op);
      case types.GRAPH: return this.translateGraph(op);
      case types.GROUP: return this.translateGroup(op);
      case types.JOIN: return this.translateJoin(op);
      case types.LEFT_JOIN: return this.translateLeftJoin(op);
      case types.MINUS: return this.translateMinus(op);
      case types.NOP: return {};
      case types.ORDER_BY: return this.translateOrderBy(op);
      case types.PATH: return this.translatePath(op);
      case types.PATTERN: return this.translatePattern(op);
      case types.PROJECT: return this.translateProject(op, types.PROJECT);
      case types.REDUCED: return this.translateReduced(op);
      case types.SERVICE: return this.translateService(op);
      case types.SLICE: return this.translateSlice(op);
      case types.UNION: return this.translateUnion(op);
      case types.VALUES: return this.translateValues(op);
      // UPDATE operations
      case types.COMPOSITE_UPDATE: return this.translateCompositeUpdate(op);
      case types.DELETE_INSERT: return this.translateDeleteInsert(op);
      case types.LOAD: return this.translateLoad(op);
      case types.CLEAR: return this.translateClear(op);
      case types.CREATE: return this.translateCreate(op);
      case types.DROP: return this.translateDrop(op);
      case types.ADD: return this.translateAdd(op);
      case types.MOVE: return this.translateMove(op);
      case types.COPY: return this.translateCopy(op);
      default:
        throw new Error(`Unknown Operation type ${op.type}`);
    }
  }

  private translateExpression(expr: Algebra.Expression): Expression {
    switch (expr.expressionType) {
      case eTypes.AGGREGATE: return this.translateAggregateExpression(expr);
      case eTypes.EXISTENCE: return this.translateExistenceExpression(expr);
      case eTypes.NAMED: return this.translateNamedExpression(expr);
      case eTypes.OPERATOR: return <any> this.translateOperatorExpression(expr);
      case eTypes.TERM: return <Expression> this.translateTermExpression(expr);
      case eTypes.WILDCARD: return <any> this.translateWildcardExpression(expr);
    }

    throw new Error(`Unknown Expression Operation type ${(<Expression> expr).subType}`);
  }

  private translatePathComponent(path: Algebra.Operation): Path {
    switch (path.type) {
      case types.ALT: return this.translateAlt(path);
      case types.INV: return this.translateInv(path);
      case types.LINK: return this.translateLink(path);
      case types.NPS: return this.translateNps(path);
      case types.ONE_OR_MORE_PATH: return this.translateOneOrMorePath(path);
      case types.SEQ: return this.translateSeq(path);
      case types.ZERO_OR_MORE_PATH: return this.translateZeroOrMorePath(path);
      case types.ZERO_OR_ONE_PATH: return this.translateZeroOrOnePath(path);
      default:
        throw new Error(`Unknown Path type ${path.type}`);
    }
  }

  private translateTerm<T extends RDF.Term>(term: T): RdfTermToAst<T> {
    const F = this.astFactory;
    if (term.termType === 'NamedNode') {
      return <RdfTermToAst<T>> F.namedNode(F.gen(), term.value);
    }
    if (term.termType === 'BlankNode') {
      return <RdfTermToAst<T>> F.blankNode(term.value, F.gen());
    }
    if (term.termType === 'Variable') {
      return <RdfTermToAst<T>> F.variable(term.value, F.gen());
    }
    if (term.termType === 'Literal') {
      return <RdfTermToAst<T>> F.literalTerm(
        F.gen(),
        term.value,
        term.language ? term.language : this.translateTerm(term.datatype),
      );
    }
    throw new Error(`invalid term type: ${term.termType}`);
  }

  private translateTermExpression(expr: Algebra.TermExpression): Term {
    return this.translateTerm(expr.term);
  }

  // ------------------------- EXPRESSIONS -------------------------

  private translateAggregateExpression(expr: Algebra.AggregateExpression): ExpressionAggregate {
    return this.astFactory.aggregate(
      expr.aggregator,
      expr.distinct,
      this.translateExpression(expr.expression),
      expr.separator,
      this.astFactory.gen(),
    );
  }

  private translateExistenceExpression(expr: Algebra.ExistenceExpression): ExpressionPatternOperation {
    return this.astFactory.expressionPatternOperation(
      expr.not ? 'notexists' : 'exists',
      this.astFactory.patternGroup(Util.flatten([ this.translateOperation(expr.input) ]), this.astFactory.gen()),
      this.astFactory.gen(),
    );
  }

  private translateNamedExpression(expr: Algebra.NamedExpression): ExpressionFunctionCall {
    return this.astFactory.expressionFunctionCall(
      this.translateTerm(expr.name),
      expr.args.map(x => this.translateExpression(x)),
      false,
      this.astFactory.gen(),
    );
  }

  private translateOperatorExpression(expr: Algebra.OperatorExpression): Ordering | ExpressionOperation {
    if (expr.operator === 'desc') {
      return { expression: this.translateExpression(expr.args[0]), descending: true, loc: this.astFactory.gen() };
    }

    return this.astFactory.expressionOperation(
      expr.operator,
      expr.args.map(x => this.translateExpression(x)),
      this.astFactory.gen(),
    );
  }

  // eslint-disable-next-line unused-imports/no-unused-vars
  private translateWildcardExpression(expr: Algebra.WildcardExpression): Wildcard {
    return this.astFactory.wildcard(this.astFactory.gen());
  }

  private arrayToPattern(input: Pattern[]): PatternGroup {
    if (!Array.isArray(input)) {
      return this.astFactory.patternGroup([ input ], this.astFactory.gen());
    }
    return this.astFactory.patternGroup(input, this.astFactory.gen());
  }

  // ------------------------- OPERATIONS -------------------------
  // these get translated in the project function
  private translateBoundAggregate(op: Algebra.BoundAggregate): Algebra.BoundAggregate {
    return op;
  }

  private translateBgp(op: Algebra.Bgp): PatternBgp | null {
    const patterns = op.patterns.map(x => this.translatePattern(x));
    if (patterns.length === 0) {
      return null;
    }
    return this.astFactory.patternBgp(patterns, this.astFactory.gen());
  }

  private translateConstruct(op: Algebra.Construct): QueryConstruct {
    return this.astFactory.queryConstruct(
      this.astFactory.gen(),
      [],
      this.astFactory.patternBgp(op.template.map(x => this.translatePattern(x)), this.astFactory.gen()),
      this.astFactory.patternGroup(Util.flatten([
        this.translateOperation(op.input),
      ]), this.astFactory.gen()),
      {},
      this.astFactory.datasetClauses([], this.astFactory.gen()),
    );
  }

  private translateDistinct(op: Algebra.Distinct): PatternGroup {
    const result = this.translateOperation(op.input);
    // Project is nested in group object
    result.patterns[0].distinct = true;
    return result;
  }

  private translateExtend(op: Algebra.Extend): Pattern[] {
    if (this.project) {
      this.extend.push(op);
      return this.translateOperation(op.input);
    }
    return Util.flatten([
      this.translateOperation(op.input),
      this.astFactory.patternBind(
        this.translateExpression(op.expression),
        this.translateTerm(op.variable),
        this.astFactory.gen(),
      ),
    ]);
  }

  private translateDatasetClauses(_default: RDF.NamedNode[], named: RDF.NamedNode[]): DatasetClauses {
    const F = this.astFactory;
    return F.datasetClauses([
      ..._default.map(x => (<const>{ clauseType: 'default', value: this.translateTerm(x) })),
      ...named.map(x => (<const>{ clauseType: 'named', value: this.translateTerm(x) })),
    ], F.gen());
  }

  /**
   * Input of from is for example a project
   */
  private translateFrom(op: Algebra.From): PatternGroup {
    const F = this.astFactory;
    const result: QueryBase | PatternGroup = this.translateOperation(op.input);
    let query: QueryBase;
    if (F.isPatternGroup(result)) {
      query = <QueryBase> <unknown> result.patterns[0];
    } else {
      query = result;
    }
    query.datasets = this.translateDatasetClauses(op.default, op.named);
    return <PatternGroup> result;
  }

  private translateFilter(op: Algebra.Filter): PatternGroup {
    return this.astFactory.patternGroup(
      Util.flatten ([
        this.translateOperation(op.input),
        this.astFactory.patternFilter(this.translateExpression(op.expression), this.astFactory.gen()),
      ]),
      this.astFactory.gen(),
    );
  }

  private translateGraph(op: Algebra.Graph): PatternGraph {
    return this.astFactory.patternGraph(
      this.translateTerm(op.name),
      Util.flatten([ this.translateOperation(op.input) ]),
      this.astFactory.gen(),
    );
  }

  private translateGroup(op: Algebra.Group): PatternGroup {
    const input = this.translateOperation(op.input);
    const aggs = op.aggregates.map(x => this.translateBoundAggregate(x));
    this.aggregates.push(...aggs);
    // TODO: apply possible extends
    this.group.push(...op.variables);

    return input;
  }

  private translateJoin(op: Algebra.Join): Pattern[] {
    const arr: any[] = Util.flatten(op.input.map(x => this.translateOperation(x)));

    // Merge bgps
    // This is possible if one side was a path and the other a bgp for example
    return arr.reduce((result, val) => {
      if (val.type !== 'bgp' || result.length === 0 || result.at(-1).type !== 'bgp') {
        result.push(val);
      } else {
        result.at(-1).triples.push(...val.triples);
      }
      return result;
    }, []);
  }

  private translateLeftJoin(op: Algebra.LeftJoin): Pattern[] {
    const leftJoin = this.astFactory.patternOptional([
      this.translateOperation(op.input[1]),
    ], this.astFactory.gen());

    if (op.expression) {
      leftJoin.patterns.push(
        this.astFactory.patternFilter(this.translateExpression(op.expression), this.astFactory.gen()),
      );
    }
    leftJoin.patterns = leftJoin.patterns.filter(Boolean);

    return Util.flatten([
      this.translateOperation(op.input[0]),
      leftJoin,
    ]);
  }

  private translateMinus(op: Algebra.Minus): Pattern[] {
    const F = this.astFactory;
    let patterns = this.translateOperation(op.input[1]);
    if (patterns.type === 'group') {
      patterns = patterns.patterns;
    }
    if (!Array.isArray(patterns)) {
      patterns = [ patterns ];
    }
    return Util.flatten([
      this.translateOperation(op.input[0]),
      F.patternMinus(patterns, F.gen()),
    ]);
  }

  private translateOrderBy(op: Algebra.OrderBy): any {
    this.order.push(...op.expressions);
    return this.translateOperation(op.input);
  }

  private translatePath(op: Algebra.Path): PatternBgp {
    return this.astFactory.patternBgp([
      this.astFactory.triple(
        this.translateTerm(op.subject),
        this.translatePathComponent(op.predicate),
        this.translateTerm(op.object),
      ),
    ], this.astFactory.gen());
  }

  private translatePattern(op: Algebra.Pattern): TripleNesting {
    return this.astFactory.triple(
      this.translateTerm(op.subject),
       <any> this.translateTerm(op.predicate),
       this.translateTerm(op.object),
    );
  }

  private replaceAggregatorVariables(s: any, map: any): any {
    const F = this.astFactory;
    const st: Sparql11Nodes = Util.isSimpleTerm(s) ? this.translateTerm(s) : s;

    // Look for TermVariable, if we find, replace it by the aggregator.
    if (F.isTermVariable(st)) {
      if (map[st.value]) {
        // Returns the ExpressionAggregate
        return map[st.value];
      }
    } else if (Array.isArray(s)) {
      s = s.map(e => this.replaceAggregatorVariables(e, map));
    } else if (typeof s === 'object') {
      for (const key of Object.keys(s)) {
        s[key] = this.replaceAggregatorVariables(s[key], map);
      }
    }
    return s;
  }

  private translateProject(op: Algebra.Project | Algebra.Ask | Algebra.Describe, type: string): PatternGroup {
    const F = this.astFactory;
    const result: QueryBase = <any> {
      type: 'query',
      solutionModifiers: {},
      loc: F.gen(),
      datasets: F.datasetClauses([], F.gen()),
      context: [],
    } satisfies Partial<QueryBase>;

    // Makes typing easier in some places
    const select: QuerySelect = <any> result;
    let variables: RDF.Variable[] | undefined;

    if (type === types.PROJECT) {
      result.subType = 'select';
      variables = op.variables;
    } else if (type === types.ASK) {
      result.subType = 'ask';
    } else if (type === types.DESCRIBE) {
      result.subType = 'describe';
      variables = op.terms;
    }

    // Backup values in case of nested queries
    // everything in extend, group, etc. is irrelevant for this project call
    const extend = this.extend;
    const group = this.group;
    const aggregates = this.aggregates;
    const order = this.order;
    this.resetContext();
    this.project = true;

    let input = Util.flatten<any>([ this.translateOperation(op.input) ]);
    if (input.length === 1 && F.isPatternGroup(input[0])) {
      input = (<any> input[0]).patterns;
    }
    result.where = F.patternGroup(input, F.gen());

    // Map from variable to what agg it represents
    const aggregators: Record<string, Expression> = {};
    // These can not reference each other
    for (const agg of this.aggregates) {
      aggregators[this.translateTerm(agg.variable).value] = this.translateExpression(agg);
    }

    // Do these in reverse order since variables in one extend might apply to an expression in an other extend
    const extensions: Record<string, Expression> = {};
    for (const e of this.extend.reverse()) {
      extensions[this.translateTerm(e.variable).value] =
        this.replaceAggregatorVariables(this.translateExpression(e.expression), aggregators);
    }
    if (this.group.length > 0) {
      select.solutionModifiers.group = F.solutionModifierGroup(
        this.group.map((variable) => {
          const v = this.translateTerm(variable);
          if (extensions[v.value]) {
            const result = extensions[v.value];
            // Make sure there is only 1 'AS' statement
            delete extensions[v.value];
            return {
              variable: v,
              value: result,
              loc: F.gen(),
            } satisfies SolutionModifierGroupBind;
          }
          return v;
        }),
        F.gen(),
      );
    }

    if (this.order.length > 0) {
      select.solutionModifiers.order = F.solutionModifierOrder(
        this.order.map(x => this.translateOperation(x)).map((o: Ordering | Expression) =>
          F.isExpression(o) ?
              ({
                expression: o,
                descending: false,
                loc: F.gen(),
              } satisfies Ordering) :
            o),
        F.gen(),
      );
    }

    // This needs to happen after the group because it might depend on variables generated there
    if (variables) {
      select.variables = variables.map((term): TermVariable | PatternBind => {
        const v = this.translateTerm(term);
        if (extensions[v.value]) {
          const result: Expression = extensions[v.value];
          // Remove used extensions so only unused ones remain
          delete extensions[v.value];
          return F.patternBind(result, v, F.gen());
        }
        return v;
      });
      // If the * didn't match any variables this would be empty
      if (select.variables.length === 0) {
        select.variables = [ F.wildcard(F.gen()) ];
      }
    }

    // It is possible that at this point some extensions have not yet been resolved.
    // These would be bind operations that are not used in a GROUP BY or SELECT body.
    // We still need to add them though, as they could be relevant to the other extensions.
    const extensionEntries = Object.entries(extensions);
    if (extensionEntries.length > 0) {
      select.where = select.where ?? F.patternGroup([], F.gen());
      for (const [ key, value ] of extensionEntries) {
        select.where.patterns.push(
          F.patternBind(
            value,
            F.variable(key, F.gen()),
            F.gen(),
          ),
        );
      }
    }

    // Convert filter to 'having' if it contains an aggregator variable
    // could always convert, but is nicer to use filter when possible
    if (result.where && F.isPatternFilter(result.where.patterns.at(-1) ?? {})) {
      const filter = <PatternFilter> result.where.patterns.at(-1);
      if (this.objectContainsVariable(filter, Object.keys(aggregators))) {
        select.solutionModifiers.having = F.solutionModifierHaving(
          Util.flatten([ this.replaceAggregatorVariables(filter.expression, aggregators) ]),
          F.gen(),
        );
        result.where.patterns.splice(-1);
      }
    }

    this.extend = extend;
    this.group = group;
    this.aggregates = aggregates;
    this.order = order;

    // Subqueries need to be in a group, this will be removed again later for the root query
    return F.patternGroup([ select ], F.gen());
  }

  private objectContainsVariable(o: any, vals: string[]): boolean {
    const F = this.astFactory;
    const casted = <Sparql11Nodes> o;
    if (F.isTermVariable(casted)) {
      return vals.includes(casted.value);
    }
    if (Array.isArray(o)) {
      return o.some(e => this.objectContainsVariable(e, vals));
    }
    if (o === Object(o)) {
      return Object.keys(o).some(key => this.objectContainsVariable(o[key], vals));
    }
    return false;
  }

  private translateReduced(op: Algebra.Reduced): Pattern {
    const result = this.translateOperation(op.input);
    // Project is nested in group object
    result.patterns[0].reduced = true;
    return result;
  }

  private translateService(op: Algebra.Service): PatternService {
    let patterns: Pattern | Pattern[] = <Pattern> this.translateOperation(op.input);
    if (this.astFactory.isPatternGroup(patterns)) {
      patterns = patterns.patterns;
    }
    if (!Array.isArray(patterns)) {
      patterns = [ patterns ];
    }
    return this.astFactory.patternService(
      this.translateTerm(op.name),
      patterns,
      op.silent,
      this.astFactory.gen(),
    );
  }

  private translateSlice(op: Algebra.Slice): Pattern {
    const F = this.astFactory;
    const result = <Pattern> this.translateOperation(op.input);
    // Results can be nested in a group object
    let castedRes = <any> result;
    if (F.isPatternGroup(result)) {
      castedRes = result.patterns[0];
    }
    if (op.start !== 0) {
      const query = <QueryBase> castedRes;
      query.solutionModifiers.limitOffset = query.solutionModifiers.limitOffset ??
        F.solutionModifierLimitOffset(undefined, op.start, F.gen());
      query.solutionModifiers.limitOffset.offset = op.start;
    }
    if (op.length !== undefined) {
      const query = <QueryBase> castedRes;
      query.solutionModifiers.limitOffset = query.solutionModifiers.limitOffset ??
        F.solutionModifierLimitOffset(op.length, undefined, F.gen());
      query.solutionModifiers.limitOffset.limit = op.length;
    }
    return result;
  }

  private translateUnion(op: Algebra.Union): PatternUnion {
    return this.astFactory.patternUnion(
      op.input.map(x => this.translateOperation(x)).map(x => this.arrayToPattern(x)),
      this.astFactory.gen(),
    );
  }

  private translateValues(op: Algebra.Values): PatternValues {
    // TODO: check if handled correctly when outside of select block
    return this.astFactory.patternValues(
      op.bindings.map((binding) => {
        const result: ValuePatternRow = {};
        for (const v of op.variables) {
          const s = v.value;
          if (binding[s]) {
            result[s] = this.translateTerm(binding[s]);
          } else {
            result[s] = undefined;
          }
        }
        return result;
      }),
      this.astFactory.gen(),
    );
  }

  // PATH COMPONENTS

  private translateAlt(path: Algebra.Alt): any {
    const mapped = path.input.map(x => this.translatePathComponent(x));
    if (mapped.every(entry => this.astFactory.isPathOfType(entry, [ '!' ]))) {
      return this.astFactory.path(
        '!',
        [ this.astFactory.path(
          '|',
          <(TermIri | PathNegatedElt)[]> Util.flatten(mapped.map(entry => (<PathPure> entry).items)),
          this.astFactory.gen(),
        ) ],
        this.astFactory.gen(),
      );
    }
    return this.astFactory.path('|', mapped, this.astFactory.gen());
  }

  private translateInv(path: Algebra.Inv): Path {
    const F = this.astFactory;
    if (path.path.type === types.NPS) {
      const inv: Path[] = path.path.iris.map((iri: RDF.NamedNode) => F.path(
        '^',
        [ this.translateTerm(iri) ],
        F.gen(),
      ));

      if (inv.length <= 1) {
        return F.path(
          '!',
<[TermIri | PathNegatedElt | PathAlternativeLimited]> inv,
F.gen(),
        );
      }

      return F.path('!', [ <PathAlternativeLimited> F.path('|', inv, F.gen()) ], F.gen());
    }

    return F.path('^', [ this.translatePathComponent(path.path) ], F.gen());
  }

  private translateLink(path: Algebra.Link): TermIri {
    return this.translateTerm(path.iri);
  }

  private translateNps(path: Algebra.Nps): Path {
    const F = this.astFactory;
    if (path.iris.length === 1) {
      return F.path('!', [ this.translateTerm(path.iris[0]) ], F.gen());
    }
    return F.path('!', [ F.path('|', path.iris.map(x => this.translateTerm(x)), F.gen()) ], F.gen());
  }

  private translateOneOrMorePath(path: Algebra.OneOrMorePath): PathModified {
    const F = this.astFactory;
    return F.path('+', [ this.translatePathComponent(path.path) ], F.gen());
  }

  private translateSeq(path: Algebra.Seq): PropertyPathChain {
    const F = this.astFactory;
    return F.path(
      '/',
      path.input.map(x => this.translatePathComponent(x)),
      F.gen(),
    );
  }

  private translateZeroOrMorePath(path: Algebra.ZeroOrMorePath): PathModified {
    const F = this.astFactory;
    return F.path('*', [ this.translatePathComponent(path.path) ], F.gen());
  }

  private translateZeroOrOnePath(path: Algebra.ZeroOrOnePath): PathModified {
    const F = this.astFactory;
    return F.path('?', [ this.translatePathComponent(path.path) ], F.gen());
  }

  // UPDATE OPERATIONS

  private toUpdate(ops: UpdateOperation[]): Update {
    return {
      type: 'update',
      updates: ops.map(op => ({ context: [], operation: op })),
      loc: this.astFactory.gen(),
    } satisfies Update;
  }

  private translateCompositeUpdate(op: Algebra.CompositeUpdate): Update {
    return this.toUpdate(op.updates.map(update => <UpdateOperation> this.translateOperation(update)));
  }

  private translateDeleteInsert(op: Algebra.DeleteInsert): UpdateOperationModify {
    const F = this.astFactory;
    let where: Algebra.Operation | undefined = op.where;
    let use;
    if (where && where.type === types.FROM) {
      const from = where;
      where = from.input;
      use = this.translateDatasetClauses(from.default, from.named);
    }

    const updates = <[UpdateOperationModify & { where?: unknown; delete?: unknown; insert?: unknown }]> [{
      type: 'updateOperation',
      subType: 'modify',
      delete: this.convertUpdatePatterns(op.delete ?? []),
      insert: this.convertUpdatePatterns(op.insert ?? []),
      where: F.patternGroup([], F.gen()),
      from: use ?? F.datasetClauses([], F.gen()),
      loc: F.gen(),
    }];

    // Corresponds to empty array in SPARQL.js
    if (!where || (where.type === types.BGP && where.patterns.length === 0)) {
      updates[0].where = F.patternGroup([], F.gen());
    } else {
      const graphs: RDF.NamedNode[] = [];
      const result = <Pattern[]> this.translateOperation(this.removeQuadsRecursive(where, graphs));
      updates[0].where = this.arrayToPattern(result);
      // Graph might not be applied yet since there was no project
      // this can only happen if there was a single graph
      if (graphs.length > 0) {
        if (graphs.length !== 1) {
          throw new Error('This is unexpected and might indicate an error in graph handling for updates.');
        }
        // Ignore if default graph
        if (graphs[0]?.value !== '') {
          updates[0].where.patterns = [
            F.patternGraph(this.translateTerm(graphs[0]), updates[0].where.patterns, F.gen()),
          ];
        }
      }
    }

    // Not really necessary but can give cleaner looking queries
    if (!op.delete && !op.where) {
      const asInsert = <UpdateOperationInsertData & { delete?: unknown; where?: unknown }> <unknown> updates[0];
      asInsert.subType = 'insertdata';
      asInsert.data = updates[0].insert;
      delete asInsert.delete;
      delete asInsert.where;
    } else if (!op.insert && !op.where) {
      const asCasted =
        <(UpdateOperationDeleteData | UpdateOperationDeleteWhere) & { insert?: unknown; where?: unknown }>
          <unknown> updates[0];
      asCasted.data = updates[0].delete;
      delete asCasted.insert;
      delete asCasted.where;
      if (op.delete!.some(pattern =>
        pattern.subject.termType === 'Variable' ||
        pattern.predicate.termType === 'Variable' ||
        pattern.object.termType === 'Variable')) {
        asCasted.subType = 'deletewhere';
      } else {
        asCasted.subType = 'deletedata';
      }
    } else if (!op.insert && op.where && op.where.type === 'bgp' && isomorphic(op.delete!, op.where.patterns)) {
      const asCasted = <UpdateOperationDeleteWhere & { where?: unknown; delete?: unknown }> <unknown> updates[0];
      asCasted.data = updates[0].delete;
      delete asCasted.where;
      delete asCasted.delete;
      asCasted.subType = 'deletewhere';
    }

    return updates[0];
  }

  private translateLoad(op: Algebra.Load): UpdateOperationLoad {
    const F = this.astFactory;
    return F.updateOperationLoad(
      F.gen(),
      this.translateTerm(op.source),
      Boolean(op.silent),
      op.destination ? F.graphRefSpecific(this.translateTerm(op.destination), F.gen()) : undefined,
    );
  }

  private translateGraphRef<T extends 'DEFAULT' | 'NAMED' | 'ALL' | RDF.NamedNode>(graphRef: T): GraphToGraphRef<T> {
    const F = this.astFactory;
    if (graphRef === 'DEFAULT') {
      return <GraphToGraphRef<T>> F.graphRefDefault(F.gen());
    }
    if (graphRef === 'NAMED') {
      return <GraphToGraphRef<T>> F.graphRefNamed(F.gen());
    }
    if (graphRef === 'ALL') {
      return <GraphToGraphRef<T>> F.graphRefAll(F.gen());
    }
    return <GraphToGraphRef<T>> F.graphRefSpecific(<TermIri> this.translateTerm(graphRef), F.gen());
  }

  private translateClear(op: Algebra.Clear): UpdateOperationClear {
    const F = this.astFactory;
    return F.updateOperationClear(this.translateGraphRef(op.source), op.silent ?? false, F.gen());
  }

  private translateCreate(op: Algebra.Create): UpdateOperationCreate {
    const F = this.astFactory;
    return F.updateOperationCreate(this.translateGraphRef(op.source), op.silent ?? false, F.gen());
  }

  private translateDrop(op: Algebra.Drop): UpdateOperationDrop {
    const F = this.astFactory;
    return F.updateOperationDrop(this.translateGraphRef(op.source), op.silent ?? false, F.gen());
  }

  private translateAdd(op: Algebra.Add): UpdateOperationAdd {
    const F = this.astFactory;
    return F.updateOperationAdd(
      this.translateGraphRef(op.source),
      this.translateGraphRef(op.destination),
      op.silent ?? false,
      F.gen(),
    );
  }

  private translateMove(op: Algebra.Move): UpdateOperationMove {
    const F = this.astFactory;
    return F.updateOperationMove(
      this.translateGraphRef(op.source),
      this.translateGraphRef(op.destination),
      op.silent ?? false,
      F.gen(),
    );
  }

  private translateCopy(op: Algebra.Copy): UpdateOperationCopy {
    const F = this.astFactory;
    return F.updateOperationCopy(
      this.translateGraphRef(op.source),
      this.translateGraphRef(op.destination),
      op.silent ?? false,
      F.gen(),
    );
  }

  // Similar to removeQuads but more simplified for UPDATEs
  private convertUpdatePatterns(patterns: Algebra.Pattern[]): Quads[] {
    const F = this.astFactory;
    if (!patterns) {
      return [];
    }
    const graphs: Record<string, Algebra.Pattern[]> = {};
    for (const pattern of patterns) {
      const graph = pattern.graph.value;
      if (!graphs[graph]) {
        graphs[graph] = [];
      }
      graphs[graph].push(pattern);
    }
    return Object.keys(graphs).map((graph) => {
      const patternBgp = F.patternBgp(graphs[graph].map(x => this.translatePattern(x)), F.gen());
      if (graph === '') {
        return patternBgp;
      }
      return F.graphQuads(<TermIri | TermVariable> this.translateTerm(graphs[graph][0].graph), patternBgp, F.gen());
    });
  }

  /**
   * DEBUG NOTE: the type is a little wrong but works in the general case.
   */
  private removeQuads<T extends Algebra.Operation>(op: T): T {
    return this.removeQuadsRecursive(op, []);
  }

  // Remove quads
  private removeQuadsRecursive<T extends Algebra.Operation | Algebra.Operation[]>(
    op: T,
    graphs: (RDF.NamedNode | RDF.DefaultGraph)[],
  ): T {
    if (Array.isArray(op)) {
      return <T> op.map(sub => this.removeQuadsRecursive(sub, graphs));
    }

    if (!op.type) {
      return op;
    }

    // UPDATE operations with Patterns handle graphs a bit differently
    if (op.type === types.DELETE_INSERT) {
      return op;
    }

    if ((op.type === types.PATTERN || op.type === types.PATH) && op.graph) {
      const graph = <RDF.NamedNode | RDF.DefaultGraph> op.graph;
      // We create a list that tracks, for each pattern the original graph and remove the graph
      graphs.push(graph);
      // Remove non-default graphs
      if (graph.value !== '') {
        return op.type === types.PATTERN ?
          <T> this.factory.createPattern(op.subject, op.predicate, op.object) :
          <T> this.factory.createPath(op.subject, op.predicate, op.object);
      }
      return op;
    }

    // We build our `op` again.
    const result: any = {};
    // Unique graphs per key (keyof T)
    const keyGraphs: Record<string, (RDF.NamedNode | RDF.DefaultGraph)[]> = {};
    // Track all the unique graph names for the entire Operation
    const operationGraphNames: Record<string, RDF.NamedNode | RDF.DefaultGraph> = {};
    for (const key of Object.keys(op)) {
      const newGraphs: (RDF.NamedNode | RDF.DefaultGraph)[] = [];
      result[key] = this.removeQuadsRecursive(op[key], newGraphs);

      if (newGraphs.length > 0) {
        keyGraphs[key] = newGraphs;
        for (const graph of newGraphs) {
          operationGraphNames[graph.value] = graph;
        }
      }
    }

    const graphNameSet = Object.keys(operationGraphNames);
    if (graphNameSet.length > 0) {
      // We also need to create graph statement if we are at the edge of certain operations
      if (graphNameSet.length === 1 && ![ types.PROJECT, types.SERVICE ].includes(op.type)) {
        graphs.push(operationGraphNames[graphNameSet[0]]);
      } else if (op.type === types.BGP) {
        // This is the specific case that got changed because of using quads. - This is where the cast of T is shaky
        return <T> this.splitBgpToGraphs(op, keyGraphs.patterns);
      } else {
        // Multiple graphs (or project), need to create graph objects for them
        for (const key of Object.keys(keyGraphs)) {
          const value = result[key];
          if (Array.isArray(value)) {
            result[key] = value.map((child, idx) =>
              // If DefaultGraph, do nothing, else wrap in plainly in Graph
              keyGraphs[key][idx].termType === 'DefaultGraph' ?
                child :
                this.factory.createGraph(child, keyGraphs[key][idx]));
          } else if (keyGraphs[key][0].termType !== 'DefaultGraph') {
            result[key] = this.factory.createGraph(value, keyGraphs[key][0]);
          }
        }
      }
    }

    return result;
  }

  /**
   * Graphs should be an array of length identical to `op.patterns`,
   * containing the corresponding graph for each triple.
   *
   * returns Join if more than 1 pattern present, otherwise if only default graph present returns Bgp, otherwise Graph.
   */
  private splitBgpToGraphs(
    op: Algebra.Bgp,
    graphs: (RDF.NamedNode | RDF.DefaultGraph)[],
  ): Algebra.Join | Algebra.Graph | Algebra.Bgp {
    // Split patterns per graph
    const graphPatterns: Record<string, { patterns: Algebra.Pattern[]; graph: RDF.NamedNode }> = {};
    for (const [ index, pattern ] of op.patterns.entries()) {
      const graph = graphs[index];
      graphPatterns[graph.value] = graphPatterns[graph.value] ?? { patterns: [], graph };
      graphPatterns[graph.value].patterns.push(pattern);
    }

    // Create graph objects for every cluster
    const children: (Algebra.Graph | Algebra.Bgp)[] = [];
    for (const [ graphName, { patterns, graph }] of Object.entries(graphPatterns)) {
      const bgp = this.factory.createBgp(patterns);
      // No name means DefaultGraph, otherwise wrap in graph
      children.push(graphName === '' ? bgp : this.factory.createGraph(bgp, graph));
    }

    // Join the graph objects
    let join: Algebra.Join | Algebra.Graph | Algebra.Bgp = children[0];
    for (const child of children.slice(1)) {
      join = this.factory.createJoin([ join, child ]);
    }

    return join;
  }
}
