import { describe, it, expect } from 'vitest';
import { parsePrefixMappings } from '../lib/index.js';

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
