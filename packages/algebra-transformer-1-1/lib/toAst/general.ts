import type * as RDF from '@rdfjs/types';
import type {
  DatasetClauses,
  Pattern,
  PatternBgp,
  TermBlank,
  TermIri,
  TermLiteral,
  TermVariable,
  TripleNesting,
} from '@traqula/rules-sparql-1-1';
import type * as Algebra from '../algebra';
import Util from '../util';
import type { AstContext } from './core';
import { translatePathComponent } from './path';
import { translateExpression, translateOperation } from './pattern';

type RdfTermToAst<T extends RDF.Term> = T extends RDF.Variable ? TermVariable :
  T extends RDF.BlankNode ? TermBlank :
    T extends RDF.Literal ? TermLiteral :
      T extends RDF.NamedNode ? TermIri : never;

export function translateTerm<T extends RDF.Term>(c: AstContext, term: T): RdfTermToAst<T> {
  const F = c.astFactory;
  if (term.termType === 'NamedNode') {
    return <RdfTermToAst<T>> F.namedNode(F.gen(), term.value);
  }
  if (term.termType === 'BlankNode') {
    return <RdfTermToAst<T>> F.blankNode(term.value, F.gen());
  }
  if (term.termType === 'Variable') {
    return <RdfTermToAst<T>> F.variable(term.value, F.gen());
  }
  if (term.termType === 'Literal') {
    return <RdfTermToAst<T>> F.literalTerm(
      F.gen(),
      term.value,
      term.language ? term.language : translateTerm(c, term.datatype),
    );
  }
  throw new Error(`invalid term type: ${term.termType}`);
}

export function translateExtend(c: AstContext, op: Algebra.Extend): Pattern[] {
  const F = c.astFactory;
  if (c.project) {
    c.extend.push(op);
    return translateOperation(c, op.input);
  }
  return Util.flatten([
    translateOperation(c, op.input),
    F.patternBind(
      translateExpression(c, op.expression),
      translateTerm(c, op.variable),
      F.gen(),
    ),
  ]);
}

export function translateDatasetClauses(
  c: AstContext,
  _default: RDF.NamedNode[],
  named: RDF.NamedNode[],
): DatasetClauses {
  const F = c.astFactory;
  return F.datasetClauses([
    ..._default.map(x => (<const>{ clauseType: 'default', value: translateTerm(c, x) })),
    ...named.map(x => (<const>{ clauseType: 'named', value: translateTerm(c, x) })),
  ], F.gen());
}

export function translateOrderBy(c: AstContext, op: Algebra.OrderBy): any {
  c.order.push(...op.expressions);
  return translateOperation(c, op.input);
}

export function translatePath(c: AstContext, op: Algebra.Path): PatternBgp {
  const F = c.astFactory;
  return F.patternBgp([
    F.triple(
      translateTerm(c, op.subject),
      translatePathComponent(c, op.predicate),
      translateTerm(c, op.object),
    ),
  ], F.gen());
}

export function translatePattern(c: AstContext, op: Algebra.Pattern): TripleNesting {
  const F = c.astFactory;
  return F.triple(
    translateTerm(c, op.subject),
    <TripleNesting['predicate']> translateTerm(c, op.predicate),
    translateTerm(c, op.object),
  );
}

export function translateReduced(c: AstContext, op: Algebra.Reduced): Pattern {
  const result = translateOperation(c, op.input);
  // Project is nested in group object
  result.patterns[0].reduced = true;
  return result;
}
