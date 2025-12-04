import csv

def transpose_csv_to_tsv(input_file, output_file):
    # Read the semicolon-separated input
    with open(input_file, newline='') as f:
        reader = csv.reader(f, delimiter=';')
        rows = list(reader)

    # Transpose (zip over rows)
    transposed = list(map(list, zip(*rows)))

    # Write TSV output
    with open(output_file, "w", newline='') as f:
        writer = csv.writer(f, delimiter='\t')
        writer.writerows(transposed)

if __name__ == "__main__":
    # Example:
    transpose_csv_to_tsv("bench-times-no-cold-no-space.csv", "bench-times-tests.tsv")
