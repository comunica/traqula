/**
 * Native JS replacements for all lodash-es functions used by chevrotain.
 * Used as an esbuild alias for 'lodash-es' to eliminate lodash from the bundle.
 */

export const assign = Object.assign.bind(Object);

export function clone(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return [...value];
  return Object.assign(Object.create(Object.getPrototypeOf(value)), value);
}

export function compact(array) {
  return (array ?? []).filter(Boolean);
}

export function defaults(object, ...sources) {
  for (const source of sources) {
    if (source) {
      for (const key of Object.keys(source)) {
        if (object[key] === undefined) object[key] = source[key];
      }
    }
  }
  return object;
}

export function difference(array, ...values) {
  const excluded = new Set(values.flat());
  return (array ?? []).filter((item) => !excluded.has(item));
}

export function drop(array, n = 1) {
  return (array ?? []).slice(n);
}

export function dropRight(array, n = 1) {
  if (n === 0) return [...(array ?? [])];
  return (array ?? []).slice(0, -n);
}

export function every(collection, predicate) {
  const arr = Array.isArray(collection) ? collection : Object.values(collection ?? {});
  return arr.every(predicate);
}

export function filter(collection, predicate) {
  if (Array.isArray(collection)) return collection.filter(predicate);
  if (collection && typeof collection === 'object') {
    return Object.values(collection).filter(predicate);
  }
  return [];
}

export function find(collection, predicate) {
  const arr = Array.isArray(collection) ? collection : Object.values(collection ?? {});
  if (typeof predicate === 'function') return arr.find(predicate);
  if (predicate && typeof predicate === 'object') {
    const entries = Object.entries(predicate);
    return arr.find((item) => entries.every(([k, v]) => item[k] === v));
  }
  return arr.find((item) => item[predicate]);
}

export function first(array) {
  return array?.[0];
}

export function flatMap(collection, iteratee) {
  const arr = Array.isArray(collection) ? collection : Object.values(collection ?? {});
  return arr.flatMap(iteratee);
}

export function flatten(array) {
  return (array ?? []).flat(1);
}

export function forEach(collection, iteratee) {
  if (Array.isArray(collection)) {
    collection.forEach(iteratee);
  } else if (collection && typeof collection === 'object') {
    Object.keys(collection).forEach((key) => iteratee(collection[key], key, collection));
  }
  return collection;
}

export function groupBy(collection, iteratee) {
  const arr = Array.isArray(collection) ? collection : Object.values(collection ?? {});
  const fn = typeof iteratee === 'function' ? iteratee : (item) => item[iteratee];
  return arr.reduce((result, item) => {
    const key = fn(item);
    (result[key] ?? (result[key] = [])).push(item);
    return result;
  }, {});
}

export function has(object, path) {
  return object != null && Object.prototype.hasOwnProperty.call(object, path);
}

export function identity(value) {
  return value;
}

export function includes(collection, value) {
  if (Array.isArray(collection) || typeof collection === 'string') {
    return collection.includes(value);
  }
  if (collection && typeof collection === 'object') {
    return Object.values(collection).includes(value);
  }
  return false;
}

export function indexOf(array, value, fromIndex = 0) {
  return (array ?? []).indexOf(value, fromIndex);
}

export const isArray = Array.isArray;

export function isEmpty(value) {
  if (value == null) return true;
  if (Array.isArray(value) || typeof value === 'string') return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

export function isFunction(value) {
  return typeof value === 'function';
}

export function isObject(value) {
  return value !== null && typeof value === 'object';
}

export function isRegExp(value) {
  return value instanceof RegExp;
}

export function isString(value) {
  return typeof value === 'string';
}

export function isUndefined(value) {
  return value === undefined;
}

export const keys = Object.keys.bind(Object);

export function last(array) {
  return array?.[array.length - 1];
}

export function map(collection, iteratee) {
  if (Array.isArray(collection)) return collection.map(iteratee);
  if (collection && typeof collection === 'object') {
    return Object.keys(collection).map((key) => iteratee(collection[key], key, collection));
  }
  return [];
}

export function noop() {}

export function pickBy(object, predicate) {
  if (!object) return {};
  const result = {};
  for (const [key, value] of Object.entries(object)) {
    if (predicate(value, key)) result[key] = value;
  }
  return result;
}

export function reduce(collection, iteratee, accumulator) {
  if (Array.isArray(collection)) {
    return accumulator !== undefined
      ? collection.reduce(iteratee, accumulator)
      : collection.reduce(iteratee);
  }
  if (collection && typeof collection === 'object') {
    const entries = Object.entries(collection);
    if (accumulator !== undefined) {
      return entries.reduce((acc, [key, val]) => iteratee(acc, val, key, collection), accumulator);
    }
    if (entries.length === 0) throw new TypeError('Reduce of empty object with no initial value');
    const [[, firstVal], ...rest] = entries;
    return rest.reduce((acc, [key, val]) => iteratee(acc, val, key, collection), firstVal);
  }
  return accumulator;
}

export function reject(collection, predicate) {
  if (Array.isArray(collection)) return collection.filter((v) => !predicate(v));
  if (collection && typeof collection === 'object') {
    return Object.values(collection).filter((v) => !predicate(v));
  }
  return [];
}

export function some(collection, predicate) {
  const arr = Array.isArray(collection) ? collection : Object.values(collection ?? {});
  if (typeof predicate === 'function') return arr.some(predicate);
  if (predicate && typeof predicate === 'object') {
    const entries = Object.entries(predicate);
    return arr.some((item) => entries.every(([k, v]) => item[k] === v));
  }
  return arr.some((item) => item[predicate]);
}

export function uniq(array) {
  return [...new Set(array)];
}

export function upperFirst(string) {
  if (!string) return string;
  return string.charAt(0).toUpperCase() + string.slice(1);
}

export const values = Object.values.bind(Object);
