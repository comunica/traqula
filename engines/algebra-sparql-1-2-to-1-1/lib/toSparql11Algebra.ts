import type * as RDF from '@rdfjs/types';
import type { Algebra as A } from '@traqula/algebra-transformations-1-2';
import { AlgebraFactory, ExpressionTypes, Types } from '@traqula/algebra-transformations-1-2';

const RDF_NS = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const XSD_BOOLEAN = 'http://www.w3.org/2001/XMLSchema#boolean';

/**
 * How often the query is rewritten to learn which variables hold a triple term, each rewrite learning at least one.
 * Only a query nesting triple terms through its own variables without end gets there.
 */
const MAX_REWRITES = 32;

const positions = <const> [ 'subject', 'predicate', 'object' ];
type Position = typeof positions[number];

/**
 * Thrown for a query whose SPARQL 1.2 features have no SPARQL 1.1 counterpart in this rewriting.
 */
export class UnsupportedSparql12Error extends Error {
  public constructor(message: string) {
    super(`Cannot rewrite to SPARQL 1.1: ${message}`);
    this.name = 'UnsupportedSparql12Error';
  }
}

export interface ToSparql11Options {
  /**
   * The factory creating the terms of the rewritten query. Default: that of `rdf-data-factory`.
   */
  dataFactory?: RDF.DataFactory<RDF.BaseQuad>;
}

/**
 * What is statically known of a triple term: whether its object is a triple term again, and what of that one.
 */
interface Shape {
  object: Shape | undefined;
}

/**
 * A triple term taken apart. Subject and predicate are rewritten, the object is not, since it can be a triple term.
 * The components only are those of a triple term in a solution where every expression of `valid` holds.
 */
interface Resolved {
  subject: A.Expression;
  predicate: A.Expression;
  object: A.Expression;
  valid: A.Expression[];
}

/**
 * Rewrites SPARQL 1.2 algebra to SPARQL 1.1 algebra,
 * to be evaluated over data that holds no triple terms, where they are represented by RDF 1.1 reification:
 *
 * - A triple term in a BGP or path becomes a fresh variable `?n` with
 *   `?n rdf:subject s . ?n rdf:predicate p . ?n rdf:object o` in that same BGP.
 *   In a CONSTRUCT or INSERT template it becomes a blank node with those three triples.
 * - A variable the query itself binds to a triple term, in a BIND or VALUES, no longer exists.
 *   Its three components are bound to three variables instead, which are bound together or not at all.
 *   Such a variable is read by name: once a name is bound to a triple term somewhere in the query,
 *   it is taken to hold a triple term everywhere.
 * - `SUBJECT`, `PREDICATE`, `OBJECT` and `isTRIPLE` are resolved over such a variable or a written triple term.
 * - A variable the data binds holds the node reifying a triple term, as nothing tells the two apart.
 *   Where the query reads its components, every BGP and path binding the variable is followed by
 *   `OPTIONAL { ?t rdf:subject ?s . ?t rdf:predicate ?p . ?t rdf:object ?o }`, which the accessors read.
 *   Over anything else no triple term exists, so the accessors become an expression that errors (`COALESCE()`).
 * - A base direction is dropped from literals and from `STRLANGDIR`, `LANGDIR` gives `""`.
 *
 * @param operation the SPARQL 1.2 algebra, which is left untouched.
 * @param options see {@link ToSparql11Options}.
 * @returns algebra without triple terms, base directions and SPARQL 1.2 functions.
 * @throws UnsupportedSparql12Error when a triple term the query binds is used where it cannot be resolved,
 *   such as in the projection of the query, an ORDER BY, an aggregate or a DELETE template.
 */
export function toSparql11Algebra(operation: A.Operation, options: ToSparql11Options = {}): A.Operation {
  const names = new Set<string>();
  collectNames(operation, names);
  let prefix = 'tt';
  while ([ ...names ].some(name => name.startsWith(prefix))) {
    prefix += 't';
  }
  const tripleVariables = new Set<string>();
  const lookups = new Set<string>();
  for (let i = 0; i < MAX_REWRITES; i++) {
    const known = tripleVariables.size + lookups.size;
    const rewriter = new Rewriter(new AlgebraFactory(options.dataFactory), prefix, tripleVariables, lookups);
    const result = rewriter.rewrite(operation);
    // A rewrite that learned how a variable is to be read, read that variable wrongly before learning so.
    if (tripleVariables.size + lookups.size === known) {
      return result;
    }
  }
  throw new UnsupportedSparql12Error('the query nests triple terms too deeply through its variables');
}

function collectNames(value: unknown, names: Set<string>): void {
  if (Array.isArray(value)) {
    for (const element of value) {
      collectNames(element, names);
    }
  } else if (value && typeof value === 'object') {
    const term = <Partial<RDF.Term>> value;
    if (term.termType === 'Variable' || term.termType === 'BlankNode') {
      names.add(term.value!);
    }
    for (const child of Object.values(value)) {
      collectNames(child, names);
    }
  }
}

class Rewriter {
  private counter = 0;
  /**
   * A BIND of something that is no triple term to a variable known to hold one.
   * Only an error once nothing more is learned, since the expression might turn out to be a triple term.
   */
  private mixedBind: string | undefined;
  /**
   * The projection giving the solutions of the query, which keeps the variables it has.
   */
  private resultProject: A.Operation | undefined;

  /**
   * @param AF creates the rewritten operations.
   * @param prefix starts every name this rewriting coins, and no name of the query.
   * @param tripleVariables the names of the variables the query binds to a triple term.
   * @param lookups the names of the variables the data binds, of which the query reads the components.
   */
  public constructor(
    private readonly AF: AlgebraFactory,
    private readonly prefix: string,
    private readonly tripleVariables: Set<string>,
    private readonly lookups: Set<string>,
  ) {}

  public rewrite(operation: A.Operation): A.Operation {
    const known = this.tripleVariables.size;
    const wrappers = new Set<string>([ Types.SLICE, Types.DISTINCT, Types.REDUCED, Types.ORDER_BY, Types.FROM ]);
    this.resultProject = operation;
    while (wrappers.has(this.resultProject.type)) {
      this.resultProject = (<A.Single> this.resultProject).input;
    }
    const result = this.operation(operation);
    if (this.tripleVariables.size === known) {
      if (this.mixedBind) {
        throw new UnsupportedSparql12Error(`?${this.mixedBind} is bound to a triple term and to another expression`);
      }
      // The solutions of the query itself cannot hold a triple term
      if (this.resultProject.type === Types.PROJECT) {
        for (const variable of this.resultProject.variables) {
          this.plainTerm(variable);
        }
      }
    }
    return result;
  }

  // ---------------------------------------------------- TERMS ----------------------------------------------------

  private get DF(): RDF.DataFactory<RDF.BaseQuad, RDF.BaseQuad> {
    return this.AF.dataFactory;
  }

  private freshName(): string {
    return `${this.prefix}${this.counter++}`;
  }

  private readonly freshVariable = (): RDF.Variable => this.DF.variable!(this.freshName());

  private readonly freshBlankNode = (): RDF.BlankNode => this.DF.blankNode(this.freshName());

  /**
   * The variable holding a component of the triple term a variable holds.
   */
  private component(variable: RDF.Variable, position: Position): RDF.Variable {
    return this.DF.variable!(`${this.prefix}_${variable.value}_${position[0]}`);
  }

  private isTripleVariable(term: RDF.Term): term is RDF.Variable {
    return term.termType === 'Variable' && this.tripleVariables.has(term.value);
  }

  /**
   * Whether the data binds this variable, to what can be the node of a triple term the query reads the components of.
   * Only asked of a variable that is not bound to a triple term by the query, which comes first.
   */
  private isLookup(term: RDF.Term): term is RDF.Variable {
    return term.termType === 'Variable' && this.lookups.has(term.value);
  }

  /**
   * The variables a {@link lookup} of this variable binds.
   */
  private lookedUp(variable: RDF.Variable): RDF.Variable[] {
    const components = positions.map(position => this.component(variable, position));
    return this.isLookup(components[2]) ? [ ...components, ...this.lookedUp(components[2]) ] : components;
  }

  /**
   * The variables binding a variable in the rewritten query: the components of its triple term,
   * or itself, with the components looked up for it unless only the variable itself is to be kept.
   */
  private flatten(variable: RDF.Variable, onlyItself = false): RDF.Variable[] {
    if (this.isTripleVariable(variable)) {
      return positions.flatMap(position => this.flatten(this.component(variable, position)));
    }
    return this.isLookup(variable) && !onlyItself ? [ variable, ...this.lookedUp(variable) ] : [ variable ];
  }

  /**
   * A term in a position that cannot hold a triple term.
   */
  private plainTerm<T extends RDF.Term>(term: T): T {
    if (term.termType === 'Quad') {
      throw new UnsupportedSparql12Error('a triple term is used where its components cannot be read');
    }
    if (this.isTripleVariable(term)) {
      throw new UnsupportedSparql12Error(`?${term.value} holds a triple term where its components cannot be read`);
    }
    if (term.termType === 'Literal' && term.direction) {
      return <T> <RDF.Term> this.DF.literal(term.value, term.language);
    }
    return term;
  }

  private parts(term: RDF.Term): RDF.Term[] | undefined {
    if (term.termType === 'Quad') {
      return [ term.subject, term.predicate, term.object ];
    }
    if (this.isTripleVariable(term)) {
      return positions.map(position => this.component(term, position));
    }
  }

  // --------------------------------------------------- PATTERNS --------------------------------------------------

  /**
   * A subject or object of a pattern: a triple term becomes a node, with its reification added to `reification`.
   */
  private node(term: RDF.Term, graph: RDF.Term, fresh: () => RDF.Term, reification: A.Pattern[]): RDF.Term {
    const parts = this.parts(term);
    if (!parts) {
      return this.plainTerm(term);
    }
    const node = fresh();
    for (const [ index, position ] of positions.entries()) {
      // The patterns of a nested triple term come after the pattern that uses its node
      const nested: A.Pattern[] = [];
      const part = this.node(parts[index], graph, fresh, nested);
      reification.push(this.AF.createPattern(node, this.DF.namedNode(RDF_NS + position), part, graph), ...nested);
    }
    return node;
  }

  private patterns(patterns: A.Pattern[], fresh: () => RDF.Term): A.Pattern[] {
    return patterns.flatMap((pattern) => {
      const graph = this.plainTerm(pattern.graph);
      const reification: A.Pattern[] = [];
      const subject = this.node(pattern.subject, graph, fresh, reification);
      const object = this.node(pattern.object, graph, fresh, reification);
      return [ this.AF.createPattern(subject, this.plainTerm(pattern.predicate), object, graph), ...reification ];
    });
  }

  private path(path: A.Path): A.Operation {
    const graph = this.plainTerm(path.graph);
    const reification: A.Pattern[] = [];
    const subject = this.node(path.subject, graph, this.freshVariable, reification);
    const object = this.node(path.object, graph, this.freshVariable, reification);
    const result: A.Path = { ...path, subject, object, graph };
    return this.withLookups(
      reification.length > 0 ? this.AF.createJoin([ result, this.AF.createBgp(reification) ]) : result,
      [ result, ...reification ],
    );
  }

  /**
   * The reification of the node a variable holds, when it holds one: this is to be the right side of an OPTIONAL.
   * The variable has to be bound, an unbound one would be bound to every node there is.
   */
  private lookup(variable: RDF.Variable, graph: RDF.Term): A.Operation {
    const components = positions.map(position => this.component(variable, position));
    const reification = this.AF.createBgp(positions.map((position, index) =>
      this.AF.createPattern(variable, this.DF.namedNode(RDF_NS + position), components[index], graph)));
    return this.isLookup(components[2]) ?
      this.AF.createLeftJoin(reification, this.lookup(components[2], graph)) :
      reification;
  }

  /**
   * Looks up the components the query reads of the variables these patterns bind as subject or object.
   */
  private withLookups(op: A.Operation, patterns: Pick<A.Pattern, 'subject' | 'object' | 'graph'>[]): A.Operation {
    const done = new Set<string>();
    for (const { subject, object, graph } of patterns) {
      for (const term of [ subject, object ]) {
        if (this.isLookup(term) && !done.has(term.value)) {
          done.add(term.value);
          op = this.AF.createLeftJoin(op, this.lookup(term, graph));
        }
      }
    }
    return op;
  }

  // -------------------------------------------------- OPERATIONS -------------------------------------------------

  private operation(op: A.Operation): A.Operation {
    switch (op.type) {
      case Types.BGP: {
        const patterns = this.patterns(op.patterns, this.freshVariable);
        return this.withLookups(this.AF.createBgp(patterns), patterns);
      }
      case Types.PATH:
        return this.path(op);
      case Types.EXTEND:
        return this.extend(op);
      case Types.VALUES:
        return this.values(op);
      case Types.PROJECT:
        return {
          ...op,
          input: this.operation(op.input),
          variables: op.variables.flatMap(v => this.flatten(v, op === this.resultProject)),
        };
      case Types.GROUP:
        return {
          ...op,
          input: this.operation(op.input),
          variables: op.variables.flatMap(v => this.flatten(v)),
          aggregates: op.aggregates.map((aggregate) => {
            this.plainTerm(aggregate.variable);
            return <A.BoundAggregate> this.expression(aggregate);
          }),
        };
      case Types.GRAPH:
      case Types.SERVICE:
        return { ...op, input: this.operation(op.input), name: this.plainTerm(op.name) };
      case Types.DESCRIBE:
        return { ...op, input: this.operation(op.input), terms: op.terms.map(term => this.plainTerm(term)) };
      case Types.CONSTRUCT:
        return {
          ...op,
          input: this.operation(op.input),
          template: this.patterns(op.template, this.freshBlankNode),
        };
      case Types.DELETE_INSERT:
        return {
          ...op,
          // A blank node cannot be deleted, so neither can the node of a triple term
          delete: op.delete && this.patterns(op.delete, () => {
            throw new UnsupportedSparql12Error('a triple term is deleted');
          }),
          insert: op.insert && this.patterns(op.insert, this.freshBlankNode),
          where: op.where && this.operation(op.where),
        };
      case Types.COMPOSITE_UPDATE:
        return { ...op, updates: op.updates.map(update => <A.Update | A.Nop> this.operation(update)) };
      default:
        return this.generic(op);
    }
  }

  /**
   * An operation that only reads terms in its inputs and expressions.
   */
  private generic(op: A.Operation): A.Operation {
    const result: any = { ...op };
    const { input, expression, expressions } = <{
      input?: A.Operation | A.Operation[];
      expression?: A.Expression;
      expressions?: A.Expression[];
    }> op;
    if (Array.isArray(input)) {
      result.input = input.map(child => this.operation(child));
    } else if (input) {
      result.input = this.operation(input);
    }
    if (expression) {
      result.expression = this.expression(expression);
    }
    if (expressions) {
      result.expressions = expressions.map(child => this.expression(child));
    }
    return result;
  }

  private extend(op: A.Extend): A.Operation {
    const input = this.operation(op.input);
    if (!this.shape(op.expression)) {
      if (this.isTripleVariable(op.variable)) {
        this.mixedBind = op.variable.value;
      }
      return { ...op, input, expression: this.expression(op.expression) };
    }
    const binds: [RDF.Variable, A.Expression][] = [];
    const valid = this.guardsItself(op.expression) ? [] : this.resolve(op.expression).valid;
    this.assign(op.variable, op.expression, valid, binds);
    return binds.reduce<A.Operation>((acc, [ variable, expr ]) => this.AF.createExtend(acc, variable, expr), input);
  }

  /**
   * Binds the components of a triple term to those of a variable, in the solutions where `valid` holds.
   */
  private assign(
    target: RDF.Variable,
    expression: A.Expression,
    valid: A.Expression[],
    binds: [RDF.Variable, A.Expression][],
  ): void {
    this.tripleVariables.add(target.value);
    const resolved = this.resolve(expression);
    binds.push(
      [ this.component(target, 'subject'), this.guard(valid, resolved.subject) ],
      [ this.component(target, 'predicate'), this.guard(valid, resolved.predicate) ],
    );
    const object = this.component(target, 'object');
    if (this.shape(resolved.object)) {
      this.assign(object, resolved.object, valid, binds);
    } else {
      binds.push([ object, this.guard(valid, this.expression(resolved.object)) ]);
    }
  }

  private values(op: A.Values): A.Values {
    const bindings: Record<string, RDF.Term>[] = op.bindings.map(binding => ({ ...binding }));
    const variables: RDF.Variable[] = [];
    const todo = [ ...op.variables ];
    while (todo.length > 0) {
      const variable = todo.shift()!;
      const rows = bindings.filter(binding => binding[variable.value]);
      const tripleTerms = rows.filter(binding => binding[variable.value].termType === 'Quad');
      if (tripleTerms.length === 0) {
        variables.push(this.plainTerm(variable));
        for (const row of rows) {
          row[variable.value] = this.plainTerm(row[variable.value]);
        }
      } else if (tripleTerms.length < rows.length) {
        throw new UnsupportedSparql12Error(`VALUES binds ?${variable.value} to triple terms and to other terms`);
      } else {
        this.tripleVariables.add(variable.value);
        const components = positions.map(position => this.component(variable, position));
        for (const row of rows) {
          const tripleTerm = <RDF.BaseQuad> row[variable.value];
          delete row[variable.value];
          for (const [ index, position ] of positions.entries()) {
            row[components[index].value] = tripleTerm[position];
          }
        }
        todo.unshift(...components);
      }
    }
    return this.AF.createValues(variables, <A.Values['bindings']> bindings);
  }

  // ------------------------------------------------- EXPRESSIONS -------------------------------------------------

  private call(operator: string, ...args: A.Expression[]): A.Expression {
    return this.AF.createOperatorExpression(operator, args);
  }

  private term(term: RDF.Term): A.TermExpression {
    return this.AF.createTermExpression(term);
  }

  private boolean(value: boolean): A.Expression {
    return this.term(this.DF.literal(String(value), this.DF.namedNode(XSD_BOOLEAN)));
  }

  private isTerm(expression: A.Expression): expression is A.TermExpression {
    return expression.subType === ExpressionTypes.TERM;
  }

  private isVariable(expression: A.Expression): expression is A.TermExpression & { term: RDF.Variable } {
    return this.isTerm(expression) && expression.term.termType === 'Variable';
  }

  /**
   * Whether the components of this triple term are those of a variable,
   * which are unbound, so an error to read, in the solutions where the variable holds no triple term.
   */
  private guardsItself(expression: A.Expression): boolean {
    const objectOf = this.argsOf(expression, 'object');
    return this.isVariable(expression) || (objectOf !== undefined && this.guardsItself(objectOf[0]));
  }

  private isIri(expression: A.Expression): boolean {
    return this.isTerm(expression) && expression.term.termType === 'NamedNode';
  }

  /**
   * The arguments of an expression that calls the given operator.
   */
  private argsOf(expression: A.Expression, operator: string): A.Expression[] | undefined {
    if (expression.subType === ExpressionTypes.OPERATOR && expression.operator === operator) {
      return expression.args;
    }
  }

  /**
   * The expression in the solutions where every condition holds, an error in the others.
   */
  private guard(conditions: A.Expression[], expression: A.Expression): A.Expression {
    if (conditions.length === 0) {
      return expression;
    }
    const condition = conditions.reduce((left, right) => this.call('&&', left, right));
    // COALESCE without arguments is the one expression of SPARQL 1.1 that is defined to always raise an error
    return this.call('if', condition, expression, this.call('coalesce'));
  }

  /**
   * The conditions under which a rewritten expression does not raise an error.
   */
  private defined(expression: A.Expression): A.Expression[] {
    if (this.isVariable(expression)) {
      return [ this.call('bound', expression) ];
    }
    if (this.isTerm(expression)) {
      return [];
    }
    // An IF raises the error of its condition, whatever value it has: this one need not be the same in both calls
    return [ this.call('if', this.call('sameterm', expression, expression), this.boolean(true), this.boolean(true)) ];
  }

  private shape(expression: A.Expression): Shape | undefined {
    if (this.isTerm(expression)) {
      return this.termShape(expression.term);
    }
    const components = this.argsOf(expression, 'triple');
    if (components) {
      return { object: this.shape(components[2]) };
    }
    const objectOf = this.argsOf(expression, 'object');
    if (objectOf) {
      return this.shape(objectOf[0])?.object;
    }
  }

  private termShape(term: RDF.Term): Shape | undefined {
    const parts = this.parts(term);
    return parts && { object: this.termShape(parts[2]) };
  }

  /**
   * Takes apart an expression that has a {@link shape}.
   */
  private resolve(expression: A.Expression): Resolved {
    if (this.isVariable(expression)) {
      const [ subject, predicate, object ] = positions.map(pos => this.term(this.component(expression.term, pos)));
      return { subject, predicate, object, valid: [ this.call('bound', subject) ]};
    }
    const objectOf = this.argsOf(expression, 'object');
    if (objectOf) {
      const outer = this.resolve(objectOf[0]);
      // Where the outer triple term is one, so is its object
      return { ...this.resolve(outer.object), valid: outer.valid };
    }
    const [ rawSubject, rawPredicate, object ] = this.isTerm(expression) ?
      this.parts(expression.term)!.map(part => this.term(part)) :
        (<A.OperatorExpression> expression).args;
    const subject = this.expression(rawSubject);
    const predicate = this.expression(rawPredicate);
    const valid: A.Expression[] = [];
    if (!this.isIri(subject)) {
      valid.push(this.call('||', this.call('isiri', subject), this.call('isblank', subject)));
    }
    if (!this.isIri(predicate)) {
      valid.push(this.call('isiri', predicate));
    }
    valid.push(...this.shape(object) ? this.resolve(object).valid : this.defined(this.expression(object)));
    return { subject, predicate, object, valid };
  }

  /**
   * An expression that is used for the term it evaluates to, which no SPARQL 1.1 expression can make a triple term.
   */
  private expression(expression: A.Expression): A.Expression {
    switch (expression.subType) {
      case ExpressionTypes.TERM:
        return this.term(this.plainTerm(expression.term));
      case ExpressionTypes.EXISTENCE:
        return { ...expression, input: this.operation(expression.input) };
      case ExpressionTypes.AGGREGATE:
        return { ...expression, expression: this.expression(expression.expression) };
      case ExpressionTypes.NAMED:
        return { ...expression, args: expression.args.map(arg => this.expression(arg)) };
      case ExpressionTypes.OPERATOR:
        return this.operator(expression);
      default:
        return expression;
    }
  }

  private operator(expression: A.OperatorExpression): A.Expression {
    const { operator, args } = expression;
    switch (operator) {
      case 'triple':
        throw new UnsupportedSparql12Error('a triple term is used where its components cannot be read');
      case 'subject':
      case 'predicate':
      case 'object':
        return this.accessor(operator, args[0]);
      case 'istriple': {
        if (this.shape(args[0])) {
          return this.guard(this.resolve(args[0]).valid, this.boolean(true));
        }
        const target = this.lookupTarget(args[0]);
        return this.guard(
          this.defined(this.expression(args[0])),
          target ? this.call('bound', this.term(this.component(target, 'subject'))) : this.boolean(false),
        );
      }
      case 'bound':
        return this.isTripleVariable((<A.TermExpression> args[0]).term) ?
          this.resolve(args[0]).valid[0] :
          expression;
      case 'sameterm':
      case '=':
        return this.compare(operator, args[0], args[1]);
      case '!=':
        return this.shape(args[0]) ?? this.shape(args[1]) ?
          this.call('!', this.compare('=', args[0], args[1])) :
          this.plainOperator(expression);
      case 'langdir':
        // No literal has a base direction
        return this.guard([ this.call('isliteral', this.expression(args[0])) ], this.term(this.DF.literal('')));
      case 'haslangdir':
        return this.guard(this.defined(this.expression(args[0])), this.boolean(false));
      case 'haslang': {
        const arg = this.expression(args[0]);
        const hasLanguage = this.call('!=', this.call('lang', arg), this.term(this.DF.literal('')));
        return this.call('&&', this.call('isliteral', arg), hasLanguage);
      }
      case 'strlangdir': {
        const [ lexical, language, direction ] = args.map(arg => this.expression(arg));
        const isDirection = [ 'ltr', 'rtl' ].map(dir => this.call('=', direction, this.term(this.DF.literal(dir))));
        return this.guard([ this.call('||', ...isDirection) ], this.call('strlang', lexical, language));
      }
      default:
        return this.plainOperator(expression);
    }
  }

  private plainOperator(expression: A.OperatorExpression): A.Expression {
    return { ...expression, args: expression.args.map(arg => this.expression(arg)) };
  }

  private accessor(position: Position, arg: A.Expression): A.Expression {
    const shape = this.shape(arg);
    if (!shape) {
      const target = this.lookupTarget(arg);
      // Nothing else that the query did not make a triple term itself, is one
      return target ? this.term(this.component(target, position)) : this.call('coalesce');
    }
    if (position === 'object' && shape.object) {
      throw new UnsupportedSparql12Error('a triple term is used where its components cannot be read');
    }
    const resolved = this.resolve(arg);
    const value = position === 'object' ? this.expression(resolved.object) : resolved[position];
    return this.guardsItself(arg) ? value : this.guard(resolved.valid, value);
  }

  /**
   * The variable holding what an expression that is no triple term evaluates to, when the data can bind it:
   * a variable, or the object of the triple term such a variable stands for.
   * Its components are looked up from here on.
   */
  private lookupTarget(arg: A.Expression): RDF.Variable | undefined {
    let target: RDF.Variable | undefined;
    if (this.isVariable(arg)) {
      target = arg.term;
    } else {
      const objectOf = this.argsOf(arg, 'object');
      const outer = objectOf && !this.shape(objectOf[0]) && this.lookupTarget(objectOf[0]);
      target = outer ? this.component(outer, 'object') : undefined;
    }
    if (target) {
      this.lookups.add(target.value);
    }
    return target;
  }

  private compare(operator: string, left: A.Expression, right: A.Expression): A.Expression {
    const leftShape = this.shape(left);
    const rightShape = this.shape(right);
    if (!leftShape && !rightShape) {
      return this.call(operator, this.expression(left), this.expression(right));
    }
    if (!leftShape || !rightShape) {
      const [ tripleTerm, other ] = leftShape ? [ left, right ] : [ right, left ];
      const valid = [ ...this.resolve(tripleTerm).valid, ...this.defined(this.expression(other)) ];
      return this.guard(valid, this.boolean(false));
    }
    const resolvedLeft = this.resolve(left);
    const resolvedRight = this.resolve(right);
    return this.guard(
      [ ...resolvedLeft.valid, ...resolvedRight.valid ],
      this.call('&&', this.call(
        '&&',
        this.call(operator, resolvedLeft.subject, resolvedRight.subject),
        this.call(operator, resolvedLeft.predicate, resolvedRight.predicate),
      ), this.compare(operator, resolvedLeft.object, resolvedRight.object)),
    );
  }
}
