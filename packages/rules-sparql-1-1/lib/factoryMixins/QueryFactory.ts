import type { CoreFactory, SourceLocation, Typed, SubTyped } from '@traqula/core';
import type {
  QuerySelect,
} from '../RoundTripTypes';
import type { Constructor } from './mixins';

type NodeType = 'query';
const nodeType: NodeType = 'query';

// eslint-disable-next-line ts/explicit-function-return-type
export function QueryFactoryMixin<TBase extends Constructor<CoreFactory>>(Base: TBase) {
  return class QueryFactory extends Base {
    public isQuery(obj: object): obj is Typed<NodeType> {
      return this.isOfType(obj, nodeType);
    }

    public isQuerySelect(obj: object): obj is SubTyped<NodeType, 'select'> {
      return this.isOfSubType(obj, nodeType, 'select');
    }

    public isQueryConstruct(obj: object): obj is SubTyped<NodeType, 'construct'> {
      return this.isOfSubType(obj, nodeType, 'construct');
    }

    public isQueryDescribe(obj: object): obj is SubTyped<NodeType, 'describe'> {
      return this.isOfSubType(obj, nodeType, 'describe');
    }

    public isQueryAsk(obj: object): obj is SubTyped<NodeType, 'ask'> {
      return this.isOfSubType(obj, nodeType, 'ask');
    }

    public querySelect(arg: Omit<QuerySelect, 'type' | 'subType' | 'loc'>, loc: SourceLocation): QuerySelect {
      return {
        type: nodeType,
        subType: 'select',
        ...arg,
        loc,
      };
    }
  };
}
