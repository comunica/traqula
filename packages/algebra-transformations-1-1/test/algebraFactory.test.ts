import { DataFactory } from 'rdf-data-factory';
import { describe, it } from 'vitest';
import { AlgebraFactory, Algebra } from '@traqula/algebra-transformations-1-1';

describe('AlgebraFactory', () => {
  const factory = new AlgebraFactory();
  const df = new DataFactory();

  describe('constructor', () => {
    it('uses a custom dataFactory when provided', ({ expect }) => {
      const customDf = new DataFactory();
      const f = new AlgebraFactory(customDf);
      expect(f.dataFactory).toBe(customDf);
    });

    it('creates a default dataFactory when none is provided', ({ expect }) => {
      const f = new AlgebraFactory();
      expect(f.dataFactory).toBeDefined();
    });

    it('sets the string type IRI', ({ expect }) => {
      expect(factory.stringType.value).toBe('http://www.w3.org/2001/XMLSchema#string');
    });
  });

  describe('createAsk', () => {
    it('creates an ask operation', ({ expect }) => {
      const nop = factory.createNop();
      const ask = factory.createAsk(nop);
      expect(ask).toMatchObject({ type: Algebra.Types.ASK, input: nop });
    });
  });

  describe('createBgp', () => {
    it('creates a bgp operation with patterns', ({ expect }) => {
      const s = df.namedNode('http://s');
      const p = df.namedNode('http://p');
      const o = df.namedNode('http://o');
      const pattern = factory.createPattern(s, p, o);
      const bgp = factory.createBgp([ pattern ]);
      expect(bgp).toMatchObject({ type: Algebra.Types.BGP, patterns: [ pattern ] });
    });

    it('creates a bgp with empty patterns', ({ expect }) => {
      const bgp = factory.createBgp([]);
      expect(bgp).toMatchObject({ type: Algebra.Types.BGP, patterns: [] });
    });
  });

  describe('createBoundAggregate', () => {
    it('creates a bound aggregate with separator', ({ expect }) => {
      const variable = df.variable('x');
      const termExpr = factory.createTermExpression(df.literal('test'));
      const agg = factory.createBoundAggregate(variable, 'group_concat', termExpr, false, '|');
      expect(agg).toMatchObject({
        type: Algebra.Types.EXPRESSION,
        subType: Algebra.ExpressionTypes.AGGREGATE,
        aggregator: 'group_concat',
        distinct: false,
        separator: '|',
      });
      expect(agg.variable).toBe(variable);
    });

    it('creates a bound aggregate without separator', ({ expect }) => {
      const variable = df.variable('y');
      const termExpr = factory.createTermExpression(df.literal('test'));
      const agg = factory.createBoundAggregate(variable, 'count', termExpr, true);
      expect(agg).toMatchObject({
        type: Algebra.Types.EXPRESSION,
        subType: Algebra.ExpressionTypes.AGGREGATE,
        aggregator: 'count',
        distinct: true,
      });
      expect(agg.variable).toBe(variable);
      expect(agg.separator).toBeUndefined();
    });
  });

  describe('createConstruct', () => {
    it('creates a construct operation', ({ expect }) => {
      const nop = factory.createNop();
      const s = df.namedNode('http://s');
      const p = df.namedNode('http://p');
      const o = df.namedNode('http://o');
      const pattern = factory.createPattern(s, p, o);
      const construct = factory.createConstruct(nop, [ pattern ]);
      expect(construct).toMatchObject({ type: Algebra.Types.CONSTRUCT, template: [ pattern ] });
    });
  });

  describe('createDescribe', () => {
    it('creates a describe operation', ({ expect }) => {
      const nop = factory.createNop();
      const iri = df.namedNode('http://example.org/x');
      const describe = factory.createDescribe(nop, [ iri ]);
      expect(describe).toMatchObject({ type: Algebra.Types.DESCRIBE, terms: [ iri ] });
    });
  });

  describe('createDistinct', () => {
    it('wraps an operation in distinct', ({ expect }) => {
      const nop = factory.createNop();
      const distinct = factory.createDistinct(nop);
      expect(distinct).toMatchObject({ type: Algebra.Types.DISTINCT, input: nop });
    });
  });

  describe('createExtend', () => {
    it('creates an extend operation', ({ expect }) => {
      const nop = factory.createNop();
      const variable = df.variable('x');
      const expr = factory.createTermExpression(df.literal('1'));
      const extend = factory.createExtend(nop, variable, expr);
      expect(extend).toMatchObject({ type: Algebra.Types.EXTEND, variable, expression: expr });
    });
  });

  describe('createFilter', () => {
    it('creates a filter operation', ({ expect }) => {
      const nop = factory.createNop();
      const expr = factory.createOperatorExpression('=', [
        factory.createTermExpression(df.variable('x')),
        factory.createTermExpression(df.literal('1')),
      ]);
      const filter = factory.createFilter(nop, expr);
      expect(filter).toMatchObject({ type: Algebra.Types.FILTER, expression: expr });
    });
  });

  describe('createFrom', () => {
    it('creates a from operation', ({ expect }) => {
      const nop = factory.createNop();
      const defaultGraph = df.namedNode('http://default.org');
      const namedGraph = df.namedNode('http://named.org');
      const from = factory.createFrom(nop, [ defaultGraph ], [ namedGraph ]);
      expect(from).toMatchObject({
        type: Algebra.Types.FROM,
        default: [ defaultGraph ],
        named: [ namedGraph ],
      });
    });
  });

  describe('createGraph', () => {
    it('creates a graph operation with named node', ({ expect }) => {
      const nop = factory.createNop();
      const graphName = df.namedNode('http://g');
      const graph = factory.createGraph(nop, graphName);
      expect(graph).toMatchObject({ type: Algebra.Types.GRAPH, name: graphName });
    });

    it('creates a graph operation with variable', ({ expect }) => {
      const nop = factory.createNop();
      const graphVar = df.variable('g');
      const graph = factory.createGraph(nop, graphVar);
      expect(graph).toMatchObject({ type: Algebra.Types.GRAPH, name: graphVar });
    });
  });

  describe('createGroup', () => {
    it('creates a group operation', ({ expect }) => {
      const nop = factory.createNop();
      const variable = df.variable('x');
      const group = factory.createGroup(nop, [ variable ], []);
      expect(group).toMatchObject({ type: Algebra.Types.GROUP, variables: [ variable ] });
    });
  });

  describe('createJoin', () => {
    it('creates a join with flattening by default', ({ expect }) => {
      const nop1 = factory.createNop();
      const nop2 = factory.createNop();
      const join = factory.createJoin([ nop1, nop2 ]);
      expect(join).toMatchObject({ type: Algebra.Types.JOIN });
      expect(join.input).toHaveLength(2);
    });

    it('flattens nested joins', ({ expect }) => {
      const nop1 = factory.createNop();
      const nop2 = factory.createNop();
      const nop3 = factory.createNop();
      const innerJoin = factory.createJoin([ nop1, nop2 ], false);
      const outerJoin = factory.createJoin([ innerJoin, nop3 ]);
      // The inner join elements are flattened into the outer join
      expect(outerJoin.input).toHaveLength(3);
    });

    it('does not flatten when flatten=false', ({ expect }) => {
      const nop1 = factory.createNop();
      const nop2 = factory.createNop();
      const join = factory.createJoin([ nop1, nop2 ], false);
      expect(join.input).toHaveLength(2);
    });
  });

  describe('createLeftJoin', () => {
    it('creates a left join without expression', ({ expect }) => {
      const nop1 = factory.createNop();
      const nop2 = factory.createNop();
      const leftJoin = factory.createLeftJoin(nop1, nop2);
      expect(leftJoin).toMatchObject({ type: Algebra.Types.LEFT_JOIN });
      expect(leftJoin.input).toHaveLength(2);
      expect(leftJoin.expression).toBeUndefined();
    });

    it('creates a left join with expression', ({ expect }) => {
      const nop1 = factory.createNop();
      const nop2 = factory.createNop();
      const expr = factory.createOperatorExpression('>', [
        factory.createTermExpression(df.variable('x')),
        factory.createTermExpression(df.literal('0')),
      ]);
      const leftJoin = factory.createLeftJoin(nop1, nop2, expr);
      expect(leftJoin).toMatchObject({ type: Algebra.Types.LEFT_JOIN, expression: expr });
    });
  });

  describe('createLink', () => {
    it('creates a link path symbol', ({ expect }) => {
      const iri = df.namedNode('http://p');
      const link = factory.createLink(iri);
      expect(link).toMatchObject({ type: Algebra.Types.LINK, iri });
    });
  });

  describe('createMinus', () => {
    it('creates a minus operation', ({ expect }) => {
      const nop1 = factory.createNop();
      const nop2 = factory.createNop();
      const minus = factory.createMinus(nop1, nop2);
      expect(minus).toMatchObject({ type: Algebra.Types.MINUS });
      expect(minus.input).toHaveLength(2);
    });
  });

  describe('createNop', () => {
    it('creates a nop operation', ({ expect }) => {
      const nop = factory.createNop();
      expect(nop).toMatchObject({ type: Algebra.Types.NOP });
    });
  });

  describe('createNps', () => {
    it('creates an nps path symbol', ({ expect }) => {
      const iri = df.namedNode('http://p');
      const nps = factory.createNps([ iri ]);
      expect(nps).toMatchObject({ type: Algebra.Types.NPS, iris: [ iri ] });
    });
  });

  describe('createOneOrMorePath', () => {
    it('creates a one-or-more path', ({ expect }) => {
      const link = factory.createLink(df.namedNode('http://p'));
      const path = factory.createOneOrMorePath(link);
      expect(path).toMatchObject({ type: Algebra.Types.ONE_OR_MORE_PATH });
    });
  });

  describe('createOrderBy', () => {
    it('creates an order-by operation', ({ expect }) => {
      const nop = factory.createNop();
      const expr = factory.createTermExpression(df.variable('x'));
      const orderBy = factory.createOrderBy(nop, [ expr ]);
      expect(orderBy).toMatchObject({ type: Algebra.Types.ORDER_BY });
      expect(orderBy.expressions).toHaveLength(1);
    });
  });

  describe('createPath', () => {
    it('creates a path with explicit graph', ({ expect }) => {
      const s = df.namedNode('http://s');
      const link = factory.createLink(df.namedNode('http://p'));
      const o = df.namedNode('http://o');
      const g = df.namedNode('http://g');
      const path = factory.createPath(s, link, o, g);
      expect(path).toMatchObject({ type: Algebra.Types.PATH, subject: s, object: o, graph: g });
    });

    it('creates a path with default graph when no graph is provided', ({ expect }) => {
      const s = df.namedNode('http://s');
      const link = factory.createLink(df.namedNode('http://p'));
      const o = df.namedNode('http://o');
      const path = factory.createPath(s, link, o);
      expect(path).toMatchObject({ type: Algebra.Types.PATH });
      expect(path.graph.termType).toBe('DefaultGraph');
    });
  });

  describe('createPattern', () => {
    it('creates a triple pattern', ({ expect }) => {
      const s = df.namedNode('http://s');
      const p = df.namedNode('http://p');
      const o = df.namedNode('http://o');
      const pattern = factory.createPattern(s, p, o);
      expect(pattern.type).toBe(Algebra.Types.PATTERN);
      expect(pattern.subject).toBe(s);
      expect(pattern.predicate).toBe(p);
      expect(pattern.object).toBe(o);
    });

    it('creates a quad pattern with explicit graph', ({ expect }) => {
      const s = df.namedNode('http://s');
      const p = df.namedNode('http://p');
      const o = df.namedNode('http://o');
      const g = df.namedNode('http://g');
      const pattern = factory.createPattern(s, p, o, g);
      expect(pattern.graph).toBe(g);
    });
  });

  describe('createProject', () => {
    it('creates a project operation', ({ expect }) => {
      const nop = factory.createNop();
      const variable = df.variable('x');
      const project = factory.createProject(nop, [ variable ]);
      expect(project).toMatchObject({ type: Algebra.Types.PROJECT, variables: [ variable ] });
    });
  });

  describe('createReduced', () => {
    it('creates a reduced operation', ({ expect }) => {
      const nop = factory.createNop();
      const reduced = factory.createReduced(nop);
      expect(reduced).toMatchObject({ type: Algebra.Types.REDUCED, input: nop });
    });
  });

  describe('createSeq', () => {
    it('creates a seq with two paths', ({ expect }) => {
      const link1 = factory.createLink(df.namedNode('http://p1'));
      const link2 = factory.createLink(df.namedNode('http://p2'));
      const seq = factory.createSeq([ link1, link2 ]);
      expect(seq).toMatchObject({ type: Algebra.Types.SEQ });
      expect(seq.input).toHaveLength(2);
    });

    it('flattens nested seqs by default', ({ expect }) => {
      const link1 = factory.createLink(df.namedNode('http://p1'));
      const link2 = factory.createLink(df.namedNode('http://p2'));
      const link3 = factory.createLink(df.namedNode('http://p3'));
      const inner = factory.createSeq([ link1, link2 ], false);
      const outer = factory.createSeq([ inner, link3 ]);
      expect(outer.input).toHaveLength(3);
    });
  });

  describe('createAlt', () => {
    it('creates an alt with multiple paths', ({ expect }) => {
      const link1 = factory.createLink(df.namedNode('http://p1'));
      const link2 = factory.createLink(df.namedNode('http://p2'));
      const alt = factory.createAlt([ link1, link2 ]);
      expect(alt).toMatchObject({ type: Algebra.Types.ALT });
      expect(alt.input).toHaveLength(2);
    });

    it('flattens nested alts', ({ expect }) => {
      const link1 = factory.createLink(df.namedNode('http://p1'));
      const link2 = factory.createLink(df.namedNode('http://p2'));
      const link3 = factory.createLink(df.namedNode('http://p3'));
      const inner = factory.createAlt([ link1, link2 ], false);
      const outer = factory.createAlt([ inner, link3 ]);
      expect(outer.input).toHaveLength(3);
    });

    it('does not flatten when flatten=false', ({ expect }) => {
      const link1 = factory.createLink(df.namedNode('http://p1'));
      const link2 = factory.createLink(df.namedNode('http://p2'));
      const alt = factory.createAlt([ link1, link2 ], false);
      expect(alt.input).toHaveLength(2);
    });
  });

  describe('createInv', () => {
    it('creates an inv path', ({ expect }) => {
      const link = factory.createLink(df.namedNode('http://p'));
      const inv = factory.createInv(link);
      expect(inv).toMatchObject({ type: Algebra.Types.INV });
    });
  });

  describe('createService', () => {
    it('creates a service operation (not silent)', ({ expect }) => {
      const nop = factory.createNop();
      const name = df.namedNode('http://endpoint');
      const service = factory.createService(nop, name);
      expect(service).toMatchObject({ type: Algebra.Types.SERVICE, name, silent: false });
    });

    it('creates a service operation (silent)', ({ expect }) => {
      const nop = factory.createNop();
      const name = df.namedNode('http://endpoint');
      const service = factory.createService(nop, name, true);
      expect(service.silent).toBe(true);
    });
  });

  describe('createSlice', () => {
    it('creates a slice with start and length', ({ expect }) => {
      const nop = factory.createNop();
      const slice = factory.createSlice(nop, 10, 5);
      expect(slice).toMatchObject({ type: Algebra.Types.SLICE, start: 10, length: 5 });
    });

    it('creates a slice with only start', ({ expect }) => {
      const nop = factory.createNop();
      const slice = factory.createSlice(nop, 10);
      expect(slice).toMatchObject({ type: Algebra.Types.SLICE, start: 10 });
      expect(slice.length).toBeUndefined();
    });

    it('normalizes falsy start to 0', ({ expect }) => {
      const nop = factory.createNop();
      const slice = factory.createSlice(nop, 0);
      expect(slice.start).toBe(0);
    });
  });

  describe('createUnion', () => {
    it('creates a union operation', ({ expect }) => {
      const nop1 = factory.createNop();
      const nop2 = factory.createNop();
      const union = factory.createUnion([ nop1, nop2 ]);
      expect(union).toMatchObject({ type: Algebra.Types.UNION });
      expect(union.input).toHaveLength(2);
    });

    it('flattens nested unions', ({ expect }) => {
      const nop1 = factory.createNop();
      const nop2 = factory.createNop();
      const nop3 = factory.createNop();
      const inner = factory.createUnion([ nop1, nop2 ], false);
      const outer = factory.createUnion([ inner, nop3 ]);
      expect(outer.input).toHaveLength(3);
    });
  });

  describe('createValues', () => {
    it('creates a values operation', ({ expect }) => {
      const x = df.variable('x');
      const binding = { '?x': df.literal('1') };
      const values = factory.createValues([ x ], [ binding ]);
      expect(values).toMatchObject({ type: Algebra.Types.VALUES, variables: [ x ], bindings: [ binding ] });
    });
  });

  describe('createZeroOrMorePath', () => {
    it('creates a zero-or-more path', ({ expect }) => {
      const link = factory.createLink(df.namedNode('http://p'));
      const path = factory.createZeroOrMorePath(link);
      expect(path).toMatchObject({ type: Algebra.Types.ZERO_OR_MORE_PATH });
    });
  });

  describe('createZeroOrOnePath', () => {
    it('creates a zero-or-one path', ({ expect }) => {
      const link = factory.createLink(df.namedNode('http://p'));
      const path = factory.createZeroOrOnePath(link);
      expect(path).toMatchObject({ type: Algebra.Types.ZERO_OR_ONE_PATH });
    });
  });

  describe('createAggregateExpression', () => {
    it('creates an aggregate without separator', ({ expect }) => {
      const termExpr = factory.createTermExpression(df.variable('x'));
      const agg = factory.createAggregateExpression('count', termExpr, false);
      expect(agg).toMatchObject({
        type: Algebra.Types.EXPRESSION,
        subType: Algebra.ExpressionTypes.AGGREGATE,
        aggregator: 'count',
        distinct: false,
      });
      expect(agg.separator).toBeUndefined();
    });

    it('creates an aggregate with separator', ({ expect }) => {
      const termExpr = factory.createTermExpression(df.variable('x'));
      const agg = factory.createAggregateExpression('group_concat', termExpr, false, ', ');
      expect(agg).toMatchObject({
        type: Algebra.Types.EXPRESSION,
        subType: Algebra.ExpressionTypes.AGGREGATE,
        aggregator: 'group_concat',
        separator: ', ',
      });
    });
  });

  describe('createExistenceExpression', () => {
    it('creates an existence expression', ({ expect }) => {
      const nop = factory.createNop();
      const exists = factory.createExistenceExpression(false, nop);
      expect(exists).toMatchObject({
        type: Algebra.Types.EXPRESSION,
        subType: Algebra.ExpressionTypes.EXISTENCE,
        not: false,
      });
    });

    it('creates a not-exists expression', ({ expect }) => {
      const nop = factory.createNop();
      const notExists = factory.createExistenceExpression(true, nop);
      expect(notExists).toMatchObject({
        type: Algebra.Types.EXPRESSION,
        subType: Algebra.ExpressionTypes.EXISTENCE,
        not: true,
      });
    });
  });

  describe('createNamedExpression', () => {
    it('creates a named expression', ({ expect }) => {
      const name = df.namedNode('http://fn');
      const arg = factory.createTermExpression(df.literal('1'));
      const named = factory.createNamedExpression(name, [ arg ]);
      expect(named).toMatchObject({
        type: Algebra.Types.EXPRESSION,
        subType: Algebra.ExpressionTypes.NAMED,
        name,
      });
    });
  });

  describe('createOperatorExpression', () => {
    it('creates an operator expression', ({ expect }) => {
      const arg1 = factory.createTermExpression(df.variable('x'));
      const arg2 = factory.createTermExpression(df.literal('1'));
      const op = factory.createOperatorExpression('+', [ arg1, arg2 ]);
      expect(op).toMatchObject({
        type: Algebra.Types.EXPRESSION,
        subType: Algebra.ExpressionTypes.OPERATOR,
        operator: '+',
      });
    });
  });

  describe('createTermExpression', () => {
    it('creates a term expression for a literal', ({ expect }) => {
      const literal = df.literal('hello');
      const termExpr = factory.createTermExpression(literal);
      expect(termExpr).toMatchObject({
        type: Algebra.Types.EXPRESSION,
        subType: Algebra.ExpressionTypes.TERM,
        term: literal,
      });
    });
  });

  describe('createWildcardExpression', () => {
    it('creates a wildcard expression', ({ expect }) => {
      const wildcard = factory.createWildcardExpression();
      expect(wildcard).toMatchObject({
        type: Algebra.Types.EXPRESSION,
        subType: Algebra.ExpressionTypes.WILDCARD,
        wildcard: { type: 'wildcard' },
      });
    });
  });

  describe('createTerm', () => {
    it('creates a named node from an IRI string', ({ expect }) => {
      const term = factory.createTerm('http://example.org/');
      expect(term.termType).toBe('NamedNode');
      expect(term.value).toBe('http://example.org/');
    });

    it('creates a variable from a ?-prefixed string', ({ expect }) => {
      const term = factory.createTerm('?x');
      expect(term.termType).toBe('Variable');
      expect(term.value).toBe('x');
    });

    it('replaces $ with ? for variable notation', ({ expect }) => {
      const term = factory.createTerm('$myVar');
      expect(term.termType).toBe('Variable');
      expect(term.value).toBe('myVar');
    });
  });

  describe('update operations', () => {
    describe('createCompositeUpdate', () => {
      it('creates a composite update', ({ expect }) => {
        const deleteInsert = factory.createDeleteInsert();
        const composite = factory.createCompositeUpdate([ deleteInsert ]);
        expect(composite).toMatchObject({ type: Algebra.Types.COMPOSITE_UPDATE });
        expect(composite.updates).toHaveLength(1);
      });
    });

    describe('createDeleteInsert', () => {
      it('creates an empty delete-insert', ({ expect }) => {
        const di = factory.createDeleteInsert();
        expect(di).toMatchObject({ type: Algebra.Types.DELETE_INSERT });
        expect(di.delete).toBeUndefined();
        expect(di.insert).toBeUndefined();
        expect(di.where).toBeUndefined();
      });

      it('creates a delete-insert with delete quads', ({ expect }) => {
        const s = df.namedNode('http://s');
        const p = df.namedNode('http://p');
        const o = df.namedNode('http://o');
        const pattern = factory.createPattern(s, p, o);
        const di = factory.createDeleteInsert([ pattern ]);
        expect(di.delete).toHaveLength(1);
      });

      it('creates a delete-insert with all parts', ({ expect }) => {
        const s = df.namedNode('http://s');
        const p = df.namedNode('http://p');
        const o = df.namedNode('http://o');
        const pattern = factory.createPattern(s, p, o);
        const nop = factory.createNop();
        const di = factory.createDeleteInsert([ pattern ], [ pattern ], nop);
        expect(di.delete).toHaveLength(1);
        expect(di.insert).toHaveLength(1);
        expect(di.where).toBe(nop);
      });
    });

    describe('createLoad', () => {
      it('creates a load operation', ({ expect }) => {
        const source = df.namedNode('http://source.org');
        const load = factory.createLoad(source);
        expect(load).toMatchObject({ type: Algebra.Types.LOAD, source });
        expect(load.destination).toBeUndefined();
        expect(load.silent).toBeUndefined();
      });

      it('creates a load operation with destination and silent', ({ expect }) => {
        const source = df.namedNode('http://source.org');
        const dest = df.namedNode('http://dest.org');
        const load = factory.createLoad(source, dest, true);
        expect(load.destination).toBe(dest);
        expect(load.silent).toBe(true);
      });
    });

    describe('createClear', () => {
      it('creates a clear operation on DEFAULT', ({ expect }) => {
        const clear = factory.createClear('DEFAULT');
        expect(clear).toMatchObject({ type: Algebra.Types.CLEAR, source: 'DEFAULT' });
        expect(clear.silent).toBeUndefined();
      });

      it('creates a silent clear operation', ({ expect }) => {
        const clear = factory.createClear('ALL', true);
        expect(clear.silent).toBe(true);
      });
    });

    describe('createCreate', () => {
      it('creates a create operation', ({ expect }) => {
        const source = df.namedNode('http://graph');
        const create = factory.createCreate(source);
        expect(create).toMatchObject({ type: Algebra.Types.CREATE, source });
        expect(create.silent).toBeUndefined();
      });

      it('creates a silent create operation', ({ expect }) => {
        const source = df.namedNode('http://graph');
        const create = factory.createCreate(source, true);
        expect(create.silent).toBe(true);
      });
    });

    describe('createDrop', () => {
      it('creates a drop operation', ({ expect }) => {
        const drop = factory.createDrop('NAMED');
        expect(drop).toMatchObject({ type: Algebra.Types.DROP, source: 'NAMED' });
      });
    });

    describe('createAdd', () => {
      it('creates an add operation', ({ expect }) => {
        const source = df.namedNode('http://src');
        const dest = df.namedNode('http://dst');
        const add = factory.createAdd(source, dest);
        expect(add).toMatchObject({ type: Algebra.Types.ADD, source, destination: dest });
      });

      it('creates a silent add operation', ({ expect }) => {
        const source = df.namedNode('http://src');
        const dest = df.namedNode('http://dst');
        const add = factory.createAdd(source, dest, true);
        expect(add.silent).toBe(true);
      });
    });

    describe('createMove', () => {
      it('creates a move operation', ({ expect }) => {
        const source = df.namedNode('http://src');
        const dest = df.namedNode('http://dst');
        const move = factory.createMove(source, dest);
        expect(move).toMatchObject({ type: Algebra.Types.MOVE, source, destination: dest });
      });

      it('creates a silent move operation', ({ expect }) => {
        const source = df.namedNode('http://src');
        const dest = df.namedNode('http://dst');
        const move = factory.createMove(source, dest, true);
        expect(move.silent).toBe(true);
      });
    });

    describe('createCopy', () => {
      it('creates a copy operation', ({ expect }) => {
        const source = df.namedNode('http://src');
        const dest = df.namedNode('http://dst');
        const copy = factory.createCopy(source, dest);
        expect(copy).toMatchObject({ type: Algebra.Types.COPY, source, destination: dest });
      });

      it('creates a copy from DEFAULT', ({ expect }) => {
        const dest = df.namedNode('http://dst');
        const copy = factory.createCopy('DEFAULT', dest);
        expect(copy).toMatchObject({ type: Algebra.Types.COPY, source: 'DEFAULT', destination: dest });
      });
    });
  });
});
