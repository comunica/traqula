/**
 * Converts AST fragments produced by the deprecated `sparqljs` (https://github.com/RubenVerborgh/SPARQL.js)
 * into Traqula's own SPARQL 1.1 AST (see ../../docs/sparqlJSMigration.md for the two formats' differences).
 *
 * @example
 * ```typescript
 * import { Parser as SparqlJsParser } from 'sparqljs';
 * import { sparqlQueryFromSparqlJs } from '@traqula/rules-sparql-1-1';
 * import { Generator } from '@traqula/generator-sparql-1-1';
 *
 * // Converting a whole parsed query:
 * const sparqlJsAst = new SparqlJsParser().parse('SELECT * WHERE { ?s ?p ?o }');
 * const traqulaAst = sparqlQueryFromSparqlJs(sparqlJsAst);
 * new Generator().generate(traqulaAst); // 'SELECT * WHERE {\n  ?s ?p ?o .\n}'
 *
 * // Converting a single stored AST fragment (e.g. a form-builder's `path` property), using the more
 * // specific export for that fragment's own node type instead of the top-level SparqlQuery one:
 * import { patternFromSparqlJs } from '@traqula/rules-sparql-1-1';
 * const storedFragment = { type: 'bgp', triples: [{ subject: { value: 's' }, predicate: { value: 'http://example.com/p' }, object: { value: 'o' } }] };
 * const traqulaPattern = patternFromSparqlJs(storedFragment); // works even without termType, see below
 * ```
 *
 * This is a lossy, one-directional (sparqljs -> Traqula) conversion:
 *  - sparqljs resolves prefixed names to full IRIs at parse time, so every converted `TermIri` is a
 *    {@link TermIriFull}: the original prefix notation cannot be recovered, and regenerated queries will
 *    always print full `<...>` IRIs unless the caller rewrites the resulting AST to use `contextDefinitionPrefix`.
 *  - sparqljs merges/deduplicates PREFIX and BASE declarations into one flat map for the whole query
 *    (and, for updates, the whole set of operations). Traqula keeps a `context` list per query / per
 *    update-operation. The original per-declaration order and per-operation scoping is therefore not
 *    recoverable; the same flattened context is attached to the query, or to every operation of an update.
 *  - sparqljs already desugars `( ... )` collections and `[ ... ]` blank node property lists into a flat
 *    list of triples with synthesized blank nodes. Traqula can represent that nested syntax explicitly via
 *    `TripleCollection`, but since the information needed to reconstruct it no longer exists in sparqljs'
 *    AST, this converter always produces flat `TripleNesting` triples. The generated query stays correct,
 *    it just prints blank-node triples individually instead of using `[]`/`()` shorthand.
 *  - sparqljs itself already prefixes every blank node's `.value` with `e_` (explicit `_:label`) or `g_`
 *    (anonymous `[]`/`()`) - the same convention Traqula's own {@link AstFactory.termBlank} uses internally.
 *    That prefix is stripped and always re-added as `e_` (see `termFromSparqlJs`), so a regenerated query
 *    always prints `_:<label>` rather than leaking sparqljs' own naming into the output. This means a
 *    user-written label that happens to collide with a stripped anonymous counter value (e.g. `_:0` next to
 *    the query's first anonymous node) could theoretically be merged into the same node; this is exceedingly
 *    unlikely in practice and not guarded against.
 *  - RDF-star / SPARQL-star quoted triples (rdfjs `Quad` terms, sparqljs' `sparqlStar` option) are not part
 *    of the SPARQL 1.1 grammar Traqula's `rules-sparql-1-1` package implements, and are not supported here.
 *
 * Terms do not strictly need a `termType`: unlike sparqljs' own generator, which requires one and has no
 * fallback (see {@link inferSparqlJsTermType} for why and what happens instead), this converter infers it
 * from shape when it's missing. This is a best-effort fallback, not a substitute for a real termType when
 * you have one, and it cannot tell an arbitrarily-labelled blank node apart from a variable.
 */
import type { AstFactory as AstFactoryType } from '../astFactory.js';
import { AstFactory } from '../astFactory.js';
import type {
  ContextDefinition,
  DatasetClauses,
  Expression,
  Path,
  PathAlternativeLimited,
  PathNegatedElt,
  Pattern,
  PatternGroup,
  PatternValues,
  Query,
  QueryAsk,
  QueryConstruct,
  QueryDescribe,
  QuerySelect,
  SolutionModifierGroupBind,
  SolutionModifiers,
  SparqlQuery,
  Term,
  TermIri,
  TermLiteral,
  TermVariable,
  TripleNesting,
  Update,
  UpdateOperation,
  ValuePatternRow,
  Wildcard,
} from '../Sparql11types.js';
import { CommonIRIs } from '../utils.js';
import type * as SparqlJs from './sparqljsTypes.js';

const F: AstFactoryType = new AstFactory();

/**
 * Sparqljs itself has no fallback for a missing `termType` - its own generator identifies a term with
 * nothing more than `typeof object.termType === 'string'` and otherwise assumes a property-path node
 * (checking `.items`/`.pathType`), so this heuristic isn't mirroring an existing sparqljs mechanism, it's
 * new behavior. It exists because some rdfjs Term implementations expose `termType` through a
 * non-enumerable/prototype getter rather than an own data property: a *live* instance still passes
 * sparqljs' check fine (plain property access resolves a getter), but the value does not survive a plain
 * object hand-off (JSON round-tripping, `{ ...term }`, `structuredClone`, a hand-built AST fragment, ...)
 * even though every other property does. When `termType` is missing, this infers it from shape instead: a
 * `datatype`/`language`/`direction` key means a Literal, a `subject`/`predicate`/`object` triple of keys
 * means a quoted triple (`Quad`), a `value` starting with `e_`/`g_` means a BlankNode (sparqljs' own
 * internal naming convention, see the file header), a `value` that looks like an absolute IRI means a
 * NamedNode, and anything else is treated as a Variable. Blank nodes with an arbitrary label cannot be
 * told apart from Variables this way - this is a best-effort fallback for otherwise-unlabelled data, not a
 * substitute for a real termType when you have one.
 */
function inferSparqlJsTermType(term: object): string {
  const t = <{ termType?: unknown; value?: unknown; datatype?: unknown; language?: unknown; direction?: unknown }>
    term;
  if (typeof t.termType === 'string') {
    return t.termType;
  }
  if ('subject' in term && 'predicate' in term && 'object' in term) {
    return 'Quad';
  }
  if ('datatype' in t || 'language' in t || 'direction' in t) {
    return 'Literal';
  }
  if (typeof t.value === 'string') {
    if (/^[eg]_/u.test(t.value)) {
      return 'BlankNode';
    }
    if (/^[a-z][a-z\d+.-]*:/iu.test(t.value)) {
      return 'NamedNode';
    }
  }
  return 'Variable';
}

function isSparqlJsWildcard(value: object): value is SparqlJs.Wildcard {
  const v = <{ termType?: unknown; value?: unknown; expression?: unknown }> value;
  if (typeof v.termType === 'string') {
    return v.termType === 'Wildcard';
  }
  return !('expression' in v) && v.value === '*';
}

/**
 * A term-like leaf (as opposed to a Path/Pattern/Expression/Query/Update structural node, or a
 * VariableExpression-like `{ expression, variable }` wrapper). See {@link inferSparqlJsTermType} for why
 * this cannot simply check for a `termType` key.
 *
 * A bare Wildcard without a `termType` (`{ value: '*' }`) is not special-cased here: every position this
 * is called from can only ever hold a Wildcard when {@link isWildcardVariables} has already matched a
 * single-element `[Wildcard]` array beforehand (SPARQL's grammar never allows `*` to appear anywhere
 * else), so this is never actually reached with one.
 */
function isSparqlJsTerm(value: object): value is SparqlJs.Term {
  if ('termType' in value) {
    return (<{ termType: unknown }> value).termType !== 'Wildcard';
  }
  const v = <{ value?: unknown; expression?: unknown }> value;
  if ('expression' in v) {
    return false;
  }
  return 'value' in v || ('subject' in value && 'predicate' in value && 'object' in value);
}

function stripLeadingQuestionMark(name: string): string {
  return name.startsWith('?') ? name.slice(1) : name;
}

/**
 * Converts a single sparqljs (rdfjs-shaped) term into a Traqula {@link Term}.
 * Suitable for use on values coming from an rdfjs-compatible datastore, not only from sparqljs itself.
 * Tolerates a missing `termType` (see {@link inferSparqlJsTermType}).
 */
export function termFromSparqlJs(term: SparqlJs.Term): Term {
  const termType = inferSparqlJsTermType(term);
  switch (termType) {
    case 'NamedNode':
      return F.termNamed(F.gen(), (<SparqlJs.IriTerm> term).value);
    case 'Variable':
      return F.termVariable((<SparqlJs.VariableTerm> term).value, F.gen());
    case 'BlankNode': {
      // Strip sparqljs' own 'e_'/'g_' prefix before handing the label to termBlank, which re-applies its
      // own 'e_' prefix - otherwise explicit labels would double up (`_:b0` becoming `e_e_b0`).
      const label = (<SparqlJs.BlankTerm> term).value.replace(/^[eg]_/u, '');
      return F.termBlank(label, F.gen());
    }
    case 'Literal': {
      const literal = <SparqlJs.LiteralTerm> term;
      if (literal.language) {
        return F.termLiteral(F.gen(), literal.value, literal.language);
      }
      if (literal.datatype && literal.datatype.value !== CommonIRIs.STRING) {
        return F.termLiteral(F.gen(), literal.value, F.termNamed(F.gen(), literal.datatype.value));
      }
      return F.termLiteral(F.gen(), literal.value);
    }
    default:
      throw new Error(
        `Cannot convert sparqljs term of termType '${termType}' to a Traqula term ` +
        `(RDF-star / SPARQL-star quoted triples are not supported by rules-sparql-1-1)`,
      );
  }
}

/**
 * Converts a sparqljs property path (or plain predicate IRI) into a Traqula {@link Path}.
 */
export function pathFromSparqlJs(item: SparqlJs.IriTerm | SparqlJs.PropertyPath): Path {
  if (isSparqlJsTerm(item)) {
    return <TermIri> termFromSparqlJs(item);
  }
  if (item.pathType === '!') {
    // Sparqljs always wraps a negated property set's content as the single element of `items`, whether
    // it is a plain IRI (`!ex:p`), an inverse (`!^ex:p`) or an alternative list (`!(ex:p1|^ex:p2)`, itself
    // represented as a nested `{ pathType: '|', ... }` node) - never as a flattened array of alternatives.
    const [ child ] = item.items;
    const converted = <TermIri | PathNegatedElt | PathAlternativeLimited> pathFromSparqlJs(child);
    return F.path('!', [ converted ], F.gen());
  }
  if (item.pathType === '?' || item.pathType === '*' || item.pathType === '+' || item.pathType === '^') {
    const [ child ] = item.items;
    return F.path(item.pathType, [ pathFromSparqlJs(child) ], F.gen());
  }
  // '|' or '/'
  return F.path(item.pathType, item.items.map(pathFromSparqlJs), F.gen());
}

function graphNodeFromSparqlJs(term: SparqlJs.Term): Term {
  return termFromSparqlJs(term);
}

/**
 * Converts a single sparqljs {@link SparqlJs.Triple} into a Traqula {@link TripleNesting}.
 * sparqljs already flattens `( ... )` collections and `[ ... ]` property lists into plain triples with
 * synthesized blank nodes, so no `TripleCollection` reconstruction is attempted, see the file header.
 */
export function tripleFromSparqlJs(triple: SparqlJs.Triple): TripleNesting {
  const predicate = isSparqlJsTerm(triple.predicate) ?
    <TermIri | TermVariable> termFromSparqlJs(triple.predicate) :
    pathFromSparqlJs(triple.predicate);
  return F.triple(
    graphNodeFromSparqlJs(<SparqlJs.Term> triple.subject),
    predicate,
    graphNodeFromSparqlJs(triple.object),
    F.gen(),
  );
}

type BgpOrGraphQuads = ReturnType<typeof F.patternBgp> | ReturnType<typeof F.graphQuads>;

function quadsFromSparqlJs(quads: SparqlJs.Quads[]): BgpOrGraphQuads[] {
  return quads.map((quad) => {
    if (quad.type === 'bgp') {
      return F.patternBgp(quad.triples.map(tripleFromSparqlJs), F.gen());
    }
    return F.graphQuads(
      <TermIri | TermVariable> termFromSparqlJs(quad.name),
      F.patternBgp(quad.triples.map(tripleFromSparqlJs), F.gen()),
      F.gen(),
    );
  });
}

function valuesPatternFromSparqlJs(rows: SparqlJs.ValuePatternRow[]): PatternValues {
  const variableNames = rows.length > 0 ? Object.keys(rows[0]) : [];
  const variables = variableNames.map(name => F.termVariable(stripLeadingQuestionMark(name), F.gen()));
  const values: ValuePatternRow[] = rows.map((row) => {
    const convertedRow: ValuePatternRow = {};
    for (const key of Object.keys(row)) {
      const value = row[key];
      if (value === undefined) {
        convertedRow[stripLeadingQuestionMark(key)] = undefined;
        continue;
      }
      if (inferSparqlJsTermType(value) === 'BlankNode') {
        throw new Error('Blank nodes are not allowed as VALUES bindings in the SPARQL 1.1 grammar');
      }
      convertedRow[stripLeadingQuestionMark(key)] = <TermIri | TermLiteral> termFromSparqlJs(value);
    }
    return convertedRow;
  });
  return F.patternValues(variables, values, F.gen());
}

/**
 * Converts a sparqljs {@link SparqlJs.Expression} into a Traqula {@link Expression}.
 */
export function expressionFromSparqlJs(expression: SparqlJs.Expression): Expression {
  if (Array.isArray(expression)) {
    throw new TypeError(
      'A bare Tuple can only occur as the right-hand side of IN / NOT IN, not as a standalone expression',
    );
  }
  if (isSparqlJsTerm(expression)) {
    return <TermIri | TermVariable | TermLiteral> termFromSparqlJs(expression);
  }
  switch (expression.type) {
    case 'aggregate': {
      const distinct = Boolean(expression.distinct);
      if (isSparqlJsWildcard(expression.expression)) {
        return F.aggregate(expression.aggregation, distinct, F.wildcard(F.gen()), undefined, F.gen());
      }
      const arg = expressionFromSparqlJs(expression.expression);
      if (typeof expression.separator === 'string') {
        return F.aggregate(expression.aggregation, distinct, arg, expression.separator, F.gen());
      }
      return F.aggregate(expression.aggregation, distinct, arg, undefined, F.gen());
    }
    case 'functionCall':
      return F.expressionFunctionCall(
        <TermIri> termFromSparqlJs(expression.function),
        expression.args.map(expressionFromSparqlJs),
        Boolean(expression.distinct),
        F.gen(),
      );
    case 'operation': {
      const operator = expression.operator.toLowerCase();
      if (operator === 'exists' || operator === 'notexists') {
        // Sparqljs' `degroupSingle` unwraps a `{ ... }` block down to its single inner pattern when it
        // contains exactly one, so `args[0]` is not necessarily of type 'group' (e.g. `NOT EXISTS { ?s ?p ?o }`).
        const [ patternArg ] = <[SparqlJs.Pattern]> expression.args;
        return F.expressionPatternOperation(operator, ensurePatternGroup(patternFromSparqlJs(patternArg)), F.gen());
      }
      if (operator === 'in' || operator === 'notin') {
        const [ left, list ] = <[SparqlJs.Expression, SparqlJs.Expression[]]> expression.args;
        const args = [ expressionFromSparqlJs(left), ...list.map(expressionFromSparqlJs) ];
        return F.expressionOperation(operator, args, F.gen());
      }
      const args = (<SparqlJs.Expression[]> expression.args).map(expressionFromSparqlJs);
      return F.expressionOperation(operator, args, F.gen());
    }
    default:
      throw new Error(`Cannot convert sparqljs expression of type '${(<{ type: string }> expression).type}'`);
  }
}

/**
 * Sparqljs' `degroupSingle` helper unwraps a `{ ... }` block down to its single inner pattern whenever it
 * contains exactly one (used for UNION branches and EXISTS/NOT EXISTS), so those are not necessarily of
 * type 'group' any more. This re-wraps a converted pattern into a {@link PatternGroup} when needed.
 */
function ensurePatternGroup(pattern: Pattern): PatternGroup {
  return F.isPatternGroup(pattern) ? pattern : F.patternGroup([ pattern ], F.gen());
}

/**
 * Converts a single sparqljs {@link SparqlJs.Pattern} (a where-clause element, including nested subqueries)
 * into a Traqula {@link Pattern}.
 */
export function patternFromSparqlJs(pattern: SparqlJs.Pattern): Pattern {
  switch (pattern.type) {
    case 'bgp':
      return F.patternBgp(pattern.triples.map(tripleFromSparqlJs), F.gen());
    case 'group':
      return F.patternGroup(pattern.patterns.map(patternFromSparqlJs), F.gen());
    case 'optional':
      return F.patternOptional(pattern.patterns.map(patternFromSparqlJs), F.gen());
    case 'union':
      return F.patternUnion(pattern.patterns.map(branch => ensurePatternGroup(patternFromSparqlJs(branch))), F.gen());
    case 'minus':
      return F.patternMinus(pattern.patterns.map(patternFromSparqlJs), F.gen());
    case 'graph':
      return F.patternGraph(
        <TermIri | TermVariable> termFromSparqlJs(pattern.name),
        pattern.patterns.map(patternFromSparqlJs),
        F.gen(),
      );
    case 'service':
      return F.patternService(
        <TermIri | TermVariable> termFromSparqlJs(pattern.name),
        pattern.patterns.map(patternFromSparqlJs),
        pattern.silent,
        F.gen(),
      );
    case 'filter':
      return F.patternFilter(expressionFromSparqlJs(pattern.expression), F.gen());
    case 'bind':
      return F.patternBind(
        expressionFromSparqlJs(pattern.expression),
        <TermVariable> termFromSparqlJs(pattern.variable),
        F.gen(),
      );
    case 'values':
      return valuesPatternFromSparqlJs(pattern.values);
    case 'query':
      return selectQueryFromSparqlJs(pattern);
    default:
      throw new Error(`Cannot convert sparqljs pattern of type '${(<{ type: string }> pattern).type}'`);
  }
}

/**
 * `prefixes` and `base` are only populated on a top-level query/update by sparqljs' `Prologue` rule:
 * a nested subquery Pattern shares its enclosing query's lexical scope and carries neither, so both
 * parameters are treated as optional here even though the sparqljs types mark `prefixes` as required.
 */
function contextFromSparqlJs(prefixes: Record<string, string> | undefined, base: string | undefined):
ContextDefinition[] {
  const context: ContextDefinition[] = [];
  if (base !== undefined) {
    context.push(F.contextDefinitionBase(F.gen(), F.termNamed(F.gen(), base)));
  }
  for (const [ key, value ] of Object.entries(prefixes ?? {})) {
    context.push(F.contextDefinitionPrefix(F.gen(), key, F.termNamed(F.gen(), value)));
  }
  return context;
}

function datasetClausesFromSparqlJs(
  from: { default: SparqlJs.IriTerm[]; named: SparqlJs.IriTerm[] } | undefined,
): DatasetClauses {
  const clauses: DatasetClauses['clauses'] = [];
  if (from) {
    for (const iri of from.default) {
      clauses.push({ clauseType: 'default', value: <TermIri> termFromSparqlJs(iri) });
    }
    for (const iri of from.named) {
      clauses.push({ clauseType: 'named', value: <TermIri> termFromSparqlJs(iri) });
    }
  }
  return F.datasetClauses(clauses, F.gen());
}

type SolutionModifierFields = Pick<SparqlJs.BaseQuery, 'group' | 'having' | 'order' | 'limit' | 'offset'>;

function solutionModifiersFromSparqlJs(query: SolutionModifierFields): SolutionModifiers {
  const modifiers: SolutionModifiers = {};
  if (query.group && query.group.length > 0) {
    modifiers.group = F.solutionModifierGroup(query.group.map((grouping): Expression | SolutionModifierGroupBind => {
      const value = expressionFromSparqlJs(grouping.expression);
      if (grouping.variable) {
        return { variable: <TermVariable> termFromSparqlJs(grouping.variable), value, loc: F.gen() };
      }
      return value;
    }), F.gen());
  }
  if (query.having && query.having.length > 0) {
    modifiers.having = F.solutionModifierHaving(query.having.map(expressionFromSparqlJs), F.gen());
  }
  if (query.order && query.order.length > 0) {
    modifiers.order = F.solutionModifierOrder(query.order.map(ordering => ({
      descending: Boolean(ordering.descending),
      expression: expressionFromSparqlJs(ordering.expression),
      loc: F.gen(),
    })), F.gen());
  }
  if (query.limit !== undefined || query.offset !== undefined) {
    modifiers.limitOffset = F.solutionModifierLimitOffset(query.limit, query.offset, F.gen());
  }
  return modifiers;
}

function isWildcardVariables<T>(variables: (T | SparqlJs.Wildcard)[]): variables is [SparqlJs.Wildcard] {
  return variables.length === 1 && isSparqlJsWildcard(<object> variables[0]);
}

export function selectQueryFromSparqlJs(query: SparqlJs.SelectQuery): QuerySelect {
  const variables = isWildcardVariables(query.variables) ?
    <[Wildcard]> [ F.wildcard(F.gen()) ] :
    query.variables.map((variable) => {
      if (isSparqlJsTerm(variable)) {
        return <TermVariable> termFromSparqlJs(variable);
      }
      return F.patternBind(
        expressionFromSparqlJs(variable.expression),
        <TermVariable> termFromSparqlJs(variable.variable),
        F.gen(),
      );
    });
  return F.querySelect({
    context: contextFromSparqlJs(query.prefixes, query.base),
    datasets: datasetClausesFromSparqlJs(query.from),
    where: F.patternGroup((query.where ?? []).map(patternFromSparqlJs), F.gen()),
    variables,
    ...(query.distinct ? { distinct: <const> true } : {}),
    ...(query.reduced ? { reduced: <const> true } : {}),
    solutionModifiers: solutionModifiersFromSparqlJs(query),
    ...(query.values ? { values: valuesPatternFromSparqlJs(query.values) } : {}),
  }, F.gen());
}

export function constructQueryFromSparqlJs(query: SparqlJs.ConstructQuery): QueryConstruct {
  const where = F.patternGroup((query.where ?? []).map(patternFromSparqlJs), F.gen());
  // Sparqljs always populates `template` (also for the `CONSTRUCT WHERE { ... }` shorthand, where it
  // duplicates the where-clause triples), but the fallback keeps this robust for hand-built input too.
  const templateTriples = query.template ?? extractTopLevelBgpTriples(query.where ?? []);
  return F.queryConstruct(
    F.gen(),
    contextFromSparqlJs(query.prefixes, query.base),
    F.patternBgp(templateTriples.map(tripleFromSparqlJs), F.gen()),
    where,
    solutionModifiersFromSparqlJs(query),
    datasetClausesFromSparqlJs(query.from),
    query.values ? valuesPatternFromSparqlJs(query.values) : undefined,
  );
}

function extractTopLevelBgpTriples(patterns: SparqlJs.Pattern[]): SparqlJs.Triple[] {
  return patterns.filter((pattern): pattern is SparqlJs.BgpPattern => pattern.type === 'bgp')
    .flatMap(pattern => pattern.triples);
}

export function askQueryFromSparqlJs(query: SparqlJs.AskQuery): QueryAsk {
  return {
    type: 'query',
    subType: 'ask',
    context: contextFromSparqlJs(query.prefixes, query.base),
    datasets: datasetClausesFromSparqlJs(query.from),
    where: F.patternGroup((query.where ?? []).map(patternFromSparqlJs), F.gen()),
    solutionModifiers: solutionModifiersFromSparqlJs(query),
    values: query.values ? valuesPatternFromSparqlJs(query.values) : undefined,
    loc: F.gen(),
  };
}

export function describeQueryFromSparqlJs(query: SparqlJs.DescribeQuery): QueryDescribe {
  const variables = isWildcardVariables(query.variables) ?
    <[Wildcard]> [ F.wildcard(F.gen()) ] :
    query.variables.map(variable => <TermVariable | TermIri> termFromSparqlJs(variable));
  return {
    type: 'query',
    subType: 'describe',
    context: contextFromSparqlJs(query.prefixes, query.base),
    datasets: datasetClausesFromSparqlJs(query.from),
    where: query.where ? F.patternGroup(query.where.map(patternFromSparqlJs), F.gen()) : undefined,
    variables,
    solutionModifiers: solutionModifiersFromSparqlJs(query),
    values: query.values ? valuesPatternFromSparqlJs(query.values) : undefined,
    loc: F.gen(),
  };
}

export function queryFromSparqlJs(query: SparqlJs.Query): Query {
  switch (query.queryType) {
    case 'SELECT':
      return selectQueryFromSparqlJs(query);
    case 'CONSTRUCT':
      return constructQueryFromSparqlJs(query);
    case 'ASK':
      return askQueryFromSparqlJs(query);
    case 'DESCRIBE':
      return describeQueryFromSparqlJs(query);
    default:
      throw new Error(`Cannot convert sparqljs query of queryType '${(<{ queryType: string }> query).queryType}'`);
  }
}

type GraphRefDefaultOrSpecific = ReturnType<typeof F.graphRefDefault> | ReturnType<typeof F.graphRefSpecific>;

function graphOrDefaultToGraphRef(graph: SparqlJs.GraphOrDefault): GraphRefDefaultOrSpecific {
  if (graph.default === true || !graph.name) {
    return F.graphRefDefault(F.gen());
  }
  return F.graphRefSpecific(<TermIri> termFromSparqlJs(graph.name), F.gen());
}

function graphReferenceToGraphRef(graph: SparqlJs.GraphReference): ReturnType<typeof F.graphRefDefault> |
ReturnType<typeof F.graphRefNamed> | ReturnType<typeof F.graphRefAll> | ReturnType<typeof F.graphRefSpecific> {
  if (graph.default) {
    return F.graphRefDefault(F.gen());
  }
  if (graph.named) {
    return F.graphRefNamed(F.gen());
  }
  if (graph.all) {
    return F.graphRefAll(F.gen());
  }
  return F.graphRefSpecific(<TermIri> termFromSparqlJs(<SparqlJs.IriTerm> graph.name), F.gen());
}

export function updateOperationFromSparqlJs(operation: SparqlJs.UpdateOperation): UpdateOperation {
  if ('updateType' in operation) {
    switch (operation.updateType) {
      case 'insert':
        return F.updateOperationInsertData(quadsFromSparqlJs(operation.insert), F.gen());
      case 'delete':
        return F.updateOperationDeleteData(quadsFromSparqlJs(operation.delete), F.gen());
      case 'deletewhere':
        return F.updateOperationDeleteWhere(quadsFromSparqlJs(operation.delete), F.gen());
      case 'insertdelete':
        return F.updateOperationModify(
          F.gen(),
          quadsFromSparqlJs(operation.insert),
          quadsFromSparqlJs(operation.delete),
          F.patternGroup(operation.where.map(patternFromSparqlJs), F.gen()),
          datasetClausesFromSparqlJs(operation.using),
          operation.graph ? <TermIri> termFromSparqlJs(operation.graph) : undefined,
        );
      default:
        throw new Error(`Cannot convert sparqljs update of updateType '${(<{ updateType: string }> operation).updateType}'`);
    }
  }
  switch (operation.type) {
    case 'load': {
      const destination = operation.destination ?
        F.graphRefSpecific(<TermIri> termFromSparqlJs(operation.destination), F.gen()) :
        undefined;
      const source = <TermIri> termFromSparqlJs(operation.source);
      return F.updateOperationLoad(F.gen(), source, operation.silent, destination);
    }
    case 'create':
      return F.updateOperationCreate(
        <ReturnType<typeof F.graphRefSpecific>> graphOrDefaultToGraphRef(operation.graph),
        operation.silent,
        F.gen(),
      );
    case 'clear':
      return F.updateOperationClear(graphReferenceToGraphRef(operation.graph), operation.silent, F.gen());
    case 'drop':
      return F.updateOperationDrop(graphReferenceToGraphRef(operation.graph), operation.silent, F.gen());
    case 'add':
      return F.updateOperationAdd(
        graphOrDefaultToGraphRef(operation.source),
        graphOrDefaultToGraphRef(operation.destination),
        operation.silent,
        F.gen(),
      );
    case 'move':
      return F.updateOperationMove(
        graphOrDefaultToGraphRef(operation.source),
        graphOrDefaultToGraphRef(operation.destination),
        operation.silent,
        F.gen(),
      );
    case 'copy':
      return F.updateOperationCopy(
        graphOrDefaultToGraphRef(operation.source),
        graphOrDefaultToGraphRef(operation.destination),
        operation.silent,
        F.gen(),
      );
    default:
      throw new Error(`Cannot convert sparqljs update of type '${(<{ type: string }> operation).type}'`);
  }
}

export function updateFromSparqlJs(update: SparqlJs.Update): Update {
  // Sparqljs merges every PREFIX/BASE declaration in the whole update into one flat map, so - unlike a
  // native Traqula parse - the same (flattened) context ends up attached to every operation.
  const context = contextFromSparqlJs(update.prefixes, update.base);
  return {
    type: 'update',
    updates: update.updates.map(operation => ({
      operation: updateOperationFromSparqlJs(operation),
      context,
    })),
    loc: F.gen(),
  };
}

/**
 * Converts a full sparqljs parse result (`new (require('sparqljs').Parser)().parse(queryString)`) into a
 * Traqula {@link SparqlQuery} AST.
 */
export function sparqlQueryFromSparqlJs(query: SparqlJs.SparqlQuery): SparqlQuery {
  return query.type === 'update' ? updateFromSparqlJs(query) : queryFromSparqlJs(query);
}

function bestPrefixMatch(iri: string, prefixes: Record<string, string>): { prefix: string; expansion: string } |
undefined {
  let best: { prefix: string; expansion: string } | undefined;
  for (const [ prefix, expansion ] of Object.entries(prefixes)) {
    if (iri.startsWith(expansion) && (!best || expansion.length > best.expansion.length)) {
      best = { prefix, expansion };
    }
  }
  return best;
}

/**
 * Rewrites every plain full-IRI {@link TermIriFull} in a Traqula AST (sub)tree to a {@link TermIriPrefixed}
 * wherever a known prefix's expansion matches the IRI's start (the longest-matching expansion wins when
 * more than one prefix could apply). Returns a new tree; `node` itself is not mutated.
 *
 * `termFromSparqlJs` (and everything built on it) always produces full IRIs - sparqljs resolves prefixed
 * names to full IRIs at parse time, so the original prefix notation genuinely isn't recoverable from a
 * single term in isolation - see the file header. This is the tool to reach for afterwards if you want the
 * more familiar `prefix:local` style back in generated output, for example to approximate what sparqljs'
 * own (deprecated) `Generator` used to produce: pass it the same query's `context` (or its original
 * sparqljs `prefixes` map) once you've converted it.
 *
 * `contextDef` nodes (the `PREFIX`/`BASE` declarations themselves) are left untouched: they must always
 * show the full IRI they define, never a prefixed self-reference.
 */
export function collapseIrisToPrefixed<T>(node: T, prefixes: Record<string, string>): T {
  if (Array.isArray(node)) {
    return <T> node.map(item => collapseIrisToPrefixed(item, prefixes));
  }
  if (node === null || typeof node !== 'object') {
    return node;
  }
  if (F.isTermNamed(node) && !F.isTermNamedPrefixed(node)) {
    const iriFull = <TermIri> <unknown> node;
    const match = bestPrefixMatch(iriFull.value, prefixes);
    if (match && iriFull.value.length > match.expansion.length) {
      return <T> F.termNamed(iriFull.loc, iriFull.value.slice(match.expansion.length), match.prefix);
    }
    return node;
  }
  const obj = <Record<string, unknown>> node;
  const out: Record<string, unknown> = {};
  for (const [ key, value ] of Object.entries(obj)) {
    out[key] = obj.type === 'contextDef' && key === 'value' ? value : collapseIrisToPrefixed(value, prefixes);
  }
  return <T> out;
}
