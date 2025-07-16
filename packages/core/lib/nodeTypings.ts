export interface Localized {
  /**
   * Location undefined means the node does have a string representation, but it was not clarified.
   * This happens when an AST node is patched by a client of the lib.
   */
  loc: SourceLocation;
}

export interface Wrap<T> extends Localized {
  val: T;
}

/**
 * A AST node. Nodes are indexable by their types.
 * When generating, the SUBRULES called should be located within the current location range.
 */
export interface Node extends Localized {
  type: string;
  subType?: string;
}

export interface SourceLocationBase {
  sourceLocationType: string;
}

export interface SourceLocationSource extends SourceLocationBase {
  sourceLocationType: 'source';
  start: number;
  end: number;
}

/**
 * NoStringManifestation means the node does not have a string representation.
 * For example the literal '5' has an integer type (which is an AST node),
 * but the type does not have an associated string representation.
 * When set to true, the node will not be printed, start and end are meaningless in this case.
 */
export interface SourceLocationNoMaterialize extends SourceLocationBase {
  sourceLocationType: 'noMaterialize';
}

export interface SourceLocationStringReplace extends SourceLocationBase {
  sourceLocationType: 'stringReplace';
  newSource: string;
  start: number;
  end: number;
}

export interface SourceLocationNodeReplace extends SourceLocationBase {
  sourceLocationType: 'nodeReplace';
  start: number;
  end: number;
}
/**
 * Must have an ancestor of type {@link SourceLocationNodeReplace}
 */
export interface SourceLocationNodeAutoGenerate extends SourceLocationBase {
  sourceLocationType: 'autoGenerate';
}

export type SourceLocation =
  | SourceLocationSource
  | SourceLocationNoMaterialize
  | SourceLocationStringReplace
  | SourceLocationNodeReplace
  | SourceLocationNodeAutoGenerate;
