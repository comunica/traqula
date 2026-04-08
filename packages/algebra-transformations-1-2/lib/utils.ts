// TODO: find a cleaner way
/**
 * Outputs a JSON object corresponding to the input algebra-like.
 */
export function objectify(algebra: any): any {
  if (algebra.termType) {
    if (algebra.termType === 'Quad') {
      return {
        type: 'pattern',
        termType: 'Quad',
        subject: objectify(algebra.subject),
        predicate: objectify(algebra.predicate),
        object: objectify(algebra.object),
        graph: objectify(algebra.graph),
      };
    }
    const result: any = { termType: algebra.termType, value: algebra.value };
    if (algebra.language) {
      result.language = algebra.language;
    }
    if (algebra.direction) {
      result.direction = algebra.direction;
    }
    if (algebra.datatype) {
      result.datatype = objectify(algebra.datatype);
    }
    return result;
  }
  if (Array.isArray(algebra)) {
    return algebra.map(e => objectify(e));
  }
  if (algebra === Object(algebra)) {
    const result: any = {};
    for (const key of Object.keys(algebra)) {
      result[key] = objectify(algebra[key]);
    }
    return result;
  }
  return algebra;
}
