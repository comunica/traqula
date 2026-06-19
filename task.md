SPARQL 1.2 has a codepoint escape policy: https://www.w3.org/TR/sparql12-query/#sec-escapes

In the current branch I added the static SPARQL for the new spec tests: https://github.com/w3c/rdf-tests/pull/348

You are tasked with fixing the current codepoint escape code of our 1.2 parser to cover the new spec tests.
In the end commit your changes (100% code coverage and passing pre commit hook) You cannot add vitest ignore lines!

Note that the snapshot tests added in @packages/test-utils/statics/ast/sparql/sparql-1-2/ are correct. The things they compare against not yet. The problem is that the parser currently throws on some of the added tests.
