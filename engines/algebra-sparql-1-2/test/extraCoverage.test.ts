import { AlgebraFactory } from '@traqula/algebra-transformations-1-1';
import { Parser } from '@traqula/parser-sparql-1-2';
import { AstFactory } from '@traqula/rules-sparql-1-2';
import { describe, it } from 'vitest';
import { toAlgebra, toAst } from '../lib/index.js';

describe('algebra-sparql-1-2 extra coverage', () => {
  const AF = new AlgebraFactory();

  describe('toAst (lines 21-23)', () => {
    it('converts a simple projection to sparql 1.2 ast', ({ expect }) => {
      const op = AF.createProject(AF.createBgp([]), []);
      const result = toAst(op);
      expect(result).toBeDefined();
      expect(result.type).toBe('query');
    });
  });

  describe('toAlgebra12.ts directional literal (line 51)', () => {
    it('translates a directional language-tagged literal with ltr direction', ({ expect }) => {
      // Covers toAlgebra12.ts line 51: creates literal with { language, direction }
      const F = new AstFactory();
      const parser = new Parser({ defaultContext: { astFactory: F }});
      const ast = parser.parse('SELECT * WHERE { ?s ?p "hello"@en--ltr }');
      const algebra = toAlgebra(ast);
      expect(algebra).toBeDefined();
    });

    it('translates a directional language-tagged literal with rtl direction', ({ expect }) => {
      // Covers toAlgebra12.ts line 51: creates literal with { language, direction }
      const F = new AstFactory();
      const parser = new Parser({ defaultContext: { astFactory: F }});
      const ast = parser.parse('SELECT * WHERE { ?s ?p "مرحبا"@ar--rtl }');
      const algebra = toAlgebra(ast);
      expect(algebra).toBeDefined();
    });
  });
});
