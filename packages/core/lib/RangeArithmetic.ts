/**
 * Starting inclusive, ending exclusive
 */
export type Range<A extends number = number, B extends number = number> = [A, B];

export class RangeArithmetic {
  public ranges: Range[] = [];
  private readonly initRange: Range;
  public constructor(start: number, end: number) {
    this.initRange = RangeArithmetic.validate(start, end);
    this.ranges.push(this.initRange);
  }

  private static validate(...range: Range): Range {
    const [ start, end ] = range;
    if (start >= end) {
      throw new Error('Invalid range');
    }
    return range;
  }

  private static substractRange(included: Range[], ...range: Range): Range[] {
    const [ sMinus, eMinus ] = RangeArithmetic.validate(...range);

    return included.flatMap(([ sCur, eCur ]) => {
      // Split in half
      if (sCur < sMinus && eMinus < eCur) {
        return [[ sCur, sMinus ], [ eMinus, eCur ]];
      }
      if (sMinus <= sCur && sCur < eMinus && eMinus < eCur) {
        return [[ eMinus, eCur ]];
      }
      if (sCur < sMinus && sMinus < eCur && eCur <= eMinus) {
        return [[ sCur, sMinus ]];
      }
      if (sMinus <= sCur && eCur <= eMinus) {
        return [];
      }
      return [[ sCur, eCur ]];
    });
  }

  public subtract(...range: Range): this {
    this.ranges = RangeArithmetic.substractRange(this.ranges, ...range);
    return this;
  }

  public negate(): this {
    // Can be optimized
    let iter = [ this.initRange ];
    for (const range of this.ranges) {
      iter = RangeArithmetic.substractRange(iter, ...range);
    }
    this.ranges = iter;
    return this;
  }

  public projection(...range: Range): Range[] {
    const [ sProj, eProj ] = range;
    if (sProj >= eProj) {
      return [];
    }
    return this.ranges.flatMap(([ sCur, eCur ]) => {
      // If projection is inside the range
      if (sCur < sProj && eProj < eCur) {
        return [[ sProj, eProj ]];
      }
      // Projection wraps around
      if (sProj <= sCur && eCur <= eProj) {
        return [[ sCur, eCur ]];
      }
      // Matches left side
      if (sProj <= sCur && sCur < eProj && eProj < eCur) {
        return [[ sCur, eProj ]];
      }
      if (sCur < sProj && sProj < eCur && eCur < eProj) {
        return [[ sProj, eCur ]];
      }
      return [];
    });
  }
}
