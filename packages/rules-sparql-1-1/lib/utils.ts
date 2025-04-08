import type {
  GroupPattern,
  Pattern,
  PropertyPath,
  Term,
  VariableTerm,
} from './Sparql11types';

export function deGroupSingle(group: GroupPattern): Pattern {
  return group.patterns.length === 1 ? group.patterns[0] : group;
}

export function isVariable(term: Term | PropertyPath): term is VariableTerm {
  return 'termType' in term && term.termType === 'Variable';
}

/**
 * Transform input in accordance to [19.2](https://www.w3.org/TR/sparql11-query/#codepointEscape)
 * and validate unicode codepoints.
 */
export function sparqlCodepointEscape(input: string): string {
  const sanitizedInput = input.replaceAll(
    /\\u([0-9a-fA-F]{4})|\\U([0-9a-fA-F]{8})/gu,
    (_, unicode4: string, unicode8: string) => {
      if (unicode4) {
        const charCode = Number.parseInt(unicode4, 16);
        return String.fromCodePoint(charCode);
      }
      const charCode = Number.parseInt(unicode8, 16);
      if (charCode < 0xFFFF) {
        return String.fromCodePoint(charCode);
      }
      const substractedCharCode = charCode - 0x10000;
      return String.fromCodePoint(0xD800 + (substractedCharCode >> 10), 0xDC00 + (substractedCharCode & 0x3FF));
    },
  );
  // Test for invalid unicode surrogate pairs
  if (/[\uD800-\uDBFF](?:[^\uDC00-\uDFFF]|$)/u.test(sanitizedInput)) {
    throw new Error(`Invalid unicode codepoint of surrogate pair without corresponding codepoint`);
  }
  return sanitizedInput;
}
