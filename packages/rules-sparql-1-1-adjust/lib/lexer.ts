import type { NamedToken } from '@traqula/core';
import { createToken } from '@traqula/core';

export const BuiltInAdjust: NamedToken<'BuiltInAdjust'> = createToken({ name: 'BuiltInAdjust', pattern: 'ADJUST' });
