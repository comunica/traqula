# Benchmark Traqula

We ran the benchmark twice, once on the
[50 DBPedia benchmark queries](../packages/test-utils/statics/ast/sparql/AKSWBenchmark), and once on our
[own 199 SPARQL test queries](../packages/test-utils/statics/ast/sparql/sparql-1-1).
Our paper:
`Traqula: Providing a Foundation for The Evolving SPARQL Ecosystem Through Modular Query Parsing, Transformation, and Generation`
details the evaluation of the 50 DBPedia queries.
To change the queries used, the `setup.ts` file should be altered for each of the engines tested by our [bench.sh](./bench.sh) script.

The precomputed measurements can be found in `res-dbpedia-bench` and `res-own-bench`.

## Run the benchmark

Start by running the `bench.sh` script within the project root.
This will generate a file called `bench-times.csv`.
Next, we suggest removing any duplicate entries resulting from the fact that the benchmark suites are independent;
and organizing relevant measurements together.
Most conclusions can be made without the `COLD` measurements, so feel free to delete them, we did this in `bench-times-no-cold.csv`.

Both the `bargraph.py` and `boxplot.py` scripts can be executed on this generated file.
For clarity of the figures we removed some entries (rows) and maybe renamed the measurements to result in clearer figures.
These modifications can be found in `boxplots.csv` and `bargraph.csv`.

## Run statistic tests

To run the statistic tests in R, you first need to modify the output file.
So create a copy of your measurements without COLD measurements and call it `bench-times-no-cold-no-space`,
than rename the first column to the names matching our `bench-times-test.tsv` names,
where `ASTSRC` means AST + source tracking.
Then execute the `csv-transformer.py` file, to create `transformed.csv`.
Note that the input to this script should not contain the cold measurements because they are performed on fewer measurements (due to the significantly larger execution time).
You can then execute the `analyze.r` script to discover the statistical significance of the varous pairwise differences.
