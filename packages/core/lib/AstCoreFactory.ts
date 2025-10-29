import type { IToken } from '@traqula/chevrotain';

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
  Typed,
  SubTyped,
  SourceLocationInlinedSource,
} from './types.js';

export interface AstCoreFactoryArgs {
  /**
   * Whether the AstFactory can track sources, if not, the sourceLocation function returns autoGen. Default true
   */
  tracksSourceLocation: boolean;
}

export class AstCoreFactory implements AstCoreFactoryArgs {
  public tracksSourceLocation: boolean;
  public constructor(args: Partial<AstCoreFactoryArgs> = {}) {
    this.tracksSourceLocation = args.tracksSourceLocation ?? true;
  }

  public wrap<T>(val: T, loc: SourceLocation): Wrap<T> {
    return { val, loc };
  }

  public isLocalized(obj: unknown): obj is Localized {
    return typeof obj === 'object' && obj !== null && 'loc' in obj &&
      typeof obj.loc === 'object' && obj.loc !== null && 'sourceLocationType' in obj.loc;
  }

  public sourceLocation(...elements: (undefined | IToken | Localized)[]): SourceLocation {
    if (!this.tracksSourceLocation) {
      return this.gen();
    }

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
    const first = filtered.at(0)!;
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

  public sourceLocationNoMaterialize(): SourceLocation {
    if (!this.tracksSourceLocation) {
      return this.gen();
    }
    return { sourceLocationType: 'noMaterialize' };
  }

  /**
   * Returns a copy of the argument that is not materialized
   */
  public dematerialized<T extends Node>(arg: T): T {
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

  /**
   * {@inheritDoc SourceLocationInlinedSource}
   */
  public sourceLocationInlinedSource(
    newSource: string,
    subLoc: SourceLocation,
    start: number,
    end: number,
    startOnNew: number = 0,
    endOnNew: number = newSource.length,
  ): SourceLocation {
    if (!this.tracksSourceLocation) {
      return this.gen();
    }
    return {
      sourceLocationType: 'inlinedSource',
      newSource,
      start,
      end,
      loc: subLoc,
      startOnNew,
      endOnNew
    }satisfies SourceLocationInlinedSource;
  };

  public isSourceLocationInlinedSource(loc: object): loc is SourceLocationInlinedSource {
    return this.isSourceLocation(loc) && loc.sourceLocationType === 'inlinedSource';
  }

  public gen(): SourceLocationNodeAutoGenerate {
    return { sourceLocationType: 'autoGenerate' };
  }

  public isSourceLocationSource(loc: object): loc is SourceLocationSource {
    return this.isSourceLocation(loc) && loc.sourceLocationType === 'source';
  }

  public sourceLocationStringReplace(newSource: string, start: number, end: number): SourceLocation {
    if (!this.tracksSourceLocation) {
      return this.gen();
    }
    return { sourceLocationType: 'stringReplace', newSource, start, end } satisfies SourceLocationStringReplace;
  }

  public isSourceLocationStringReplace(loc: object): loc is SourceLocationStringReplace {
    return this.isSourceLocation(loc) && loc.sourceLocationType === 'stringReplace';
  }

  public sourceLocationNodeReplaceUnsafe(loc: SourceLocation): SourceLocationNodeReplace {
    if (this.isSourceLocationSource(loc)) {
      return this.sourceLocationNodeReplace(loc);
    }
    if (this.isSourceLocationInlinedSource(loc)) {
      return this.sourceLocationNodeReplaceUnsafe(loc.loc);
    }
    throw new Error(`Cannot convert SourceLocation of type ${loc.sourceLocationType} to SourceLocationNodeReplace`);
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

  public isPrintingLoc(loc: SourceLocation): boolean {
    return this.isSourceLocationNodeReplace(loc) ||
      this.isSourceLocationNodeAutoGenerate(loc) ||
      (this.isSourceLocationInlinedSource(loc) && this.isPrintingLoc(loc.loc));
  }

  public printFilter(node: Localized, callback: () => void): void {
    if (this.isPrintingLoc(node.loc)) {
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
