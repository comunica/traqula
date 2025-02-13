import { BlankSpaceFactory } from './BlankSpaceFactory';
import type {
  BlankTermAnon,
  BlankTermImplicit,
  BlankTermLabeled,
  FullIriTerm,
  IriTerm,
  LiteralTerm,
  LiteralTermLangStr,
  LiteralTermPrimitive,
  LiteralTermStr,
  LiteralTermTyped,
  PrefixedIriTerm,
  VariableTerm,
} from './RoundTripTypes';
import type { ITOS } from './TypeHelpersRTT';

export class TraqulaFactory extends BlankSpaceFactory {
  private blankNodeCounter = 0;
  public constructor() {
    super();
  }

  public variable(value: string): VariableTerm {
    return {
      type: 'term',
      termType: 'Variable',
      value,
    };
  }

  public isPrefixedIriTerm(x: IriTerm): x is PrefixedIriTerm {
    return 'prefix' in x;
  }

  public namedNode(i0: ITOS, value: string): FullIriTerm;
  public namedNode(i0: ITOS, value: string, prefix: string): PrefixedIriTerm;
  public namedNode(i0: ITOS, value: string, prefix?: string): FullIriTerm | PrefixedIriTerm {
    if (prefix === undefined) {
      return this.rttIgnore({
        type: 'term',
        termType: 'NamedNode',
        value,
      }, i0);
    }
    return this.rttIgnore({
      type: 'term',
      termType: 'NamedNode',
      value,
      prefix,
    }, i0);
  }

  public blankNode(i0: ITOS, label: string): BlankTermLabeled;
  public blankNode(i0: ITOS, label: undefined, image: string): BlankTermAnon;
  public blankNode(i0: ITOS, label: string | undefined, image?: string): BlankTermAnon | BlankTermLabeled {
    return label === undefined ?
      this.rttIgnore(this.rttImage({
        type: 'term',
        termType: 'BlankNode',
        label: undefined,
      }, image!), i0) :
      this.rttIgnore({
        type: 'term',
        termType: 'BlankNode',
        label,
      }, i0);
  }

  public blankNodeImplicit(count?: number): BlankTermImplicit {
    return {
      type: 'term',
      termType: 'BlankNode',
      count: count ?? this.blankNodeCounter++,
    };
  }

  public literalTerm(i0: ITOS, img: string, value: string): LiteralTermStr;
  public literalTerm(i0: ITOS, img: string, value: string, iri: IriTerm): LiteralTermPrimitive;
  public literalTerm(i0: ITOS, img: string, i1: ITOS, value: string, lang: string): LiteralTermLangStr;
  public literalTerm(i0: ITOS, img: string, i1: ITOS, value: string, iri: IriTerm): LiteralTermTyped;
  public literalTerm(
    i0: ITOS,
    img: string,
    i1OrValue: string | ITOS,
    valueOrIri?: string | IriTerm,
    langOrIri?: string | IriTerm,
  ): LiteralTerm {
    if (typeof i1OrValue === 'string') {
      if (valueOrIri === undefined) {
        return this.rttImage(this.rttIgnore({
          type: 'term',
          termType: 'Literal',
          value: i1OrValue,
          langOrIri: valueOrIri,
        }, i0), img);
      }
      if (typeof valueOrIri === 'object') {
        return this.rttImage(this.rttIgnore({
          type: 'term',
          termType: 'Literal',
          value: i1OrValue,
          langOrIri: valueOrIri,
        }, i0), img);
      }
    } else if (typeof valueOrIri === 'string' && langOrIri !== undefined) {
      return this.rttImage(this.rttIgnore({
        type: 'term',
        termType: 'Literal',
        value: valueOrIri,
        langOrIri,
      }, i0, i1OrValue), img);
    }
    throw new Error('Invalid arguments');
  }
}
