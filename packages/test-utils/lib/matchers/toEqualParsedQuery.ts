import { expect } from 'vitest';
import { parsedQueryMatchers } from './parsedQueryMatchers.js';

// Register the matchers on vitest's `expect`. The matcher implementations
// themselves live in `parsedQueryMatchers.ts` so they can be reused by other
// test frameworks (e.g. jest) without pulling in vitest.
expect.extend(parsedQueryMatchers);
