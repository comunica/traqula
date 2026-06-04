The codepoint escape behaviour is being changed in SPARQL 1.2.
The PR that changes the behaviour is this: https://github.com/w3c/sparql-query/pull/384

You should edit the SPARQL 1.2 parser such that the escape code indeed only works in the dedicated parts.
To do this, you should change the 1.2 lexer and parser.
The few grammar rules that consume UCHAR should then also perform the string escaping.
Since multiple grammar rules will require the same string escape function,
you should ensure that the escape function is passed through the parser's context.
The default context creator should load our version of the escape function by default.

Note that all these changes only apply to the 1.2 parser, not the 1.1 parser.
