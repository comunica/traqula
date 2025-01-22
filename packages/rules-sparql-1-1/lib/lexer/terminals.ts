import { Lexer } from 'chevrotain';
import { LexerBuilder } from '@traqula/core';
import { createToken } from '@traqula/core';

 
export const pnCharsBasePattern = /[A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD]|[\uD800-\uDB7F][\uDC00-\uDFFF]/;
export const pnCharsUPattern = new RegExp(`${pnCharsBasePattern.source}|_`);
// eslint-disable-next-line no-misleading-character-class
export const varNamePattern = new RegExp(`((${pnCharsUPattern.source})|[0-9])((${pnCharsUPattern.source})|[0-9]|[\u00B7\u0300-\u036F\u203F-\u2040])*`);
// eslint-disable-next-line no-control-regex
export const iriRefPattern = /<([^\\<>"{}|^`\u0000-\u0020])*>/;
// eslint-disable-next-line no-misleading-character-class
export const pnCharsPattern = new RegExp(`(${pnCharsUPattern.source})|[\\-0-9\u00B7\u0300-\u036F\u203F-\u2040]`);
// eslint-disable-next-line no-misleading-character-class
export const pnPrefixPattern = new RegExp(`(${pnCharsBasePattern.source})(((${pnCharsPattern.source})|\\.)*(${pnCharsPattern.source}))?`);
// eslint-disable-next-line no-misleading-character-class
export const pNameNsPattern = new RegExp(`(${pnPrefixPattern.source})?:`);
export const percentPattern = /%[0-9A-Fa-f][0-9A-Fa-f]/;
export const pnLocalEscPattern = /\\[_~.\-!$&'()*+,;=\\/?#@%]/;
export const plxPattern = new RegExp(`(${percentPattern.source})|(${pnLocalEscPattern.source})`);
// eslint-disable-next-line no-misleading-character-class
export const pnLocalPattern = new RegExp(`((${pnCharsUPattern.source})|:|[0-9]|(${plxPattern.source}))(((${pnCharsPattern.source})|\\.|:|(${plxPattern.source}))*((${pnCharsPattern.source})|:|(${plxPattern.source})))?`);
// eslint-disable-next-line no-misleading-character-class
export const pNameLnPattern = new RegExp(`(${pNameNsPattern.source})(${pnLocalPattern.source})`);
// eslint-disable-next-line no-misleading-character-class
export const blankNodeLabelPattern = new RegExp(`_:(?:(?:${pnCharsUPattern.source})|[0-9])(?:(?:(?:${pnCharsPattern.source})|\\.)*(${pnCharsPattern.source}))?`);
// eslint-disable-next-line no-misleading-character-class
export const var1Pattern = new RegExp(`\\?(${varNamePattern.source})`);
// eslint-disable-next-line no-misleading-character-class
export const var2Pattern = new RegExp(`\\$(${varNamePattern.source})`);
export const langTagPattern = /@[a-zA-Z]+(-[a-zA-Z0-9]+)*/;
export const integerPattern = /[0-9]+/;
export const decimalPattern = /[0-9]+\.[0-9]+/;
export const exponentPattern = /[eE][+-]?[0-9]+/;
export const doublePattern = new RegExp(`([0-9]+\\.[0-9]*(${exponentPattern.source}))|(\\.[0-9]+(${exponentPattern.source}))|([0-9]+(${exponentPattern.source}))`);
export const interferePositivePattern = new RegExp(`\\+${integerPattern.source}`);
export const decimalPositivePattern = new RegExp(`\\+${decimalPattern.source}`);
export const doublePositivePattern = new RegExp(`\\+${doublePattern.source}`);
export const integerNegativePattern = new RegExp(`-${integerPattern.source}`);
export const decimalNegativePattern = new RegExp(`-${decimalPattern.source}`);
export const doubleNegativePattern = new RegExp(`-${doublePattern.source}`);
export const echarPattern = /\\[\\"'bfnrt]/u;
export const stringLiteral1Pattern = new RegExp(`'(?:([^\\u0027\\u005C\\u000A\u000D])|(?:${echarPattern.source}))*'`);
export const stringLiteral2Pattern = new RegExp(`"(?:([^\\u0022\\u005C\\u000A\\u000D])|(?:${echarPattern.source}))*"`);
export const stringLiteralLong1Pattern = new RegExp(`'''(('|(''))?([^'\\\\]|(${echarPattern.source})))*'''`);
export const stringLiteralLong2Pattern = new RegExp(`"""(("|(""))?([^"\\\\]|(${echarPattern.source})))*"""`);
// eslint-disable-next-line no-control-regex
export const wsPattern = /[\u0020\u0009\u000D\u000A]/;
export const nilPattern = new RegExp(`\\((${wsPattern.source})*\\)`);
export const anonPattern = new RegExp(`\\[(${wsPattern.source})*\\]`);

export const iriRef = createToken({ name: 'IriRef', pattern: iriRefPattern });
export const pNameLn = createToken({ name: 'PNameLn', pattern: pNameLnPattern });
export const pNameNs = createToken({ name: 'PNameNs', pattern: pNameNsPattern, longer_alt: [ pNameLn ]});
export const blankNodeLabel = createToken({ name: 'BlankNodeLabel', pattern: blankNodeLabelPattern });
export const var1 = createToken({ name: 'Var1', pattern: var1Pattern });
export const var2 = createToken({ name: 'Var2', pattern: var2Pattern });
export const langTag = createToken({ name: 'LangTag', pattern: langTagPattern });
export const integer = createToken({ name: 'Integer', pattern: integerPattern });
export const decimal = createToken({ name: 'Decimal', pattern: decimalPattern });
export const double = createToken({ name: 'Double', pattern: doublePattern });
export const integerPositive = createToken({ name: 'InterferePositive', pattern: interferePositivePattern });
export const decimalPositive = createToken({ name: 'DecimalPositive', pattern: decimalPositivePattern });
export const doublePositive = createToken({ name: 'DoublePositive', pattern: doublePositivePattern });
export const integerNegative = createToken({ name: 'IntegerNegative', pattern: integerNegativePattern });
export const decimalNegative = createToken({ name: 'DecimalNegative', pattern: decimalNegativePattern });
export const doubleNegative = createToken({ name: 'DoubleNegative', pattern: doubleNegativePattern });
export const stringLiteral1 = createToken({ name: 'StringLiteral1', pattern: stringLiteral1Pattern });
export const stringLiteral2 = createToken({ name: 'StringLiteral2', pattern: stringLiteral2Pattern });
export const stringLiteralLong1 = createToken({ name: 'StringLiteralLong1', pattern: stringLiteralLong1Pattern });
export const stringLiteralLong2 = createToken({ name: 'StringLiteralLong2', pattern: stringLiteralLong2Pattern });
export const ws = createToken({ name: 'Ws', pattern: wsPattern, group: Lexer.SKIPPED });
export const comment = createToken({ name: 'Comment', pattern: /#[^\n]*/, group: Lexer.SKIPPED });
export const nil = createToken({ name: 'Nil', pattern: nilPattern });
export const anon = createToken({ name: 'Anon', pattern: anonPattern });

export const allTerminals = LexerBuilder.create().add(
  iriRef,
  pNameNs,
  pNameLn,
  blankNodeLabel,
  var1,
  var2,
  langTag,
  double,
  decimal,
  integer,
  integerPositive,
  decimalPositive,
  doublePositive,
  integerNegative,
  decimalNegative,
  doubleNegative,
  stringLiteralLong1,
  stringLiteralLong2,
  stringLiteral1,
  stringLiteral2,
  ws,
  comment,
  nil,
  anon,
);
