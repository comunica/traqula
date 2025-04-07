/**
 * Check whether the first two types overlap, if no, return the 3th argument, else the 4th.
 */
export type CheckOverlap<T, U, V, W = never> = T & U extends never ? V : W;

export function unCapitalize<T extends string>(str: T): Uncapitalize<T> {
  return <Uncapitalize<T>> (str.charAt(0).toLowerCase() + str.slice(1));
}

/**
 * A AST node. Nodes are indexable by their types.
 */
export type Node = {
  type: string;
  /**
   * Location undefined means the node does have a string representation, but it was not clarified.
   * This happens when an AST node is patched by a client of the lib.
   */
  loc: undefined | SourceLocation;
};

export type SourceLocation = {
  // When null, traverse the tree up until you find a non-null source
  source?: string | undefined;
  /**
   * NoStringManifestation means the node does not have a string representation.
   * For example the literal '5' has an integer type (which is an AST node),
   * but the type does not have an associated string representation.
   * When set to true, the node will not be printed, start and end are meaningless in this case.
   */
  noStringManifestation?: true;
  start: number;
  end: number;
};
