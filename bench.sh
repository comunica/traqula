#!/bin/bash

yarn bench engines/parser-sparql-1-1/test/bench-query/*
#yarn bench engines/parser-sparql-1-2/test/bench-query/*
#yarn bench engines/algebra-sparql-1-1/test/bench-query/*
#yarn bench engines/algebra-sparql-1-2/test/bench-query/*


# cat bench-to-ast11.txt | grep -e '·' | sed -e 's/\( *[^ ]*\)\{3\} *\([^ ]*\)\( *[^ ]*\)\{4\} *\([^ ]*\)\( *[^ ]*\)\{1\}$/;\2;\4/' | sed -e 's/^[ ·]*//' | sed -e 's/[±%]//g' > bench-to-ast11.csv
# cat bench-to-ast12.txt | grep -e '·' | sed -e 's/\( *[^ ]*\)\{3\} *\([^ ]*\)\( *[^ ]*\)\{4\} *\([^ ]*\)\( *[^ ]*\)\{1\}$/;\2;\4/' | sed -e 's/^[ ·]*//' | sed -e 's/[±%]//g' > bench-to-ast12.csv
# cat bench-to-algebra11.txt | grep -e '·' | sed -e 's/\( *[^ ]*\)\{3\} *\([^ ]*\)\( *[^ ]*\)\{4\} *\([^ ]*\)\( *[^ ]*\)\{1\}$/;\2;\4/' | sed -e 's/^[ ·]*//' | sed -e 's/[±%]//g' > bench-to-algebra11.csv
# cat bench-to-algebra12.txt | grep -e '·' | sed -e 's/\( *[^ ]*\)\{3\} *\([^ ]*\)\( *[^ ]*\)\{4\} *\([^ ]*\)\( *[^ ]*\)\{1\}$/;\2;\4/' | sed -e 's/^[ ·]*//' | sed -e 's/[±%]//g' > bench-to-algebra12.csv


#cat bench-to-ast11.txt | grep -e '·' | sed -e 's/\( *[^ ]*\)\{1\} *\([^ ]*\) *\([^ ]*\) *\([^ ]*\)\( *[^ ]*\)\{4\} *\([^ ]*\)\( *[^ ]*\)\{1\}$/;\2;\3;\4;\6/' | \
#  sed -e 's/^[ ·]*//' | sed -e 's/[±%]//g' > bench-to-ast11.csv
#cat bench-to-ast12.txt | grep -e '·' | sed -e 's/\( *[^ ]*\)\{1\} *\([^ ]*\) *\([^ ]*\) *\([^ ]*\)\( *[^ ]*\)\{4\} *\([^ ]*\)\( *[^ ]*\)\{1\}$/;\2;\3;\4;\6/' | \
#  sed -e 's/^[ ·]*//' | sed -e 's/[±%]//g' > bench-to-ast12.csv
#cat bench-to-algebra11.txt | grep -e '·' | sed -e 's/\( *[^ ]*\)\{1\} *\([^ ]*\) *\([^ ]*\) *\([^ ]*\)\( *[^ ]*\)\{4\} *\([^ ]*\)\( *[^ ]*\)\{1\}$/;\2;\3;\4;\6/' | \
#  sed -e 's/^[ ·]*//' | sed -e 's/[±%]//g' > bench-to-algebra11.csv
#cat bench-to-algebra12.txt | grep -e '·' | sed -e 's/\( *[^ ]*\)\{1\} *\([^ ]*\) *\([^ ]*\) *\([^ ]*\)\( *[^ ]*\)\{4\} *\([^ ]*\)\( *[^ ]*\)\{1\}$/;\2;\3;\4;\6/' | \
#  sed -e 's/^[ ·]*//' | sed -e 's/[±%]//g' > bench-to-algebra12.csv
