import type { SourceLocation } from '@traqula/core';
import { TraqulaFactory } from '@traqula/rules-sparql-1-1';
import type * as T11 from '@traqula/rules-sparql-1-1';
import type {
  Annotation,
  TermBlank,
  TermIri,
  TermTriple,
  TermVariable,
  TripleCollectionBlankNodeProperties,
  TripleCollectionReifiedTriple,
  TripleNesting,
} from './sparql12Types';

export class Factory extends TraqulaFactory {
  public termTriple(
    subject: TermTriple['subject'],
    predicate: TermTriple['predicate'],
    object: TermTriple['object'],
    loc: SourceLocation,
  ): TermTriple {
    return {
      type: 'term',
      subType: 'triple',
      subject,
      predicate,
      object,
      loc,
    };
  }

  public tripleCollectionReifiedTriple(
    loc: SourceLocation,
    subject: TripleNesting['subject'],
    predicate: TripleNesting['predicate'],
    object: TripleNesting['object'],
    reifier?: TripleCollectionReifiedTriple['identifier'],
  ): TripleCollectionReifiedTriple {
    return {
      type: 'tripleCollection',
      subType: 'reifiedTriple',
      triples: [ this.triple(<T11.TripleNesting['subject']>subject, predicate, <T11.TripleNesting['object']>object) ],
      identifier: reifier ?? this.blankNode(undefined, this.sourceLocationNoMaterialize()),
      loc,
    };
  }

  // eslint-disable-next-line ts/ban-ts-comment
  // @ts-expect-error 2416
  public override tripleCollectionBlankNodeProperties(
    identifier: TermBlank | TermVariable | TermIri,
    triples: TripleNesting[],
    loc: SourceLocation,
  ): TripleCollectionBlankNodeProperties {
    return {
      type: 'tripleCollection',
      subType: 'blankNodeProperties',
      triples,
      identifier,
      loc,
    };
  }

  // eslint-disable-next-line ts/ban-ts-comment
  // @ts-expect-error 2416
  public override triple(
    subject: TripleNesting['subject'],
    predicate: TripleNesting['predicate'],
    object: TripleNesting['object'],
    loc?: SourceLocation,
  ): TripleNesting {
    return {
      type: 'triple',
      subject,
      predicate,
      object,
      annotations: [],
      loc: loc ?? this.sourceLocation(subject, predicate, object),
    };
  }

  public annotatedTriple(
    subject: TripleNesting['subject'],
    predicate: TripleNesting['predicate'],
    object: TripleNesting['object'],
    annotations?: Annotation[],
    loc?: SourceLocation,
  ): TripleNesting {
    return {
      type: 'triple',
      subject,
      predicate,
      object,
      annotations: annotations ?? [],
      loc: loc ?? this.sourceLocation(subject, predicate, object, ...annotations ?? []),
    };
  }
}
