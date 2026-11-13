import { Generator } from '@traqula/generator-sparql-1-1';
import { Parser as SparqlJsParser } from 'sparqljs';
import type * as SparqlJs from 'sparqljs';
import { describe, it } from 'vitest';
import { collapseIrisToPrefixed, sparqlQueryFromSparqlJs } from '../lib/index.js';

// Lets the cases write relative IRIs such as `<p>`.
const BASE = 'http://example.org/';
const sparqlJsParser = new SparqlJsParser({ baseIRI: BASE });
const generator = new Generator();

function iri(relative: string): string {
  return `<${BASE}${relative}>`;
}

function int(value: string): string {
  return `"${value}"^^<http://www.w3.org/2001/XMLSchema#integer>`;
}

/**
 * Parses with SPARQL.js. The SPARQL.js blank node counter is global, so it is reset first.
 * SPARQL.js adds the parser's `baseIRI` to the AST as a BASE declaration; it is removed so it does not show up in
 * every expectation.
 */
function parse(query: string): SparqlJs.SparqlQuery {
  sparqlJsParser._resetBlanks();
  const parsed = sparqlJsParser.parse(query);
  if (parsed.base === BASE) {
    delete parsed.base;
  }
  return parsed;
}

/**
 * Generates the converted query, with whitespace collapsed so expectations fit on one line.
 */
function generate(query: SparqlJs.SparqlQuery): string {
  return generator.generate(sparqlQueryFromSparqlJs(query)).replaceAll(/\s+/gu, ' ').trim();
}

function roundTrip(query: string): string {
  return generate(parse(query));
}

type Case = [ description: string, query: string, expected: string ];

function runCases(cases: Case[]): void {
  for (const [ description, query, expected ] of cases) {
    it(description, ({ expect }) => {
      expect(roundTrip(query)).toBe(expected);
    });
  }
}

describe('generated output', () => {
  describe('query forms', () => {
    runCases([
      [ 'SELECT', 'SELECT ?s WHERE { ?s ?p ?o }', 'SELECT ?s WHERE { ?s ?p ?o . }' ],
      [ 'SELECT *', 'SELECT * WHERE { ?s ?p ?o }', 'SELECT * WHERE { ?s ?p ?o . }' ],
      [ 'SELECT DISTINCT', 'SELECT DISTINCT ?s WHERE { ?s ?p ?o }', 'SELECT DISTINCT ?s WHERE { ?s ?p ?o . }' ],
      [ 'SELECT REDUCED', 'SELECT REDUCED ?s WHERE { ?s ?p ?o }', 'SELECT REDUCED ?s WHERE { ?s ?p ?o . }' ],
      [
        'SELECT with an alias',
        'SELECT (STR(?s) AS ?name) WHERE { ?s ?p ?o }',
        'SELECT ( STR( ?s ) AS ?name ) WHERE { ?s ?p ?o . }',
      ],
      [
        'CONSTRUCT',
        'CONSTRUCT { ?s <q> ?o } WHERE { ?s <p> ?o }',
        `CONSTRUCT { ?s ${iri('q')} ?o . } WHERE { ?s ${iri('p')} ?o . }`,
      ],
      [
        'CONSTRUCT WHERE shorthand gets an explicit template',
        'CONSTRUCT WHERE { ?s <p> ?o }',
        `CONSTRUCT { ?s ${iri('p')} ?o . } WHERE { ?s ${iri('p')} ?o . }`,
      ],
      [
        'CONSTRUCT with an explicitly empty template stays empty',
        'CONSTRUCT { } WHERE { ?s <p> ?o }',
        `CONSTRUCT { } WHERE { ?s ${iri('p')} ?o . }`,
      ],
      [ 'ASK', 'ASK { ?s ?p ?o }', 'ASK WHERE { ?s ?p ?o . }' ],
      [ 'DESCRIBE', 'DESCRIBE ?s WHERE { ?s ?p ?o }', 'DESCRIBE ?s WHERE { ?s ?p ?o . }' ],
      [ 'DESCRIBE *', 'DESCRIBE *', 'DESCRIBE *' ],
      [
        'subquery',
        'SELECT ?s WHERE { { SELECT ?s WHERE { ?s ?p ?o } LIMIT 1 } }',
        'SELECT ?s WHERE { { SELECT ?s WHERE { ?s ?p ?o . } LIMIT 1 } }',
      ],
      [
        'FROM and FROM NAMED',
        'SELECT * FROM <g1> FROM NAMED <g2> WHERE { ?s ?p ?o }',
        `SELECT * FROM ${iri('g1')} FROM NAMED ${iri('g2')} WHERE { ?s ?p ?o . }`,
      ],
      [
        'BASE is kept, relative IRIs are resolved by SPARQL.js',
        'BASE <http://other.org/> SELECT * WHERE { <a> ?p ?o }',
        'BASE <http://other.org/> SELECT * WHERE { <http://other.org/a> ?p ?o . }',
      ],
      [
        'GROUP BY, HAVING, ORDER BY, LIMIT and OFFSET',
        'SELECT ?s (COUNT(?o) AS ?n) WHERE { ?s ?p ?o } GROUP BY ?s HAVING (COUNT(?o) > 1) ' +
        'ORDER BY DESC(?n) ?s LIMIT 10 OFFSET 5',
        `SELECT ?s ( COUNT( ?o ) AS ?n ) WHERE { ?s ?p ?o . } GROUP BY ?s HAVING ( COUNT( ?o ) > ${int('1')} ) ` +
        'ORDER BY DESC ( ?n ) ASC ( ?s ) LIMIT 10 OFFSET 5',
      ],
      [
        'GROUP BY with an alias',
        'SELECT ?x WHERE { ?s ?p ?o } GROUP BY (STR(?s) AS ?x)',
        'SELECT ?x WHERE { ?s ?p ?o . } GROUP BY ( STR( ?s ) AS ?x )',
      ],
      [
        'VALUES with UNDEF inside WHERE',
        'SELECT * WHERE { VALUES (?x ?y) { (1 UNDEF) (2 "b") } }',
        `SELECT * WHERE { VALUES( ?x ?y ){ ( ${int('1')} UNDEF ) ( ${int('2')} "b" ) } }`,
      ],
      [
        'VALUES after the query',
        'SELECT ?x WHERE { ?x ?p ?o } VALUES ?x { <a> }',
        `SELECT ?x WHERE { ?x ?p ?o . } VALUES ?x { ${iri('a')} }`,
      ],
    ]);
  });

  describe('update operations', () => {
    runCases([
      [
        'INSERT DATA with a GRAPH block',
        'INSERT DATA { <a> <b> <c> ' +
        'GRAPH <g> { <a> <b> <d> } }',
        `INSERT DATA { GRAPH ${iri('g')} { ${iri('a')} ${iri('b')} ${iri('d')} . } ${iri('a')} ${iri('b')} ${iri('c')} . }`,
      ],
      [
        'DELETE DATA',
        'DELETE DATA { <a> <b> <c> }',
        `DELETE DATA { ${iri('a')} ${iri('b')} ${iri('c')} . }`,
      ],
      [ 'DELETE WHERE', 'DELETE WHERE { ?s ?p ?o }', 'DELETE WHERE { ?s ?p ?o . }' ],
      [
        'WITH, DELETE, INSERT, USING and WHERE',
        'WITH <g> DELETE { ?s ?p ?o } INSERT { ?s ?q ?o } ' +
        'USING <u> USING NAMED <n> WHERE { ?s ?p ?o }',
        `WITH ${iri('g')} DELETE { ?s ?p ?o . } INSERT { ?s ?q ?o . } ` +
        `USING ${iri('u')} USING NAMED ${iri('n')} WHERE { ?s ?p ?o . }`,
      ],
      [
        'LOAD SILENT ... INTO GRAPH',
        'LOAD SILENT <src> INTO GRAPH <dst>',
        `LOAD SILENT ${iri('src')} INTO GRAPH ${iri('dst')}`,
      ],
      [
        'CLEAR DEFAULT, NAMED, ALL and a named graph',
        'CLEAR DEFAULT; CLEAR NAMED; CLEAR ALL; CLEAR GRAPH <g>',
        `CLEAR DEFAULT ; CLEAR NAMED ; CLEAR ALL ; CLEAR GRAPH ${iri('g')}`,
      ],
      [ 'CREATE SILENT', 'CREATE SILENT GRAPH <g>', `CREATE SILENT GRAPH ${iri('g')}` ],
      [ 'DROP', 'DROP ALL', 'DROP ALL' ],
      [
        'ADD, MOVE and COPY',
        'ADD DEFAULT TO <g>; MOVE <g> TO DEFAULT; ' +
        'COPY SILENT <a> TO <b>',
        `ADD DEFAULT TO GRAPH ${iri('g')}; MOVE GRAPH ${iri('g')} TO DEFAULT ; ` +
        `COPY SILENT GRAPH ${iri('a')} TO GRAPH ${iri('b')}`,
      ],
    ]);
  });

  describe('terms', () => {
    runCases([
      [ 'full IRI', 'SELECT * WHERE { <a> ?p ?o }', `SELECT * WHERE { ${iri('a')} ?p ?o . }` ],
      [
        'prefixed name is expanded by SPARQL.js, the PREFIX is kept',
        'PREFIX ex: <http://example.org/> SELECT * WHERE { ex:a ?p ?o }',
        `PREFIX ex: <${BASE}> SELECT * WHERE { ${iri('a')} ?p ?o . }`,
      ],
      [ 'variable', 'SELECT ?s WHERE { ?s ?p ?o }', 'SELECT ?s WHERE { ?s ?p ?o . }' ],
      [
        'blank node label keeps its name (no doubled e_ prefix)',
        'SELECT * WHERE { _:b0 ?p ?o }',
        'SELECT * WHERE { _:b0 ?p ?o . }',
      ],
      [ 'anonymous blank node', 'SELECT * WHERE { [] ?p ?o }', 'SELECT * WHERE { _:0 ?p ?o . }' ],
      [
        'literals: plain, language-tagged, typed, xsd:string, decimal and boolean',
        'SELECT * WHERE { ?s ?p "plain", "hi"@en, "5"^^<http://www.w3.org/2001/XMLSchema#integer>, ' +
        '"s"^^<http://www.w3.org/2001/XMLSchema#string>, 1.5, true }',
        `SELECT * WHERE { ?s ?p "plain" . ?s ?p "hi"@en . ?s ?p ${int('5')} . ?s ?p "s" . ` +
        '?s ?p "1.5"^^<http://www.w3.org/2001/XMLSchema#decimal> . ' +
        '?s ?p "true"^^<http://www.w3.org/2001/XMLSchema#boolean> . }',
      ],
    ]);
  });

  describe('property paths', () => {
    runCases([
      [ 'sequence /', 'SELECT * WHERE { ?s <a>/<b> ?o }', `SELECT * WHERE { ?s (${iri('a')}/${iri('b')}) ?o . }` ],
      [ 'alternative |', 'SELECT * WHERE { ?s <a>|<b> ?o }', `SELECT * WHERE { ?s (${iri('a')}|${iri('b')}) ?o . }` ],
      [ 'inverse ^', 'SELECT * WHERE { ?s ^<a> ?o }', `SELECT * WHERE { ?s (^${iri('a')}) ?o . }` ],
      [ 'zero or more *', 'SELECT * WHERE { ?s <a>* ?o }', `SELECT * WHERE { ?s (${iri('a')}*) ?o . }` ],
      [ 'one or more +', 'SELECT * WHERE { ?s <a>+ ?o }', `SELECT * WHERE { ?s (${iri('a')}+) ?o . }` ],
      [ 'zero or one ?', 'SELECT * WHERE { ?s <a>? ?o }', `SELECT * WHERE { ?s (${iri('a')}?) ?o . }` ],
      [ 'negated !', 'SELECT * WHERE { ?s !<a> ?o }', `SELECT * WHERE { ?s (!(${iri('a')})) ?o . }` ],
      [ 'negated inverse !^', 'SELECT * WHERE { ?s !^<a> ?o }', `SELECT * WHERE { ?s (!(^${iri('a')})) ?o . }` ],
      [
        'negated alternative !(a|^b)',
        'SELECT * WHERE { ?s !(<a>|^<b>) ?o }',
        `SELECT * WHERE { ?s (!(${iri('a')}|^${iri('b')})) ?o . }`,
      ],
      [
        'nested (a/^b)*',
        'SELECT * WHERE { ?s (<a>/^<b>)* ?o }',
        `SELECT * WHERE { ?s ((${iri('a')}/(^${iri('b')}))*) ?o . }`,
      ],
    ]);
  });

  describe('graph patterns', () => {
    runCases([
      [
        'OPTIONAL',
        'SELECT * WHERE { ?s ?p ?o OPTIONAL { ?o ?q ?r } }',
        'SELECT * WHERE { ?s ?p ?o . OPTIONAL { ?o ?q ?r . } }',
      ],
      [
        'UNION with single-pattern branches, re-wrapped in groups',
        'SELECT * WHERE { { ?s ?p ?o } UNION { ?s ?q ?o } }',
        'SELECT * WHERE { { ?s ?p ?o . } UNION { ?s ?q ?o . } }',
      ],
      [
        'MINUS',
        'SELECT * WHERE { ?s ?p ?o MINUS { ?s ?q ?o } }',
        'SELECT * WHERE { ?s ?p ?o . MINUS { ?s ?q ?o . } }',
      ],
      [ 'GRAPH', 'SELECT * WHERE { GRAPH ?g { ?s ?p ?o } }', 'SELECT * WHERE { GRAPH ?g { ?s ?p ?o . } }' ],
      [
        'SERVICE SILENT',
        'SELECT * WHERE { SERVICE SILENT <sparql> { ?s ?p ?o } }',
        `SELECT * WHERE { SERVICE SILENT ${iri('sparql')} { ?s ?p ?o . } }`,
      ],
      [
        'BIND',
        'SELECT * WHERE { ?s ?p ?o BIND(STR(?o) AS ?x) }',
        'SELECT * WHERE { ?s ?p ?o . BIND( STR( ?o ) AS ?x ) }',
      ],
      [
        'FILTER EXISTS with a single pattern, re-wrapped in a group',
        'SELECT * WHERE { ?s ?p ?o FILTER EXISTS { ?o ?q ?r } }',
        'SELECT * WHERE { ?s ?p ?o . FILTER ( EXISTS { ?o ?q ?r . } ) }',
      ],
      [
        'FILTER NOT EXISTS',
        'SELECT * WHERE { ?s ?p ?o FILTER NOT EXISTS { ?o ?q ?r } }',
        'SELECT * WHERE { ?s ?p ?o . FILTER ( NOT EXISTS { ?o ?q ?r . } ) }',
      ],
    ]);
  });

  describe('operators and functions', () => {
    runCases([
      [
        'arithmetic and comparison keep their precedence: + - * / > and unary -',
        'SELECT * WHERE { ?s ?p ?o FILTER(?o + 1 * 2 - 3 / 4 > -5) }',
        `SELECT * WHERE { ?s ?p ?o . FILTER ( ( ( ( ?o + ( ${int('1')} * ${int('2')} ) ) - ( ${int('3')} / ${int('4')} ) ) ` +
        `> ${int('-5')} ) ) }`,
      ],
      [
        'logical operators and comparisons: ! && || = != <=',
        'SELECT * WHERE { ?s ?p ?o FILTER(!(?o = 1) && (?o != 2 || ?o <= 3)) }',
        `SELECT * WHERE { ?s ?p ?o . FILTER ( ( ! ( ?o = ${int('1')} ) && ( ( ?o != ${int('2')} ) || ` +
        `( ?o <= ${int('3')} ) ) ) ) }`,
      ],
      [
        'IN and NOT IN',
        'SELECT * WHERE { ?s ?p ?o FILTER(?o IN (1, 2) && ?o NOT IN (3)) }',
        `SELECT * WHERE { ?s ?p ?o . FILTER ( ( ( ?o IN ( ${int('1')} , ${int('2')} ) ) && ( ?o NOT IN ( ${int('3')} ) ) ) ) }`,
      ],
      [
        'built-in functions',
        'SELECT * WHERE { ?s ?p ?o FILTER(REGEX(STR(?o), "a", "i") && BOUND(?s) && isIRI(?s)) }',
        'SELECT * WHERE { ?s ?p ?o . FILTER ( ( ( REGEX( STR( ?o ) , "a" , "i" ) && BOUND( ?s ) ) && ISIRI( ?s ) ) ) }',
      ],
      [
        'function call by IRI (a cast)',
        'SELECT * WHERE { ?s ?p ?o FILTER(<http://www.w3.org/2001/XMLSchema#integer>(?o) > 1) }',
        `SELECT * WHERE { ?s ?p ?o . FILTER ( ( <http://www.w3.org/2001/XMLSchema#integer> ( ?o ) > ${int('1')} ) ) }`,
      ],
      [
        'aggregates: COUNT(*), COUNT(DISTINCT), GROUP_CONCAT with SEPARATOR, SUM',
        'SELECT (COUNT(*) AS ?c) (COUNT(DISTINCT ?o) AS ?d) (GROUP_CONCAT(?o; SEPARATOR=",") AS ?g) ' +
        '(SUM(?o) AS ?t) WHERE { ?s ?p ?o }',
        'SELECT ( COUNT( * ) AS ?c ) ( COUNT( DISTINCT ?o ) AS ?d ) ( GROUP_CONCAT( ?o ;SEPARATOR="," ) AS ?g ) ' +
        '( SUM( ?o ) AS ?t ) WHERE { ?s ?p ?o . }',
      ],
    ]);
  });

  describe('edge cases where SPARQL.js does not keep the original syntax', () => {
    runCases([
      [
        '[ ... ] becomes triples with a generated blank node',
        'SELECT * WHERE { ?s <p> [ <q> ?o ] }',
        `SELECT * WHERE { ?s ${iri('p')} _:0 . _:0 ${iri('q')} ?o . }`,
      ],
      [
        '( ... ) becomes rdf:first / rdf:rest triples',
        'SELECT * WHERE { ?s <p> (1) }',
        `SELECT * WHERE { ?s ${iri('p')} _:0 . _:0 <http://www.w3.org/1999/02/22-rdf-syntax-ns#first> ${int('1')} . ` +
        '_:0 <http://www.w3.org/1999/02/22-rdf-syntax-ns#rest> <http://www.w3.org/1999/02/22-rdf-syntax-ns#nil> . }',
      ],
      [
        'a label like _:0 coincides with the first generated blank node (known limitation)',
        'SELECT * WHERE { _:0 ?p ?o . [] ?q ?r }',
        'SELECT * WHERE { _:0 ?p ?o . _:0 ?q ?r . }',
      ],
      [
        'a blank node label may be reused within one basic graph pattern',
        'SELECT * WHERE { _:a ?p ?v . _:a ?q 1 }',
        `SELECT * WHERE { _:a ?p ?v . _:a ?q ${int('1')} . }`,
      ],
      [
        'the last PREFIX declaration of an update applies to every operation',
        'PREFIX ex: <http://example.org/> INSERT DATA { ex:a ex:a ex:a }; ' +
        'PREFIX ex: <http://example.org/other/> DELETE DATA { ex:a ex:a ex:a }',
        `PREFIX ex: ${iri('other/')} INSERT DATA { ${iri('a')} ${iri('a')} ${iri('a')} . } ; ` +
        `PREFIX ex: ${iri('other/')} DELETE DATA { ${iri('other/a')} ${iri('other/a')} ${iri('other/a')} . }`,
      ],
      [ 'an update with only a PREFIX', 'PREFIX a: <urn:a>', 'PREFIX a: <urn:a>' ],
      [ 'an update with only a BASE', 'BASE <http://other.org/>', 'BASE <http://other.org/>' ],
      [ 'an update with only a comment', '# nothing', '' ],
    ]);

    it('rejects a blank node label reused across basic graph patterns', ({ expect }) => {
      expect(() => roundTrip('SELECT * WHERE { _:a ?p ?v . { _:a ?q 1 } }')).toThrow(/reuse of blank node/u);
    });

    it('collapseIrisToPrefixed brings prefixed names back', ({ expect }) => {
      const query = parse(
        'PREFIX ex: <http://example.org/> SELECT * WHERE { ex:a ex:b <http://other.org/c> }',
      );
      const collapsed = collapseIrisToPrefixed(sparqlQueryFromSparqlJs(query), query.prefixes);
      expect(generator.generate(collapsed).replaceAll(/\s+/gu, ' ').trim())
        .toBe(`PREFIX ex: <${BASE}> SELECT * WHERE { ex:a ex:b <http://other.org/c> . }`);
    });
  });

  describe('hand-built input (not produced by the SPARQL.js parser)', () => {
    it('terms without termType', ({ expect }) => {
      const query = <SparqlJs.SelectQuery> {
        type: 'query',
        queryType: 'SELECT',
        prefixes: {},
        variables: [{ value: '*' }],
        where: [{
          type: 'bgp',
          triples: [
            { subject: { value: 's' }, predicate: { value: 'http://example.org/p' }, object: { value: 'o' }},
            { subject: { value: 'e_b' }, predicate: { value: 'p' }, object: { value: 'hi', language: 'en' }},
          ],
        }],
      };
      expect(generate(query)).toBe(`SELECT * WHERE { ?s ${iri('p')} ?o . _:b ?p "hi"@en . }`);
    });

    it('cONSTRUCT without a template gets an empty template', ({ expect }) => {
      const query = <SparqlJs.ConstructQuery> parse('CONSTRUCT WHERE { ?s ?p ?o }');
      delete query.template;
      expect(generate(query)).toBe('CONSTRUCT { } WHERE { ?s ?p ?o . }');
    });

    it('a function call whose function is a plain string', ({ expect }) => {
      const query = <SparqlJs.SelectQuery> parse('SELECT * WHERE { ?s ?p ?o }');
      query.where!.push({
        type: 'filter',
        expression: { type: 'functionCall', function: 'http://example.org/f', args: [ <SparqlJs.VariableTerm> { value: 'o' } ]},
      });
      expect(generate(query)).toBe(`SELECT * WHERE { ?s ?p ?o . FILTER ( ${iri('f')} ( ?o ) ) }`);
    });

    it('vALUES keys without a leading ?', ({ expect }) => {
      const query = <SparqlJs.SelectQuery> parse('SELECT * WHERE { ?s ?p ?o }');
      query.values = [{ x: <SparqlJs.IriTerm> { value: 'http://example.org/a' }}];
      expect(generate(query)).toBe(`SELECT * WHERE { ?s ?p ?o . } VALUES ?x { ${iri('a')} }`);
    });

    it('an update with an empty operations list', ({ expect }) => {
      expect(generate({ type: 'update', prefixes: { ex: 'http://example.org/' }, updates: []}))
        .toBe(`PREFIX ex: <${BASE}>`);
    });
  });
});
