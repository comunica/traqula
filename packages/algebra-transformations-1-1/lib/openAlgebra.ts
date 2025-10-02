import type * as Algebra from './algebra.js';

export { BaseUpdate, BaseOperation, BaseExpression, BasePropertyPathSymbol } from './algebra.js';

export function asKnown<T extends object>(arg: T): CloseSingle<T> {
  return <any> arg;
}

export function asOpen<T extends object>(arg: T): OpenSingle<T> {
  return <any> arg;
}

export type OpenSingle<T> = T extends any[] ? OpenSingle<T[number]>[] :
  T extends Algebra.Expression ? Algebra.BaseExpression :
    T extends Algebra.Update ? Algebra.BaseUpdate :
      T extends Algebra.PropertyPathSymbol ? Algebra.BasePropertyPathSymbol :
        T extends Algebra.Operation ? Algebra.BaseOperation : T;

export type CloseSingle<T> = T extends any[] ? CloseSingle<T[number]>[] :
  T extends Algebra.BaseExpression ? Algebra.Expression :
    T extends Algebra.BaseUpdate ? Algebra.Update :
      T extends Algebra.BasePropertyPathSymbol ? Algebra.PropertyPathSymbol :
        T extends Algebra.BaseOperation ? Algebra.OperatorExpression : T;

export type Opened<T extends object> = {[K in keyof T]: OpenSingle<T[K]> };
export type Closed<T extends object > = {[K in keyof T]: CloseSingle<T[K]> };

export type Operation = Algebra.BaseOperation;
export type Expression = Algebra.BaseExpression;
export type Update = Algebra.BaseUpdate;
export type PropertyPathSymbol = Algebra.BasePropertyPathSymbol;
export type Single = Opened<Algebra.Single>;
export type Multi = Opened<Algebra.Multi>;
export type Double = Opened<Algebra.Double>;
export type AggregateExpression = Opened<Algebra.AggregateExpression>;
export type GroupConcatExpression = Opened<Algebra.GroupConcatExpression>;
export type ExistenceExpression = Opened<Algebra.ExistenceExpression>;
export type NamedExpression = Opened<Algebra.NamedExpression>;
export type OperatorExpression = Opened<Algebra.OperatorExpression>;
export type TermExpression = Opened<Algebra.TermExpression>;
export type WildcardExpression = Opened<Algebra.WildcardExpression>;
export type Alt = Opened<Algebra.Alt>;
export type Ask = Opened<Algebra.Ask>;
export type Bgp = Opened<Algebra.Bgp>;
export type Construct = Opened<Algebra.Construct>;
export type Describe = Opened<Algebra.Describe>;
export type Distinct = Opened<Algebra.Distinct>;
export type Extend = Opened<Algebra.Extend>;
export type From = Opened<Algebra.From>;
export type Filter = Opened<Algebra.Filter>;
export type Graph = Opened<Algebra.Graph>;
export type BoundAggregate = Opened<Algebra.BoundAggregate>;
export type Group = Opened<Algebra.Group>;
export type Inv = Opened<Algebra.Inv>;
export type Join = Opened<Algebra.Join>;
export type LeftJoin = Opened<Algebra.LeftJoin>;
export type Link = Opened<Algebra.Link>;
export type Minus = Opened<Algebra.Minus>;
export type Nop = Opened<Algebra.Nop>;
export type Nps = Opened<Algebra.Nps>;
export type OneOrMorePath = Opened<Algebra.OneOrMorePath>;
export type OrderBy = Opened<Algebra.OrderBy>;
export type Path = Opened<Algebra.Path>;
export type Pattern = Opened<Algebra.Pattern>;
export type Project = Opened<Algebra.Project>;
export type Reduced = Opened<Algebra.Reduced>;
export type Seq = Opened<Algebra.Seq>;
export type Service = Opened<Algebra.Service>;
export type Slice = Opened<Algebra.Slice>;
export type Union = Opened<Algebra.Union>;
export type Values = Opened<Algebra.Values>;
export type ZeroOrMorePath = Opened<Algebra.ZeroOrMorePath>;
export type ZeroOrOnePath = Opened<Algebra.ZeroOrOnePath>;
export type CompositeUpdate = Opened<Algebra.CompositeUpdate>;
export type DeleteInsert = Opened<Algebra.DeleteInsert>;
export type UpdateGraph = Opened<Algebra.UpdateGraph>;
export type Load = Opened<Algebra.Load>;
export type Clear = Opened<Algebra.Clear>;
export type Create = Opened<Algebra.Create>;
export type Drop = Opened<Algebra.Drop>;
export type UpdateGraphShortcut = Opened<Algebra.UpdateGraphShortcut>;
export type Add = Opened<Algebra.Add>;
export type Move = Opened<Algebra.Move>;
export type Copy = Opened<Algebra.Copy>;
