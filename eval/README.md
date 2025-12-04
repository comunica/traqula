# Benchmark Traqula and generate conclusions

start by running the `bench.sh` script within the project root.
This will generate a file called `bench-times.csv`.
Most conclusions can be made without the `COLD` measurements, so feel free to delete them, and remove the duplicate evaluations of SPARQL.js - We did this in `bench-times-no-cold.csv`.


## Run statistic tests

To run the statistic tests in R, you first need to modify the output file. So create a copy of your measurements `bench-times-no-cold-no-space` and remove the spaces in the names (first column). Then execute the `csv-transformer.py` file, creating `transformed.csv`.

