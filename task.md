You should scan the complete codebase for this issue, or similar and patch it.
Before you stop you should make sure the code still works and commit your changes (with passing pre commit).

### Reserved-key bypass in prefix validation (the one real bug)
Both the parser and the algebra transformer use a plain object as the prefix map and check membership with === undefined / truthiness instead of an own-property check:

- packages/rules-sparql-1-1/lib/grammar/literals.ts:257 — if (!C.skipValidation && C.prefixes[prefix] === undefined)
- packages/algebra-transformations-1-1/lib/toAlgebra/general.ts:28 — const expanded = currentPrefixes[term.prefix]; if (!expanded) ...

For a prefix named constructor, __proto__, toString, hasOwnProperty, valueOf, etc., the lookup resolves up the prototype chain to an inherited value, so the "Unknown prefix" guard never fires even though the prefix was never declared. In the transformer this then runs fullIri = expanded + term.value where expanded is a function (e.g. Object), yielding a garbage IRI like function Object() {...}foo or a TypeError. So a query such as SELECT * WHERE { ?s constructor:foo ?o } slips past validation.
I confirmed this is not global prototype pollution — assigning prefixes["__proto__"] = "..." on a plain object literal is a no-op for the global prototype. So the impact is a validation bypass plus a possible crash, not pollution. Fix is to use Object.hasOwn(C.prefixes, prefix) (or a Map, or a null-prototype object Object.create(null) for the map).
