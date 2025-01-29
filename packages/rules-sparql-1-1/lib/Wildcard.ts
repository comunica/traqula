export class Wildcard {
  public value = <const> '*';
  public termType = <const> 'Wildcard';
  public constructor() {
    // eslint-disable-next-line no-constructor-return
    return WILDCARD ?? this;
  }

  public equals(other: { termType: unknown } | undefined | null): boolean {
    return Boolean(other && (this.termType === other.termType));
  }

  public toJSON(): object {
    // eslint-disable-next-line unused-imports/no-unused-vars
    const { value, ...rest } = this;
    return rest;
  }
}

let WILDCARD: Wildcard | undefined;
WILDCARD = new Wildcard();
