import csv
import sys

import csv
import sys

def transform_csv(input_path: str, output_path: str) -> None:
    """
    Transforms an input CSV-like file where each row contains:
        name;time1;time2;...
    into a CSV file with two columns:
        name,execution_time

    Each execution_time is written on its own row, preserving all times.
    """
    rows = []
    with open(input_path, 'r', newline='') as infile:
        reader = csv.reader(infile, delimiter=';')
        for row in reader:
            if not row:
                continue
            name = row[0]
            try:
                times = [float(x) for x in row[1:]]
            except ValueError:
                continue
            if times:
                for t in times:
                    rows.append([name, t])

    with open(output_path, 'w', newline='') as outfile:
        writer = csv.writer(outfile)
        writer.writerow(["name", "execution_time"])
        writer.writerows(rows)


transform_csv("bench-times-no-cold-no-space.csv", 'transformed.csv')
