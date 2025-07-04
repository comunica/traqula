/* eslint-disable require-unicode-regexp */
import { LexerBuilder, createToken } from '@traqula/core';
import { allBuiltInCalls, avg, datatype, groupConcat } from './BuildinCalls';
import { allGraphTokens, graphAll } from './graph';
import { allSymbols } from './symbols';
import { allTerminals } from './terminals';

export const baseDecl = createToken({ name: 'BaseDecl', pattern: /base/i, label: 'BASE' });
export const prefixDecl = createToken({ name: 'PrefixDecl', pattern: /prefix/i, label: 'PREFIX' });
export const select = createToken({ name: 'Select', pattern: /select/i, label: 'SELECT' });
export const distinct = createToken({ name: 'Distinct', pattern: /distinct/i, label: 'DISTINCT' });
export const reduced = createToken({ name: 'Reduced', pattern: /reduced/i, label: 'REDUCED' });
export const as = createToken({ name: 'As', pattern: /as/i, label: 'AS' });
export const construct = createToken({ name: 'Construct', pattern: /construct/i, label: 'CONSTRUCT' });
export const describe = createToken({ name: 'Describe', pattern: /describe/i, label: 'DESCRIBE' });
export const ask = createToken({ name: 'Ask', pattern: /ask/i, label: 'ASK' });
export const from = createToken({ name: 'From', pattern: /from/i, label: 'FROM' });
export const where = createToken({ name: 'Where', pattern: /where/i, label: 'WHERE' });
export const groupByGroup = createToken({ name: 'GroupByGroup', pattern: /group/i, label: '_GROUP_ BY' });
export const by = createToken({ name: 'By', pattern: /by/i, label: 'BY' });
export const having = createToken({ name: 'Having', pattern: /having/i, label: 'HAVING' });
export const order = createToken({ name: 'Order', pattern: /order/i, label: '_ORDER_ BY' });
export const orderAsc = createToken({ name: 'OrderAsc', pattern: /asc/i, label: 'ASC' });
export const orderDesc = createToken({ name: 'OrderDesc', pattern: /desc/i, label: 'DESC' });
export const limit = createToken({ name: 'Limit', pattern: /limit/i, label: 'LIMIT' });
export const offset = createToken({ name: 'Offset', pattern: /offset/i, label: 'OFFSET' });
export const values = createToken({ name: 'Values', pattern: /values/i, label: 'VALUES' });
export const load = createToken({ name: 'Load', pattern: /load/i, label: 'LOAD' });
export const silent = createToken({ name: 'Silent', pattern: /silent/i, label: 'SILENT' });
export const loadInto = createToken({ name: 'LoadInto', pattern: /into/i, label: 'INTO' });
export const clear = createToken({ name: 'Clear', pattern: /clear/i, label: 'CLEAR' });
export const drop = createToken({ name: 'Drop', pattern: /drop/i, label: 'DROP' });
export const create = createToken({ name: 'Create', pattern: /create/i, label: 'CREATE' });
export const add = createToken({ name: 'Add', pattern: /add/i, label: 'ADD' });
export const to = createToken({ name: 'To', pattern: /to/i, label: 'TO' });
export const move = createToken({ name: 'Move', pattern: /move/i, label: 'MOVE' });
export const copy = createToken({ name: 'Copy', pattern: /copy/i, label: 'COPY' });
export const modifyWith = createToken({ name: 'ModifyWith', pattern: /with/i, label: 'WITH' });
export const deleteClause = createToken({ name: 'DeleteClause', pattern: /delete/i, label: 'DELETE' });
export const insertClause = createToken({ name: 'InsertClause', pattern: /insert/i, label: 'INSERT' });
export const dataClause = createToken({ name: 'DataClause', pattern: /data/i, label: 'DATA', longer_alt: datatype });
export const usingClause = createToken({ name: 'UsingClause', pattern: /using/i, label: 'USING' });
export const optional = createToken({ name: 'Optional', pattern: /optional/i, label: 'OPTIONAL' });
export const service = createToken({ name: 'Service', pattern: /service/i, label: 'SERVICE' });
export const bind = createToken({ name: 'Bind', pattern: /bind/i, label: 'BIND' });
export const undef = createToken({ name: 'Undef', pattern: /undef/i, label: 'UNDEF' });
export const minus = createToken({ name: 'Minus', pattern: /minus/i, label: 'MINUS' });
export const union = createToken({ name: 'Union', pattern: /union/i, label: 'UNION' });
export const filter = createToken({ name: 'Filter', pattern: /filter/i, label: 'FILTER' });
export const a = createToken({ name: 'a', pattern: 'a', label: 'type declaration \'a\'' });
export const true_ = createToken({ name: 'True', pattern: /true/i, label: 'true' });
export const false_ = createToken({ name: 'False', pattern: /false/i, label: 'false' });
export const in_ = createToken({ name: 'In', pattern: /in/i, label: 'IN' });
// eslint-disable-next-line unicorn/better-regex,no-control-regex
export const notIn = createToken({ name: 'NotIn', pattern: /not[\u0020\u0009\u000D\u000A]+in/i, label: 'NOT IN' });
export const separator = createToken({ name: 'Separator', pattern: /separator/i, label: 'SEPARATOR' });

export const allBaseTokens = LexerBuilder.create().add(
  baseDecl,
  prefixDecl,
  select,
  distinct,
  reduced,
  construct,
  describe,
  ask,
  from,
  where,
  having,
  groupByGroup,
  by,
  order,
  orderAsc,
  orderDesc,
  limit,
  offset,
  values,
  load,
  silent,
  loadInto,
  clear,
  drop,
  create,
  add,
  to,
  move,
  copy,
  modifyWith,
  deleteClause,
  insertClause,
  dataClause,
  usingClause,
  optional,
  service,
  bind,
  undef,
  minus,
  union,
  filter,
  as,
  a,
  true_,
  false_,
  in_,
  notIn,
  separator,
);

/**
 * [!!!ORDER MATTERS!!!](https://chevrotain.io/docs/tutorial/step1_lexing.html#creating-the-lexer)
 */
export const sparql11Tokens = LexerBuilder
  .create(allTerminals)
  .merge(allBaseTokens)
  .merge(allBuiltInCalls)
  .merge(allGraphTokens)
  .merge(allSymbols)
  .moveBefore(datatype, dataClause)
  .moveAfter(avg, a)
  .moveBefore(a, graphAll)
  .moveAfter(groupConcat, groupByGroup);
