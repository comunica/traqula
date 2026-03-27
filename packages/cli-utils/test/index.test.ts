import { describe, it, expect } from 'vitest';
import {
  parseCliArgs,
  getFlag,
  getFlagAsBoolean,
  getFlagAsString,
  getFlagAsStrings,
  parsePrefixMappings,
} from '../lib/index.js';

describe('parseCliArgs', () => {
  it('parses positional arguments', () => {
    const result = parseCliArgs([ 'file1.txt', 'file2.txt' ]);
    expect(result.positionals).toEqual([ 'file1.txt', 'file2.txt' ]);
    expect(result.flags).toEqual({});
  });

  it('parses long flags without values as boolean true', () => {
    const result = parseCliArgs([ '--verbose', '--debug' ]);
    expect(result.flags).toEqual({ verbose: true, debug: true });
  });

  it('parses long flags with space-separated values', () => {
    const result = parseCliArgs([ '--output', 'file.txt' ]);
    expect(result.flags).toEqual({ output: 'file.txt' });
  });

  it('parses long flags with = separated values', () => {
    const result = parseCliArgs([ '--output=file.txt' ]);
    expect(result.flags).toEqual({ output: 'file.txt' });
  });

  it('parses --no-* negation flags', () => {
    const result = parseCliArgs([ '--no-color', '--no-cache' ]);
    expect(result.flags).toEqual({ color: false, cache: false });
  });

  it('parses short flags without values as boolean true', () => {
    const result = parseCliArgs([ '-v', '-d' ]);
    expect(result.flags).toEqual({ v: true, d: true });
  });

  it('parses combined short flags', () => {
    const result = parseCliArgs([ '-vd' ]);
    expect(result.flags).toEqual({ v: true, d: true });
  });

  it('parses short flags with values', () => {
    const result = parseCliArgs([ '-o', 'file.txt' ]);
    expect(result.flags).toEqual({ o: 'file.txt' });
  });

  it('parses combined short flags with value on last flag', () => {
    const result = parseCliArgs([ '-vo', 'file.txt' ]);
    expect(result.flags).toEqual({ v: true, o: 'file.txt' });
  });

  it('handles -- separator for positional-only mode', () => {
    const result = parseCliArgs([ '--verbose', '--', '--not-a-flag' ]);
    expect(result.flags).toEqual({ verbose: true });
    expect(result.positionals).toEqual([ '--not-a-flag' ]);
  });

  it('treats single dash as positional', () => {
    const result = parseCliArgs([ '-' ]);
    expect(result.positionals).toEqual([ '-' ]);
    expect(result.flags).toEqual({});
  });

  it('treats dash as value for flags', () => {
    const result = parseCliArgs([ '--input', '-' ]);
    expect(result.flags).toEqual({ input: '-' });
  });

  it('collects repeated flags into array', () => {
    const result = parseCliArgs([ '--prefix', 'a=b', '--prefix', 'c=d' ]);
    expect(result.flags).toEqual({ prefix: [ 'a=b', 'c=d' ]});
  });

  it('handles mixed positionals and flags', () => {
    const result = parseCliArgs([ 'input.txt', '--verbose', '-o', 'output.txt', 'extra.txt' ]);
    expect(result.positionals).toEqual([ 'input.txt', 'extra.txt' ]);
    expect(result.flags).toEqual({ verbose: true, o: 'output.txt' });
  });
});

describe('getFlag', () => {
  it('returns flag value by name', () => {
    const args = parseCliArgs([ '--verbose' ]);
    expect(getFlag(args, 'verbose')).toBe(true);
  });

  it('returns undefined for missing flag', () => {
    const args = parseCliArgs([]);
    expect(getFlag(args, 'verbose')).toBeUndefined();
  });

  it('checks multiple names and returns first match', () => {
    const args = parseCliArgs([ '-h' ]);
    expect(getFlag(args, 'help', 'h')).toBe(true);
  });
});

describe('getFlagAsBoolean', () => {
  it('returns true for boolean true flag', () => {
    const args = parseCliArgs([ '--verbose' ]);
    expect(getFlagAsBoolean(args, 'verbose')).toBe(true);
  });

  it('returns false for missing flag', () => {
    const args = parseCliArgs([]);
    expect(getFlagAsBoolean(args, 'verbose')).toBe(false);
  });

  it('returns false for --no-* flag', () => {
    const args = parseCliArgs([ '--no-verbose' ]);
    expect(getFlagAsBoolean(args, 'verbose')).toBe(false);
  });

  it('returns false for string value "false"', () => {
    const args = parseCliArgs([ '--verbose=false' ]);
    expect(getFlagAsBoolean(args, 'verbose')).toBe(false);
  });

  it('returns false for string value "0"', () => {
    const args = parseCliArgs([ '--verbose=0' ]);
    expect(getFlagAsBoolean(args, 'verbose')).toBe(false);
  });

  it('returns true for other string values', () => {
    const args = parseCliArgs([ '--verbose=yes' ]);
    expect(getFlagAsBoolean(args, 'verbose')).toBe(true);
  });
});

describe('getFlagAsString', () => {
  it('returns string value', () => {
    const args = parseCliArgs([ '--output', 'file.txt' ]);
    expect(getFlagAsString(args, 'output')).toBe('file.txt');
  });

  it('returns undefined for missing flag', () => {
    const args = parseCliArgs([]);
    expect(getFlagAsString(args, 'output')).toBeUndefined();
  });

  it('returns undefined for boolean flag', () => {
    const args = parseCliArgs([ '--verbose' ]);
    expect(getFlagAsString(args, 'verbose')).toBeUndefined();
  });

  it('returns last value for repeated flag', () => {
    const args = parseCliArgs([ '--output', 'first.txt', '--output', 'second.txt' ]);
    expect(getFlagAsString(args, 'output')).toBe('second.txt');
  });
});

describe('getFlagAsStrings', () => {
  it('returns array of values for repeated flag', () => {
    const args = parseCliArgs([ '--include', 'a', '--include', 'b' ]);
    expect(getFlagAsStrings(args, 'include')).toEqual([ 'a', 'b' ]);
  });

  it('returns single-element array for single value', () => {
    const args = parseCliArgs([ '--include', 'a' ]);
    expect(getFlagAsStrings(args, 'include')).toEqual([ 'a' ]);
  });

  it('returns empty array for missing flag', () => {
    const args = parseCliArgs([]);
    expect(getFlagAsStrings(args, 'include')).toEqual([]);
  });

  it('returns empty array for boolean flag', () => {
    const args = parseCliArgs([ '--verbose' ]);
    expect(getFlagAsStrings(args, 'verbose')).toEqual([]);
  });
});

describe('parsePrefixMappings', () => {
  it('parses valid prefix=iri mappings', () => {
    const result = parsePrefixMappings([ 'rdf=http://www.w3.org/1999/02/22-rdf-syntax-ns#' ]);
    expect(result).toEqual({ rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#' });
  });

  it('parses multiple mappings', () => {
    const result = parsePrefixMappings([
      'rdf=http://www.w3.org/1999/02/22-rdf-syntax-ns#',
      'rdfs=http://www.w3.org/2000/01/rdf-schema#',
    ]);
    expect(result).toEqual({
      rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
      rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
    });
  });

  it('returns empty object for empty input', () => {
    const result = parsePrefixMappings([]);
    expect(result).toEqual({});
  });

  it('throws on missing separator', () => {
    expect(() => parsePrefixMappings([ 'invalid' ])).toThrow('Invalid prefix mapping \'invalid\'');
  });

  it('throws on empty prefix', () => {
    expect(() => parsePrefixMappings([ '=http://example.org/' ])).toThrow('Invalid prefix mapping \'=http://example.org/\'');
  });

  it('throws on empty value', () => {
    expect(() => parsePrefixMappings([ 'prefix=' ])).toThrow('Invalid prefix mapping \'prefix=\'');
  });

  it('handles IRIs containing = characters', () => {
    const result = parsePrefixMappings([ 'ex=http://example.org/path?key=value' ]);
    expect(result).toEqual({ ex: 'http://example.org/path?key=value' });
  });
});
