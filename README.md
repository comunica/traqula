<p align="center">
    <img alt="Traqula logo" width="70%" style="border-radius: 20px" src="assets/white-on-red/logo-white-on-red-lettered-social.png">
</p>

<p align="center">
  <strong>A query language transpiler framework for JavaScript</strong>
</p>

**WARNING:** V2 will come shortly and will have lots of breaking changes.

This repository is a [monorepo](https://monorepo.tools/) containing multiple packages.
The purpose of Traqula is to provide highly flexible parsers/ generators for query languages.
Traqula achieves this by shipping default configurations as [engines](/engines) which can easily be modified by [builders](https://refactoring.guru/design-patterns/builder) found in the [core package of Traqula](/packages/core).

Traqula maintains a few engines (default parser/ generator configurations) built ontop of its own [code packages](/packages):
* For [SPARQL 1.1](https://www.w3.org/TR/sparql11-query/): a [parser](/engines/parser-sparql-1-1) and [generator](/engines/generator-sparql-1-1).
* For [SPARQL 1.2](https://www.w3.org/TR/sparql12-query/): a [parser](/engines/parser-sparql-1-2).
* For [SPARQL 1.1](https://www.w3.org/TR/sparql11-query/#grammar) + [ADJUST](https://github.com/w3c/sparql-dev/blob/main/SEP/SEP-0002/sep-0002.md) function: a [parser](/engines/parser-sparql-1-1-adjust).

## License

This software is written by [Jitse De Smet](https://jitsedesmet.be/).

This code is released under the [MIT license](https://opensource.org/license/MIT).
