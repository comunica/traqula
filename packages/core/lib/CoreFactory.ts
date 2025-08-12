import type { IToken } from 'chevrotain';

import type {
  SourceLocation,
  SourceLocationNodeAutoGenerate,
  SourceLocationNodeReplace,
  SourceLocationNoMaterialize,
  SourceLocationSource,
  SourceLocationStringReplace,
  Node,
  Localized,
  Wrap,
} from './nodeTypings';

export type Typed<Type extends PropertyKey> = { type: Type };
export type SubTyped<Type extends PropertyKey, Subtype extends PropertyKey> = { type: Type; subType: Subtype };

export class CoreFactory {
  public wrap<T>(val: T, loc: SourceLocation): Wrap<T> {
    return { val, loc };
  }

  public isLocalized(obj: unknown): obj is Localized {
    return typeof obj === 'object' && obj !== null && 'loc' in obj &&
      typeof obj.loc === 'object' && obj.loc !== null && 'sourceLocationType' in obj.loc;
  }

  public sourceLocation(...elements: (undefined | IToken | Localized)[]): SourceLocation {
    const pureElements = elements.filter(x => x !== undefined);
    if (pureElements.length === 0) {
      return this.sourceLocationNoMaterialize();
    }
    const filtered = pureElements.filter(element =>
      !this.isLocalized(element) || this.isSourceLocationSource(element.loc) ||
      this.isSourceLocationStringReplace(element.loc) || this.isSourceLocationNodeReplace(element.loc));
    if (filtered.length === 0) {
      return this.gen();
    }
    const first = filtered[0];
    const last = filtered.at(-1)!;
    return {
      sourceLocationType: 'source',
      start: this.isLocalized(first) ?
          (<SourceLocationSource | SourceLocationStringReplace> first.loc).start :
        first.startOffset,
      end: this.isLocalized(last) ?
          (<SourceLocationSource | SourceLocationStringReplace> last.loc).end :
          (last.endOffset! + 1),
    };
  }

  public sourceLocationNoMaterialize(): SourceLocationNoMaterialize {
    return { sourceLocationType: 'noMaterialize' };
  }

  /**
   * Returns a copy of the argument that is not materialized
   */
  public dematerialized<T extends Node>(arg: T): T & { loc: SourceLocationNoMaterialize } {
    return { ...arg, loc: this.sourceLocationNoMaterialize() };
  }

  public safeObjectTransform(value: unknown, mapper: (some: object) => any): any {
    if (value && typeof value === 'object') {
      // If you wonder why this is all so hard, this is the reason. We cannot lose the methods of our Array objects
      if (Array.isArray(value)) {
        return value.map(x => this.safeObjectTransform(x, mapper));
      }
      return mapper(value);
    }
    return value;
  }

  public forcedAutoGenTree<T extends object>(obj: T): T {
    const copy = { ...obj };
    for (const [ key, value ] of Object.entries(copy)) {
      (<Record<string, object>> copy)[key] = this.safeObjectTransform(value, obj => this.forcedAutoGenTree(obj));
    }
    if (this.isLocalized(copy)) {
      copy.loc = this.gen();
    }
    return copy;
  }

  public forceMaterialized<T extends Node>(arg: T): T {
    if (this.isSourceLocationNoMaterialize(arg.loc)) {
      return this.forcedAutoGenTree(arg);
    }
    return { ...arg };
  }

  public isSourceLocation(loc: object): loc is SourceLocation {
    return 'sourceLocationType' in loc;
  }

  public sourceLocationSource(start: number, end: number): SourceLocationSource {
    return {
      sourceLocationType: 'source',
      start,
      end,
    };
  }

  public gen(): SourceLocationNodeAutoGenerate {
    return { sourceLocationType: 'autoGenerate' };
  }

  public isSourceLocationSource(loc: object): loc is SourceLocationSource {
    return this.isSourceLocation(loc) && loc.sourceLocationType === 'source';
  }

  public isSourceLocationStringReplace(loc: object): loc is SourceLocationStringReplace {
    return this.isSourceLocation(loc) && loc.sourceLocationType === 'stringReplace';
  }

  public sourceLocationNodeReplaceUnsafe(loc: SourceLocation): SourceLocationNodeReplace {
    if (this.isSourceLocationSource(loc)) {
      return this.sourceLocationNodeReplace(loc);
    }
    throw new Error('not possible');
  }

  public sourceLocationNodeReplace(location: SourceLocationSource): SourceLocationNodeReplace;
  public sourceLocationNodeReplace(start: number, end: number): SourceLocationNodeReplace;
  public sourceLocationNodeReplace(startOrLoc: number | SourceLocationSource, end?: number): SourceLocationNodeReplace {
    let starting;
    let ending;
    if (typeof startOrLoc === 'number') {
      starting = startOrLoc;
      ending = end!;
    } else {
      starting = startOrLoc.start;
      ending = startOrLoc.end;
    }
    return {
      sourceLocationType: 'nodeReplace',
      start: starting,
      end: ending,
    };
  }

  public isSourceLocationNodeReplace(loc: object): loc is SourceLocationNodeReplace {
    return this.isSourceLocation(loc) && loc.sourceLocationType === 'nodeReplace';
  }

  public isSourceLocationNodeAutoGenerate(loc: object): loc is SourceLocationNodeAutoGenerate {
    return this.isSourceLocation(loc) && loc.sourceLocationType === 'autoGenerate';
  }

  public nodeShouldPrint(node: Localized): boolean {
    return this.isSourceLocationNodeReplace(node.loc) ||
      this.isSourceLocationNodeAutoGenerate(node.loc);
  }

  public printFilter(node: Localized, callback: () => void): void {
    if (this.nodeShouldPrint(node)) {
      callback();
    }
  }

  public isSourceLocationNoMaterialize(loc: object): loc is SourceLocationNoMaterialize {
    return this.isSourceLocation(loc) && loc.sourceLocationType === 'noMaterialize';
  }

  public isOfType<Type extends string>(obj: object, type: Type): obj is Typed<Type> {
    const casted: { type?: any } = obj;
    return casted.type === type;
  }

  public isOfSubType<Type extends string, SubType extends string>(obj: object, type: Type, subType: SubType):
    obj is SubTyped<Type, SubType> {
    const temp: { type?: unknown; subType?: unknown } = obj;
    return temp.type === type && temp.subType === subType;
  }
}
