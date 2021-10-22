# SPARQL to SPARQL Algebra converter

[![npm version](https://badge.fury.io/js/sparqlalgebrajs.svg)](https://www.npmjs.com/package/sparqlalgebrajs)
[![Build status](https://github.com/joachimvh/SPARQLAlgebra.js/workflows/CI/badge.svg)](https://github.com/joachimvh/SPARQLAlgebra.js/actions?query=workflow%3ACI)

2 components get exposed: the **translate** function and the **Algebra** object,
which contains all the output types that can occur.

Note that this is still a work in progress so naming conventions could change.
There is also support for 'non-algebra' entities such as ASK, FROM, etc.
to make sure the output contains all relevant information from the query.

## Translate

Input for the translate function should either be a SPARQL string
or a result from calling [SPARQL.js](https://github.com/RubenVerborgh/SPARQL.js).

```javascript
const { translate } = require('sparqlalgebrajs');
translate('SELECT * WHERE { ?x ?y ?z }');
```
Returns:
```json
{ 
  "type": "project",
  "input": {
    "type": "bgp",
      "patterns": [{
        "type": "pattern",
        "termType": "Quad",
        "subject": { "termType": "Variable", "value": "x" },
        "predicate": { "termType": "Variable", "value": "y" },
        "object": { "termType": "Variable", "value": "z" },
        "graph": { "termType": "DefaultGraph", "value": "" }
      }]
  },
  "variables": [
    { "termType": "Variable", "value": "x" },
    { "termType": "Variable", "value": "y" },
    { "termType": "Variable", "value": "z" }
  ]
}

```

Translating back to SPARQL can be done with the `toSparql` (or `toSparqlJs`) function.

## Algebra object
The algebra object contains a `types` object,
which contains all possible values for the `type` field in the output results.
Besides that it also contains all the TypeScript interfaces of the possible output results.
The output of the `translate` function will always be an `Algebra.Operation` instance.

The best way to see what output would be generated is to look in the `test` folder,
where we have many SPARQL queries and their corresponding algebra output.

## Deviations from the spec
This implementation tries to stay as close to the SPARQL 1.1
[specification](https://www.w3.org/TR/sparql11-query/#sparqlDefinition),
but some changes were made for ease of use.
These are mostly based on the Jena ARQ [implementation](https://jena.apache.org/documentation/query/).
What follows is a non-exhaustive list of deviations:

#### Named parameters
This is the biggest visual change.
The functions no longer take an ordered list of parameters but a named list instead.
The reason for this is to prevent having to memorize the order of parameters and also
due to seeing some differences between the spec and the Jena ARQ SSE output when ordering parameters.

#### Multiset/List conversion
The functions `toMultiset` and `toList` have been removed for brevity.
Conversions between the two are implied by the operations used.

#### Quads
The `translate` function has an optional second parameter
indicating whether patterns should be translated to triple or quad patterns.
In the case of quads the `graph` operation will be removed
and embedded into the patterns it contained.
The default value for this parameter is `false`.
```
PREFIX : <http://www.example.org/>

SELECT ?x WHERE {
    GRAPH ?g {?x ?y ?z}
}
```

Default result:
```json
{
  "type": "project",
    "input": {
    "type": "graph",
      "input": {
      "type": "bgp",
        "patterns": [{
          "type": "pattern",
          "termType": "Quad",
          "subject": { "termType": "Variable", "value": "x" },
          "predicate": { "termType": "Variable", "value": "y" },
          "object": { "termType": "Variable", "value": "z" },
          "graph": { "termType": "DefaultGraph", "value": "" }
        }]
    },
    "name": { "termType": "Variable", "value": "g" }
  },
  "variables": [{ "termType": "Variable", "value": "x" }]
}

```

With quads:
```json
{
  "type": "project",
    "input": {
    "type": "bgp",
      "patterns": [{
        "type": "pattern",
        "termType": "Quad",
        "subject": { "termType": "Variable", "value": "x" },
        "predicate": { "termType": "Variable", "value": "y" },
        "object": { "termType": "Variable", "value": "z" },
        "graph": { "termType": "Variable", "value": "g" }
      }]
  },
  "variables": [{ "termType": "Variable", "value": "x" }]
}

```

### Flattened operators
Several binary operators that can be nested, 
such as the path operators,
can take an array of input entries to simply this notation.
For example, the following SPARQL:
```sparql
SELECT * WHERE { ?x <a:a>|<b:b>|<c:c> ?z }
```
outputs the following algebra:
```json
{
  "type": "project",
  "input": {
    "type": "path",
    "subject": { "termType": "Variable", "value": "x" },
    "predicate": {
      "type": "alt",
      "input": [
        { "type": "link", "iri": { "termType": "NamedNode", "value": "a:a" }},
        { "type": "link", "iri": { "termType": "NamedNode", "value": "b:b" }},
        { "type": "link", "iri": { "termType": "NamedNode", "value": "c:c" }}
      ]
    },
    "object": { "termType": "Variable", "value": "z" },
    "graph": { "termType": "DefaultGraph", "value": "" }
  },
  "variables": [
    { "termType": "Variable", "value": "x" },
    { "termType": "Variable", "value": "z" }
  ]
}

```

#### SPARQL*

[SPARQL*](https://blog.liu.se/olafhartig/2019/01/10/position-statement-rdf-star-and-sparql-star/) queries can be parsed by setting `sparqlStar` to true in the `translate` options.

#### VALUES
For the VALUES block we return the following output:
```
PREFIX dc:   <http://purl.org/dc/elements/1.1/> 
PREFIX :     <http://example.org/book/> 
PREFIX ns:   <http://example.org/ns#> 

SELECT ?book ?title ?price
{
   VALUES ?book { :book1 :book3 }
   ?book dc:title ?title ;
         ns:price ?price .
}
```
```json
{
  "type": "project",
  "input": {
    "type": "join",
    "input": [
      {
        "type": "values",
        "variables": [{ "termType": "Variable", "value": "book" }],
        "bindings": [
          { "?book": { "termType": "NamedNode", "value": "http://example.org/book/book1" }},
          { "?book": { "termType": "NamedNode", "value": "http://example.org/book/book3" }}
        ]
      },
      {
        "type": "bgp",
        "patterns": [
          {
            "type": "pattern",
            "termType": "Quad",
            "subject": { "termType": "Variable", "value": "book" },
            "predicate": { "termType": "NamedNode", "value": "http://purl.org/dc/elements/1.1/title" },
            "object": { "termType": "Variable", "value": "title" },
            "graph": { "termType": "DefaultGraph", "value": "" }
          },
          {
            "type": "pattern",
            "termType": "Quad",
            "subject": { "termType": "Variable", "value": "book" },
            "predicate": { "termType": "NamedNode", "value": "http://example.org/ns#price" },
            "object": { "termType": "Variable", "value": "price" },
            "graph": { "termType": "DefaultGraph", "value": "" }
          }
        ]
      }
    ]
  },
  "variables": [
    { "termType": "Variable", "value": "book" },
    { "termType": "Variable", "value": "title" },
    { "termType": "Variable", "value": "price" }
  ]
}

```

#### Differences from Jena ARQ
Some differences from Jena (again, non-exhaustive):
no prefixes are used (all uris get expanded)
and the project operation always gets used (even in the case of `SELECT *`).

## A note on tests
Every test consists of a sparql file and a corresponding json file containing the algebra result.
Tests ending with `(quads)` in their name are tested/generated with `quads: true` in the options.

If you need to regenerate the parsed JSON files in bulk, you can invoke `node test/generate-json.js`.
