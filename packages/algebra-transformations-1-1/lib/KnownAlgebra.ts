import type { Patch } from '@traqula/core';
import type * as Algebra from './algebra.js';

export type KnownOperation = Ask | KnownExpression | Bgp | Construct | Describe | Distinct | Extend | From | Filter
  | Graph | Group | Join | LeftJoin | Minus | Nop | OrderBy | Path | Pattern | Project | KnownPropertyPathSymbol
  | Reduced | Service | Slice | Union | Values | KnownUpdate;

export type KnownExpression = AggregateExpression | GroupConcatExpression | ExistenceExpression | NamedExpression |
  OperatorExpression | TermExpression | WildcardExpression | BoundAggregate;

export type KnownPropertyPathSymbol = Alt | Inv | Link | Nps | OneOrMorePath | Seq | ZeroOrMorePath | ZeroOrOnePath;

export type KnownUpdate = CompositeUpdate | DeleteInsert | Load | Clear | Create | Drop | Add | Move | Copy | Nop;

// Returns the correct type based on the type enum
export type KnownTypedOperation<T extends Algebra.KnownTypes>
  = Extract<KnownOperation, { type: T }>;
export type KnownTypedExpression<T extends Algebra.KnownExpressionTypes>
  = Extract<KnownExpression, { expressionType: T }>;

export type Single = Patch<Algebra.Single, { input: KnownOperation }>;
export type Multi = Patch<Algebra.Multi, { input: KnownOperation[] }>;
export type Double = Patch<Algebra.Double, { input: [KnownOperation, KnownOperation]}>;

export type AggregateExpression = Patch<Algebra.AggregateExpression, { expression: KnownOperation }>;
export type GroupConcatExpression = Patch<Algebra.AggregateExpression, { expression: KnownExpression }>;
export type ExistenceExpression = Patch<Algebra.ExistenceExpression, { input: KnownOperation }>;
export type NamedExpression = Patch<Algebra.NamedExpression, { args: KnownExpression[] }>;
export type OperatorExpression = Patch<Algebra.OperatorExpression, { args: KnownExpression[] }>;
export type TermExpression = Algebra.TermExpression;
export type WildcardExpression = Algebra.WildcardExpression;

export type Alt = Patch<Algebra.Alt, { input: KnownPropertyPathSymbol[] }>;
export type Ask = Patch<Algebra.Ask, Single>;
export type Bgp = Algebra.Bgp;
export type Construct = Algebra.Construct;
export type Describe = Algebra.Describe;
export type Distinct = Algebra.Distinct;
export type Extend = Patch<Algebra.Extend, Single & { expression: KnownExpression }>;
export type From = Patch<Algebra.From, Single>;
export type Filter = Patch<Algebra.Filter, Single & { expression: KnownExpression }>;
export type Graph = Patch<Algebra.Graph, Single>;
export type BoundAggregate = Patch<Algebra.BoundAggregate, AggregateExpression>;
export type Group = Patch<Algebra.Group, Single & { aggregates: BoundAggregate[] }>;

export type Inv = Patch<Algebra.Inv, { path: KnownPropertyPathSymbol }>;
export type Join = Patch<Algebra.Join, Multi>;
export type LeftJoin = Patch<Algebra.LeftJoin, Double & { expression?: KnownExpression }>;
export type Link = Algebra.Link;
export type Minus = Patch<Algebra.Minus, Double>;
export type Nop = Algebra.Nop;
export type Nps = Algebra.Nps;
export type OneOrMorePath = Patch<Algebra.OneOrMorePath, { path: KnownPropertyPathSymbol }>;
export type OrderBy = Patch<Algebra.OrderBy, { expressions: KnownExpression[] }>;
export type Path = Patch<Algebra.Path, { predicate: KnownPropertyPathSymbol }>;
export type Pattern = Algebra.Pattern;
export type Project = Patch<Algebra.Project, Single>;
export type Reduced = Patch<Algebra.Reduced, Single>;
export type Seq = Patch<Algebra.Seq, { input: KnownPropertyPathSymbol[] }>;
export type Service = Patch<Algebra.Service, Single>;
export type Slice = Patch<Algebra.Slice, Single>;
export type Union = Patch<Algebra.Union, Multi>;
export type Values = Algebra.Values;
export type ZeroOrMorePath = Patch<Algebra.ZeroOrMorePath, { path: KnownPropertyPathSymbol }>;
export type ZeroOrOnePath = Patch<Algebra.ZeroOrOnePath, { path: KnownPropertyPathSymbol }>;

export type CompositeUpdate = Patch<Algebra.CompositeUpdate, { updates: KnownUpdate[] }>;
export type DeleteInsert = Patch<Algebra.DeleteInsert, { where?: KnownOperation }>;
export type UpdateGraph = Algebra.UpdateGraph;
export type Load = Algebra.Load;
export type Clear = Algebra.Clear;
export type Create = Algebra.Create;
export type Drop = Algebra.Drop;
export type UpdateGraphShortcut = Algebra.UpdateGraphShortcut;
export type Add = Algebra.Add;
export type Move = Algebra.Move;
export type Copy = Algebra.Copy;
