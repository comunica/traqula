<p align="center">
    <img alt="Traqula logo" width="70%" style="border-radius: 20px" src="assets/white-on-red/logo-white-on-red-lettered-social.png">
</p>

<p align="center">
  <strong>A query language transpiler framework for JavaScript</strong>
</p>

<p align="center">
<a href="https://github.com/comunica/traqula/actions?query=workflow%3ACI+branch%3Amain"><img src="https://github.com/comunica/traqula/actions/workflows/ci.yml/badge.svg" alt="Build Status"></a>
<a href='https://coveralls.io/github/comunica/traqula?branch=main'><img src='https://coveralls.io/repos/github/comunica/traqula/badge.svg?branch=main' alt='Coverage Status' /></a>
<a href="https://comunica.github.io/traqula/"><img src="https://img.shields.io/badge/doc-code_documentation-blueviolet"/></a>
</p>

This repository is a [monorepo](https://monorepo.tools/) containing multiple packages.
Traqula is a highly flexible framework for parsing, transforming and generating structured languages, with an initial focus on the [SPARQL](https://www.w3.org/TR/sparql11-query/) query language.
Traqula achieves this by shipping default configurations as [engines](engines) which can easily be modified by [builders](https://refactoring.guru/design-patterns/builder) found in the [core package of Traqula](packages/core).

Traqula maintains a few engines (default parser, transformer, and generator configurations) built on top of its own [code packages](packages):
* For [SPARQL 1.1](https://www.w3.org/TR/sparql11-query/): a [parser](engines/parser-sparql-1-1), [generator](engines/generator-sparql-1-1), and [algebra transformer](engines/algebra-sparql-1-1).
* For [SPARQL 1.2](https://www.w3.org/TR/sparql12-query/): a [parser](engines/parser-sparql-1-2), [generator](engines/generator-sparql-1-2), and [algebra transformer](engines/algebra-sparql-1-2).
* For [SPARQL 1.1](https://www.w3.org/TR/sparql11-query/#grammar) + [ADJUST](https://github.com/w3c/sparql-dev/blob/main/SEP/SEP-0002/sep-0002.md) function: a [parser](engines/parser-sparql-1-1-adjust), the generator and transformers of SPARQL1.1 also work here.

## Documentation

To use Traqula's engines, learn more in their respective READMEs as linked to above.
In order to create or modify the parsers, transformers and generators to your desire, we provide [**dedicated documentation pages**](docs/index.md).
If you are building a project that depends on Traqula, see the [**guidelines for dependent projects**](docs/guidelines.md).
Additionally, a documentation website is generated based on the source code's documentation: [https://comunica.github.io/traqula/](https://comunica.github.io/traqula/).
The source code itself is available on [GitHub](https://github.com/comunica/traqula/).

## Cite

If you are using or extending Traqula as part of a scientific publication,
we would appreciate a citation of our [article](https://traqula-resource.jitsedesmet.be/).

```bibtex
@inproceedings{De_Smet_Traqula_Providing_a_2026,
    address = {Dubrovnik, HR},
    author = {De Smet, Jitse and Taelman, Ruben},
    booktitle = {The Semantic Web},
    doi = {10.1007/978-3-032-25159-6\_13},
    month = may,
    pages = {232--252},
    publisher = {Springer Nature Switzerland},
    series = {23rd European Semantic Web Conference (ESWC 2026)},
    title = {{Traqula: Providing a Foundation for The Evolving SPARQL Ecosystem Through Modular Query Parsing, Transformation, and Generation}},
    url = {https://traqula-resource.jitsedesmet.be/},
    year = {2026}
}
```

## License

This software is written by [Jitse De Smet](https://jitsedesmet.be/).

This code is released under the [MIT license](https://opensource.org/license/MIT).
