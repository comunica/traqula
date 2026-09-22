import { AstFactory } from '@traqula/rules-sparql-1-1';
import type {
  PatternGroup,
  PatternValues,
  Query,
  QueryAsk,
  QueryConstruct,
  QueryDescribe,
  QuerySelect,
  Term,
  Update,
} from '@traqula/rules-sparql-1-1';
import { Parser as SparqlJsParser } from 'sparqljs';
import type * as SparqlJs from 'sparqljs';
import { describe, it } from 'vitest';
import {
  askQueryFromSparqlJs,
  collapseIrisToPrefixed,
  constructQueryFromSparqlJs,
  describeQueryFromSparqlJs,
  expressionFromSparqlJs,
  graphOrDefaultToGraphRef,
  graphReferenceToGraphRef,
  pathFromSparqlJs,
  patternFromSparqlJs,
  queryFromSparqlJs,
  selectQueryFromSparqlJs,
  sparqlQueryFromSparqlJs,
  termFromSparqlJs,
  tripleFromSparqlJs,
  updateFromSparqlJs,
  updateOperationFromSparqlJs,
} from '../lib/index.js';

const F = new AstFactory();
const sparqlJsParser = new SparqlJsParser();
const sparqlStarParser = new SparqlJsParser({ sparqlStar: true });

function parseRaw(query: string): SparqlJs.SparqlQuery {
  return sparqlJsParser.parse(query);
}

function parseRawSelect(query: string): SparqlJs.SelectQuery {
  return <SparqlJs.SelectQuery> parseRaw(query);
}

function parseSelect(query: string): QuerySelect {
  return <QuerySelect> sparqlQueryFromSparqlJs(parseRaw(query));
}

function parseQuery(query: string): Query {
  return <Query> sparqlQueryFromSparqlJs(parseRaw(query));
}

function parseUpdate(query: string): Update {
  return <Update> sparqlQueryFromSparqlJs(parseRaw(query));
}

function firstRawBgp(patterns: SparqlJs.Pattern[]): SparqlJs.BgpPattern {
  return <SparqlJs.BgpPattern> patterns[0];
}

function firstTriplePredicate(bgpTriples: PatternGroup['patterns'][number]): unknown {
  if (!F.isPatternBgp(bgpTriples)) {
    throw new Error('expected bgp');
  }
  const [ triple ] = bgpTriples.triples;
  if (!F.isTriple(triple)) {
    throw new Error('expected a plain triple, not a TripleCollection');
  }
  return triple.predicate;
}

describe('fromSparqlJs', () => {
  describe('termFromSparqlJs', () => {
    it('converts a full IRI', ({ expect }) => {
      const bgp = firstRawBgp(parseRawSelect('SELECT * WHERE { <http://example.com/a> ?p ?o }').where!);
      const term = termFromSparqlJs(bgp.triples[0].subject);
      expect(F.isTermNamed(term)).toBe(true);
      expect((<{ value: string }> term).value).toBe('http://example.com/a');
    });

    it('resolves prefixed names to a full IRI (prefix information is not recoverable)', ({ expect }) => {
      const bgp = firstRawBgp(parseRawSelect('PREFIX ex: <http://example.com/> SELECT * WHERE { ex:a ?p ?o }').where!);
      const term = termFromSparqlJs(bgp.triples[0].subject);
      expect(F.isTermNamed(term)).toBe(true);
      expect(F.isTermNamedPrefixed(term)).toBe(false);
      expect((<{ value: string }> term).value).toBe('http://example.com/a');
    });

    it('defaults plain literals to no langOrIri, and marks non-xsd:string datatypes', ({ expect }) => {
      const bgp = firstRawBgp(parseRawSelect('SELECT * WHERE { ?s ?p "hi", "hi"@en, 5 }').where!);
      const [ plain, lang, typed ]: Term[] = bgp.triples.map(triple => termFromSparqlJs(triple.object));
      expect(F.isTermLiteralStr(plain)).toBe(true);
      expect(F.isTermLiteralLangStr(lang)).toBe(true);
      expect((<{ langOrIri: string }> lang).langOrIri).toBe('en');
      expect(F.isTermLiteralTyped(typed)).toBe(true);
    });

    it('prefixes blank node labels with e_ so they always round trip as _:label', ({ expect }) => {
      const bgp = firstRawBgp(parseRawSelect('SELECT * WHERE { _:b0 ?p ?o }').where!);
      const term = termFromSparqlJs(bgp.triples[0].subject);
      expect(F.isTermBlank(term)).toBe(true);
      expect((<{ label: string }> term).label).toBe('e_b0');
    });

    it('does not double up sparqljs\' own e_/g_ prefix for anonymous blank nodes either', ({ expect }) => {
      const bgp = firstRawBgp(parseRawSelect('SELECT * WHERE { [] ?p ?o }').where!);
      const term = termFromSparqlJs(bgp.triples[0].subject);
      expect((<{ label: string }> term).label).toBe('e_0');
    });

    describe('infers termType when it is missing (e.g. lost to a non-enumerable getter, see file header)', () => {
      it('infers a NamedNode from an absolute-IRI-looking value', ({ expect }) => {
        const term = termFromSparqlJs(<SparqlJs.IriTerm> { value: 'http://example.com/a' });
        expect(F.isTermNamed(term)).toBe(true);
      });

      it('infers a Variable from a plain identifier value', ({ expect }) => {
        const term = termFromSparqlJs(<SparqlJs.VariableTerm> { value: 'larvae_subject' });
        expect(F.isTermVariable(term)).toBe(true);
        expect((<{ value: string }> term).value).toBe('larvae_subject');
      });

      it('infers a Literal from the presence of datatype/language keys', ({ expect }) => {
        const plain = termFromSparqlJs(<SparqlJs.LiteralTerm> {
          value: 'en',
          language: '',
          datatype: <SparqlJs.IriTerm> { value: 'http://www.w3.org/2001/XMLSchema#string' },
        });
        const withLang = termFromSparqlJs(<SparqlJs.LiteralTerm> { value: 'hi', language: 'en' });
        expect(F.isTermLiteralStr(plain)).toBe(true);
        expect(F.isTermLiteralLangStr(withLang)).toBe(true);
      });

      it('infers a BlankNode from sparqljs\' own e_/g_ value prefix', ({ expect }) => {
        const term = termFromSparqlJs(<SparqlJs.BlankTerm> { value: 'e_myLabel' });
        expect(F.isTermBlank(term)).toBe(true);
        expect((<{ label: string }> term).label).toBe('e_myLabel');
      });

      it('still throws on a quoted-triple-shaped (subject/predicate/object) value', ({ expect }) => {
        const quad = <SparqlJs.QuadTerm> {
          subject: <SparqlJs.VariableTerm> { value: 's' },
          predicate: <SparqlJs.VariableTerm> { value: 'p' },
          object: <SparqlJs.VariableTerm> { value: 'o' },
        };
        expect(() => termFromSparqlJs(quad)).toThrow(/SPARQL-star/u);
      });

      it('recognizes a termType-less quoted triple reached via an expression position too', ({ expect }) => {
        const quad = <SparqlJs.QuadTerm> {
          subject: <SparqlJs.VariableTerm> { value: 's' },
          predicate: <SparqlJs.VariableTerm> { value: 'p' },
          object: <SparqlJs.VariableTerm> { value: 'o' },
        };
        expect(() => expressionFromSparqlJs(quad)).toThrow(/SPARQL-star/u);
      });

      it('falls back to Variable when even the value key is missing entirely', ({ expect }) => {
        const term = termFromSparqlJs(<SparqlJs.VariableTerm> {});
        expect(F.isTermVariable(term)).toBe(true);
      });

      it('converts a whole fragment built from termType-less terms (a real degraded-rdfjs shape)', ({ expect }) => {
        const fragment: SparqlJs.Pattern = {
          type: 'bgp',
          triples: [{
            subject: <SparqlJs.VariableTerm> { value: 'larvae_subject' },
            predicate: <SparqlJs.IriTerm> { value: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' },
            object: <SparqlJs.VariableTerm> { value: 'larvae_subject_type' },
          }],
        };
        const converted = patternFromSparqlJs(fragment);
        expect(F.isPatternBgp(converted)).toBe(true);
      });

      it('does not mistake a termType-less {expression, variable} alias wrapper for a term', ({ expect }) => {
        const raw = <SparqlJs.SelectQuery> {
          type: 'query',
          queryType: 'SELECT',
          prefixes: {},
          variables: [{
            expression: <SparqlJs.VariableTerm> { value: 's' },
            variable: <SparqlJs.VariableTerm> { value: 'alias' },
          }],
          where: [{
            type: 'bgp',
            triples: [{
              subject: <SparqlJs.VariableTerm> { value: 's' },
              predicate: <SparqlJs.VariableTerm> { value: 'p' },
              object: <SparqlJs.VariableTerm> { value: 'o' },
            }],
          }],
        };
        const q = selectQueryFromSparqlJs(raw);
        expect(F.isPatternBind(q.variables[0])).toBe(true);
      });

      it('does not mistake a Wildcard variable-selector with no termType for a plain term', ({ expect }) => {
        const raw = <SparqlJs.SelectQuery> {
          type: 'query',
          queryType: 'SELECT',
          prefixes: {},
          variables: [ <SparqlJs.Wildcard> { value: '*' } ],
          where: [],
        };
        const q = selectQueryFromSparqlJs(raw);
        expect(F.isWildcard(q.variables[0])).toBe(true);
      });
    });

    it('throws on RDF-star / SPARQL-star quoted triples', ({ expect }) => {
      const ast = <SparqlJs.SelectQuery> sparqlStarParser.parse('SELECT * WHERE { << ?s ?p ?o >> ?p2 ?o2 }');
      const bgp = firstRawBgp(ast.where!);
      expect(() => termFromSparqlJs(bgp.triples[0].subject)).toThrow(/SPARQL-star/u);
    });
  });

  describe('pathFromSparqlJs (via property paths in triples)', () => {
    it('is usable directly on a plain IRI predicate too', ({ expect }) => {
      const bgp = firstRawBgp(parseRawSelect('SELECT * WHERE { ?s <http://example.com/p> ?o }').where!);
      const path = pathFromSparqlJs(<SparqlJs.IriTerm> bgp.triples[0].predicate);
      expect(F.isTermNamed(path)).toBe(true);
    });

    it('converts a sequence path', ({ expect }) => {
      const q = parseSelect('PREFIX ex: <http://example.com/> SELECT * WHERE { ?s ex:p1/ex:p2 ?o }');
      expect(F.isPatternBgp(q.where.patterns[0])).toBe(true);
    });

    it('converts an alternative path', ({ expect }) => {
      const q = parseSelect('PREFIX ex: <http://example.com/> SELECT * WHERE { ?s ex:p1|ex:p2 ?o }');
      const predicate = firstTriplePredicate(q.where.patterns[0]);
      expect(F.isPathChain(<object> predicate)).toBe(true);
    });

    it('converts an inverse path', ({ expect }) => {
      const q = parseSelect('PREFIX ex: <http://example.com/> SELECT * WHERE { ?s ^ex:p1 ?o }');
      const predicate = firstTriplePredicate(q.where.patterns[0]);
      expect(F.isPathModified(<object> predicate)).toBe(true);
    });

    it('converts * + ? cardinality modifiers', ({ expect }) => {
      const q = parseSelect(
        'PREFIX ex: <http://example.com/> SELECT * WHERE { ?s ex:p1* ?o1 . ?s ex:p1+ ?o2 . ?s ex:p1? ?o3 }',
      );
      if (!F.isPatternBgp(q.where.patterns[0])) {
        throw new Error('expected bgp');
      }
      for (const triple of q.where.patterns[0].triples) {
        if (!F.isTriple(triple)) {
          throw new Error('expected a plain triple');
        }
        expect(F.isPathModified(triple.predicate)).toBe(true);
      }
    });

    it('converts !(iri) to a PathNegated wrapping a plain TermIri', ({ expect }) => {
      const q = parseSelect('PREFIX ex: <http://example.com/> SELECT * WHERE { ?s !ex:p ?o }');
      const predicate = firstTriplePredicate(q.where.patterns[0]);
      expect(F.isPathNegated(<object> predicate)).toBe(true);
      expect(F.isTermNamed(<object> (<{ items: unknown[] }> predicate).items[0])).toBe(true);
    });

    it('converts !^iri to a PathNegated wrapping a PathNegatedElt', ({ expect }) => {
      const q = parseSelect('PREFIX ex: <http://example.com/> SELECT * WHERE { ?s !^ex:p ?o }');
      const negated = firstTriplePredicate(q.where.patterns[0]);
      expect(F.isPathNegated(<object> negated)).toBe(true);
      const [ inner ] = (<{ items: unknown[] }> negated).items;
      expect(F.isPathNegatedElt(<object> inner)).toBe(true);
    });

    it('converts a negated alternative !(a|^b) without flattening it incorrectly', ({ expect }) => {
      const q = parseSelect('PREFIX ex: <http://example.com/> SELECT * WHERE { ?s !(ex:p1|^ex:p2) ?o }');
      const negated = firstTriplePredicate(q.where.patterns[0]);
      expect(F.isPathNegated(<object> negated)).toBe(true);
      const [ alt ] = (<{ items: unknown[] }> negated).items;
      expect(F.isPathAlternativeLimited(<object> alt)).toBe(true);
      expect((<{ items: unknown[] }> alt).items).toHaveLength(2);
    });
  });

  describe('tripleFromSparqlJs', () => {
    it('is usable directly on a single raw sparqljs triple', ({ expect }) => {
      const bgp = firstRawBgp(parseRawSelect('SELECT * WHERE { ?s <http://example.com/p> ?o }').where!);
      const triple = tripleFromSparqlJs(bgp.triples[0]);
      expect(F.isTriple(triple)).toBe(true);
    });
  });

  describe('quadsFromSparqlJs (via INSERT/DELETE DATA)', () => {
    it('converts a bare bgp block', ({ expect }) => {
      const u = parseUpdate('PREFIX ex: <http://example.com/> INSERT DATA { ex:a ex:b ex:c }');
      const op = u.updates[0].operation!;
      if (op.subType !== 'insertdata') {
        throw new Error('expected insertdata');
      }
      expect(F.isPatternBgp(op.data[0])).toBe(true);
    });

    it('converts a GRAPH block into a GraphQuads wrapping a PatternBgp', ({ expect }) => {
      const u = parseUpdate('PREFIX ex: <http://example.com/> INSERT DATA { GRAPH ex:g { ex:a ex:b ex:c } }');
      const op = u.updates[0].operation!;
      if (op.subType !== 'insertdata') {
        throw new Error('expected insertdata');
      }
      expect(F.isGraphQuads(op.data[0])).toBe(true);
    });
  });

  describe('vALUES', () => {
    it('strips the leading "?" from row keys', ({ expect }) => {
      const q = parseSelect('SELECT * WHERE { VALUES ?x { 1 2 } }');
      const values = <PatternValues> q.where.patterns[0];
      expect(F.isPatternValues(values)).toBe(true);
      expect(values.variables[0].value).toBe('x');
      expect(Object.keys(values.values[0])).toEqual([ 'x' ]);
    });

    it('leaves a row key alone when it has no leading "?" (e.g. hand-built, already-bare input)', ({ expect }) => {
      const fragment: SparqlJs.Pattern = {
        type: 'values',
        values: [{ x: <SparqlJs.IriTerm> { value: 'http://example.com/a' }}],
      };
      const converted = <PatternValues> patternFromSparqlJs(fragment);
      expect(converted.variables[0].value).toBe('x');
    });

    it('keeps UNDEF rows as undefined', ({ expect }) => {
      const q = parseSelect('SELECT * WHERE { VALUES ?x { UNDEF } }');
      const values = <PatternValues> q.where.patterns[0];
      expect(values.values[0].x).toBeUndefined();
    });

    it('produces no declared variables for a zero-row VALUES clause', ({ expect }) => {
      const q = parseSelect('SELECT * WHERE { VALUES ?x { } }');
      const values = <PatternValues> q.where.patterns[0];
      expect(values.variables).toHaveLength(0);
      expect(values.values).toHaveLength(0);
    });

    it('rejects blank nodes as bindings (disallowed by the SPARQL 1.1 grammar)', ({ expect }) => {
      const fragment: SparqlJs.ValuesPattern = {
        type: 'values',
        values: [{ '?x': <SparqlJs.BlankTerm> { termType: 'BlankNode', value: 'b' }}],
      };
      expect(() => patternFromSparqlJs(fragment)).toThrow(/[Bb]lank node/u);
    });
  });

  describe('expressionFromSparqlJs', () => {
    it('converts an aggregate with distinct and a separator', ({ expect }) => {
      const q = parseSelect(
        'SELECT (GROUP_CONCAT(DISTINCT ?x; SEPARATOR=",") AS ?g) WHERE { ?s ?p ?x } GROUP BY ?s',
      );
      const [ bindVar ] = q.variables;
      if (!F.isPatternBind(bindVar)) {
        throw new Error('expected a bind (aliased select expression)');
      }
      expect(F.isExpressionAggregateSeparator(bindVar.expression)).toBe(true);
      expect((<{ distinct: boolean }> bindVar.expression).distinct).toBe(true);
    });

    it('converts COUNT(*) to an aggregate over a Wildcard', ({ expect }) => {
      const q = parseSelect('SELECT (COUNT(*) AS ?c) WHERE { ?s ?p ?o }');
      const [ bindVar ] = q.variables;
      if (!F.isPatternBind(bindVar)) {
        throw new Error('expected a bind');
      }
      expect(F.isExpressionAggregateOnWildcard(bindVar.expression)).toBe(true);
    });

    it('converts a cast function call to an ExpressionFunctionCall', ({ expect }) => {
      const q = parseSelect(
        'PREFIX xsd: <http://www.w3.org/2001/XMLSchema#> SELECT * WHERE { ?s ?p ?o FILTER(xsd:integer(?o) > 1) }',
      );
      const filter = q.where.patterns[1];
      if (!F.isPatternFilter(filter)) {
        throw new Error('expected filter');
      }
      const op = filter.expression;
      if (!F.isExpressionOperator(op)) {
        throw new Error('expected operation');
      }
      expect(F.isExpressionFunctionCall(op.args[0])).toBe(true);
    });

    it('accepts a bare string as a functionCall\'s function (allowed by the types, sparqljs never emits one)', ({
      expect,
    }) => {
      const bogus: SparqlJs.FunctionCallExpression = {
        type: 'functionCall',
        function: 'http://example.com/customFunction',
        args: [],
      };
      const op = expressionFromSparqlJs(bogus);
      if (!F.isExpressionFunctionCall(op)) {
        throw new Error('expected functionCall');
      }
      expect((<{ value: string }> op.function).value).toBe('http://example.com/customFunction');
    });

    it('converts an infix operation', ({ expect }) => {
      const q = parseSelect('SELECT * WHERE { ?s ?p ?o FILTER(?o + 1 = 2) }');
      const filter = q.where.patterns[1];
      if (!F.isPatternFilter(filter)) {
        throw new Error('expected filter');
      }
      expect(F.isExpressionOperator(filter.expression)).toBe(true);
    });

    it('flattens IN/NOT IN\'s Tuple argument into a single args array', ({ expect }) => {
      const q = parseSelect('SELECT * WHERE { ?s ?p ?o FILTER(?o IN (1, 2, 3)) }');
      const filter = q.where.patterns[1];
      if (!F.isPatternFilter(filter)) {
        throw new Error('expected filter');
      }
      const op = filter.expression;
      if (!F.isExpressionOperator(op)) {
        throw new Error('expected operation');
      }
      expect(op.operator).toBe('in');
      expect(op.args).toHaveLength(4);
    });

    it('re-wraps a degrouped single-pattern EXISTS argument into a PatternGroup', ({ expect }) => {
      const q = parseSelect('PREFIX ex: <http://example.com/> SELECT * WHERE { FILTER EXISTS { ?s ex:p ?o } }');
      const filter = q.where.patterns[0];
      if (!F.isPatternFilter(filter)) {
        throw new Error('expected filter');
      }
      const patternOp = filter.expression;
      if (!F.isExpressionPatternOperation(patternOp)) {
        throw new Error('expected patternOperation');
      }
      expect(F.isPatternGroup(patternOp.args)).toBe(true);
    });

    it('rejects a bare Tuple as a standalone expression', ({ expect }) => {
      expect(() => expressionFromSparqlJs(<SparqlJs.Tuple> [])).toThrow(TypeError);
    });

    it('rejects an unrecognized expression type', ({ expect }) => {
      const bogus = <SparqlJs.Expression> <unknown> { type: 'bogus' };
      expect(() => expressionFromSparqlJs(bogus)).toThrow(/Cannot convert/u);
    });
  });

  describe('patterns', () => {
    it('re-wraps a degrouped single-pattern UNION branch into a PatternGroup', ({ expect }) => {
      const q = parseSelect('PREFIX ex: <http://example.com/> SELECT * WHERE { { ?s ex:a ?o } UNION { ?s ex:b ?o } }');
      const union = q.where.patterns[0];
      if (!F.isPatternUnion(union)) {
        throw new Error('expected union');
      }
      expect(union.patterns.every(branch => F.isPatternGroup(branch))).toBe(true);
    });

    it('leaves a UNION branch that sparqljs did not degroup (2+ distinct patterns) as-is', ({ expect }) => {
      // Two triples joined by `.` still form a single `bgp` pattern (still degrouped); a bgp plus a
      // filter are two distinct patterns, which is what keeps sparqljs from degrouping the block.
      const q = parseSelect(
        'PREFIX ex: <http://example.com/> SELECT * WHERE { { ?s ex:a ?o . FILTER(?o > 1) } UNION { ?s ex:b ?o } }',
      );
      const union = q.where.patterns[0];
      if (!F.isPatternUnion(union)) {
        throw new Error('expected union');
      }
      expect(union.patterns.every(branch => F.isPatternGroup(branch))).toBe(true);
    });

    it('converts OPTIONAL and MINUS patterns', ({ expect }) => {
      const q = parseSelect(
        'PREFIX ex: <http://example.com/> SELECT * WHERE { ' +
        'OPTIONAL { ?s ex:a ?o } ' +
        'MINUS { ?s ex:b ?o } }',
      );
      const [ optional, minus ] = q.where.patterns;
      expect(F.isPatternOptional(optional)).toBe(true);
      expect(F.isPatternMinus(minus)).toBe(true);
    });

    it('converts a subquery pattern without crashing on its absent prefixes/base', ({ expect }) => {
      const q = parseSelect(
        'PREFIX ex: <http://example.com/> SELECT ?s WHERE { { SELECT ?s WHERE { ?s ex:x ?y } LIMIT 5 } }',
      );
      // Sparqljs wraps a `{ SELECT ... }` block in its own 'group' pattern rather than degrouping it.
      const group = q.where.patterns[0];
      if (!F.isPatternGroup(group)) {
        throw new Error('expected group');
      }
      expect(F.isQuerySelect(group.patterns[0])).toBe(true);
    });

    it('converts GRAPH, SERVICE and BIND patterns', ({ expect }) => {
      const q = parseSelect(
        'PREFIX ex: <http://example.com/> SELECT * WHERE { ' +
        'GRAPH ex:g { ?s ex:p ?o } ' +
        'SERVICE SILENT ex:endpoint { ?s ex:p ?o } ' +
        'BIND(?s AS ?renamed) }',
      );
      const [ graph, service, bind ] = q.where.patterns;
      expect(F.isPatternGraph(graph)).toBe(true);
      expect(F.isPatternService(service)).toBe(true);
      expect((<{ silent: boolean }> service).silent).toBe(true);
      expect(F.isPatternBind(bind)).toBe(true);
    });

    it('rejects an unrecognized pattern type', ({ expect }) => {
      const bogus = <SparqlJs.Pattern> <unknown> { type: 'bogus' };
      expect(() => patternFromSparqlJs(bogus)).toThrow(/Cannot convert/u);
    });
  });

  describe('blank node label scope (checked like Traqula\'s parser does)', () => {
    const reusedAcrossGroups = 'SELECT * WHERE { _:a ?p ?v . { _:a ?q 1 } }';

    it('rejects a label reused across basic graph patterns', ({ expect }) => {
      expect(() => sparqlQueryFromSparqlJs(parseRaw(reusedAcrossGroups)))
        .toThrow(/reuse of blank node across two different basic graph patterns \(_:a\)/u);
    });

    it('accepts it when validation is skipped', ({ expect }) => {
      expect(sparqlQueryFromSparqlJs(parseRaw(reusedAcrossGroups), { skipValidation: true }).type).toBe('query');
    });

    it('accepts a label reused within one basic graph pattern', ({ expect }) => {
      expect(parseSelect('SELECT * WHERE { _:a ?p ?v . _:a ?q 1 }').type).toBe('query');
    });

    it('also checks a hand-built fragment converted on its own', ({ expect }) => {
      const blank = <SparqlJs.BlankTerm> { termType: 'BlankNode', value: 'a' };
      const bgp = (object: string): SparqlJs.BgpPattern => ({
        type: 'bgp',
        triples: [{
          subject: blank,
          predicate: <SparqlJs.VariableTerm> { value: 'p' },
          object: <SparqlJs.VariableTerm> { value: object },
        }],
      });
      const fragment: SparqlJs.Pattern = {
        type: 'optional',
        patterns: [ bgp('x'), { type: 'group', patterns: [ bgp('y') ]}],
      };
      expect(() => patternFromSparqlJs(fragment)).toThrow(/reuse of blank node/u);
    });
  });

  describe('context (PREFIX / BASE)', () => {
    it('converts a BASE declaration', ({ expect }) => {
      const q = parseSelect('BASE <http://example.com/> SELECT * WHERE { <a> ?p ?o }');
      expect(q.context.some(entry => entry.subType === 'base')).toBe(true);
    });
  });

  describe('datasets (FROM / FROM NAMED)', () => {
    it('converts FROM and FROM NAMED clauses', ({ expect }) => {
      const q = parseSelect(
        'PREFIX ex: <http://example.com/> SELECT * FROM ex:g1 FROM NAMED ex:g2 WHERE { ?s ?p ?o }',
      );
      expect(q.datasets.clauses).toEqual([
        { clauseType: 'default', value: expect.objectContaining({ value: 'http://example.com/g1' }) },
        { clauseType: 'named', value: expect.objectContaining({ value: 'http://example.com/g2' }) },
      ]);
    });
  });

  describe('solution modifiers', () => {
    it('converts GROUP BY (with and without an alias), HAVING, ORDER BY and LIMIT/OFFSET', ({ expect }) => {
      const q = parseSelect(
        'SELECT ?s WHERE { ?s ?p ?o } ' +
        'GROUP BY ?s (?p AS ?pAlias) ' +
        'HAVING (COUNT(?o) > 1) ' +
        'ORDER BY ASC(?s) DESC(?p) ' +
        'LIMIT 10 OFFSET 2',
      );
      const { group, having, order, limitOffset } = q.solutionModifiers;
      expect(group!.groupings).toHaveLength(2);
      expect('variable' in group!.groupings[1]).toBe(true);
      expect(having!.having).toHaveLength(1);
      expect(order!.orderDefs.map(o => o.descending)).toEqual([ false, true ]);
      expect(limitOffset).toEqual(expect.objectContaining({ limit: 10, offset: 2 }));
    });

    it('sets only limit or only offset when only one is given', ({ expect }) => {
      const q = parseSelect('SELECT * WHERE { ?s ?p ?o } LIMIT 5');
      expect(q.solutionModifiers.limitOffset).toEqual(expect.objectContaining({ limit: 5, offset: undefined }));
    });
  });

  describe('queries', () => {
    it('omits distinct/reduced entirely instead of setting them to false', ({ expect }) => {
      const q = parseSelect('SELECT * WHERE { ?s ?p ?o }');
      expect('distinct' in q).toBe(false);
      expect('reduced' in q).toBe(false);
    });

    it('sets distinct when present', ({ expect }) => {
      const q = parseSelect('SELECT DISTINCT ?s WHERE { ?s ?p ?o }');
      expect(q.distinct).toBe(true);
    });

    it('sets reduced when present', ({ expect }) => {
      const q = parseSelect('SELECT REDUCED ?s WHERE { ?s ?p ?o }');
      expect(q.reduced).toBe(true);
    });

    it('converts an aliased select variable to a PatternBind', ({ expect }) => {
      const q = parseSelect('SELECT (?s AS ?alias) WHERE { ?s ?p ?o }');
      expect(F.isPatternBind(q.variables[0])).toBe(true);
    });

    it('converts a post-query VALUES clause', ({ expect }) => {
      const q = parseSelect('SELECT ?x WHERE { ?s ?p ?x } VALUES ?x { 1 }');
      expect(q.values).toBeDefined();
      expect(F.isPatternValues(q.values!)).toBe(true);
    });

    it('synthesizes an empty PatternGroup for a where-less CONSTRUCT WHERE shorthand template', ({ expect }) => {
      const q = <QueryConstruct> parseQuery('PREFIX ex: <http://example.com/> CONSTRUCT WHERE { ?s ex:p ?o }');
      expect(q.template.triples).toHaveLength(1);
      expect(q.where.patterns).toHaveLength(1);
    });

    it('converts an absent template as an empty one, not as the WHERE triples', ({ expect }) => {
      const bgp = firstRawBgp(parseRawSelect('SELECT * WHERE { ?s ?p ?o }').where!);
      const raw: SparqlJs.ConstructQuery = {
        type: 'query',
        queryType: 'CONSTRUCT',
        prefixes: {},
        template: undefined,
        where: [ bgp ],
      };
      const q = constructQueryFromSparqlJs(raw);
      expect(q.template.triples).toHaveLength(0);
      expect(q.where.patterns).toHaveLength(1);
    });

    it('falls back to an empty template when both template and where are absent', ({ expect }) => {
      const raw: SparqlJs.ConstructQuery = { type: 'query', queryType: 'CONSTRUCT', prefixes: {}, template: undefined };
      const q = constructQueryFromSparqlJs(raw);
      expect(q.template.triples).toHaveLength(0);
    });

    it('synthesizes an empty PatternGroup when where is absent (defensive, real parses always set it)', ({
      expect,
    }) => {
      const rawSelect: SparqlJs.SelectQuery = { type: 'query', queryType: 'SELECT', prefixes: {}, variables: []};
      const rawConstruct: SparqlJs.ConstructQuery =
        { type: 'query', queryType: 'CONSTRUCT', prefixes: {}, template: []};
      const rawAsk: SparqlJs.AskQuery = { type: 'query', queryType: 'ASK', prefixes: {}};
      expect(selectQueryFromSparqlJs(rawSelect).where.patterns).toHaveLength(0);
      expect(constructQueryFromSparqlJs(rawConstruct).where.patterns).toHaveLength(0);
      expect(askQueryFromSparqlJs(rawAsk).where.patterns).toHaveLength(0);
    });

    it('converts a CONSTRUCT query with a post-query VALUES clause', ({ expect }) => {
      const q = <QueryConstruct> parseQuery(
        'PREFIX ex: <http://example.com/> CONSTRUCT { ?s ex:p ?x } WHERE { ?s ex:p ?x } VALUES ?x { 1 }',
      );
      expect(q.values).toBeDefined();
    });

    it('converts an ASK query, including its FROM and VALUES clauses', ({ expect }) => {
      const ast = parseRaw(
        'PREFIX ex: <http://example.com/> ASK FROM ex:g { ?s ex:p ?x } VALUES ?x { 1 }',
      );
      const q = <QueryAsk> queryFromSparqlJs(<SparqlJs.Query> ast);
      expect(q.subType).toBe('ask');
      expect(q.datasets.clauses).toHaveLength(1);
      expect(q.values).toBeDefined();
    });

    it('directly calling askQueryFromSparqlJs also works', ({ expect }) => {
      const raw = <SparqlJs.AskQuery> parseRaw('ASK { ?s ?p ?o }');
      expect(askQueryFromSparqlJs(raw).subType).toBe('ask');
    });

    it('converts a DESCRIBE * query', ({ expect }) => {
      const q = <QueryDescribe> parseQuery('DESCRIBE *');
      expect(F.isWildcard(q.variables[0])).toBe(true);
      expect(q.where).toBeUndefined();
    });

    it('converts a DESCRIBE with mixed variables/IRIs, a WHERE clause and VALUES', ({ expect }) => {
      const raw = <SparqlJs.DescribeQuery> parseRaw(
        'PREFIX ex: <http://example.com/> DESCRIBE ?s ex:other WHERE { ?s ex:p ?x } VALUES ?x { 1 }',
      );
      const q = describeQueryFromSparqlJs(raw);
      expect(q.variables).toHaveLength(2);
      expect(q.where).toBeDefined();
      expect(q.values).toBeDefined();
    });

    it('rejects an unrecognized query type', ({ expect }) => {
      const bogus = <SparqlJs.Query> <unknown> { type: 'query', queryType: 'BOGUS' };
      expect(() => queryFromSparqlJs(bogus)).toThrow(/Cannot convert/u);
    });
  });

  describe('updates', () => {
    it('maps INSERT DATA / DELETE WHERE / INSERT-DELETE-WHERE to their Traqula subTypes', ({ expect }) => {
      const u = parseUpdate(
        'PREFIX ex: <http://example.com/> INSERT DATA { ex:a ex:b ex:c } ; ' +
        'DELETE WHERE { ex:a ex:b ?o } ; ' +
        'DELETE { ?s ex:old ?o } INSERT { ?s ex:new ?o } WHERE { ?s ex:old ?o }',
      );
      expect(u.updates.map(update => update.operation?.subType)).toEqual([ 'insertdata', 'deletewhere', 'modify' ]);
      // Sparqljs flattens PREFIX declarations for the whole update, so every operation gets the same context.
      expect(u.updates.every(update => update.context === u.updates[0].context)).toBe(true);
    });

    it('converts DELETE DATA', ({ expect }) => {
      const u = parseUpdate('PREFIX ex: <http://example.com/> DELETE DATA { ex:a ex:b ex:c }');
      expect(u.updates[0].operation?.subType).toBe('deletedata');
    });

    it('converts an INSERT/DELETE/WHERE with an explicit graph and USING clauses', ({ expect }) => {
      const u = parseUpdate(
        'PREFIX ex: <http://example.com/> WITH ex:g DELETE { ?s ex:old ?o } INSERT { ?s ex:new ?o } ' +
        'USING ex:u1 USING NAMED ex:u2 WHERE { ?s ex:old ?o }',
      );
      const op = u.updates[0].operation!;
      if (op.subType !== 'modify') {
        throw new Error('expected modify');
      }
      expect(op.graph).toBeDefined();
      expect(op.from.clauses).toHaveLength(2);
    });

    it('converts LOAD with and without an INTO GRAPH destination', ({ expect }) => {
      const withDest = parseUpdate('PREFIX ex: <http://example.com/> LOAD SILENT ex:src INTO GRAPH ex:dst');
      const withoutDest = parseUpdate('PREFIX ex: <http://example.com/> LOAD ex:src');
      const opWith = withDest.updates[0].operation!;
      const opWithout = withoutDest.updates[0].operation!;
      if (opWith.subType !== 'load' || opWithout.subType !== 'load') {
        throw new Error('expected load');
      }
      expect(opWith.silent).toBe(true);
      expect(opWith.destination).toBeDefined();
      expect(opWithout.destination).toBeUndefined();
    });

    it('converts CREATE', ({ expect }) => {
      const u = parseUpdate('PREFIX ex: <http://example.com/> CREATE GRAPH ex:g');
      expect(u.updates[0].operation?.subType).toBe('create');
    });

    it('converts CLEAR/DROP against DEFAULT, NAMED, ALL and a specific graph', ({ expect }) => {
      const cases: [string, string][] = [
        [ 'CLEAR DEFAULT', 'default' ],
        [ 'CLEAR NAMED', 'named' ],
        [ 'CLEAR ALL', 'all' ],
        [ 'PREFIX ex: <http://example.com/> CLEAR GRAPH ex:g', 'specific' ],
      ];
      for (const [ query, expectedSubType ] of cases) {
        const u = parseUpdate(query);
        const op = u.updates[0].operation!;
        if (op.subType !== 'clear') {
          throw new Error('expected clear');
        }
        expect(op.destination.subType).toBe(expectedSubType);
      }
      const dropped = parseUpdate('DROP ALL');
      expect(dropped.updates[0].operation?.subType).toBe('drop');
    });

    it('converts ADD, MOVE and COPY between DEFAULT and a named graph', ({ expect }) => {
      const add = parseUpdate('PREFIX ex: <http://example.com/> ADD DEFAULT TO ex:g');
      const move = parseUpdate('PREFIX ex: <http://example.com/> MOVE ex:g TO DEFAULT');
      const copy = parseUpdate('PREFIX ex: <http://example.com/> COPY ex:g1 TO ex:g2');
      expect(add.updates[0].operation?.subType).toBe('add');
      expect(move.updates[0].operation?.subType).toBe('move');
      expect(copy.updates[0].operation?.subType).toBe('copy');
    });

    it('graphOrDefaultToGraphRef and graphReferenceToGraphRef are usable directly', ({ expect }) => {
      const raw = (<SparqlJs.Update> parseRaw(
        'PREFIX ex: <http://example.com/> ADD DEFAULT TO ex:g',
      )).updates[0];
      if (!('type' in raw) || raw.type !== 'add') {
        throw new Error('expected add');
      }
      expect(F.isGraphRefDefault(graphOrDefaultToGraphRef(raw.source))).toBe(true);
      expect(F.isGraphRefSpecific(graphOrDefaultToGraphRef(raw.destination))).toBe(true);

      const cleared = (<SparqlJs.Update> parseRaw('CLEAR ALL')).updates[0];
      if (!('type' in cleared) || cleared.type !== 'clear') {
        throw new Error('expected clear');
      }
      expect(F.isGraphRefAll(graphReferenceToGraphRef(cleared.graph))).toBe(true);
    });

    it('rejects a hand-built GraphReference that sets none of default/named/all/name', ({ expect }) => {
      expect(() => graphReferenceToGraphRef({ type: 'graph' })).toThrow(/must set one of/u);
    });

    it('rejects an unrecognized updateType', ({ expect }) => {
      const bogus = <SparqlJs.UpdateOperation> <unknown> { updateType: 'bogus' };
      expect(() => updateOperationFromSparqlJs(bogus)).toThrow(/Cannot convert/u);
    });

    it('rejects an unrecognized management operation type', ({ expect }) => {
      const bogus = <SparqlJs.UpdateOperation> <unknown> { type: 'bogus' };
      expect(() => updateOperationFromSparqlJs(bogus)).toThrow(/Cannot convert/u);
    });

    it('is usable directly via updateFromSparqlJs / sparqlQueryFromSparqlJs dispatch', ({ expect }) => {
      const raw = <SparqlJs.Update> parseRaw('PREFIX ex: <http://example.com/> INSERT DATA { ex:a ex:b ex:c }');
      expect(updateFromSparqlJs(raw).type).toBe('update');
      expect(sparqlQueryFromSparqlJs(raw).type).toBe('update');
    });

    it('converts an update without operations (SPARQL.js omits `type` and `updates`) to an empty update', ({
      expect,
    }) => {
      const u = parseUpdate('BASE <http://example.com/> PREFIX ex: <http://example.com/>');
      expect(u.type).toBe('update');
      expect(u.updates).toHaveLength(1);
      expect(u.updates[0].operation).toBeUndefined();
      expect(u.updates[0].context.map(entry => entry.subType)).toEqual([ 'base', 'prefix' ]);
    });

    it('treats a hand-built update with an empty `updates` array the same way', ({ expect }) => {
      const u = updateFromSparqlJs({ type: 'update', prefixes: {}, updates: []});
      expect(u.updates).toEqual([{ context: []}]);
    });
  });

  it('is usable directly on an already-parsed sparqljs Pattern fragment (the AST-fragment use case)', ({ expect }) => {
    const [ fragment ] = parseRawSelect('PREFIX ex: <http://example.com/> SELECT * WHERE { ?s ex:p ?o }').where!;
    expect(F.isPatternBgp(patternFromSparqlJs(fragment))).toBe(true);
  });

  describe('collapseIrisToPrefixed', () => {
    it('rewrites a matching full IRI to a prefixed one', ({ expect }) => {
      const q = parseSelect('PREFIX ex: <http://example.com/> SELECT * WHERE { ?s ex:p ?o }');
      const collapsed = collapseIrisToPrefixed(q, { ex: 'http://example.com/' });
      const predicate = firstTriplePredicate(collapsed.where.patterns[0]);
      expect(F.isTermNamedPrefixed(<object> predicate)).toBe(true);
      expect(predicate).toEqual(expect.objectContaining({ prefix: 'ex', value: 'p' }));
    });

    it('picks the longest matching prefix expansion when more than one could apply', ({ expect }) => {
      const q = parseSelect('PREFIX ex: <http://example.com/> SELECT * WHERE { ?s <http://example.com/sub/p> ?o }');
      const collapsed = collapseIrisToPrefixed(q, {
        ex: 'http://example.com/',
        exSub: 'http://example.com/sub/',
      });
      const predicate = firstTriplePredicate(collapsed.where.patterns[0]);
      expect(predicate).toEqual(expect.objectContaining({ prefix: 'exSub', value: 'p' }));
    });

    it('leaves an IRI with no matching prefix untouched', ({ expect }) => {
      const q = parseSelect('SELECT * WHERE { ?s <http://other.example/p> ?o }');
      const collapsed = collapseIrisToPrefixed(q, { ex: 'http://example.com/' });
      const predicate = firstTriplePredicate(collapsed.where.patterns[0]);
      expect(F.isTermNamedPrefixed(<object> predicate)).toBe(false);
    });

    it('does not collapse an IRI that exactly equals a prefix expansion (would leave an empty local name)', ({
      expect,
    }) => {
      const q = parseSelect('SELECT * WHERE { ?s <http://example.com/> ?o }');
      const collapsed = collapseIrisToPrefixed(q, { ex: 'http://example.com/' });
      const predicate = firstTriplePredicate(collapsed.where.patterns[0]);
      expect(F.isTermNamedPrefixed(<object> predicate)).toBe(false);
    });

    it('leaves a PREFIX/BASE declaration\'s own IRI untouched', ({ expect }) => {
      const q = parseSelect('PREFIX ex: <http://example.com/> SELECT * WHERE { ?s ex:p ?o }');
      const collapsed = collapseIrisToPrefixed(q, { ex: 'http://example.com/' });
      expect(collapsed.context[0]).toEqual(expect.objectContaining({
        subType: 'prefix',
        value: expect.objectContaining({ value: 'http://example.com/' }),
      }));
    });

    it('does not mutate its input', ({ expect }) => {
      const q = parseSelect('PREFIX ex: <http://example.com/> SELECT * WHERE { ?s ex:p ?o }');
      collapseIrisToPrefixed(q, { ex: 'http://example.com/' });
      const predicate = firstTriplePredicate(q.where.patterns[0]);
      expect(F.isTermNamedPrefixed(<object> predicate)).toBe(false);
    });

    it('leaves an already-prefixed term untouched (idempotent on a second pass)', ({ expect }) => {
      const q = parseSelect('PREFIX ex: <http://example.com/> SELECT * WHERE { ?s ex:p ?o }');
      const once = collapseIrisToPrefixed(q, { ex: 'http://example.com/' });
      const twice = collapseIrisToPrefixed(once, { ex: 'http://example.com/' });
      const predicate = firstTriplePredicate(twice.where.patterns[0]);
      expect(predicate).toEqual(expect.objectContaining({ prefix: 'ex', value: 'p' }));
    });

    it('returns a non-object node untouched (defensive against a non-AST top-level argument)', ({ expect }) => {
      expect(collapseIrisToPrefixed(null, {})).toBeNull();
      expect(collapseIrisToPrefixed('not an ast', {})).toBe('not an ast');
    });
  });
});
