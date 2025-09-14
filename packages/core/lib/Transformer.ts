import type { Node } from './nodeTypings';

type Safeness = 'safe' | 'unsafe';
type SafeWrap<Safe extends Safeness, obj extends object> = Safe extends 'safe' ? {[key in keyof obj]: unknown } : obj;

export class Transformer<Nodes extends Pick<Node, 'type' | 'subType'>> {
  public transformNode<Safe extends 'safe' | 'unsafe' = 'safe'>(
    curObject: object,
    nodeCallBacks: {[T in Nodes['type']]?: {
      transform?: (op: SafeWrap<Safe, Extract<Nodes, { type: T }>>) => any;
      continue?: (op: Extract<Nodes, { type: T }>) => boolean;
    }},
  ): any {
    let continueCheck: ((node: any) => boolean) | undefined;
    let transformation: ((node: any) => unknown) | undefined;
    const casted = <{ type?: Nodes['type'] }>curObject;
    if (casted.type) {
      continueCheck = nodeCallBacks[casted.type]?.continue;
      transformation = nodeCallBacks[casted.type]?.transform;
    }
    let shouldContinue = true;
    if (continueCheck) {
      shouldContinue = continueCheck(curObject);
    }
    if (!shouldContinue) {
      return curObject;
    }
    const copy: { type?: unknown } = { ...curObject };
    for (const [ key, value ] of Object.entries(copy)) {
      (<Record<string, unknown>> copy)[key] =
        this.safeObjectVisit(value, obj => this.transformNode(obj, nodeCallBacks));
    }
    if (transformation) {
      return transformation(copy);
    }
    return copy;
  }

  // Public visitObjects(curObject: object, visitor: (current: object) => void): void {
  //   for (const value of Object.values(curObject)) {
  //     this.safeObjectVisit(value, obj => this.visitObjects(obj, visitor));
  //   }
  // }

  public transformNodeSpecific<Safe extends 'safe' | 'unsafe' = 'safe'>(
    curObject: object,
    nodeCallBacks: {[T in Nodes['type']]?: {
      transform?: (op: SafeWrap<Safe, Extract<Nodes, { type: T }>>) => any;
      continue?: (op: Extract<Nodes, { type: T }>) => boolean;
    }},
    nodeSpecificCallBacks: {[Type in Nodes['type']]?: {
      [SubType in Extract<Nodes, { type: Type; subType: string }>['subType']]?: {
        transform?: (op: SafeWrap<Safe, Extract<Nodes, { type: Type; subType: SubType }>>) => any;
        continue?: (op: Extract<Nodes, { type: Type; subType: SubType }>) => boolean;
      }}} = {},
  ): any {
    let continueCheck: ((node: any) => boolean) | undefined;
    let transformation: ((node: any) => unknown) | undefined;
    const casted = <{ type?: Nodes['type']; subType?: string }>curObject;
    if (casted.type && casted.subType) {
      const specific = nodeSpecificCallBacks[casted.type];
      if (specific) {
        continueCheck = specific[<keyof typeof specific> casted.subType]?.continue;
        transformation = specific[<keyof typeof specific> casted.subType]?.transform;
      }
    }
    let shouldContinue = true;
    if (continueCheck) {
      shouldContinue = continueCheck(curObject);
    }
    if (!shouldContinue) {
      return curObject;
    }
    const copy: { type?: unknown } = { ...curObject };
    for (const [ key, value ] of Object.entries(copy)) {
      (<Record<string, unknown>> copy)[key] =
        this.safeObjectVisit(value, obj => this.transformNodeSpecific(obj, nodeCallBacks, nodeSpecificCallBacks));
    }
    if (transformation) {
      return transformation(copy);
    }
    return copy;
  }

  public visitNode(
    curObject: object,
    nodeCallBacks: {[T in Nodes['type']]?: (op: Extract<Nodes, { type: T }>) => boolean },
  ): void {
    let callback: ((node: any) => boolean) | undefined;
    const casted = <{ type?: Nodes['type'] }>curObject;
    if (casted.type) {
      callback = nodeCallBacks[casted.type];
    }
    let shouldIterate = true;
    if (callback) {
      shouldIterate = callback(curObject);
    }
    if (shouldIterate) {
      for (const value of Object.values(curObject)) {
        this.safeObjectVisit(value, obj => this.visitNode(obj, nodeCallBacks));
      }
    }
  }

  /**
   * When both nodeCallBack and NodeSpecific callBack are matched, will only look at nodeSpecifCallback
   */
  public visitNodeSpecific(
    curObject: object,
    nodeCallBacks: {[T in Nodes['type']]?: (op: Extract<Nodes, { type: T }>) => boolean | void },
    nodeSpecificCallBacks: {[Type in Nodes['type']]?:
      {[Subtype in Extract<Nodes, { type: Type; subType: string }>['subType']]?:
        (op: Extract<Nodes, { type: Type; subType: Subtype }>) => boolean | void }} = {},
  ): void {
    let callback: ((node: any) => boolean | void) | undefined;
    const casted = <{ type?: Nodes['type']; subType?: string }> curObject;
    if (casted.type && casted.subType) {
      const specific = nodeSpecificCallBacks[casted.type];
      if (specific) {
        callback = specific[<keyof typeof specific>casted.subType];
      }
    }
    if (!callback && casted.type) {
      callback = nodeCallBacks[(<{ type: Nodes['type'] }> curObject).type];
    }
    let shouldIterate = true;
    if (callback) {
      shouldIterate = callback(curObject) ?? true;
    }
    if (shouldIterate) {
      for (const value of Object.values(curObject)) {
        this.safeObjectVisit(value, obj => this.visitNodeSpecific(obj, nodeCallBacks, nodeSpecificCallBacks));
      }
    }
  }

  private safeObjectVisit(value: unknown, mapper: (some: object) => any): unknown {
    if (value && typeof value === 'object') {
      // If you wonder why this is all so hard, this is the reason. We cannot lose the methods of our Array objects
      if (Array.isArray(value)) {
        return value.map(x => this.safeObjectVisit(x, mapper));
      }
      return mapper(value);
    }
    return value;
  }
}
