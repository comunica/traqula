import type { IToken } from 'chevrotain';

import type {
  SourceLocation,
  SourceLocationNodeAutoGenerate,
  SourceLocationNodeReplace,
  SourceLocationNoMaterialize,
  SourceLocationSource,
  SourceLocationStringReplace,
  Node,
} from './nodeTypings';

export class CoreFactory {
  public sourceLocation(...elements: (IToken | SourceLocation)[]): SourceLocation {
    const filtered =
      elements.filter(element => !this.isSourceLocation(element) || this.isSourceLocationSource(element));
    if (filtered.length === 0) {
      return this.sourceLocationNoMaterialize();
    }
    const first = filtered[0];
    const last = filtered.at(-1)!;
    return {
      sourceLocationType: 'source',
      start: this.isSourceLocationSource(first) ? first.start : first.startOffset,
      end: this.isSourceLocationSource(last) ? last.end : (last.endOffset! + 1),
    };
  }

  public sourceLocationNoMaterialize(): SourceLocationNoMaterialize {
    return { sourceLocationType: 'noMaterialize' };
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

  public isSourceLocationSource(loc: object): loc is SourceLocationSource {
    return this.isSourceLocation(loc) && loc.sourceLocationType === 'source';
  }

  public isSourceLocationStringReplace(loc: object): loc is SourceLocationStringReplace {
    return this.isSourceLocation(loc) && loc.sourceLocationType === 'stringReplace';
  }

  public sourceLocationNodeReplace(start: number, end: number): SourceLocationNodeReplace {
    return {
      sourceLocationType: 'nodeReplace',
      start,
      end,
    };
  }

  public isSourceLocationNodeReplace(loc: object): loc is SourceLocationNodeReplace {
    return this.isSourceLocation(loc) && loc.sourceLocationType === 'nodeReplace';
  }

  public isSourceLocationNodeAutoGenerate(loc: object): loc is SourceLocationNodeAutoGenerate {
    return this.isSourceLocation(loc) && loc.sourceLocationType === 'autoGenerate';
  }

  public nodeShouldPrint(node: Node): boolean {
    return this.isSourceLocationNodeReplace(node.loc) ||
      this.isSourceLocationNodeAutoGenerate(node.loc);
  }

  public printFilter(node: Node, callback: () => void): void {
    if (this.nodeShouldPrint(node)) {
      callback();
    }
  }

  public isSourceLocationNoMaterialize(loc: object): loc is SourceLocationNoMaterialize {
    return this.isSourceLocation(loc) && loc.sourceLocationType === 'noMaterialize';
  }
}
