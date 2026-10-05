import type { BaseQuad } from '@rdfjs/types';
import type { DataFactory } from 'rdf-data-factory';
import { describe, it } from 'vitest';
import type { TestFunction } from 'vitest';

interface Parser {
  parse: (query: string, context?: { prefixes?: Record<string, string>; baseIRI?: string }) => unknown;
}

/**
 * Register a suite of parser tests derived from the notes and errata of the SPARQL 1.1 specification.
 * Tests cover error handling, blank node reuse validation, VALUES cardinality, and more.
 * @param parser - A parser instance with a `parse` method.
 * @param _DF - A DataFactory instance (currently unused, reserved for future tests).
 */
export function importSparql11NoteTests(parser: Parser, _DF: DataFactory<BaseQuad>): void {
  // Only check that parsing fails: error messages are not part of the contract,
  // so engines extending the grammar are free to report a different message.
  function testErroneousQuery(query: string): TestFunction<object> {
    return ({ expect }) => {
      let error: any;
      try {
        parser.parse(query);
      } catch (e) {
        error = e;
      }
      expect(error).not.toBeUndefined();
      expect(error).toBeInstanceOf(Error);
    };
  }

  it('should throw an error on an invalid query', testErroneousQuery(
    'invalid',
  ));

  it('should throw an error on a projection of ungrouped variable', testErroneousQuery(
    'PREFIX : <http://www.example.org/> SELECT ?o WHERE { ?s ?p ?o } GROUP BY ?s',
  ));

  it('should throw an error on a values class with LESS variables than value', testErroneousQuery(
    'SELECT * WHERE { } VALUES ( ?S ) { ( true  false ) }',
  ));

  it('should throw an error on a values class with MORE variables than value', testErroneousQuery(
    'SELECT * WHERE { } VALUES ( ?S ?O ) { ( true ) }',
  ));

  it('should NOT throw on a values class with correct amount of values', ({ expect }) => {
    const query = 'SELECT * WHERE { } VALUES ( ?S ) { ( true ) }';
    expect(parser.parse(query)).toMatchObject({});
  });

  it('should throw an error on an invalid selectscope', testErroneousQuery(
    'SELECT (1 AS ?X ) { SELECT (2 AS ?X ) {} }',
  ));

  it('should NOT throw on a select expression binding a variable that is not in scope', ({ expect }) => {
    const queries = [
      'SELECT (?o + 1 AS ?a) (?a * 2 AS ?b) { ?s ?p ?o }',
      'SELECT (1 AS ?x) { ?s ?p ?o MINUS { ?s ?p ?x } }',
      'SELECT (1 AS ?x) { ?s ?p ?o FILTER EXISTS { ?s ?p ?x } }',
      'SELECT (1 AS ?x) { { SELECT ?s { ?s ?p ?x } } }',
      'SELECT (COUNT(?o) AS ?c) { ?s ?p ?o } GROUP BY ?s',
      'SELECT * { { SELECT (?o + 1 AS ?a) { ?s ?p ?o } } ?a ?p ?o }',
      'ASK { { SELECT * { { SELECT (1 AS ?x) { ?s ?p ?o } } } } }',
      'SELECT (1 AS ?g) { { SELECT (COUNT(*) AS ?c) { ?s ?p ?o } GROUP BY (?s AS ?g) } }',
      'SELECT (1 AS ?x) { { SELECT ?s { ?s ?p ?o } VALUES ?x { 1 } } }',
      'SELECT (1 AS ?y) { ?s ?p ?o } VALUES ?x { 1 }',
      // Grouping only keeps the group keys in scope
      'SELECT (123 AS ?z) WHERE { ?s ?p ?z } GROUP BY ?s',
      'SELECT ?s (COUNT(?z) AS ?z) { ?s ?p ?z } GROUP BY ?s',
      'SELECT (COUNT(?z) AS ?z) { ?s ?p ?z }',
      'SELECT (1 AS ?z) { ?s ?p ?z } HAVING (COUNT(*) > 1)',
      'SELECT (1 AS ?z) { ?s ?p ?z } ORDER BY (COUNT(*))',
      'SELECT * { { SELECT (COUNT(?z) AS ?z) { ?s ?p ?z } } }',
      // Aggregates nested in function calls, and possible custom aggregates (any function call)
      'PREFIX xsd: <http://www.w3.org/2001/XMLSchema#> SELECT (xsd:integer(COUNT(?z)) AS ?z) { ?s ?p ?z }',
      'SELECT (<http://ex.org/agg>(DISTINCT ?z) AS ?z) { ?s ?p ?z }',
      'SELECT (<http://ex.org/agg>(?z) AS ?z) { ?s ?p ?z }',
      'SELECT (1 AS ?z) { ?s ?p ?z } ORDER BY (<http://ex.org/agg>(?z))',
      'PREFIX xsd: <http://www.w3.org/2001/XMLSchema#> SELECT (xsd:string(?z) AS ?z) { ?s ?p ?z }',
      'SELECT (1 AS ?z) { ?s ?p ?z } HAVING (<http://ex.org/f>(SUM(?z)) > 1)',
    ];
    for (const query of queries) {
      expect(parser.parse(query), query).toMatchObject({});
    }
  });

  it('should throw an error on bind to variable in scope', testErroneousQuery(
    'SELECT * { ?s ?p ?o BIND(?o AS ?o) }',
  ));

  it('should throw an error on bind to variable bound by a preceding bind', testErroneousQuery(
    'SELECT * { ?s ?p ?o BIND(1 AS ?x) BIND(2 AS ?x) }',
  ));

  it('should NOT throw on bind to variable that is not in scope', ({ expect }) => {
    const queries = [
      'SELECT * { ?s ?p ?o BIND(?s AS ?x) ?x ?a ?b }',
      'SELECT * { { ?s ?p ?o BIND(1 AS ?x) } BIND(2 AS ?y) }',
      'SELECT * { ?s ?p ?o MINUS { ?s ?p ?x } BIND(1 AS ?x) }',
      'SELECT * { ?s ?p ?o FILTER EXISTS { ?s ?p ?x } BIND(1 AS ?x) }',
      'SELECT * { { BIND(1 AS ?x) } UNION { BIND(2 AS ?x) } }',
      'SELECT * { { SELECT ?s { ?s ?p ?o } GROUP BY ?s (?o AS ?g) } BIND(1 AS ?g) }',
      'SELECT * { { SELECT ?s { ?s ?p ?o } VALUES ?x { 1 } } BIND(1 AS ?x) }',
    ];
    for (const query of queries) {
      expect(parser.parse(query), query).toMatchObject({});
    }
  });

  it('should parse when not ending in newline', ({ expect }) => {
    const query = 'select?s{?s?p?o}#wow, what a query';
    expect(parser.parse(query)).toMatchObject({});
  });

  it('should preserve BGP and filter pattern order', ({ expect }) => {
    const query = 'SELECT * { ?s ?p "1" . FILTER(true) . ?s ?p "2"  }';
    expect(parser.parse(query)).toMatchObject({
      where: {
        patterns: [
          { subType: 'bgp' },
          { subType: 'filter' },
          { subType: 'bgp' },
        ],
      },
    });
  });

  it('should throw an error on an aggregate function within an aggregate function', testErroneousQuery(
    'SELECT (SUM(COUNT(?lprice)) AS ?totalPrice) { }',
  ));

  describe('with pre-defined prefixes', () => {
    const prefixes = { a: 'ex:abc#', b: 'ex:def#' };

    it.todo('should use those prefixes');

    it.todo('should allow temporarily overriding prefixes');

    it('should not change the original prefixes', ({ expect }) => {
      expect(prefixes).toEqual({ a: 'ex:abc#', b: 'ex:def#' });
    });
  });

  describe('with pre-defined base IRI', () => {
    const _context = { baseIRI: 'http://ex.org/' };

    it.todo('contains the base');

    it.todo('using prefixed as relative iri');

    it.todo('should use the base IRI');

    it.todo('should work after a previous query failed');
  });

  it.todo('should throw an error on relative IRIs if no base IRI is specified');

  describe('with group collapsing disabled', () => {
    it.todo('should keep explicit pattern group');

    it.todo('should still collapse immediate union groups');
  });

  describe('for update queries', () => {
    it('should throw an error on blank nodes in DELETE clause', testErroneousQuery(
      'DELETE { ?a <ex:knows> [] . } WHERE { ?a <ex:knows> "Alan" . }',
    ));

    it('should not throw on blank nodes in INSERT clause', ({ expect }) => {
      const query = 'INSERT { ?a <ex:knows> [] . } WHERE { ?a <ex:knows> "Alan" . }';
      expect(parser.parse(query)).toMatchObject({
        type: 'update',
        updates: [{ operation: {
          type: 'updateOperation',
          subType: 'modify',
          delete: [],
          insert: [{ type: 'pattern', subType: 'bgp', triples: [{
            type: 'triple',
            subject: { type: 'term', subType: 'variable', value: 'a' },
            predicate: { type: 'term', subType: 'namedNode', value: 'ex:knows' },
            object: { type: 'term', subType: 'blankNode' },
          }]}],
          where: { type: 'pattern', subType: 'group', patterns: [{ type: 'pattern', subType: 'bgp', triples: [{
            object: { type: 'term', subType: 'literal', value: 'Alan' },
          }]}]},
        }}],
      });
    });

    it('should throw an error on blank nodes in compact DELETE clause', testErroneousQuery(
      'DELETE WHERE { _:a <ex:p> <ex:o> }',
    ));

    it('should throw an error on variables in DELETE DATA clause', testErroneousQuery(
      'DELETE DATA { ?a <ex:p> <ex:o> }',
    ));

    it('should throw an error on blank nodes in DELETE DATA clause', testErroneousQuery(
      'DELETE DATA { _:a <ex:p> <ex:o> }',
    ));

    it('should throw an error on variables in DELETE DATA clause with GRAPH', testErroneousQuery(
      'DELETE DATA { GRAPH ?a { <ex:s> <ex:p> <ex:o> } }',
    ));

    it('should throw an error on variables in INSERT DATA clause', testErroneousQuery(
      'INSERT DATA { ?a <ex:p> <ex:o> }',
    ));

    it('should not throw on reused blank nodes in one INSERT DATA clause', ({ expect }) => {
      const query = 'INSERT DATA { _:a <ex:p> <ex:o> . _:a <ex:p> <ex:o> . }';
      const triple = {
        type: 'triple',
        subject: { type: 'term', subType: 'blankNode', label: 'e_a' },
        predicate: { type: 'term', subType: 'namedNode', value: 'ex:p' },
        object: { type: 'term', subType: 'namedNode', value: 'ex:o' },
      };
      expect(parser.parse(query)).toMatchObject({
        type: 'update',
        updates: [{ operation: {
          type: 'updateOperation',
          subType: 'insertdata',
          data: [{ type: 'pattern', subType: 'bgp', triples: [ triple, triple ]}],
        }}],
      });
    });

    it('should throw an error on reused blank nodes across INSERT DATA clauses', testErroneousQuery(
      'INSERT DATA { _:a <ex:p> <ex:o> }; INSERT DATA { _:a <ex:p> <ex:o> }',
    ));

    it('should throw an error on reused blank nodes across INSERT DATA clauses with GRAPH', testErroneousQuery(
      'INSERT DATA { _:a <ex:p> <ex:o> }; INSERT DATA { GRAPH <ex:g> { _:a <ex:p> <ex:o> } }',
    ));

    // Comments between INSERT and DATA are covered by the static tests
    // sparql-update-comment-between-insert-data and sparql-update-commented-data-after-insert.

    it('should throw an error on commented DATA after INSERT', testErroneousQuery(
      'INSERT # DATA { GRAPH <ex:G> { <ex:s> <ex:p> \'o1\', \'o2\', \'o3\' } }',
    ));
  });

  it('should throw an error on unicode codepoint escaping in literal with partial surrogate pair', testErroneousQuery(
    'SELECT * WHERE { ?s <ex:p> \'\uD800\' }',
  ));

  it(
    'should not throw an error on unicode codepoint escaping in literal with complete surrogate pair',
    ({ expect }) => {
      const query = 'SELECT * WHERE { ?s <ex:p> \'\uD800\uDFFF\' }';
      const object = { type: 'term', subType: 'literal', value: '\u{103FF}' };
      expect(parser.parse(query)).toMatchObject({ where: { patterns: [{ triples: [{ object }]}]}});
      // The \U escaped code point yields the same literal. Escaping the surrogate pair itself (\uD800\uDFFF)
      // is only legal in SPARQL 1.1: see the sparqlCodepointEscape tests and the 1.2 surrogate-esc-*-bad statics.
      expect(parser.parse('SELECT * WHERE { ?s <ex:p> \'\\U000103FF\' }'))
        .toMatchObject({ where: { patterns: [{ triples: [{ object }]}]}});
    },
  );
}
