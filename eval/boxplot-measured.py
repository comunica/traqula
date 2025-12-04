import matplotlib
matplotlib.use("Agg")  # headless backend

import matplotlib.pyplot as plt
import csv
import textwrap

def wrap_labels(labels, width=12):
    """Wrap each label to a given character width."""
    return [textwrap.fill(label, width=width) for label in labels]


CSV_FILE = "my-bench-times.csv"

names = []
data_to_plot = []

with open(CSV_FILE, newline='') as csvfile:
    reader = csv.reader(csvfile, delimiter=';')
    for row in reader:
        if not row:
            continue
        names.append(row[0])  # first column is name
        # convert remaining columns to float
        measurements = [float(x.replace(',', '.')) for x in row[1:] if x.strip() != ""]
        data_to_plot.append(measurements)

names = wrap_labels(names, width=20)

# Customize outliers
flierprops = dict(marker='o', markerfacecolor='gray', markersize=2, linestyle='none', markeredgecolor='gray')

# Plot boxplot
plt.figure(figsize=(12, 8))
plt.boxplot(data_to_plot, tick_labels=names, vert=True, flierprops=flierprops, showfliers=False)

# Rotate x-axis labels
plt.xticks(rotation=0, ha="center")
plt.ylabel("Execution Time (ms)")
plt.title("Execution Times per Parser")
plt.ylim(bottom=0)  # start y-axis at 0

# Remove top and right borders (spines)
ax = plt.gca()
ax.spines['top'].set_visible(False)
ax.spines['right'].set_visible(False)

# Add horizontal grid lines only
ax.yaxis.grid(True, linestyle='--', alpha=0.7)  # horizontal dashed lines
ax.xaxis.grid(False)  # no vertical lines

plt.tight_layout()
# Save SVG
plt.savefig("boxplots.svg", format="svg", transparent=True)
