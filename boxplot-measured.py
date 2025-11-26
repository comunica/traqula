import matplotlib
matplotlib.use("Agg")  # headless backend

import pandas as pd
import matplotlib.pyplot as plt

CSV_FILE = "mock-bench-times.csv"

# Load CSV: first column is name, rest are execution times
df = pd.read_csv(CSV_FILE, sep=";", header=None)

# Separate names and data
names = df.iloc[:, 0].tolist()  # first column = names
data_to_plot = df.iloc[:, 1:].apply(pd.to_numeric, errors='coerce').values.tolist()  # rest of columns

# Plot
plt.figure(figsize=(12, 6))
plt.boxplot(data_to_plot, tick_labels=names, vert=True)
plt.xticks(rotation=45, ha="right")
plt.ylabel("Execution Time")
plt.title("Execution Times per Tool / Query")
plt.tight_layout()

# Save SVG
plt.savefig("boxplots.svg", format="svg")
