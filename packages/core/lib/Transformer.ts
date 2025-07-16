import type { Node } from './nodeTypings';

type MapNodeTypeToImpls<Nodes extends Node> = {[Node in Nodes as Node['type']]: Node };
type MapNodeSubTypeToImpls<Nodes extends Node & { subType: string }> = {[Node in Nodes as Node['subType']]: Node };

type AlterNodeOutput<RecursiveObject extends object, Input, Out>
  = {
    [Key in keyof RecursiveObject]: RecursiveObject[Key] extends object ?
        (AlterNodeOutput<RecursiveObject[Key], Input, Out> extends Input ?
          Out : AlterNodeOutput<RecursiveObject[Key], Input, Out>) :
      RecursiveObject[Key]
  };

export class Transformer<
  Nodes extends Node,
NodeMapping extends MapNodeTypeToImpls<Nodes> = MapNodeTypeToImpls<Nodes>,
> {
  public transformNode<Input extends object, TypeFilter extends keyof NodeMapping, Out>(
    curObject: Input,
    searchType: TypeFilter,
    patch: (current: NodeMapping[TypeFilter]) => Out,
  ): AlterNodeOutput<Input, NodeMapping[TypeFilter], Out> {
    const copy: { type?: unknown } = { ...curObject };
    for (const [ key, value ] of Object.entries(copy)) {
      (<Record<string, unknown>> copy)[key] =
        this.safeObjectTransform(value, obj => this.transformNode(obj, searchType, patch));
    }
    if (copy.type === searchType) {
      return <any> patch(<NodeMapping[TypeFilter]> copy);
    }
    return <any> copy;
  }

  public transformNodeSpecific<
    Input extends object,
TypeFilter extends keyof NodeMapping,
SpecificType extends keyof SpecificNodes,
Out,
SpecificNodes = NodeMapping[TypeFilter] extends Node & { subType: string } ?
  MapNodeSubTypeToImpls<NodeMapping[TypeFilter]> : never,
>(
    curObject: Input,
    searchType: TypeFilter,
    searchSubType: SpecificType,
    patch: (current: SpecificNodes[SpecificType]) => Out,
  ): AlterNodeOutput<Input, SpecificNodes[SpecificType], Out> {
    const copy: { type?: unknown; subType?: unknown } = { ...curObject };
    for (const [ key, value ] of Object.entries(copy)) {
      (<Record<string, unknown>> copy)[key] =
        this.safeObjectTransform(value, obj => this.transformNodeSpecific(obj, searchType, searchSubType, patch));
    }
    if (copy.type === searchType && copy.subType === searchSubType) {
      return <any> patch(<SpecificNodes[SpecificType]> copy);
    }
    return <any> copy;
  }

  public visitNode<Input extends object, TypeFilter extends keyof NodeMapping>(
    curObject: Input,
    searchType: TypeFilter,
    visitor: (current: Readonly<NodeMapping[TypeFilter]>) => void,
  ): void {
    for (const value of Object.values(curObject)) {
      this.safeObjectTransform(value, obj => this.visitNode(obj, searchType, visitor));
    }
    if ((<{ type?: unknown }>curObject).type === searchType) {
      visitor(<NodeMapping[TypeFilter]> curObject);
    }
  }

  public visitNodeSpecific<
    Input extends object,
TypeFilter extends keyof NodeMapping,
SpecificType extends keyof SpecificNodes,
SpecificNodes = NodeMapping[TypeFilter] extends Node & { subType: string } ?
  MapNodeSubTypeToImpls<NodeMapping[TypeFilter]> : never,
 >(
    curObject: Input,
    searchType: TypeFilter,
    searchSubType: SpecificType,
    visitor: (current: Readonly<SpecificNodes[SpecificType]>) => void,
  ): void {
    for (const value of Object.values(curObject)) {
      this.safeObjectTransform(value, obj => this.visitNodeSpecific(obj, searchType, searchSubType, visitor));
    }
    const cast = <{ type?: unknown; subType?: unknown }>curObject;
    if (cast.type === searchType && cast.subType === searchSubType) {
      visitor(<SpecificNodes[SpecificType]> curObject);
    }
  }

  private safeObjectTransform(value: unknown, mapper: (some: object) => any): any {
    if (value && typeof value === 'object') {
      // If you wonder why this is all so hard, this is the reason. We cannot lose the methods of our Array objects
      if (Array.isArray(value)) {
        return value.map(x => this.safeObjectTransform(x, mapper));
      }
      return mapper(value);
    }
    return value;
  }
}
