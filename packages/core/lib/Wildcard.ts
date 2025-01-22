export class Wildcard {
  public value = <const> '*';
  public termType = <const> 'Wildcard';
  public constructor() {
     
    return singleton ?? this;
  }

  public equals(other: { termType: unknown } | undefined | null): boolean {
    return Boolean(other && (this.termType === other.termType));
  }

  public toJSON(): object {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { value, ...rest } = this;
    return rest;
  }
}

let singleton: Wildcard | undefined = undefined;
singleton = new Wildcard();
