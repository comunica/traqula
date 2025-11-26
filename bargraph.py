import matplotlib
matplotlib.use("Agg")  # headless backend
import matplotlib.pyplot as plt
import csv
import numpy as np

CSV_FILE = "bench-times.csv"

names = []
means = []

# Read CSV row by row
with open(CSV_FILE, newline='') as csvfile:
    reader = csv.reader(csvfile, delimiter=';')
    for row in reader:
        if not row:
            continue
        name = row[0]
        # Convert remaining columns to floats
        measurements = [float(x.replace(',', '.')) for x in row[1:] if x.strip() != ""]
        if len(measurements) == 0:
            continue
        mean_val = np.mean(measurements)
        names.append(name)
        means.append(mean_val)

# Plot bar graph
plt.figure(figsize=(12, 6))
bars = plt.bar(names, means, color='skyblue')
plt.ylabel("Mean Execution Time")
plt.xticks(rotation=45, ha="right")
plt.title("Mean Execution Time per Tool / Query")

# Add text on top of each bar
for bar, mean_val in zip(bars, means):
    height = bar.get_height()
    plt.text(bar.get_x() + bar.get_width()/2.0, height,
             f"{mean_val:.2f}", ha='center', va='bottom', fontsize=9)

plt.tight_layout()

# Save as SVG
plt.savefig("barplot_means.svg", format="svg")
