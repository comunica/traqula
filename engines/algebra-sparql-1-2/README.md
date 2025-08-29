<p align="center">
    <img alt="Traqula logo" width="70%" style="border-radius: 20px" src="/assets/white-on-red/logo-white-on-red-lettered-social.png">
</p>

<p align="center">
  <strong>A query language transpiler framework for JavaScript</strong>
</p>

# SPARQL to SPARQL Algebra converter

There is also support for 'non-algebra' entities such as ASK, FROM, etc.
to make sure the output contains all relevant information from the query.

## Translate

Input for the translate function should be a Traqula AST, by calling [Traqula parser](../parser-sparql-1-2).
More documentation can be found in the algebra [transformer for SPARQL 1.1](../algebra-sparql-1-1).
This transformer build on that one but also allows triple terms introduced in [SPARQL 1.2 spec](https://www.w3.org/TR/sparql12-query/).
