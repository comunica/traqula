import type { SourceLocation, SubTyped } from '@traqula/core';
import { Factory as Sparql11Factory } from '@traqula/rules-sparql-1-1';
import type * as T11 from '@traqula/rules-sparql-1-1';
import type {
  Annotation,
  ContextDefinitionVersion,
  TermBlank,
  TermIri,
  TermTriple,
  TermVariable,
  TripleCollectionBlankNodeProperties,
  TripleCollectionReifiedTriple,
  TripleNesting,
} from './sparql12Types';

export class Factory extends Sparql11Factory {
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

  public isTermTriple(obj: object): obj is SubTyped<'term', 'triple'> {
    return this.isOfSubType(obj, 'term', 'triple');
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

  public isTripleCollectionReifiedTriple(obj: object): obj is SubTyped<'tripleCollection', 'reifiedTriple'> {
    return this.isOfSubType(obj, 'tripleCollection', 'reifiedTriple');
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

  /**
   * Overwritten triple constructor to always contain an empty annotations list
   */
  public override triple: Sparql11Factory['triple'] =
    (subject, predicate, object, loc) => <T11.TripleNesting> {
      type: 'triple',
      subject,
      predicate,
      object,
      annotations: [],
      loc: loc ?? this.sourceLocation(subject, predicate, object),
    } satisfies TripleNesting;

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

  public contextDefinitionVersion(version: string, loc: SourceLocation): ContextDefinitionVersion {
    return {
      type: 'contextDef',
      subType: 'version',
      version,
      loc,
    };
  }

  public isContextDefinitionVersion(obj: object): obj is SubTyped<'contextDef', 'version'> {
    return this.isOfSubType(obj, 'contextDef', 'version');
  }
}
