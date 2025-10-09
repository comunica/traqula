import type { ITokenConfig, TokenType } from '@chevrotain/types';
import { createToken as chevcT } from 'chevrotain';

/**
 * Check whether the first two types overlap, if no, return the 3th argument, else the 4th.
 */
export type CheckOverlap<T, U, V, W = never> = T & U extends never ? V : W;

export function unCapitalize<T extends string>(str: T): Uncapitalize<T> {
  return <Uncapitalize<T>> (str.charAt(0).toLowerCase() + str.slice(1));
}

export type NamedToken<Name extends string = string> = TokenType & { name: Name };

export function createToken<Name extends string>(config: ITokenConfig & { name: Name }): NamedToken<Name> {
  return <TokenType & { name: Name }> chevcT(config);
}

export type Patch<T extends object, Patch extends {[Key in keyof T ]?: unknown }> =
  {[Key in keyof T]: Key extends keyof Patch ? Patch[Key] : T[Key] };

/**
 * Key that allows you to set the space based indentation of your query when generating newlines using the NEW_LINE.
 * A value of -1 disables the generation of newlines from the NEW_LINE function
 */
export const traqulaIndentation =
  'When you use this string, you expect traqula to handle indentation after every newline';
