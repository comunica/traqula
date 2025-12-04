import matplotlib
matplotlib.use("Agg")  # headless backend
import matplotlib.pyplot as plt
import csv
import numpy as np
import textwrap

def wrap_labels(labels, width=12):
    """Wrap each label to a given character width."""
    return [textwrap.fill(label, width=width) for label in labels]

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

names = wrap_labels(names, width=30)
colors = ["#ffe6cc" if i >= 2 else "#d5e8d4" for i in range(len(names))]

# Plot bar graph
plt.figure(figsize=(12, 6))
bars = plt.bar(names, means, color=colors)
plt.ylabel("Mean Execution Time (ms)")
plt.xticks(rotation=0, ha="center")
plt.title("Mean Execution Time per Parser")

# Add text on top of each bar
for bar, mean_val in zip(bars, means):
    height = bar.get_height()
    plt.text(bar.get_x() + bar.get_width()/2.0, height,
             f"{mean_val:.2f}", ha='center', va='bottom', fontsize=12)

# Remove top and right borders (spines)
ax = plt.gca()
ax.spines['top'].set_visible(False)
ax.spines['right'].set_visible(False)

plt.tight_layout()
# Save as SVG
plt.savefig("barplot_means.svg", format="svg", transparent=True)
