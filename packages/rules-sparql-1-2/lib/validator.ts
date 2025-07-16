import { Factory } from '@traqula/rules-sparql-1-1';
import type { TermLiteral } from './sparql12Types';

const F = new Factory();

function isLangDir(dir: string): dir is 'ltr' | 'rtl' {
  return dir === 'ltr' || dir === 'rtl';
}

export function langTagHasCorrectDomain(literal: TermLiteral): void {
  if (F.isTermLiteralLangStr(literal)) {
    const dirSplit = literal.langOrIri.split('--');
    if (dirSplit.length > 1) {
      const [ _, direction ] = dirSplit;
      if (!isLangDir(direction)) {
        throw new Error(`language direction "${direction}" of literal "${JSON.stringify(literal)}" is not is required range 'ltr' | 'rtl'.`);
      }
    }
  }
}
