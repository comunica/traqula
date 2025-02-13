import type {
  BlankSpace,
  BlankTerm,
  Comment,
  FullIriTerm,
  Ignores,
  Ignores1,
  Ignores2,
  Images,
  Images2,
  Indexes0,
  IriTerm,
  ITO,
  ITOS,
  LiteralTermLangStr,
  LiteralTermStr,
  LiteralTermTyped,
  PrefixedIriTerm,
  VariableTerm,
  Wrap,
} from './RoundTripTypes';

export function variable(value: string): VariableTerm {
  return {
    type: 'term',
    termType: 'Variable',
    value,
  };
}

export function isPrefixedIriTerm(x: IriTerm): x is PrefixedIriTerm {
  return 'prefix' in x;
}

function isIgnores<Indexes extends Indexes0>(x: object, indexes: Indexes[]): x is Ignores<Indexes0> {
  return indexes.every(i => `i${i}` in x);
}
export const isIgnores0 = (x: object): x is Ignores => isIgnores(x, [ '0' ]);
export const isIgnores1 = (x: object): x is Ignores1 => isIgnores(x, [ '0', '1' ]);
export const isIgnores2 = (x: object): x is Ignores1 => isIgnores(x, [ '0', '1', '2' ]);

function isImages<Indexes extends string>(x: object, indexes: Indexes[]): x is Images {
  return indexes.every(i => `img${i}` in x);
}
export const isImages1 = (x: object): x is Images => isImages(x, [ '1' ]);
export const isImages2 = (x: object): x is Images2 => isImages(x, [ '1', '2' ]);

export function namedNode<T extends string | undefined>(value: string, prefix: T):
T extends string ? PrefixedIriTerm : FullIriTerm {
  if (prefix === undefined) {
    return <T extends string ? PrefixedIriTerm : FullIriTerm> {
      type: 'term',
      termType: 'NamedNode',
      value,
    };
  }
  return <PrefixedIriTerm> {
    type: 'term',
    termType: 'NamedNode',
    value,
    prefix,
  };
}

export function blankNode(value: string): BlankTerm {
  return {
    type: 'term',
    termType: 'BlankNode',
    value,
  };
}

export function literalTerm<T extends undefined | string | IriTerm>(value: string, langOrIri: T):
T extends undefined ? LiteralTermStr :
    (T extends string ? LiteralTermLangStr : LiteralTermTyped) {
  return <any> {
    type: 'term',
    termType: 'Literal',
    value,
    langOrIri,
  };
}

export function isBS(x: ITO): x is BlankSpace {
  return 'bs' in x;
}

export function blankSpace(blank: string): BlankSpace {
  return { bs: blank };
}

export function comment(comment: string): Comment {
  return { comment };
}

export function wrap<T>(val: T): Wrap<T> {
  return { val };
}

function ignores<T extends object>(value: T, ...ignored: ITOS[]): Record<any, any> {
  if (ignored.length > 10) {
    throw new Error('Too many ignored');
  }
  const result: Record<any, any> = value;
  for (const [ i, ignored_ ] of ignored.entries()) {
    result[`i${i}`] = ignored_;
  }
  return result;
}
export function ignore0<T extends object>(value: T, ignored0: ITOS): T & Ignores {
  return <T & Ignores> ignores(value, ignored0);
}
export function ignore1<T extends object>(value: T, ignored0: ITOS, ignored1: ITOS): T & Ignores1 {
  return <T & Ignores1> ignores(value, ignored0, ignored1);
}
export function ignore2<T extends object>(value: T, ignored0: ITOS, ignored1: ITOS, ignored2: ITOS): T & Ignores2 {
  return <T & Ignores2> ignores(value, ignored0, ignored1, ignored2);
}

function image<T extends object>(value: T, ...images: string[]): Record<any, any> {
  if (images.length > 9) {
    throw new Error('Too many images');
  }
  const result: Record<string, any> = value;
  for (const [ i, image_ ] of images.entries()) {
    result[`img${i + 1}`] = image_;
  }
  return result;
}
export function image1<T extends object>(value: T, image1: string): T & Images {
  return <T & Images> image(value, image1);
}
export function image2<T extends object>(value: T, image1: string, image2: string): T & Images2 {
  return <T & Images2> image(value, image1, image2);
}
