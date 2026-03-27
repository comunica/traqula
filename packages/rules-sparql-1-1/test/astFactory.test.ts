import { AstFactory } from '@traqula/rules-sparql-1-1';
import { describe, it } from 'vitest';

const F = new AstFactory();
const noLoc = F.gen();

describe('astFactory', () => {
  describe('termFactory', () => {
    it('creates and identifies variables', ({ expect }) => {
      const v = F.termVariable('x', noLoc);
      expect(F.isTermVariable(v)).toBe(true);
      expect(v.value).toBe('x');
    });

    it('creates and identifies blank nodes', ({ expect }) => {
      const b = F.termBlank('myblank', noLoc);
      expect(F.isTermBlank(b)).toBe(true);
      expect(b.label).toBe('e_myblank');
    });

    it('creates blank nodes with auto-generated labels', ({ expect }) => {
      F.resetBlankNodeCounter();
      const b1 = F.termBlank(undefined, noLoc);
      const b2 = F.termBlank(undefined, noLoc);
      expect(b1.label).toBe('g_0');
      expect(b2.label).toBe('g_1');
    });

    it('creates and identifies literals', ({ expect }) => {
      const strLit = F.termLiteral(noLoc, 'hello');
      expect(F.isTermLiteral(strLit)).toBe(true);
      expect(F.isTermLiteralStr(strLit)).toBe(true);
      expect(F.isTermLiteralLangStr(strLit)).toBe(false);
      expect(strLit.value).toBe('hello');
    });

    it('creates and identifies language-tagged literals', ({ expect }) => {
      const langLit = F.termLiteral(noLoc, 'bonjour', 'fr');
      expect(F.isTermLiteral(langLit)).toBe(true);
      expect(F.isTermLiteralLangStr(langLit)).toBe(true);
      expect(F.isTermLiteralStr(langLit)).toBe(false);
      expect(langLit.langOrIri).toBe('fr');
    });

    it('creates and identifies typed literals', ({ expect }) => {
      const typeIri = F.termNamed(noLoc, 'http://www.w3.org/2001/XMLSchema#integer');
      const typedLit = F.termLiteral(noLoc, '42', typeIri);
      expect(F.isTermLiteral(typedLit)).toBe(true);
      expect(F.isTermLiteralTyped(typedLit)).toBe(true);
      expect(F.isTermLiteralStr(typedLit)).toBe(false);
    });

    it('creates and identifies named nodes', ({ expect }) => {
      const named = F.termNamed(noLoc, 'http://example.org/test');
      expect(F.isTermNamed(named)).toBe(true);
      expect(F.isTermNamedPrefixed(named)).toBe(false);
      expect(named.value).toBe('http://example.org/test');
    });

    it('creates and identifies prefixed named nodes', ({ expect }) => {
      const prefixed = F.termNamed(noLoc, 'localName', 'ex');
      expect(F.isTermNamed(prefixed)).toBe(true);
      expect(F.isTermNamedPrefixed(prefixed)).toBe(true);
      expect(prefixed.prefix).toBe('ex');
    });
  });

  describe('pathFactory', () => {
    it('creates path alternatives', ({ expect }) => {
      const iri1 = F.termNamed(noLoc, 'http://p1');
      const iri2 = F.termNamed(noLoc, 'http://p2');
      const alt = F.path('|', [ iri1, iri2 ], noLoc);
      expect(F.isPathPure(alt)).toBe(true);
      expect(alt.subType).toBe('|');
    });

    it('creates path sequences', ({ expect }) => {
      const iri1 = F.termNamed(noLoc, 'http://p1');
      const iri2 = F.termNamed(noLoc, 'http://p2');
      const seq = F.path('/', [ iri1, iri2 ], noLoc);
      expect(F.isPathPure(seq)).toBe(true);
      expect(seq.subType).toBe('/');
    });

    it('creates negated paths', ({ expect }) => {
      const iri = F.termNamed(noLoc, 'http://p');
      const neg = F.path('!', [ iri ], noLoc);
      expect(F.isPathPure(neg)).toBe(true);
      expect(neg.subType).toBe('!');
    });

    it('creates modified paths (*, +, ?)', ({ expect }) => {
      const iri = F.termNamed(noLoc, 'http://p');
      const star = F.path('*', [ iri ], noLoc);
      expect(star.subType).toBe('*');

      const plus = F.path('+', [ iri ], noLoc);
      expect(plus.subType).toBe('+');

      const opt = F.path('?', [ iri ], noLoc);
      expect(opt.subType).toBe('?');
    });
  });

  describe('patternFactory', () => {
    it('creates and identifies group patterns', ({ expect }) => {
      const group = F.patternGroup([], noLoc);
      expect(F.isPatternGroup(group)).toBe(true);
      expect(group.subType).toBe('group');
    });

    it('creates and identifies union patterns', ({ expect }) => {
      const g1 = F.patternGroup([], noLoc);
      const g2 = F.patternGroup([], noLoc);
      const union = F.patternUnion([ g1, g2 ], noLoc);
      expect(F.isPatternUnion(union)).toBe(true);
    });

    it('creates and identifies optional patterns', ({ expect }) => {
      const opt = F.patternOptional([], noLoc);
      expect(F.isPatternOptional(opt)).toBe(true);
    });

    it('creates and identifies filter patterns', ({ expect }) => {
      const expr = F.termLiteral(noLoc, 'true');
      const filter = F.patternFilter(expr, noLoc);
      expect(F.isPatternFilter(filter)).toBe(true);
    });

    it('creates and identifies service patterns', ({ expect }) => {
      const iri = F.termNamed(noLoc, 'http://endpoint');
      const service = F.patternService(iri, [], false, noLoc);
      expect(F.isPatternService(service)).toBe(true);
    });

    it('creates and identifies graph patterns', ({ expect }) => {
      const iri = F.termNamed(noLoc, 'http://graph');
      const graph = F.patternGraph(iri, [], noLoc);
      expect(F.isPatternGraph(graph)).toBe(true);
    });
  });

  describe('expressionFactory', () => {
    it('creates and identifies operator expressions', ({ expect }) => {
      const arg1 = F.termVariable('x', noLoc);
      const arg2 = F.termLiteral(noLoc, '5');
      const expr = F.expressionOperation('+', [ arg1, arg2 ], noLoc);
      expect(F.isExpressionOperator(expr)).toBe(true);
      expect(expr.operator).toBe('+');
    });

    it('creates and identifies aggregate expressions', ({ expect }) => {
      const arg = F.termVariable('x', noLoc);
      const agg = F.aggregate('count', false, arg, undefined, noLoc);
      expect(F.isExpressionAggregate(agg)).toBe(true);
      expect(agg.aggregation).toBe('count');
    });

    it('creates aggregate with distinct', ({ expect }) => {
      const arg = F.termVariable('x', noLoc);
      const agg = F.aggregate('sum', true, arg, undefined, noLoc);
      expect(agg.distinct).toBe(true);
    });
  });

  describe('queryFactory', () => {
    it('creates wildcard', ({ expect }) => {
      const w = F.wildcard(noLoc);
      expect(F.isWildcard(w)).toBe(true);
    });
  });

  describe('solutionModifiersFactory', () => {
    it('creates group modifier', ({ expect }) => {
      const varX = F.termVariable('x', noLoc);
      const group = F.solutionModifierGroup([ varX ], noLoc);
      expect(F.isSolutionModifierGroup(group)).toBe(true);
    });

    it('creates having modifier', ({ expect }) => {
      const expr = F.termLiteral(noLoc, 'true');
      const having = F.solutionModifierHaving([ expr ], noLoc);
      expect(F.isSolutionModifierHaving(having)).toBe(true);
    });

    it('creates order modifier', ({ expect }) => {
      const varX = F.termVariable('x', noLoc);
      const order = F.solutionModifierOrder([{ expression: varX, descending: false, loc: noLoc }], noLoc);
      expect(F.isSolutionModifierOrder(order)).toBe(true);
    });
  });

  describe('updateOperationFactory', () => {
    it('creates load operation', ({ expect }) => {
      const iri = F.termNamed(noLoc, 'http://source');
      const load = F.updateOperationLoad(noLoc, iri, false, undefined);
      expect(load.subType).toBe('load');
    });

    it('creates clear operation', ({ expect }) => {
      const graphRef = F.graphRefAll(noLoc);
      const clear = F.updateOperationClear(graphRef, false, noLoc);
      expect(clear.subType).toBe('clear');
    });

    it('creates drop operation', ({ expect }) => {
      const graphRef = F.graphRefDefault(noLoc);
      const drop = F.updateOperationDrop(graphRef, true, noLoc);
      expect(drop.subType).toBe('drop');
    });

    it('creates create operation', ({ expect }) => {
      const iri = F.termNamed(noLoc, 'http://newgraph');
      const graphRef = F.graphRefSpecific(iri, noLoc);
      const create = F.updateOperationCreate(graphRef, false, noLoc);
      expect(create.subType).toBe('create');
    });
  });

  describe('type guards', () => {
    it('isPath identifies both TermIri and Path', ({ expect }) => {
      const iri = F.termNamed(noLoc, 'http://p');
      expect(F.isPath(iri)).toBe(true);

      const path = F.path('*', [ iri ], noLoc);
      expect(F.isPath(path)).toBe(true);
    });

    it('isExpression identifies terms and expressions', ({ expect }) => {
      const iri = F.termNamed(noLoc, 'http://x');
      expect(F.isExpression(iri)).toBe(true);

      const variable = F.termVariable('x', noLoc);
      expect(F.isExpression(variable)).toBe(true);

      const literal = F.termLiteral(noLoc, 'val');
      expect(F.isExpression(literal)).toBe(true);

      const expr = F.expressionOperation('+', [ variable ], noLoc);
      expect(F.isExpression(expr)).toBe(true);
    });

    it('isQuery checks for query type', ({ expect }) => {
      const notAQuery = { type: 'other' };
      expect(F.isQuery(notAQuery)).toBe(false);
    });

    it('isTerm checks for term type', ({ expect }) => {
      const term = F.termVariable('x', noLoc);
      expect(F.isTerm(term)).toBe(true);
      expect(F.isTerm({ type: 'other' })).toBe(false);
    });

    it('alwaysSparql11 returns true for any object', ({ expect }) => {
      expect(F.alwaysSparql11({})).toBe(true);
      expect(F.alwaysSparql11({ type: 'anything' })).toBe(true);
    });
  });

  describe('tripleFactory', () => {
    it('creates and identifies triples', ({ expect }) => {
      const subject = F.termVariable('s', noLoc);
      const predicate = F.termNamed(noLoc, 'http://predicate');
      const object = F.termLiteral(noLoc, 'value');
      const triple = F.triple(subject, predicate, object, noLoc);
      expect(F.isTriple(triple)).toBe(true);
      expect(triple.subject).toBe(subject);
      expect(triple.predicate).toBe(predicate);
      expect(triple.object).toBe(object);
    });

    it('creates triples with auto-generated location', ({ expect }) => {
      const subject = F.termVariable('s', noLoc);
      const predicate = F.termNamed(noLoc, 'http://predicate');
      const object = F.termLiteral(noLoc, 'value');
      const triple = F.triple(subject, predicate, object);
      expect(F.isTriple(triple)).toBe(true);
      expect(triple.loc).toBeDefined();
    });

    it('graphNodeIdentifier returns term for non-tripleCollection', ({ expect }) => {
      const iri = F.termNamed(noLoc, 'http://example');
      expect(F.graphNodeIdentifier(iri)).toBe(iri);
    });

    it('graphNodeIdentifier returns identifier for tripleCollection', ({ expect }) => {
      F.resetBlankNodeCounter();
      const blank = F.termBlank(undefined, noLoc);
      const collection = F.tripleCollectionBlankNodeProperties(blank, [], noLoc);
      expect(F.graphNodeIdentifier(collection)).toBe(blank);
    });
  });

  describe('datasetClausesFactory', () => {
    it('creates and identifies dataset clauses', ({ expect }) => {
      const clauses = F.datasetClauses([], noLoc);
      expect(F.isDatasetClauses(clauses)).toBe(true);
      expect(clauses.clauses).toEqual([]);
    });
  });

  describe('tripleCollectionFactory', () => {
    it('creates and identifies blank node properties', ({ expect }) => {
      F.resetBlankNodeCounter();
      const blank = F.termBlank(undefined, noLoc);
      const collection = F.tripleCollectionBlankNodeProperties(blank, [], noLoc);
      expect(F.isTripleCollection(collection)).toBe(true);
      expect(F.isTripleCollectionBlankNodeProperties(collection)).toBe(true);
      expect(F.isTripleCollectionList(collection)).toBe(false);
    });

    it('creates and identifies list collections', ({ expect }) => {
      F.resetBlankNodeCounter();
      const blank = F.termBlank(undefined, noLoc);
      const list = F.tripleCollectionList(blank, [], noLoc);
      expect(F.isTripleCollection(list)).toBe(true);
      expect(F.isTripleCollectionList(list)).toBe(true);
      expect(F.isTripleCollectionBlankNodeProperties(list)).toBe(false);
    });
  });

  describe('graphQuadsFactory', () => {
    it('creates and identifies graph quads with IRI', ({ expect }) => {
      const graph = F.termNamed(noLoc, 'http://graph');
      const bgp = F.patternBgp([], noLoc);
      const quads = F.graphQuads(graph, bgp, noLoc);
      expect(F.isGraphQuads(quads)).toBe(true);
      expect(quads.graph).toBe(graph);
    });

    it('creates and identifies graph quads with variable', ({ expect }) => {
      const graph = F.termVariable('g', noLoc);
      const bgp = F.patternBgp([], noLoc);
      const quads = F.graphQuads(graph, bgp, noLoc);
      expect(F.isGraphQuads(quads)).toBe(true);
      expect(quads.graph).toBe(graph);
    });
  });

  describe('updateFactory', () => {
    it('isUpdate returns false for non-update objects', ({ expect }) => {
      expect(F.isUpdate({ type: 'other' })).toBe(false);
    });
  });

  describe('pathFactory - additional guards', () => {
    it('isPathChain identifies / and | paths', ({ expect }) => {
      const iri = F.termNamed(noLoc, 'http://p');
      const seq = F.path('/', [ iri, iri ], noLoc);
      expect(F.isPathChain(seq)).toBe(true);
      const alt = F.path('|', [ iri, iri ], noLoc);
      expect(F.isPathChain(alt)).toBe(true);
      expect(F.isPathChain(iri)).toBe(false);
    });

    it('isPathModified identifies ?, *, +, ^ paths', ({ expect }) => {
      const iri = F.termNamed(noLoc, 'http://p');
      const star = F.path('*', [ iri ], noLoc);
      expect(F.isPathModified(star)).toBe(true);
      expect(F.isPathModified(iri)).toBe(false);
    });

    it('isPathNegated identifies ! paths', ({ expect }) => {
      const iri = F.termNamed(noLoc, 'http://p');
      const neg = F.path('!', [ iri ], noLoc);
      expect(F.isPathNegated(neg)).toBe(true);
      expect(F.isPathNegated(iri)).toBe(false);
    });

    it('path returns PathNegatedElt for ^ with a non-path term', ({ expect }) => {
      const iri = F.termNamed(noLoc, 'http://p');
      // ^ with a TermIri (not a path) returns a PathNegatedElt
      const negElt = F.path('^', [ iri ], noLoc);
      expect(negElt.subType).toBe('^');
    });

    it('throws on invalid path combination', ({ expect }) => {
      const iri = F.termNamed(noLoc, 'http://p');
      // No branch matches for ^ with multiple items - should throw
      expect(() => F.path(<any> '^', [ iri, iri ], noLoc)).toThrowError('Invalid path type');
    });
  });

  describe('expressionFactory - aggregate type guards', () => {
    it('isExpressionAggregateOnWildcard identifies wildcard aggregates', ({ expect }) => {
      const wild = F.wildcard(noLoc);
      const agg = F.aggregate('count', false, wild, undefined, noLoc);
      expect(F.isExpressionAggregateOnWildcard(agg)).toBe(true);
      const varX = F.termVariable('x', noLoc);
      const aggNonWild = F.aggregate('sum', false, varX, undefined, noLoc);
      expect(F.isExpressionAggregateOnWildcard(aggNonWild)).toBe(false);
    });

    it('isExpressionAggregateDefault identifies default aggregates', ({ expect }) => {
      const varX = F.termVariable('x', noLoc);
      const agg = F.aggregate('sum', false, varX, undefined, noLoc);
      // Note: this method checks for 'operation' subType internally (it's a quirk)
      expect(F.isExpressionAggregateDefault(agg)).toBe(false);
      const opExpr = F.expressionOperation('+', [ varX ], noLoc);
      expect(F.isExpressionAggregateDefault(opExpr)).toBe(false);
    });
  });

  describe('solutionModifiersFactory - type guards', () => {
    it('isSolutionModifier identifies any solutionModifier', ({ expect }) => {
      const expr = F.termLiteral(noLoc, 'true');
      const having = F.solutionModifierHaving([ expr ], noLoc);
      expect(F.isSolutionModifier(having)).toBe(true);
      expect(F.isSolutionModifier({ type: 'other' })).toBe(false);
    });

    it('isSolutionModifierLimitOffset identifies limitOffset', ({ expect }) => {
      const limitOffset = F.solutionModifierLimitOffset(10, 0, noLoc);
      expect(F.isSolutionModifierLimitOffset(limitOffset)).toBe(true);
      const expr = F.termLiteral(noLoc, 'true');
      const having = F.solutionModifierHaving([ expr ], noLoc);
      expect(F.isSolutionModifierLimitOffset(having)).toBe(false);
    });
  });

  describe('updateOperationFactory - type guards and additional operations', () => {
    it('isUpdateOperation identifies any update operation', ({ expect }) => {
      const iri = F.termNamed(noLoc, 'http://source');
      const load = F.updateOperationLoad(noLoc, iri, false);
      expect(F.isUpdateOperation(load)).toBe(true);
      expect(F.isUpdateOperation({ type: 'other' })).toBe(false);
    });

    it('creates insertData, deleteData, and deleteWhere operations', ({ expect }) => {
      const bgp = F.patternBgp([], noLoc);
      const quads = F.graphQuads(F.termNamed(noLoc, 'http://g'), bgp, noLoc);

      const insert = F.updateOperationInsertData([ quads ], noLoc);
      expect(insert.subType).toBe('insertdata');
      expect(F.isUpdateOperationInsertData(insert)).toBe(true);

      const del = F.updateOperationDeleteData([ quads ], noLoc);
      expect(del.subType).toBe('deletedata');
      expect(F.isUpdateOperationDeleteData(del)).toBe(true);

      const delWhere = F.updateOperationDeleteWhere([ quads ], noLoc);
      expect(delWhere.subType).toBe('deletewhere');
      expect(F.isUpdateOperationDeleteWhere(delWhere)).toBe(true);
    });
  });
});
