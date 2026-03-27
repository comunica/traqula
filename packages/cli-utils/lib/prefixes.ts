export function parsePrefixMappings(values: readonly string[]): Record<string, string> {
  const prefixes: Record<string, string> = {};
  for (const entry of values) {
    const separator = entry.indexOf('=');
    if (separator <= 0 || separator === entry.length - 1) {
      throw new Error(`Invalid prefix mapping '${entry}', expected prefix=iri`);
    }
    const key = entry.slice(0, separator);
    const value = entry.slice(separator + 1);
    prefixes[key] = value;
  }
  return prefixes;
}
