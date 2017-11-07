import { Operation } from './algebra';

declare function translate (sparql: any, quads?: boolean) : Operation;
export = translate;