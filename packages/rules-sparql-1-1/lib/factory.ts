import { BlankSpaceFactory } from './BlankSpaceFactory';
import type {
  BlankTermAnon,
  BlankTermImplicit,
  BlankTermLabeled,
  IriTermFull,
  IriTerm,
  LiteralTerm,
  LiteralTermLangStr,
  LiteralTermPrimitive,
  LiteralTermStr,
  LiteralTermTyped,
  PrefixDecl,
  IriTermPrefixed,
  VariableTerm,
  BaseDecl,
  IriTermPrimitive,
  NegatedElt,
  PropertyPath,
  PropertyPathModified,
  PropertyPathChain,
  PropertyPathAlternativeLimited,
  PropertyPathNegated,
  ContextDefinition,
  Term,
} from './RoundTripTypes';
import type { ITOS } from './TypeHelpersRTT';
import type * as r from './TypeHelpersRTT';

export class TraqulaFactory extends BlankSpaceFactory {
  private blankNodeCounter = 0;
  public constructor() {
    super();
  }

  public prefix(i0: ITOS, img1: string, i1: ITOS, i2: ITOS, key: string, value: IriTermFull): PrefixDecl {
    return this.rttImage(this.rttIgnore({
      type: 'contextDef',
      contextType: 'prefix',
      key,
      value,
    }, i0, i1, i2), img1);
  }

  public baseDecl(i0: ITOS, img1: string, value: IriTermFull): BaseDecl {
    return this.rttImage(this.rttIgnore({
      type: 'contextDef',
      contextType: 'base',
      value,
    }, i0), img1);
  }

  public isBaseDecl(x: ContextDefinition): x is BaseDecl {
    return x.contextType === 'base';
  }

  public variable(i0: ITOS, img1: string, value: string): VariableTerm {
    return this.rttImage(this.rttIgnore({
      type: 'term',
      termType: 'Variable',
      value,
    }, i0), img1);
  }

  public isTerm(x: object): x is Term {
    return 'type' in x && x.type === 'term';
  }

  public isIriTerm(x: Term): x is IriTerm {
    return x.termType === 'NamedNode';
  }

  public isPrimitiveIriTerm(x: IriTerm): x is IriTermPrimitive {
    return 'img1' in x.RTT;
  }

  public isPrefixedIriTerm(x: IriTerm): x is IriTermPrefixed {
    return 'prefix' in x;
  }

  public isBrackettedRTT(x: { RTT: object }): x is { RTT: { preBracket: [r.ITOS, r.ITOS][] }} {
    return 'preBracket' in x.RTT;
  }

  /**
   * If PreBracketed exists, this function will append the current values to it.
   */
  public bracketted<T extends object & { RTT?: { preBracket?: [ITOS, ITOS][] }}>(x: T, i0: ITOS, i1: ITOS):
    T & { RTT: { preBracket: [ITOS, ITOS][] }} {
    if (x.RTT !== undefined && x.RTT.preBracket !== undefined) {
      x.RTT.preBracket.push([ i0, i1 ]);
      return <T & { RTT: { preBracket: [ITOS, ITOS][] }}> x;
    }
    return {
      ...x,
      RTT: {
        ...x.RTT,
        preBracket: [[ i0, i1 ]],
      },
    };
  }

  public path(pathType: '!', items: IriTerm | NegatedElt | PropertyPathAlternativeLimited, ignored: ITOS):
  PropertyPathNegated;
  public path(pathType: '!', items: IriTerm | NegatedElt | PropertyPathAlternativeLimited, ignored: [ITOS, ITOS, ITOS]):
  PropertyPathNegated;
  public path(pathType: '^', items: IriTerm, i0: ITOS): NegatedElt;
  public path(pathType: '?' | '*' | '+' | '^', item: PropertyPath, i0: ITOS): PropertyPathModified;
  public path(pathType: '|', items: [IriTerm | NegatedElt, ...(IriTerm | NegatedElt)[]], ignored: [ITOS, ...ITOS[]]):
  PropertyPathAlternativeLimited;
  public path(pathType: '|' | '/', items: [PropertyPath, ...PropertyPath[]], ignored: [ITOS, ...ITOS[]]):
  PropertyPathChain;
  public path(
    pathType: '?' | '*' | '+' | '^' | '|' | '/' | '!',
    items: PropertyPath | PropertyPath[],
    ignored: ITOS | ITOS[],
  ): PropertyPath {
    if (pathType === '!') {
      let RTT: PropertyPathNegated['RTT'];
      if (Array.isArray(ignored[0])) {
        const [ i0, i1, i2 ] = <[ITOS, ITOS, ITOS]> ignored;
        RTT = this.ignores({}, i0, i1, i2);
      } else {
        RTT = this.ignores({}, <ITOS> ignored);
      }
      return {
        type: 'path',
        pathType,
        items: <[IriTerm | NegatedElt | PropertyPathAlternativeLimited]> [ items ],
        RTT,
      };
    }
    if (pathType === '|' || pathType === '/') {
      return {
        type: 'path',
        pathType,
        items: <[PropertyPath, ...PropertyPath[]]> items,
        RTT: {
          preSepIgnores: <[ITOS, ...ITOS[]]> ignored,
        },
      };
    }
    return {
      type: 'path',
      pathType,
      items: <[PropertyPath]> items,
      RTT: {
        i0: <ITOS> ignored,
      },
    };
  }

  public namedNode(i0: ITOS, value: string): IriTermFull;
  public namedNode(i0: ITOS, value: string, prefix: string): IriTermPrefixed;
  public namedNode(i0: ITOS, value: string, prefix?: string): IriTermFull | IriTermPrefixed {
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
