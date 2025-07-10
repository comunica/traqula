/**
 * Check whether the first two types overlap, if no, return the 3th argument, else the 4th.
 */
export type CheckOverlap<T, U, V, W = never> = T & U extends never ? V : W;

export function unCapitalize<T extends string>(str: T): Uncapitalize<T> {
  return <Uncapitalize<T>> (str.charAt(0).toLowerCase() + str.slice(1));
}
