# Benchmark Traqula and generate conclusions

Start by running the `bench.sh` script within the project root.
This will generate a file called `bench-times.csv`.
Next, we suggest removing any duplicate entries resulting from the fact that the benchmark suites are independent; and organizing relevant measurements together.
Most conclusions can be made without the `COLD` measurements, so feel free to delete them, we did this in `bench-times-no-cold.csv`.

Both the `bargraph.py` and `boxplot.py` scripts can be executed on this generated file.
For clarity of the figures we removed some entries (rows) and maybe renamed the measurements to result in clearer figures.

## Run statistic tests

To run the statistic tests in R, you first need to modify the output file.
So create a copy of your measurements `bench-times-no-cold-no-space` and rename the first column to the names matching our `bench-times-test.tsv` names,
where `ASTSRC` means AST + source tracking.
Then execute the `csv-transformer.py` file, creating `transformed.csv`.
Note that the input to this script should not contain the cold measurements because they are performed on fewer measurements (due to the significantly larger execution time).
