import { toAst } from '@traqula/algebra-sparql-1-1';
import { toAlgebra } from '@traqula/algebra-sparql-1-2';
import { Generator } from '@traqula/generator-sparql-1-1';
import { Parser } from '@traqula/parser-sparql-1-2';
import { DataFactory } from 'rdf-data-factory';
import { describe, expect, it, vi } from 'vitest';
import { toSparql11Algebra, UnsupportedSparql12Error } from '../lib/index.js';

const parser = new Parser();
const generator = new Generator();
const prefixes = {
  '': 'http://example.org/',
  rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  xsd: 'http://www.w3.org/2001/XMLSchema#',
};
const header = Object.entries(prefixes).map(([ prefix, iri ]) => `PREFIX ${prefix}: <${iri}>`).join('\n');

/**
 * Rewrites a SPARQL 1.2 query to a SPARQL 1.1 one, in which the IRIs are written with the prefixes above.
 */
function rewrite(query: string): string {
  const algebra = toAlgebra(parser.parse(`${header}\n${query}`), { quads: true });
  let result = generator.generate(<any> toAst(toSparql11Algebra(algebra)));
  for (const [ prefix, iri ] of Object.entries(prefixes)) {
    result = result.replaceAll(new RegExp(`<${iri.replaceAll('.', String.raw`\.`)}([^>]*)>`, 'gu'), `${prefix}:$1`);
  }
  return result;
}

describe('toSparql11Algebra', () => {
  const rewrites: [name: string, query: string, expected: string][] = [
    [
      'expands a triple term in a BGP and drops base directions',
      `SELECT * { ?r rdf:reifies <<( :s :p "o"@en--ltr )>> . ?r :says "a"@en--rtl }`,
      `SELECT ?r WHERE {
  ?r rdf:reifies ?tt0 .
  ?tt0 rdf:subject :s .
  ?tt0 rdf:predicate :p .
  ?tt0 rdf:object "o"@en .
  ?r :says "a"@en .
}`,
    ],
    [
      'expands nested triple terms and reified triples',
      `SELECT * { << ?s :p <<( :a :b ?c )>> >> :q ?z }`,
      `SELECT ?c ?s ?z WHERE {
  _:g_0 rdf:reifies ?tt0 .
  ?tt0 rdf:subject ?s .
  ?tt0 rdf:predicate :p .
  ?tt0 rdf:object ?tt1 .
  ?tt1 rdf:subject :a .
  ?tt1 rdf:predicate :b .
  ?tt1 rdf:object ?c .
  _:g_0 :q ?z .
}`,
    ],
    [
      'expands annotations',
      `SELECT * { ?s :p ?o {| :q 1 |} }`,
      `SELECT ?o ?s WHERE {
  ?s :p ?o .
  _:g_1 rdf:reifies ?tt0 .
  ?tt0 rdf:subject ?s .
  ?tt0 rdf:predicate :p .
  ?tt0 rdf:object ?o .
  _:g_1 :q "1"^^xsd:integer .
}`,
    ],
    [
      'expands a triple term at the end of a path',
      `SELECT * { ?s :p* <<( :a :b ?c )>> . ?s :q+ ?d }`,
      `SELECT ?c ?d ?s WHERE {
  ?s (:p*) ?tt0 .
  ?tt0 rdf:subject :a .
  ?tt0 rdf:predicate :b .
  ?tt0 rdf:object ?c .
  ?s (:q+) ?d .
}`,
    ],
    [
      'expands a triple term in a named graph',
      `SELECT ?r { GRAPH ?g { ?r :p <<( :s :p :o )>> } }`,
      `SELECT ?r WHERE {
  GRAPH ?g {
    ?r :p ?tt0 .
    ?tt0 rdf:subject :s .
    ?tt0 rdf:predicate :p .
    ?tt0 rdf:object :o .
  }
}`,
    ],
    [
      'expands a triple term in a CONSTRUCT template to blank nodes',
      `CONSTRUCT { ?s :p <<( ?s :p ?o )>> } WHERE { ?s :p ?o }`,
      `CONSTRUCT {
  ?s :p _:tt0 .
  _:tt0 rdf:subject ?s .
  _:tt0 rdf:predicate :p .
  _:tt0 rdf:object ?o .
}
WHERE {
  ?s :p ?o .
}`,
    ],
    [
      'expands a triple term in an INSERT template to blank nodes',
      `INSERT { ?s :p <<( ?s :p ?o )>> } WHERE { ?s :p ?o }`,
      `INSERT {
  ?s :p _:tt0 .
  _:tt0 rdf:subject ?s .
  _:tt0 rdf:predicate :p .
  _:tt0 rdf:object ?o .
}
WHERE {
  ?s :p ?o .
}`,
    ],
    [
      'expands a triple term in INSERT DATA and in the pattern of a DELETE',
      `INSERT DATA { :s :p <<( :s :p :o )>> } ; DELETE { ?r :q ?o } WHERE { ?r :p <<( :s :p ?o )>> } ; CLEAR ALL`,
      `INSERT DATA {
  :s :p _:tt0 .
  _:tt0 rdf:subject :s .
  _:tt0 rdf:predicate :p .
  _:tt0 rdf:object :o .
}
;
DELETE {
  ?r :q ?o .
}
WHERE {
  ?r :p ?tt1 .
  ?tt1 rdf:subject :s .
  ?tt1 rdf:predicate :p .
  ?tt1 rdf:object ?o .
}
;
CLEAR ALL`,
    ],
    [
      'makes the accessors of something the query did not bind an error',
      `SELECT ?s { ?s :p ?t FILTER(isTRIPLE(?t) && isTRIPLE(:a) && isTRIPLE(STR(?t)) && SUBJECT(?t) = :s && PREDICATE(?s) = :p) BIND(OBJECT(?t) AS ?o) }`,
      `SELECT ?s WHERE {
  {
    ?s :p ?t .
    BIND( COALESCE( ) AS ?o )
  }
  FILTER ( ( ( ( ( IF( BOUND( ?t ) , "false"^^xsd:boolean , COALESCE( ) ) && "false"^^xsd:boolean ) && IF( IF( SAMETERM( STR( ?t ) , STR( ?t ) ) , "true"^^xsd:boolean , "true"^^xsd:boolean ) , "false"^^xsd:boolean , COALESCE( ) ) ) && ( COALESCE( ) = :s ) ) && ( COALESCE( ) = :p ) ) )
}`,
    ],
    [
      'resolves the accessors of a variable bound to TRIPLE',
      `SELECT ?a ?b ?c { BIND(TRIPLE(?s, ?p, ?o) AS ?x) BIND(SUBJECT(?x) AS ?a) BIND(PREDICATE(?x) AS ?b) BIND(OBJECT(?x) AS ?c) FILTER(isTRIPLE(?x) && bound(?x) && bound(?a)) }`,
      `SELECT ?a ?b ?c WHERE {
  {
    BIND( IF( ( ( ( ISIRI( ?s ) || ISBLANK( ?s ) ) && ISIRI( ?p ) ) && BOUND( ?o ) ) , ?s , COALESCE( ) ) AS ?tt_x_s )
    BIND( IF( ( ( ( ISIRI( ?s ) || ISBLANK( ?s ) ) && ISIRI( ?p ) ) && BOUND( ?o ) ) , ?p , COALESCE( ) ) AS ?tt_x_p )
    BIND( IF( ( ( ( ISIRI( ?s ) || ISBLANK( ?s ) ) && ISIRI( ?p ) ) && BOUND( ?o ) ) , ?o , COALESCE( ) ) AS ?tt_x_o )
    BIND( ?tt_x_s AS ?a )
    BIND( ?tt_x_p AS ?b )
    BIND( ?tt_x_o AS ?c )
  }
  FILTER ( ( ( IF( BOUND( ?tt_x_s ) , "true"^^xsd:boolean , COALESCE( ) ) && BOUND( ?tt_x_s ) ) && BOUND( ?a ) ) )
}`,
    ],
    [
      'resolves the accessors of a variable bound to a written triple term',
      `SELECT ?a { BIND(<<( :s ?p 1 )>> AS ?x) BIND(?x AS ?y) BIND(PREDICATE(?y) AS ?a) }`,
      `SELECT ( ?tt_y_p AS ?a ) WHERE {
  BIND( IF( ISIRI( ?p ) , :s , COALESCE( ) ) AS ?tt_x_s )
  BIND( IF( ISIRI( ?p ) , ?p , COALESCE( ) ) AS ?tt_x_p )
  BIND( IF( ISIRI( ?p ) , "1"^^xsd:integer , COALESCE( ) ) AS ?tt_x_o )
  BIND( ?tt_x_s AS ?tt_y_s )
  BIND( ?tt_x_p AS ?tt_y_p )
  BIND( ?tt_x_o AS ?tt_y_o )
}`,
    ],
    [
      'resolves nested triple terms bound to variables',
      `SELECT ?a ?b { BIND(<<( :s :p <<( :a :b 1 )>> )>> AS ?x) BIND(OBJECT(?x) AS ?y) BIND(?x AS ?z) BIND(OBJECT(OBJECT(?z)) AS ?a) BIND(TRIPLE(?a, :p, OBJECT(?x)) AS ?w) BIND(SUBJECT(OBJECT(?w)) AS ?b) }`,
      `SELECT ?a ( ?tt_tt_w_o_s AS ?b ) WHERE {
  BIND( :s AS ?tt_x_s )
  BIND( :p AS ?tt_x_p )
  BIND( :a AS ?tt_tt_x_o_s )
  BIND( :b AS ?tt_tt_x_o_p )
  BIND( "1"^^xsd:integer AS ?tt_tt_x_o_o )
  BIND( ?tt_tt_x_o_s AS ?tt_y_s )
  BIND( ?tt_tt_x_o_p AS ?tt_y_p )
  BIND( ?tt_tt_x_o_o AS ?tt_y_o )
  BIND( ?tt_x_s AS ?tt_z_s )
  BIND( ?tt_x_p AS ?tt_z_p )
  BIND( ?tt_tt_x_o_s AS ?tt_tt_z_o_s )
  BIND( ?tt_tt_x_o_p AS ?tt_tt_z_o_p )
  BIND( ?tt_tt_x_o_o AS ?tt_tt_z_o_o )
  BIND( ?tt_tt_z_o_o AS ?a )
  BIND( IF( ( ( ISIRI( ?a ) || ISBLANK( ?a ) ) && BOUND( ?tt_x_s ) ) , ?a , COALESCE( ) ) AS ?tt_w_s )
  BIND( IF( ( ( ISIRI( ?a ) || ISBLANK( ?a ) ) && BOUND( ?tt_x_s ) ) , :p , COALESCE( ) ) AS ?tt_w_p )
  BIND( IF( ( ( ISIRI( ?a ) || ISBLANK( ?a ) ) && BOUND( ?tt_x_s ) ) , ?tt_tt_x_o_s , COALESCE( ) ) AS ?tt_tt_w_o_s )
  BIND( IF( ( ( ISIRI( ?a ) || ISBLANK( ?a ) ) && BOUND( ?tt_x_s ) ) , ?tt_tt_x_o_p , COALESCE( ) ) AS ?tt_tt_w_o_p )
  BIND( IF( ( ( ISIRI( ?a ) || ISBLANK( ?a ) ) && BOUND( ?tt_x_s ) ) , ?tt_tt_x_o_o , COALESCE( ) ) AS ?tt_tt_w_o_o )
}`,
    ],
    [
      'resolves the accessors of a triple term that is not bound to a variable',
      `SELECT ?a ?b ?c { BIND(SUBJECT(TRIPLE(?s, :p, STR(?o))) AS ?a) BIND(OBJECT(<<( :s :p :o )>>) AS ?b) BIND(SUBJECT(OBJECT(TRIPLE(:s, :p, TRIPLE(?s, :p, :o)))) AS ?c) }`,
      `SELECT ( IF( ( ( ISIRI( ?s ) || ISBLANK( ?s ) ) && IF( SAMETERM( STR( ?o ) , STR( ?o ) ) , "true"^^xsd:boolean , "true"^^xsd:boolean ) ) , ?s , COALESCE( ) ) AS ?a ) ( :o AS ?b ) ( IF( ( ISIRI( ?s ) || ISBLANK( ?s ) ) , ?s , COALESCE( ) ) AS ?c ) WHERE {
}`,
    ],
    [
      'expands a variable bound to a triple term in a BGP',
      `SELECT ?r { BIND(TRIPLE(:s, :p, ?o) AS ?x) ?r rdf:reifies ?x }`,
      `SELECT ?r WHERE {
  {
    BIND( IF( BOUND( ?o ) , :s , COALESCE( ) ) AS ?tt_x_s )
    BIND( IF( BOUND( ?o ) , :p , COALESCE( ) ) AS ?tt_x_p )
    BIND( IF( BOUND( ?o ) , ?o , COALESCE( ) ) AS ?tt_x_o )
  }
  ?r rdf:reifies ?tt0 .
  ?tt0 rdf:subject ?tt_x_s .
  ?tt0 rdf:predicate ?tt_x_p .
  ?tt0 rdf:object ?tt_x_o .
}`,
    ],
    [
      'expands a variable bound to a triple term in a template',
      `CONSTRUCT { :r rdf:reifies ?x } WHERE { BIND(TRIPLE(:s, :p, :o) AS ?x) }`,
      `CONSTRUCT {
  :r rdf:reifies _:tt0 .
  _:tt0 rdf:subject ?tt_x_s .
  _:tt0 rdf:predicate ?tt_x_p .
  _:tt0 rdf:object ?tt_x_o .
}
WHERE {
  BIND( :s AS ?tt_x_s )
  BIND( :p AS ?tt_x_p )
  BIND( :o AS ?tt_x_o )
}`,
    ],
    [
      'takes apart the triple terms of VALUES',
      `SELECT ?a ?l { VALUES (?x ?l) { (<<( :s :p <<( :a :b "a"@en--rtl )>> )>> "l"@en--ltr) (UNDEF :l) } BIND(SUBJECT(OBJECT(?x)) AS ?a) }`,
      `SELECT ( ?tt_tt_x_o_s AS ?a ) ?l WHERE {
  VALUES( ?tt_x_s ?tt_x_p ?tt_tt_x_o_s ?tt_tt_x_o_p ?tt_tt_x_o_o ?l ){
    ( :s :p :a :b "a"@en "l"@en )
    ( UNDEF UNDEF UNDEF UNDEF UNDEF :l )
  }
}`,
    ],
    [
      'projects and groups the components of a variable bound to a triple term',
      `SELECT ?c (COUNT(*) AS ?n) (MAX(?o) AS ?m) { { SELECT ?x ?o { BIND(<<( :s :p 1 )>> AS ?x) ?s :p ?o } } BIND(OBJECT(?x) AS ?c) } GROUP BY ?x ?c`,
      `SELECT ?c ( COUNT( * ) AS ?n ) ( MAX( ?o ) AS ?m ) WHERE {
  SELECT ?tt_x_s ?tt_x_p ?tt_x_o ?o WHERE {
    {
      BIND( :s AS ?tt_x_s )
      BIND( :p AS ?tt_x_p )
      BIND( "1"^^xsd:integer AS ?tt_x_o )
    }
    ?s :p ?o .
  }
}
GROUP BY ?tt_x_s ?tt_x_p ?tt_x_o ( ?tt_x_o AS ?c )`,
    ],
    [
      'compares triple terms by their components',
      `SELECT ?a ?b ?c ?d ?e { BIND(sameTerm(<<( ?s :p <<( :a :b 1 )>> )>>, TRIPLE(:s, ?p, <<( :a :b 2 )>>)) AS ?a) BIND(<<( :s :p 1 )>> = ?o AS ?b) BIND(1 != <<( :s :p <<( :a :b 1 )>> )>> AS ?c) BIND(?s != ?o AS ?d) BIND(<<( :s :p 1 )>> = <<( :s :p <<( :a :b 1 )>> )>> AS ?e) }`,
      `SELECT ( IF( ( ( ISIRI( ?s ) || ISBLANK( ?s ) ) && ISIRI( ?p ) ) , ( ( SAMETERM( ?s , :s ) && SAMETERM( :p , ?p ) ) && ( ( SAMETERM( :a , :a ) && SAMETERM( :b , :b ) ) && SAMETERM( "1"^^xsd:integer , "2"^^xsd:integer ) ) ) , COALESCE( ) ) AS ?a ) ( IF( BOUND( ?o ) , "false"^^xsd:boolean , COALESCE( ) ) AS ?b ) ( ! "false"^^xsd:boolean AS ?c ) ( ( ?s != ?o ) AS ?d ) ( ( ( ( :s = :s ) && ( :p = :p ) ) && "false"^^xsd:boolean ) AS ?e ) WHERE {
}`,
    ],
    [
      'rewrites the functions on base directions',
      `SELECT ?a ?b ?c ?d { BIND(LANGDIR(?l) AS ?a) BIND(hasLANGDIR(?l) AS ?b) BIND(hasLANG(?l) AS ?c) BIND(STRLANGDIR("a", "en", ?dir) AS ?d) }`,
      `SELECT ( IF( ISLITERAL( ?l ) , ""^^xsd:string , COALESCE( ) ) AS ?a ) ( IF( BOUND( ?l ) , "false"^^xsd:boolean , COALESCE( ) ) AS ?b ) ( ( ISLITERAL( ?l ) && ( LANG( ?l ) != ""^^xsd:string ) ) AS ?c ) ( IF( ( ( ?dir = "ltr"^^xsd:string ) || ( ?dir = "rtl"^^xsd:string ) ) , STRLANG( "a"^^xsd:string , "en"^^xsd:string ) , COALESCE( ) ) AS ?d ) WHERE {
}`,
    ],
    [
      'rewrites within every kind of operation',
      `SELECT DISTINCT ?s { { ?s :p ?o } UNION { ?s :q ?o MINUS { ?s :r "a"@en--ltr } } OPTIONAL { ?s :t ?u FILTER(?u = "b"@en--ltr) } FILTER(EXISTS { ?s :p <<( :s :p :o )>> } && :f("c"@en--ltr)) } ORDER BY LANGDIR(?o) LIMIT 1`,
      `SELECT DISTINCT ?s WHERE {
  {
    ?s :p ?o .
  }
  UNION {
    ?s :q ?o .
    MINUS {
      ?s :r "a"@en .
    }
  }
  OPTIONAL {
    ?s :t ?u .
    FILTER ( ( ?u = "b"@en ) )
  }
  FILTER ( ( EXISTS {
    ?s :p ?tt0 .
    ?tt0 rdf:subject :s .
    ?tt0 rdf:predicate :p .
    ?tt0 rdf:object :o .
  }
  && :f ( "c"@en ) ) )
}
ORDER BY ASC ( IF( ISLITERAL( ?o ) , ""^^xsd:string , COALESCE( ) ) )
LIMIT 1`,
    ],
    [
      'leaves queries without a projection be',
      `ASK { ?s :p <<( :s :p :o )>> }`,
      `ASK WHERE {
  ?s :p ?tt0 .
  ?tt0 rdf:subject :s .
  ?tt0 rdf:predicate :p .
  ?tt0 rdf:object :o .
}`,
    ],
    [
      'describes',
      `DESCRIBE ?s { ?s :p <<( :s :p :o )>> }`,
      `DESCRIBE ?s WHERE {
  ?s :p ?tt0 .
  ?tt0 rdf:subject :s .
  ?tt0 rdf:predicate :p .
  ?tt0 rdf:object :o .
}`,
    ],
    [
      'coins names that are not in the query',
      `SELECT ?tt0 { ?tt0 :p <<( :s :p ?tt_x_s )>> BIND(TRIPLE(:s, :p, ?tt0) AS ?x) FILTER(isTRIPLE(?x)) }`,
      `SELECT ?tt0 WHERE {
  {
    ?tt0 :p ?ttt0 .
    ?ttt0 rdf:subject :s .
    ?ttt0 rdf:predicate :p .
    ?ttt0 rdf:object ?tt_x_s .
    BIND( IF( BOUND( ?tt0 ) , :s , COALESCE( ) ) AS ?ttt_x_s )
    BIND( IF( BOUND( ?tt0 ) , :p , COALESCE( ) ) AS ?ttt_x_p )
    BIND( IF( BOUND( ?tt0 ) , ?tt0 , COALESCE( ) ) AS ?ttt_x_o )
  }
  FILTER ( IF( BOUND( ?ttt_x_s ) , "true"^^xsd:boolean , COALESCE( ) ) )
}`,
    ],
    [
      'expands a triple term in a SERVICE',
      `SELECT ?r { SERVICE :e { ?r :p <<( :s :p :o )>> } }`,
      `SELECT ?r WHERE {
  SERVICE :e {
    ?r :p ?tt0 .
    ?tt0 rdf:subject :s .
    ?tt0 rdf:predicate :p .
    ?tt0 rdf:object :o .
  }
}`,
    ],
  ];

  it.each(rewrites)('%s', (_, query, expected) => {
    expect(rewrite(query)).toBe(expected);
  });

  const unsupported: [name: string, query: string, message: string][] = [
    [
      'a triple term in the solutions of the query',
      `SELECT DISTINCT ?x { BIND(<<( :s :p 1 )>> AS ?x) } ORDER BY ?a LIMIT 1`,
      '?x holds a triple term where its components cannot be read',
    ],
    [
      'a variable bound to a triple term in a function',
      `SELECT ?a { BIND(<<( :s :p 1 )>> AS ?x) BIND(STR(?x) AS ?a) }`,
      '?x holds a triple term where its components cannot be read',
    ],
    [
      'a triple term in a function',
      `SELECT ?a { BIND(STR(<<( :s :p 1 )>>) AS ?a) }`,
      'a triple term is used where its components cannot be read',
    ],
    [
      'a TRIPLE in a function',
      `SELECT ?a { BIND(STR(TRIPLE(:s, :p, 1)) AS ?a) }`,
      'a triple term is used where its components cannot be read',
    ],
    [
      'an object that is a triple term in a function',
      `SELECT ?a { BIND(STR(OBJECT(<<( :s :p <<( :a :b 1 )>> )>>)) AS ?a) }`,
      'a triple term is used where its components cannot be read',
    ],
    [
      'a variable bound to a triple term as predicate',
      `SELECT ?s { BIND(<<( :s :p 1 )>> AS ?x) ?s ?x ?o }`,
      '?x holds a triple term where its components cannot be read',
    ],
    [
      'an aggregate over a variable bound to a triple term',
      `SELECT (SAMPLE(?x) AS ?a) { BIND(<<( :s :p 1 )>> AS ?x) }`,
      '?x holds a triple term where its components cannot be read',
    ],
    [
      'a variable bound to a triple term and to something else',
      `SELECT ?a { { BIND(<<( :s :p 1 )>> AS ?x) } UNION { BIND(1 AS ?x) } BIND(SUBJECT(?x) AS ?a) }`,
      '?x is bound to a triple term and to another expression',
    ],
    [
      'VALUES mixing triple terms and other terms',
      `SELECT ?a { VALUES ?x { <<( :s :p 1 )>> 1 } BIND(SUBJECT(?x) AS ?a) }`,
      'VALUES binds ?x to triple terms and to other terms',
    ],
    [
      'VALUES binding other terms to a variable bound to a triple term',
      `SELECT ?a { { VALUES ?x { <<( :s :p 1 )>> } } UNION { VALUES ?x { 1 } } BIND(SUBJECT(?x) AS ?a) }`,
      '?x holds a triple term where its components cannot be read',
    ],
    [
      'deleting a triple term',
      `DELETE { ?r :p <<( :s :p :o )>> } WHERE { ?r :q :o }`,
      'a triple term is deleted',
    ],
    [
      'variables nesting triple terms without end',
      `SELECT ?a { { BIND(TRIPLE(:s, :p, ?x) AS ?y) } UNION { BIND(?y AS ?x) } BIND(SUBJECT(?x) AS ?a) }`,
      'the query nests triple terms too deeply through its variables',
    ],
  ];

  it.each(unsupported)('throws on %s', (_, query, message) => {
    expect(() => rewrite(query)).toThrow(new UnsupportedSparql12Error(message));
  });

  it('leaves its input untouched and uses the given data factory', () => {
    // Without quads, so the algebra has a GRAPH operation
    const algebra = toAlgebra(parser.parse('SELECT ?r { GRAPH ?g { ?r <ex:p> <<( <ex:s> <ex:p> "o"@en--ltr )>> } }'));
    const copy = structuredClone(algebra);
    const dataFactory = new DataFactory();
    const variable = vi.spyOn(dataFactory, 'variable');
    toSparql11Algebra(algebra, { dataFactory });
    expect(algebra).toEqual(copy);
    expect(variable).toHaveBeenCalledWith('tt0');
  });
});
