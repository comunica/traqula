import { describe, it } from 'vitest';
import { AstCoreFactory } from '../lib/AstCoreFactory.js';

describe('astCoreFactory', () => {
  describe('source location management', () => {
    it('gen() creates autoGenerate location', ({ expect }) => {
      const factory = new AstCoreFactory();
      const loc = factory.gen();
      expect(loc.sourceLocationType).toBe('autoGenerate');
    });

    it('sourceLocation creates source location when tracking enabled', ({ expect }) => {
      const factory = new AstCoreFactory({ tracksSourceLocation: true });
      const loc = factory.sourceLocationSource(10, 20);
      expect(factory.isSourceLocationSource(loc)).toBe(true);
      expect(loc).toMatchObject({ start: 10, end: 20 });
    });

    it('sourceLocationStringReplace creates stringReplace location', ({ expect }) => {
      const factory = new AstCoreFactory({ tracksSourceLocation: true });
      const loc = factory.sourceLocationStringReplace('new content', 5, 15);
      expect(factory.isSourceLocationStringReplace(loc)).toBe(true);
      if (factory.isSourceLocationStringReplace(loc)) {
        expect(loc.newSource).toBe('new content');
        expect(loc.start).toBe(5);
        expect(loc.end).toBe(15);
      }
    });

    it('sourceLocationStringReplace returns gen() when tracking disabled', ({ expect }) => {
      const factory = new AstCoreFactory({ tracksSourceLocation: false });
      const loc = factory.sourceLocationStringReplace('new content', 5, 15);
      expect(factory.isSourceLocationNodeAutoGenerate(loc)).toBe(true);
    });

    it('sourceLocationNodeReplace with number arguments', ({ expect }) => {
      const factory = new AstCoreFactory({ tracksSourceLocation: true });
      const loc = factory.sourceLocationNodeReplace(0, 10);
      expect(factory.isSourceLocationNodeReplace(loc)).toBe(true);
      expect(loc.start).toBe(0);
      expect(loc.end).toBe(10);
    });

    it('sourceLocationNodeReplace with SourceLocationSource argument', ({ expect }) => {
      const factory = new AstCoreFactory({ tracksSourceLocation: true });
      const sourceLoc = factory.sourceLocationSource(5, 25);
      if (factory.isSourceLocationSource(sourceLoc)) {
        const loc = factory.sourceLocationNodeReplace(sourceLoc);
        expect(factory.isSourceLocationNodeReplace(loc)).toBe(true);
      }
    });

    it('sourceLocationNodeReplaceUnsafe handles SourceLocationSource', ({ expect }) => {
      const factory = new AstCoreFactory({ tracksSourceLocation: true });
      const sourceLoc = factory.sourceLocationSource(0, 10);
      if (factory.isSourceLocationSource(sourceLoc)) {
        const loc = factory.sourceLocationNodeReplaceUnsafe(sourceLoc);
        expect(factory.isSourceLocationNodeReplace(loc)).toBe(true);
      }
    });

    it('sourceLocationNodeReplaceUnsafe throws for unsupported types', ({ expect }) => {
      const factory = new AstCoreFactory({ tracksSourceLocation: true });
      const genLoc = factory.gen();
      expect(() => factory.sourceLocationNodeReplaceUnsafe(genLoc))
        .toThrowError('Cannot convert SourceLocation');
    });

    it('sourceLocationInlinedSource creates inlined source location', ({ expect }) => {
      const factory = new AstCoreFactory({ tracksSourceLocation: true });
      const innerLoc = factory.sourceLocationSource(0, 10);
      // SourceLocationInlinedSource(newSource, subLoc, start, end, startOnNew?, endOnNew?)
      const loc = factory.sourceLocationInlinedSource('inline source', innerLoc, 5, 15);
      expect(factory.isSourceLocationInlinedSource(loc)).toBe(true);
    });

    it('sourceLocationNoMaterialize creates noMaterialize location', ({ expect }) => {
      const factory = new AstCoreFactory({ tracksSourceLocation: true });
      const loc = factory.sourceLocationNoMaterialize();
      expect(factory.isSourceLocationNoMaterialize(loc)).toBe(true);
    });
  });

  describe('type checking', () => {
    it('isLocalized checks for loc property', ({ expect }) => {
      const factory = new AstCoreFactory();
      expect(factory.isLocalized({ loc: factory.gen() })).toBe(true);
      expect(factory.isLocalized({})).toBe(false);
      expect(factory.isLocalized({ loc: 'not a location' })).toBe(false);
    });

    it('isOfType checks type property', ({ expect }) => {
      const factory = new AstCoreFactory();
      expect(factory.isOfType({ type: 'test' }, 'test')).toBe(true);
      expect(factory.isOfType({ type: 'other' }, 'test')).toBe(false);
      expect(factory.isOfType({}, 'test')).toBe(false);
    });

    it('isOfSubType checks type and subType properties', ({ expect }) => {
      const factory = new AstCoreFactory();
      expect(factory.isOfSubType({ type: 'a', subType: 'b' }, 'a', 'b')).toBe(true);
      expect(factory.isOfSubType({ type: 'a', subType: 'c' }, 'a', 'b')).toBe(false);
      expect(factory.isOfSubType({ type: 'x', subType: 'b' }, 'a', 'b')).toBe(false);
    });
  });

  describe('location types', () => {
    it('identifies all location types correctly', ({ expect }) => {
      const factory = new AstCoreFactory({ tracksSourceLocation: true });

      const genLoc = factory.gen();
      expect(factory.isSourceLocationNodeAutoGenerate(genLoc)).toBe(true);
      expect(factory.isSourceLocationSource(genLoc)).toBe(false);

      const sourceLoc = factory.sourceLocationSource(0, 10);
      expect(factory.isSourceLocationSource(sourceLoc)).toBe(true);
      expect(factory.isSourceLocationNodeAutoGenerate(sourceLoc)).toBe(false);

      const noMatLoc = factory.sourceLocationNoMaterialize();
      expect(factory.isSourceLocationNoMaterialize(noMatLoc)).toBe(true);

      const strReplaceLoc = factory.sourceLocationStringReplace('x', 0, 1);
      expect(factory.isSourceLocationStringReplace(strReplaceLoc)).toBe(true);

      const nodeReplaceLoc = factory.sourceLocationNodeReplace(0, 5);
      expect(factory.isSourceLocationNodeReplace(nodeReplaceLoc)).toBe(true);
    });
  });

  describe('forceMaterialized', () => {
    it('converts noMaterialize location to autoGenerate tree', ({ expect }) => {
      const factory = new AstCoreFactory({ tracksSourceLocation: true });
      const noMatLoc = factory.sourceLocationNoMaterialize();
      const node = { type: 'test', loc: noMatLoc, value: 'x' };
      const result = factory.forceMaterialized(node);
      expect(factory.isSourceLocationNodeAutoGenerate(result.loc)).toBe(true);
    });

    it('returns shallow copy when location is not noMaterialize', ({ expect }) => {
      const factory = new AstCoreFactory({ tracksSourceLocation: true });
      const sourceLoc = factory.sourceLocationSource(0, 10);
      const node = { type: 'test', loc: sourceLoc, value: 'x' };
      const result = factory.forceMaterialized(node);
      expect(result).not.toBe(node);
      expect(result.loc).toBe(sourceLoc);
    });
  });
});
