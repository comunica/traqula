# Implementing Your Own Parser

Traqula provides quite some quality of life improvements to implement a parser and round tripping generator with 'safe' typings.
To start using writing your own parser though, it is important you know we rely heavily on the amazing [chevrotain](https://chevrotain.io/docs/).
You will definitely see this reliance when writing a parser, it is therefore essential you familiarize yourself with that work.
As an alternative: learn on the fly by reading what the Traqula SPARQL parser does - oh what freedom MIT license gives you.

Ontop of the Chevrotain primitives, traqula uses builders to link together grammar.
More on that can be read in our [core README](../packages/core/README.md) or in the paper
[Towards tackling SPARQL heterogeneity through modular parsing](https://traqula-demo-semantics-2025.jitsedesmet.be/).

Another note:
Currently this has been created by a single person.
This means that things start to look 'logical' to me that might not be.
Please reach out to me when you have questions.
Especially feel free to make PRs to better the documentation if you think it is missing information.
