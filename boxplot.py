import matplotlib
matplotlib.use("Agg")

import pandas as pd
import matplotlib.pyplot as plt
import numpy as np

# -------------------------------------------------------
# CONFIG: change this if you want to use a different CSV
# -------------------------------------------------------
CSV_FILE = "bench-to-ast11.csv"

# Load data
df = pd.read_csv(
    CSV_FILE,
    sep=";",
    header=None,
    names=["name", "min", "max", "mean", "rme"],
    dtype=str
)

# Convert numeric strings (with commas) to floats
for col in ["min", "max", "mean", "rme"]:
    df[col] = df[col].str.replace(",", "", regex=False).astype(float)

# Create a boxplot for each row
plt.figure(figsize=(10, 6))
data_to_plot = []

labels = []

for _, row in df.iterrows():
    # Synthesize a small numeric distribution so boxplot can be drawn
    synthetic = np.array([
        row['min'],
        row['mean'],
        row['max']
    ])

    data_to_plot.append(synthetic)
    labels.append(row['name'])

# Plot boxplots
plt.boxplot(data_to_plot, tick_labels=labels, vert=True)
plt.xticks(rotation=45, ha='right')
plt.ylabel("Values")
plt.title("Boxplots for Each Row in CSV")
plt.tight_layout()


plt.savefig("boxplots.svg", format="svg")

