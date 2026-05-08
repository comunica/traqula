import type { IToken } from '@traqula/chevrotain';

import type {
  SourceLocation,
  SourceLocationBase,
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
import {
  SOURCE_LOC_SOURCE,
  SOURCE_LOC_INLINED_SOURCE,
  SOURCE_LOC_NO_MATERIALIZE,
  SOURCE_LOC_STRING_REPLACE,
  SOURCE_LOC_NODE_REPLACE,
  SOURCE_LOC_AUTO_GENERATE,
} from './types.js';

export interface AstCoreFactoryArgs {
  /**
   * Whether the AstFactory can track sources, if not, the sourceLocation function returns autoGen. Default true
   */
  tracksSourceLocation: boolean;
}

export class AstCoreFactory implements AstCoreFactoryArgs {
  /**
   * Whether this AstFactory will track source location. Default: true.
   * In case source location is not tracked,
   * each generated node using this factory will be {@link SourceLocationNodeAutoGenerate}
   */
  public tracksSourceLocation: boolean;

  // Cached singletons to avoid allocating identical objects repeatedly
  public readonly cachedAutoGen: SourceLocationNodeAutoGenerate = { sourceLocationType: SOURCE_LOC_AUTO_GENERATE };
  public readonly cachedNoMat: SourceLocationNoMaterialize = { sourceLocationType: SOURCE_LOC_NO_MATERIALIZE };

  public constructor(args: Partial<AstCoreFactoryArgs> = {}) {
    this.tracksSourceLocation = args.tracksSourceLocation ?? true;
  }

  /**
   * Wrap any type into an object that tracks the source location of tha value.
   * @param val the value to wrap
   * @param loc the source location for that value
   */
  public wrap<T>(val: T, loc: SourceLocation): Wrap<T> {
    return { val, loc };
  }

  /**
   * Whether the provided value is an object that tracks source location.
   * @param obj
   */
  public isLocalized(obj: unknown): obj is Localized {
    return typeof obj === 'object' && obj !== null && 'loc' in obj &&
      typeof obj.loc === 'object' && obj.loc !== null && 'sourceLocationType' in obj.loc;
  }

  /**
   * Compute the source location of an element based on the elements it contains.
   * The provided arguments should be in order of occurrence in the string.
   */
  public sourceLocation(...elements: (undefined | IToken | Localized)[]): SourceLocation {
    if (!this.tracksSourceLocation) {
      return this.cachedAutoGen;
    }

    // Inline filter to avoid allocating intermediate arrays
    let firstValid: IToken | Localized | undefined;
    let lastValid: IToken | Localized | undefined;
    let firstIsLocalized = false;
    let lastIsLocalized = false;
    let hasAnyElement = false;
    let hasFiltered = false;

    for (const x of elements) {
      if (x === undefined) {
        continue;
      }
      hasAnyElement = true;
      const localized = this.isLocalized(x);
      if (!localized ||
        x.loc.sourceLocationType === SOURCE_LOC_SOURCE ||
        x.loc.sourceLocationType === SOURCE_LOC_STRING_REPLACE ||
        x.loc.sourceLocationType === SOURCE_LOC_NODE_REPLACE) {
        if (!hasFiltered) {
          firstValid = x;
          firstIsLocalized = localized;
          hasFiltered = true;
        }
        lastValid = x;
        lastIsLocalized = localized;
      }
    }

    if (!hasAnyElement) {
      return this.cachedNoMat;
    }
    if (!hasFiltered) {
      return this.cachedAutoGen;
    }

    const first = firstValid!;
    const last = lastValid!;
    return {
      sourceLocationType: SOURCE_LOC_SOURCE,
      start: firstIsLocalized ?
          (<SourceLocationSource | SourceLocationStringReplace> (<Localized> first).loc).start :
          (<IToken> first).startOffset,
      end: lastIsLocalized ?
          (<SourceLocationSource | SourceLocationStringReplace> (<Localized> last).loc).end :
          ((<IToken> last).endOffset! + 1),
    };
  }

  /**
   * Generate a source location indicating the no materialization.
   */
  public sourceLocationNoMaterialize(): SourceLocation {
    if (!this.tracksSourceLocation) {
      return this.cachedAutoGen;
    }
    return this.cachedNoMat;
  }

  /**
   * Returns a copy of the argument that is not materialized
   */
  public dematerialized<T extends Node>(arg: T): T {
    return { ...arg, loc: this.sourceLocationNoMaterialize() };
  }

  /**
   * Given a value and some mapper from objects to objects,
   * map all containing items in case it is an array,
   * otherwise map the provided value in case it is an object, finally, do nothing.
   * @param value the value to map
   * @param mapper the function mapping an object to another object.
   */
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

  /**
   * Given a (AST) tree, return a copy of that tree where it and it's
   * descendents all have a {@link SourceLocationNodeAutoGenerate} localization.
   */
  public forcedAutoGenTree<T extends object>(obj: T): T {
    const copy = { ...obj };
    const keys = Object.keys(copy);
    for (const key of keys) {
      (<Record<string, object>> copy)[key] = this.safeObjectTransform(
        (<Record<string, unknown>> copy)[key],
        obj => this.forcedAutoGenTree(obj),
      );
    }
    if (this.isLocalized(copy)) {
      copy.loc = this.cachedAutoGen;
    }
    return copy;
  }

  /**
   * In case the provided Node is not yet materialized, force it to be autoGenerated.
   */
  public forceMaterialized<T extends Node>(arg: T): T {
    if (arg.loc.sourceLocationType === SOURCE_LOC_NO_MATERIALIZE) {
      return this.forcedAutoGenTree(arg);
    }
    return { ...arg };
  }

  /**
   * Check whether an object is in fact a {@link SourceLocation}.
   * @param loc
   */
  public isSourceLocation(loc: object): loc is SourceLocation {
    return 'sourceLocationType' in loc;
  }

  /**
   * Create a {@link SourceLocation} that indicates what range of characters this node represents in the source string.
   */
  public sourceLocationSource(start: number, end: number): SourceLocationSource {
    return {
      sourceLocationType: SOURCE_LOC_SOURCE,
      start,
      end,
    };
  }

  /**
   * Create a {@link SourceLocation} that indicates a given range of the current range should be replaced by
   * a new source.
   */
  public sourceLocationInlinedSource(
    newSource: string,
    subLoc: SourceLocation,
    start: number,
    end: number,
    startOnNew = 0,
    endOnNew: number = newSource.length,
  ): SourceLocation {
    if (!this.tracksSourceLocation) {
      return this.cachedAutoGen;
    }
    if (subLoc.sourceLocationType === SOURCE_LOC_SOURCE) {
      startOnNew = subLoc.start;
      endOnNew = subLoc.end;
    }
    return {
      sourceLocationType: SOURCE_LOC_INLINED_SOURCE,
      newSource,
      start,
      end,
      loc: subLoc,
      startOnNew,
      endOnNew,
    }satisfies SourceLocationInlinedSource;
  };

  /**
   * Guard to check if an object is a {@link SourceLocation} of type {@link SourceLocationInlinedSource}.
   */
  public isSourceLocationInlinedSource(loc: object): loc is SourceLocationInlinedSource {
    return (<SourceLocationBase> loc).sourceLocationType === SOURCE_LOC_INLINED_SOURCE;
  }

  /**
   * Create a {@link SourceLocation} indicating the node should be autoGenerated by a generator.
   */
  public gen(): SourceLocationNodeAutoGenerate {
    return this.cachedAutoGen;
  }

  /**
   * Guard to check if an object is a {@link SourceLocation} of type {@link SourceLocationSource}.
   */
  public isSourceLocationSource(loc: object): loc is SourceLocationSource {
    return (<SourceLocationBase> loc).sourceLocationType === SOURCE_LOC_SOURCE;
  }

  /**
   * Create a {@link SourceLocation} that indicates this node,
   * representing a range of characters in the original string, should be replaced by some string during generation.
   */
  public sourceLocationStringReplace(newSource: string, start: number, end: number): SourceLocation {
    if (!this.tracksSourceLocation) {
      return this.cachedAutoGen;
    }
    return {
      sourceLocationType: SOURCE_LOC_STRING_REPLACE,
      newSource,
      start,
      end,
    } satisfies SourceLocationStringReplace;
  }

  /**
   * Guard to check if an object is a {@link SourceLocation} of type {@link SourceLocationStringReplace}.
   * @param loc
   */
  public isSourceLocationStringReplace(loc: object): loc is SourceLocationStringReplace {
    return (<SourceLocationBase> loc).sourceLocationType === SOURCE_LOC_STRING_REPLACE;
  }

  /**
   * Given a sourceLocation, generate a new {@link SourceLocation}
   * that indicates the range of the given location should now be autoGenerated
   */
  public sourceLocationNodeReplaceUnsafe(loc: SourceLocation): SourceLocationNodeReplace {
    if (loc.sourceLocationType === SOURCE_LOC_SOURCE) {
      return this.sourceLocationNodeReplace(loc);
    }
    if (loc.sourceLocationType === SOURCE_LOC_INLINED_SOURCE) {
      return this.sourceLocationNodeReplaceUnsafe(loc.loc);
    }
    throw new Error(
      `Cannot convert SourceLocation of type ${loc.sourceLocationType} to SourceLocationNodeReplace`,
    );
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
      sourceLocationType: SOURCE_LOC_NODE_REPLACE,
      start: starting,
      end: ending,
    };
  }

  /**
   * Guard to check if an object is a {@link SourceLocation} of type {@link SourceLocationNodeReplace}.
   */
  public isSourceLocationNodeReplace(loc: object): loc is SourceLocationNodeReplace {
    return (<SourceLocationBase> loc).sourceLocationType === SOURCE_LOC_NODE_REPLACE;
  }

  /**
   * Guard to check if an object is a {@link SourceLocation} of type {@link SourceLocationNodeAutoGenerate}.
   */
  public isSourceLocationNodeAutoGenerate(loc: object): loc is SourceLocationNodeAutoGenerate {
    return (<SourceLocationBase> loc).sourceLocationType === SOURCE_LOC_AUTO_GENERATE;
  }

  /**
   * Check whether the provided {@link SourceLocation} expects the generator to autoGenerate.
   */
  public isPrintingLoc(loc: SourceLocation): boolean {
    return loc.sourceLocationType === SOURCE_LOC_NODE_REPLACE ||
      loc.sourceLocationType === SOURCE_LOC_AUTO_GENERATE ||
      (loc.sourceLocationType === SOURCE_LOC_INLINED_SOURCE && this.isPrintingLoc(loc.loc));
  }

  /**
   * A simple filter that will only execute the provided callback when the provided {@link SourceLocation}
   * expects the generator steps to autoGenerate.
   */
  public printFilter(node: Localized, callback: () => void): void {
    if (this.isPrintingLoc(node.loc)) {
      callback();
    }
  }

  /**
   * Guard to check if an object is a {@link SourceLocation} of type {@link SourceLocationNoMaterialize}.
   */
  public isSourceLocationNoMaterialize(loc: object): loc is SourceLocationNoMaterialize {
    return (<SourceLocationBase> loc).sourceLocationType === SOURCE_LOC_NO_MATERIALIZE;
  }

  /**
   * Guard to check if an object is the specified Type: {@link Typed}.
   */
  public isOfType<Type extends string>(obj: object, type: Type): obj is Typed<Type> {
    const casted: { type?: any } = obj;
    return casted.type === type;
  }

  /**
   * Guard to check if an object is the specified Type: {@link SubTyped}.
   */
  public isOfSubType<Type extends string, SubType extends string>(obj: object, type: Type, subType: SubType):
    obj is SubTyped<Type, SubType> {
    const temp: { type?: unknown; subType?: unknown } = obj;
    return temp.type === type && temp.subType === subType;
  }
}
