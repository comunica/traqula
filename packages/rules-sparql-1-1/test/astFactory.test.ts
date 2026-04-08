import { describe, it } from 'vitest';
import { AstFactory } from '../lib/index.js';

const F = new AstFactory();
const genLoc = F.gen();

describe('astFactory', () => {
  describe('termFactory', () => {
    it('creates and identifies variables', ({ expect }) => {
      const v = F.termVariable('x', genLoc);
      expect(F.isTermVariable(v)).toBe(true);
      expect(v.value).toBe('x');
    });

    it('creates and identifies blank nodes', ({ expect }) => {
      const b = F.termBlank('myblank', genLoc);
      expect(F.isTermBlank(b)).toBe(true);
      expect(b.label).toBe('e_myblank');
    });

    it('creates blank nodes with auto-generated labels', ({ expect }) => {
      F.resetBlankNodeCounter();
      const b1 = F.termBlank(undefined, genLoc);
      const b2 = F.termBlank(undefined, genLoc);
      expect(b1.label).toBe('g_0');
      expect(b2.label).toBe('g_1');
    });

    it('creates and identifies literals', ({ expect }) => {
      const strLit = F.termLiteral(genLoc, 'hello');
      expect(F.isTermLiteral(strLit)).toBe(true);
      expect(F.isTermLiteralStr(strLit)).toBe(true);
      expect(F.isTermLiteralLangStr(strLit)).toBe(false);
      expect(strLit.value).toBe('hello');
    });

    it('creates and identifies language-tagged literals', ({ expect }) => {
      const langLit = F.termLiteral(genLoc, 'bonjour', 'fr');
      expect(F.isTermLiteral(langLit)).toBe(true);
      expect(F.isTermLiteralLangStr(langLit)).toBe(true);
      expect(F.isTermLiteralStr(langLit)).toBe(false);
      expect(langLit.langOrIri).toBe('fr');
    });

    it('creates and identifies typed literals', ({ expect }) => {
      const typeIri = F.termNamed(genLoc, 'http://www.w3.org/2001/XMLSchema#integer');
      const typedLit = F.termLiteral(genLoc, '42', typeIri);
      expect(F.isTermLiteral(typedLit)).toBe(true);
      expect(F.isTermLiteralTyped(typedLit)).toBe(true);
      expect(F.isTermLiteralStr(typedLit)).toBe(false);
    });

    it('creates and identifies named nodes', ({ expect }) => {
      const named = F.termNamed(genLoc, 'http://example.org/test');
      expect(F.isTermNamed(named)).toBe(true);
      expect(F.isTermNamedPrefixed(named)).toBe(false);
      expect(named.value).toBe('http://example.org/test');
    });

    it('creates and identifies prefixed named nodes', ({ expect }) => {
      const prefixed = F.termNamed(genLoc, 'localName', 'ex');
      expect(F.isTermNamed(prefixed)).toBe(true);
      expect(F.isTermNamedPrefixed(prefixed)).toBe(true);
      expect(prefixed.prefix).toBe('ex');
    });
  });

  describe('pathFactory', () => {
    it('creates path alternatives', ({ expect }) => {
      const iri1 = F.termNamed(genLoc, 'http://p1');
      const iri2 = F.termNamed(genLoc, 'http://p2');
      const alt = F.path('|', [ iri1, iri2 ], genLoc);
      expect(F.isPathPure(alt)).toBe(true);
      expect(alt.subType).toBe('|');
    });

    it('creates path sequences', ({ expect }) => {
      const iri1 = F.termNamed(genLoc, 'http://p1');
      const iri2 = F.termNamed(genLoc, 'http://p2');
      const seq = F.path('/', [ iri1, iri2 ], genLoc);
      expect(F.isPathPure(seq)).toBe(true);
      expect(seq.subType).toBe('/');
    });

    it('creates negated paths', ({ expect }) => {
      const iri = F.termNamed(genLoc, 'http://p');
      const neg = F.path('!', [ iri ], genLoc);
      expect(F.isPathPure(neg)).toBe(true);
      expect(neg.subType).toBe('!');
    });

    it('creates modified paths (*, +, ?)', ({ expect }) => {
      const iri = F.termNamed(genLoc, 'http://p');
      const star = F.path('*', [ iri ], genLoc);
      expect(star.subType).toBe('*');

      const plus = F.path('+', [ iri ], genLoc);
      expect(plus.subType).toBe('+');

      const opt = F.path('?', [ iri ], genLoc);
      expect(opt.subType).toBe('?');
    });
  });

  describe('patternFactory', () => {
    it('creates and identifies group patterns', ({ expect }) => {
      const group = F.patternGroup([], genLoc);
      expect(F.isPatternGroup(group)).toBe(true);
      expect(group.subType).toBe('group');
    });

    it('creates and identifies union patterns', ({ expect }) => {
      const g1 = F.patternGroup([], genLoc);
      const g2 = F.patternGroup([], genLoc);
      const union = F.patternUnion([ g1, g2 ], genLoc);
      expect(F.isPatternUnion(union)).toBe(true);
    });

    it('creates and identifies optional patterns', ({ expect }) => {
      const opt = F.patternOptional([], genLoc);
      expect(F.isPatternOptional(opt)).toBe(true);
    });

    it('creates and identifies filter patterns', ({ expect }) => {
      const expr = F.termLiteral(genLoc, 'true');
      const filter = F.patternFilter(expr, genLoc);
      expect(F.isPatternFilter(filter)).toBe(true);
    });

    it('creates and identifies service patterns', ({ expect }) => {
      const iri = F.termNamed(genLoc, 'http://endpoint');
      const service = F.patternService(iri, [], false, genLoc);
      expect(F.isPatternService(service)).toBe(true);
    });

    it('creates and identifies graph patterns', ({ expect }) => {
      const iri = F.termNamed(genLoc, 'http://graph');
      const graph = F.patternGraph(iri, [], genLoc);
      expect(F.isPatternGraph(graph)).toBe(true);
    });
  });

  describe('expressionFactory', () => {
    it('creates and identifies operator expressions', ({ expect }) => {
      const arg1 = F.termVariable('x', genLoc);
      const arg2 = F.termLiteral(genLoc, '5');
      const expr = F.expressionOperation('+', [ arg1, arg2 ], genLoc);
      expect(F.isExpressionOperator(expr)).toBe(true);
      expect(expr.operator).toBe('+');
    });

    it('creates and identifies aggregate expressions', ({ expect }) => {
      const arg = F.termVariable('x', genLoc);
      const agg = F.aggregate('count', false, arg, undefined, genLoc);
      expect(F.isExpressionAggregate(agg)).toBe(true);
      expect(agg.aggregation).toBe('count');
    });

    it('creates aggregate with distinct', ({ expect }) => {
      const arg = F.termVariable('x', genLoc);
      const agg = F.aggregate('sum', true, arg, undefined, genLoc);
      expect(agg.distinct).toBe(true);
    });
  });

  describe('queryFactory', () => {
    it('creates wildcard', ({ expect }) => {
      const w = F.wildcard(genLoc);
      expect(F.isWildcard(w)).toBe(true);
    });
  });

  describe('solutionModifiersFactory', () => {
    it('creates group modifier', ({ expect }) => {
      const varX = F.termVariable('x', genLoc);
      const group = F.solutionModifierGroup([ varX ], genLoc);
      expect(F.isSolutionModifierGroup(group)).toBe(true);
    });

    it('creates having modifier', ({ expect }) => {
      const expr = F.termLiteral(genLoc, 'true');
      const having = F.solutionModifierHaving([ expr ], genLoc);
      expect(F.isSolutionModifierHaving(having)).toBe(true);
    });

    it('creates order modifier', ({ expect }) => {
      const varX = F.termVariable('x', genLoc);
      const order = F.solutionModifierOrder([{ expression: varX, descending: false, loc: genLoc }], genLoc);
      expect(F.isSolutionModifierOrder(order)).toBe(true);
    });
  });

  describe('updateOperationFactory', () => {
    it('creates load operation', ({ expect }) => {
      const iri = F.termNamed(genLoc, 'http://source');
      const load = F.updateOperationLoad(genLoc, iri, false, undefined);
      expect(load.subType).toBe('load');
    });

    it('creates clear operation', ({ expect }) => {
      const graphRef = F.graphRefAll(genLoc);
      const clear = F.updateOperationClear(graphRef, false, genLoc);
      expect(clear.subType).toBe('clear');
    });

    it('creates drop operation', ({ expect }) => {
      const graphRef = F.graphRefDefault(genLoc);
      const drop = F.updateOperationDrop(graphRef, true, genLoc);
      expect(drop.subType).toBe('drop');
    });

    it('creates create operation', ({ expect }) => {
      const iri = F.termNamed(genLoc, 'http://newgraph');
      const graphRef = F.graphRefSpecific(iri, genLoc);
      const create = F.updateOperationCreate(graphRef, false, genLoc);
      expect(create.subType).toBe('create');
    });
  });

  describe('type guards', () => {
    it('isPath identifies both TermIri and Path', ({ expect }) => {
      const iri = F.termNamed(genLoc, 'http://p');
      expect(F.isPath(iri)).toBe(true);

      const path = F.path('*', [ iri ], genLoc);
      expect(F.isPath(path)).toBe(true);
    });

    it('isExpression identifies terms and expressions', ({ expect }) => {
      const iri = F.termNamed(genLoc, 'http://x');
      expect(F.isExpression(iri)).toBe(true);

      const variable = F.termVariable('x', genLoc);
      expect(F.isExpression(variable)).toBe(true);

      const literal = F.termLiteral(genLoc, 'val');
      expect(F.isExpression(literal)).toBe(true);

      const expr = F.expressionOperation('+', [ variable ], genLoc);
      expect(F.isExpression(expr)).toBe(true);
    });

    it('isQuery checks for query type', ({ expect }) => {
      const notAQuery = { type: 'other' };
      expect(F.isQuery(notAQuery)).toBe(false);
    });

    it('isTerm checks for term type', ({ expect }) => {
      const term = F.termVariable('x', genLoc);
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
      const subject = F.termVariable('s', genLoc);
      const predicate = F.termNamed(genLoc, 'http://predicate');
      const object = F.termLiteral(genLoc, 'value');
      const triple = F.triple(subject, predicate, object, genLoc);
      expect(F.isTriple(triple)).toBe(true);
      expect(triple.subject).toBe(subject);
      expect(triple.predicate).toBe(predicate);
      expect(triple.object).toBe(object);
    });

    it('creates triples with auto-generated location', ({ expect }) => {
      const subject = F.termVariable('s', genLoc);
      const predicate = F.termNamed(genLoc, 'http://predicate');
      const object = F.termLiteral(genLoc, 'value');
      const triple = F.triple(subject, predicate, object);
      expect(F.isTriple(triple)).toBe(true);
      expect(triple.loc).toBeDefined();
    });

    it('graphNodeIdentifier returns term for non-tripleCollection', ({ expect }) => {
      const iri = F.termNamed(genLoc, 'http://example');
      expect(F.graphNodeIdentifier(iri)).toBe(iri);
    });

    it('graphNodeIdentifier returns identifier for tripleCollection', ({ expect }) => {
      F.resetBlankNodeCounter();
      const blank = F.termBlank(undefined, genLoc);
      const collection = F.tripleCollectionBlankNodeProperties(blank, [], genLoc);
      expect(F.graphNodeIdentifier(collection)).toBe(blank);
    });
  });

  describe('datasetClausesFactory', () => {
    it('creates and identifies dataset clauses', ({ expect }) => {
      const clauses = F.datasetClauses([], genLoc);
      expect(F.isDatasetClauses(clauses)).toBe(true);
      expect(clauses.clauses).toEqual([]);
    });
  });

  describe('tripleCollectionFactory', () => {
    it('creates and identifies blank node properties', ({ expect }) => {
      F.resetBlankNodeCounter();
      const blank = F.termBlank(undefined, genLoc);
      const collection = F.tripleCollectionBlankNodeProperties(blank, [], genLoc);
      expect(F.isTripleCollection(collection)).toBe(true);
      expect(F.isTripleCollectionBlankNodeProperties(collection)).toBe(true);
      expect(F.isTripleCollectionList(collection)).toBe(false);
    });

    it('creates and identifies list collections', ({ expect }) => {
      F.resetBlankNodeCounter();
      const blank = F.termBlank(undefined, genLoc);
      const list = F.tripleCollectionList(blank, [], genLoc);
      expect(F.isTripleCollection(list)).toBe(true);
      expect(F.isTripleCollectionList(list)).toBe(true);
      expect(F.isTripleCollectionBlankNodeProperties(list)).toBe(false);
    });
  });

  describe('graphQuadsFactory', () => {
    it('creates and identifies graph quads with IRI', ({ expect }) => {
      const graph = F.termNamed(genLoc, 'http://graph');
      const bgp = F.patternBgp([], genLoc);
      const quads = F.graphQuads(graph, bgp, genLoc);
      expect(F.isGraphQuads(quads)).toBe(true);
      expect(quads.graph).toBe(graph);
    });

    it('creates and identifies graph quads with variable', ({ expect }) => {
      const graph = F.termVariable('g', genLoc);
      const bgp = F.patternBgp([], genLoc);
      const quads = F.graphQuads(graph, bgp, genLoc);
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
      const iri = F.termNamed(genLoc, 'http://p');
      const seq = F.path('/', [ iri, iri ], genLoc);
      expect(F.isPathChain(seq)).toBe(true);
      const alt = F.path('|', [ iri, iri ], genLoc);
      expect(F.isPathChain(alt)).toBe(true);
      expect(F.isPathChain(iri)).toBe(false);
    });

    it('isPathModified identifies ?, *, +, ^ paths', ({ expect }) => {
      const iri = F.termNamed(genLoc, 'http://p');
      const star = F.path('*', [ iri ], genLoc);
      expect(F.isPathModified(star)).toBe(true);
      expect(F.isPathModified(iri)).toBe(false);
    });

    it('isPathNegated identifies ! paths', ({ expect }) => {
      const iri = F.termNamed(genLoc, 'http://p');
      const neg = F.path('!', [ iri ], genLoc);
      expect(F.isPathNegated(neg)).toBe(true);
      expect(F.isPathNegated(iri)).toBe(false);
    });

    it('path returns PathNegatedElt for ^ with a non-path term', ({ expect }) => {
      const iri = F.termNamed(genLoc, 'http://p');
      // ^ with a TermIri (not a path) returns a PathNegatedElt
      const negElt = F.path('^', [ iri ], genLoc);
      expect(negElt.subType).toBe('^');
    });

    it('throws on invalid path combination', ({ expect }) => {
      const iri = F.termNamed(genLoc, 'http://p');
      // No branch matches for ^ with multiple items - should throw
      expect(() => F.path(<any> '^', [ iri, iri ], genLoc)).toThrowError('Invalid path type');
    });
  });

  describe('expressionFactory - aggregate type guards', () => {
    it('isExpressionAggregateOnWildcard identifies wildcard aggregates', ({ expect }) => {
      const wild = F.wildcard(genLoc);
      const agg = F.aggregate('count', false, wild, undefined, genLoc);
      expect(F.isExpressionAggregateOnWildcard(agg)).toBe(true);
      const varX = F.termVariable('x', genLoc);
      const aggNonWild = F.aggregate('sum', false, varX, undefined, genLoc);
      expect(F.isExpressionAggregateOnWildcard(aggNonWild)).toBe(false);
    });

    it('isExpressionAggregateDefault identifies default aggregates', ({ expect }) => {
      const varX = F.termVariable('x', genLoc);
      const agg = F.aggregate('sum', false, varX, undefined, genLoc);
      // Note: this method checks for 'operation' subType internally (it's a quirk)
      expect(F.isExpressionAggregateDefault(agg)).toBe(false);
      const opExpr = F.expressionOperation('+', [ varX ], genLoc);
      expect(F.isExpressionAggregateDefault(opExpr)).toBe(false);
    });

    it('isExpressionAggregateDefault returns false when expression[0] is a wildcard', ({ expect }) => {
      const wildcard = F.wildcard(genLoc);
      const fakeOpWithWildcard = {
        type: 'expression',
        subType: 'operation',
        expression: [ wildcard ],
      };
      expect(F.isExpressionAggregateDefault(<any>fakeOpWithWildcard)).toBe(false);
    });
  });

  describe('pathFactory - PathNegatedElt creation', () => {
    it('creates PathNegatedElt when subType is ^ with a non-pure path item (TermIri)', ({ expect }) => {
      const iri = F.termNamed(genLoc, 'http://example.org/p');
      const result = F.path('^', [ iri ], genLoc);
      expect(result).toBeDefined();
      expect(result.subType).toBe('^');
    });

    it('isPathNegatedElt returns true for a PathNegatedElt', ({ expect }) => {
      const iri = F.termNamed(genLoc, 'http://example.org/p');
      const negElt = F.path('^', [ iri ], genLoc);
      expect(F.isPathNegatedElt(negElt)).toBe(true);
    });
  });

  describe('solutionModifiersFactory - type guards', () => {
    it('isSolutionModifier identifies any solutionModifier', ({ expect }) => {
      const expr = F.termLiteral(genLoc, 'true');
      const having = F.solutionModifierHaving([ expr ], genLoc);
      expect(F.isSolutionModifier(having)).toBe(true);
      expect(F.isSolutionModifier({ type: 'other' })).toBe(false);
    });

    it('isSolutionModifierLimitOffset identifies limitOffset', ({ expect }) => {
      const limitOffset = F.solutionModifierLimitOffset(10, 0, genLoc);
      expect(F.isSolutionModifierLimitOffset(limitOffset)).toBe(true);
      const expr = F.termLiteral(genLoc, 'true');
      const having = F.solutionModifierHaving([ expr ], genLoc);
      expect(F.isSolutionModifierLimitOffset(having)).toBe(false);
    });
  });

  describe('updateOperationFactory - type guards and additional operations', () => {
    it('isUpdateOperation identifies any update operation', ({ expect }) => {
      const iri = F.termNamed(genLoc, 'http://source');
      const load = F.updateOperationLoad(genLoc, iri, false);
      expect(F.isUpdateOperation(load)).toBe(true);
      expect(F.isUpdateOperation({ type: 'other' })).toBe(false);
    });

    it('creates insertData, deleteData, and deleteWhere operations', ({ expect }) => {
      const bgp = F.patternBgp([], genLoc);
      const quads = F.graphQuads(F.termNamed(genLoc, 'http://g'), bgp, genLoc);

      const insert = F.updateOperationInsertData([ quads ], genLoc);
      expect(insert.subType).toBe('insertdata');
      expect(F.isUpdateOperationInsertData(insert)).toBe(true);

      const del = F.updateOperationDeleteData([ quads ], genLoc);
      expect(del.subType).toBe('deletedata');
      expect(F.isUpdateOperationDeleteData(del)).toBe(true);

      const delWhere = F.updateOperationDeleteWhere([ quads ], genLoc);
      expect(delWhere.subType).toBe('deletewhere');
      expect(F.isUpdateOperationDeleteWhere(delWhere)).toBe(true);
    });

    it('creates modify operation with undefined insert and delete', ({ expect }) => {
      const where = F.patternGroup([], genLoc);
      const datasets = F.datasetClauses([], genLoc);
      const modify = F.updateOperationModify(genLoc, undefined, undefined, where, datasets);
      expect(modify.subType).toBe('modify');
      expect(modify.insert).toEqual([]);
      expect(modify.delete).toEqual([]);
      expect(F.isUpdateOperationModify(modify)).toBe(true);
    });
  });

  describe('graphRefFactory - type guards', () => {
    it('isGraphRef identifies any graphRef', ({ expect }) => {
      const graphRef = F.graphRefDefault(genLoc);
      expect(F.isGraphRef(graphRef)).toBe(true);
      expect(F.isGraphRef({ type: 'other' })).toBe(false);
    });
  });
});
