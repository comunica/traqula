import { AlgebraFactory } from '@traqula/algebra-transformations-1-1';
import { describe, it } from 'vitest';
import { toAst } from '../lib/index.js';

describe('algebra-sparql-1-2 extra coverage', () => {
  const AF = new AlgebraFactory();

  describe('toAst', () => {
    it('converts a simple projection to sparql 1.2 ast', ({ expect }) => {
      const op = AF.createProject(AF.createBgp([]), []);
      const result = toAst(op);
      expect(result).toBeDefined();
      expect(result.type).toBe('query');
    });
  });
});
