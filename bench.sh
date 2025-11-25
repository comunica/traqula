#!/bin/bash

yarn bench engines/parser-sparql-1-1/test/bench-query/* > bench-to-ast11.txt
yarn bench engines/parser-sparql-1-2/test/bench-query/* > bench-to-ast12.txt

yarn bench engines/algebra-sparql-1-1/test/bench-query/* > bench-to-algebrat11.txt
yarn bench engines/algebra-sparql-1-1/test/bench-query/* > bench-to-algebrat112txt



