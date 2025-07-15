import type { SourceLocation } from '@traqula/core';
import { TraqulaFactory } from '@traqula/rules-sparql-1-1';
import type * as T11 from '@traqula/rules-sparql-1-1';
import type {
  Annotation,
  Term,
  TermBlank,
  TermIri,
  TermTriple,
  TermVariable,
  TripleCollection,
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

  public override tripleCollectionBlankNodeProperties(
    identifier: TermBlank | TermVariable | TermIri,
    triples: TripleNesting[],
    loc: SourceLocation,
  ): T11.TripleCollectionBlankNodeProperties {
    return <T11.TripleCollectionBlankNodeProperties> {
      type: 'tripleCollection',
      subType: 'blankNodeProperties',
      triples,
      identifier,
      loc,
    } satisfies TripleCollectionBlankNodeProperties;
  }

  public isTripleCollection12(collection: object): collection is TripleCollection {
    return super.isTripleCollection(collection);
  }

  public override triple(
    subject: TripleNesting['subject'],
    predicate: TripleNesting['predicate'],
    object: TripleNesting['object'],
    loc?: SourceLocation,
  ): T11.TripleNesting {
    return <T11.TripleNesting> {
      type: 'triple',
      subject,
      predicate,
      object,
      annotations: [],
      loc: loc ?? this.sourceLocation(subject, predicate, object),
    } satisfies TripleNesting;
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

  public isTermTriple(term: Term): term is TermTriple {
    return term.subType === 'triple';
  }

  public isTripleCollectionReifiedTriple(collection: TripleCollection): collection is TripleCollectionReifiedTriple {
    return collection.subType === 'reifiedTriple';
  }
}
