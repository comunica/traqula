/**
 * Type that is used by the Traqula core package to type raw objects/ Data Transfer Objects (DTO).
 * Enforces the presence of a type string, and that in case the subType key is present, it also be a string.
 */
export interface Typed<Type extends string = string> {
  type: Type;
  subType?: string;
}

/**
 * A {@link Typed} object that is sure to have a subType
 */
export interface SubTyped<Type extends string = string, SubType extends string = string> extends Typed<Type> {
  subType: SubType;
}

/**
 * Type used by the parser and generator builders of the core Traqula package to annotate
 * the relation between AST objects and the source string.
 */
export interface Localized {
  loc: SourceLocation;
}

/**
 * Wrapper type for localization,
 * can be used to state localization information about any other type (including primitive types)
 */
export interface Wrap<T> extends Localized {
  val: T;
}

/**
 * A AST node. Nodes are indexable by their types.
 * When generating, the SUBRULES called should be located within the current location range.
 */
export interface Node extends Localized, Typed {}

export interface SourceLocationBase {
  sourceLocationType: string;
}

/**
 * SourceLocation type that annotates that the node represents the AST representation of
 * the given range in the source string.
 */
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

/**
 * SourceLocation type that annotates that the node has been replaced
 *   in relation to the original string by a new string.
 * It means that this node should be generated, and that the source string from start to end has been changed.
 */
export interface SourceLocationStringReplace extends SourceLocationBase {
  sourceLocationType: 'stringReplace';
  /**
   * The string that will replace the given range in the original source.
   */
  newSource: string;
  /**
   * The start of the region in the original source string that this node replaces.
   */
  start: number;
  /**
   * The end of the region in the original source string that this node replaces.
   */
  end: number;
}

/**
 * SourceLocation type that annotates that the node has been replaced in relation to the original string.
 * It means that this node should be generated, and that the source string from start to end has been changed.
 */
export interface SourceLocationNodeReplace extends SourceLocationBase {
  sourceLocationType: 'nodeReplace';
  /**
   * The start of the region in the original source string that this node replaces.
   */
  start: number;
  /**
   * The end of the region in the original source string that this node replaces.
   */
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
