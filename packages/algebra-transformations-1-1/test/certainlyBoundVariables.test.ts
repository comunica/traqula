import type * as RDF from '@rdfjs/types';
import { describe, it } from 'vitest';
import type { Algebra } from '../lib/index.js';
import { AlgebraFactory, algebraUtils } from '../lib/index.js';

describe('algebraUtils.certainlyBoundVariables', () => {
  const AF = new AlgebraFactory();
  const DF = AF.dataFactory;
  const v = (name: string): RDF.Variable => DF.variable!(name);
  const iri = (value: string): RDF.NamedNode => DF.namedNode(value);

  function pattern(s: string, p: string, o: string): Algebra.Pattern {
    return AF.createPattern(v(s), iri(p), v(o));
  }

  function bound(op: Algebra.Operation, extendBinds = false): string[] {
    return [ ...algebraUtils.certainlyBoundVariables(op, { extendBinds }) ].sort();
  }

  it('collects the variables of a basic graph pattern', ({ expect }) => {
    expect(bound(AF.createBgp([ pattern('s', 'ex://p', 'o') ]))).toEqual([ 'o', 's' ]);
  });

  it('intersects the branches of a UNION', ({ expect }) => {
    const union = AF.createUnion([
      AF.createBgp([ pattern('s', 'ex://p', 'o') ]),
      AF.createBgp([ pattern('s', 'ex://q', 'x') ]),
    ]);
    expect(bound(union)).toEqual([ 's' ]);
  });

  it('keeps only the required side of a LEFT JOIN (OPTIONAL)', ({ expect }) => {
    const leftJoin = AF.createLeftJoin(
      AF.createBgp([ pattern('s', 'ex://p', 'o') ]),
      AF.createBgp([ pattern('s', 'ex://q', 'x') ]),
    );
    expect(bound(leftJoin)).toEqual([ 'o', 's' ]);
  });

  it('restricts to projected variables', ({ expect }) => {
    const project = AF.createProject(AF.createBgp([ pattern('s', 'ex://p', 'o') ]), [ v('s') ]);
    expect(bound(project)).toEqual([ 's' ]);
  });

  it('treats a VALUES variable as bound only when every row provides a value', ({ expect }) => {
    const values = AF.createValues([ v('s'), v('o') ], [
      { s: iri('ex://a'), o: iri('ex://b') },
      { s: iri('ex://c') },
    ]);
    expect(bound(values)).toEqual([ 's' ]);
  });

  describe('extendBinds option', () => {
    const constBind = AF.createExtend(
      AF.createBgp([ pattern('s', 'ex://p', 'o') ]),
      v('b'),
      AF.createTermExpression(iri('ex://z')),
    );

    it('ignores BIND by default', ({ expect }) => {
      expect(bound(constBind)).toEqual([ 'o', 's' ]);
    });

    it('treats a constant BIND as certainly bound when enabled', ({ expect }) => {
      expect(bound(constBind, true)).toEqual([ 'b', 'o', 's' ]);
    });

    it('treats a variable-copy BIND as bound iff its source is bound', ({ expect }) => {
      const copyBound = AF.createExtend(
        AF.createBgp([ pattern('s', 'ex://p', 'o') ]),
        v('b'),
        AF.createTermExpression(v('o')),
      );
      expect(bound(copyBound, true)).toEqual([ 'b', 'o', 's' ]);

      const copyUnbound = AF.createExtend(
        AF.createBgp([ pattern('s', 'ex://p', 'o') ]),
        v('b'),
        AF.createTermExpression(v('u')),
      );
      expect(bound(copyUnbound, true)).toEqual([ 'o', 's' ]);
    });

    it('ignores a BIND of a possibly-erroring expression', ({ expect }) => {
      const exprBind = AF.createExtend(
        AF.createBgp([ pattern('s', 'ex://p', 'o') ]),
        v('b'),
        AF.createOperatorExpression('+', [
          AF.createTermExpression(v('o')),
          AF.createTermExpression(DF.literal('1')),
        ]),
      );
      expect(bound(exprBind, true)).toEqual([ 'o', 's' ]);
    });

    it('ignores a BIND of a triple term even when its components are bound', ({ expect }) => {
      const tripleBind = AF.createExtend(
        AF.createBgp([ pattern('s', 'ex://p', 'o') ]),
        v('b'),
        AF.createTermExpression(DF.quad(v('s'), iri('ex://p'), v('o'))),
      );
      expect(bound(tripleBind, true)).toEqual([ 'o', 's' ]);
    });
  });

  describe('isVariableCertainlyBound', () => {
    it('answers by name and by variable term', ({ expect }) => {
      const op = AF.createBgp([ pattern('s', 'ex://p', 'o') ]);
      expect(algebraUtils.isVariableCertainlyBound(op, 's')).toBe(true);
      expect(algebraUtils.isVariableCertainlyBound(op, v('o'))).toBe(true);
      expect(algebraUtils.isVariableCertainlyBound(op, 'missing')).toBe(false);
    });
  });

  describe('other operation types', () => {
    const bgpSO = AF.createBgp([ pattern('s', 'ex://p', 'o') ]);

    it('collects the variables of a single PATTERN', ({ expect }) => {
      expect(bound(pattern('s', 'ex://p', 'o'))).toEqual([ 'o', 's' ]);
    });

    it('recurses into a quoted triple inside a PATTERN', ({ expect }) => {
      const quoted = AF.createPattern(v('s'), iri('ex://p'), DF.quad(v('a'), iri('ex://q'), v('b')));
      expect(bound(quoted)).toEqual([ 'a', 'b', 's' ]);
    });

    it('collects the endpoints of a PATH', ({ expect }) => {
      const path = AF.createPath(v('s'), AF.createLink(iri('ex://p')), v('o'));
      expect(bound(path)).toEqual([ 'o', 's' ]);
    });

    it('unions the operands of a JOIN', ({ expect }) => {
      const join = AF.createJoin([
        AF.createBgp([ pattern('s', 'ex://p', 'o') ]),
        AF.createBgp([ pattern('s', 'ex://q', 'x') ]),
      ]);
      expect(bound(join)).toEqual([ 'o', 's', 'x' ]);
    });

    it('keeps only the required side of a MINUS', ({ expect }) => {
      const minus = AF.createMinus(bgpSO, AF.createBgp([ pattern('s', 'ex://q', 'x') ]));
      expect(bound(minus)).toEqual([ 'o', 's' ]);
    });

    it('reports the grouping variables of a GROUP', ({ expect }) => {
      const group = AF.createGroup(bgpSO, [ v('s') ], []);
      expect(bound(group)).toEqual([ 's' ]);
    });

    it('returns an empty set for a UNION with no branches', ({ expect }) => {
      expect(bound(AF.createUnion([]))).toEqual([]);
    });

    it('passes through unary operations that do not change bindings', ({ expect }) => {
      const passthrough = [
        AF.createGraph(bgpSO, iri('ex://g')),
        AF.createFilter(bgpSO, AF.createTermExpression(DF.literal('true'))),
        AF.createService(bgpSO, iri('ex://endpoint')),
        AF.createDistinct(bgpSO),
        AF.createReduced(bgpSO),
        AF.createSlice(bgpSO, 0, 10),
        AF.createOrderBy(bgpSO, [ AF.createTermExpression(v('s')) ]),
        AF.createFrom(bgpSO, [ iri('ex://g') ], []),
      ];
      for (const op of passthrough) {
        expect(bound(op)).toEqual([ 'o', 's' ]);
      }
    });

    it('returns an empty set for an unhandled operation type', ({ expect }) => {
      expect(bound(AF.createNop())).toEqual([]);
    });
  });
});
