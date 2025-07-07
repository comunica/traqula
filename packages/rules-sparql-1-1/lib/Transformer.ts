import type { Node } from '@traqula/core';

type Apple = 'apple' | 'pear';

type Apples = {[Key in Apple as Uppercase<Key>]: Key };

type NodeTransformer<Nodes extends Node> = {[Node in Nodes as Node['type']]: Node };

type AlterNodeOutput<Nodes extends Node, Input extends object, SearchType, Out>
  = {
    [Key in keyof Input]: Input[Key] extends object ?
        (AlterNodeOutput<Nodes, Input[Key], SearchType, Out> extends { type: any } ?
            (AlterNodeOutput<Nodes, Input[Key], SearchType, Out>['type'] extends SearchType ?
              Out : AlterNodeOutput<Nodes, Input[Key], SearchType, Out>) :
          AlterNodeOutput<Nodes, Input[Key], SearchType, Out>) : Input[Key]
  };

export class Transformer<Nodes extends Node, NodeMapping = NodeTransformer<Nodes>> {
  public alterNode<Input extends object, TypeFilter extends keyof NodeMapping, Out>(
    curObject: Input,
    searchType: TypeFilter,
    patch: (current: NodeMapping[TypeFilter]) => Out,
  ): AlterNodeOutput<Nodes, Input, typeof searchType, Out> {
    for (const [ key, value ] of Object.entries(curObject)) {
      if (value && typeof value === 'object') {
        (<Record<string, unknown>> curObject)[key] = this.alterNode(value, searchType, patch);
      }
    }
    if ((<{ type?: unknown }> curObject).type === searchType) {
      return <any> patch(<NodeMapping[typeof searchType]> curObject);
    }
    return <any> curObject;
  }
}
