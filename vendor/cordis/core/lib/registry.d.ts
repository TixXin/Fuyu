import { Dict } from 'cosmokit';
import { StandardSchemaV1 } from '@standard-schema/spec';
import { Context } from './context.ts';
import { Fiber } from './fiber.ts';
import { DisposableList, symbols } from './utils.ts';
export type Inject<M = Dict> = (keyof M)[] | {
    [K in keyof M]?: M[K];
};
export type InjectKey = keyof {
    [K in keyof Context & string as Context[K] extends {
        [symbols.metadata]: any;
    } ? K : never]: any;
};
export declare function Inject<K extends InjectKey>(name: K, config?: Context[K] extends {
    [symbols.metadata]: infer T;
} ? T : never): (value: any, decorator: ClassDecoratorContext<any> | ClassMethodDecoratorContext<any>) => void;
export declare namespace Inject {
    function resolve(inject: Inject | null | undefined, result?: Dict): Dict;
}
export type Component<T = any> = Component.Function<T> | Component.Constructor<T> | Component.Object<T>;
export declare namespace Component {
    interface Base<T = any> {
        name?: string;
        Config?: StandardSchemaV1<any, T>;
        inject?: Inject;
        provide?: string | string[];
        intercept?: Dict<boolean>;
    }
    interface Transform<S, T> {
        schema?: true;
        Config: (config: S) => T;
    }
    interface Function<T = any> extends Base<T> {
        (ctx: Context, config: T): any;
    }
    interface Constructor<T = any> extends Base<T> {
        new (ctx: Context, config: T): any;
    }
    interface Object<T = any> extends Base<T> {
        apply(ctx: Context, config: T): any;
    }
    interface Runtime {
        name?: string;
        fibers: DisposableList<Fiber>;
        callback: globalThis.Function;
        Config?: StandardSchemaV1;
    }
}
type Spread<T> = undefined extends T ? [config?: T] : [config: T];
type GetComponentParameters<P> = P extends (ctx: Context, ...args: infer R) => any ? R : P extends new (ctx: Context, ...args: infer R) => any ? R : P extends {
    apply(ctx: Context, ...args: infer R): any;
} ? R : never;
type GetComponentConfig<P> = P extends Component.Transform<infer S, any> ? S : GetComponentParameters<P>[0];
declare module './context.ts' {
    interface Context {
        inject(deps: Inject, callback: Component.Function<void>): Fiber & PromiseLike<Fiber>;
        use<P extends Component>(component: P, ...args: Spread<GetComponentConfig<P>>): Fiber & PromiseLike<Fiber>;
        /** @deprecated Use `ctx.use()` instead. */
        plugin<P extends Component>(component: P, ...args: Spread<GetComponentConfig<P>>): Fiber & PromiseLike<Fiber>;
    }
}
export declare class RegistryService {
    ctx: Context;
    private _counter;
    private _internal;
    private _aliases;
    constructor(ctx: Context);
    get counter(): number;
    get size(): number;
    resolve(component: Component): Function | undefined;
    private _forward;
    private _create;
    get(component: Component): Component.Runtime | undefined;
    has(component: Component): boolean;
    _unregister(runtime: Component.Runtime): void;
    replace(oldComponent: Component, newComponent: Component): Fiber[];
    keys(): MapIterator<Function>;
    values(): MapIterator<Component.Runtime>;
    entries(): MapIterator<[Function, Component.Runtime]>;
    forEach(callback: (value: Component.Runtime, key: Function) => void): void;
    inject(inject: Inject, callback: Component.Function<void>): Fiber & PromiseLike<Fiber>;
    /** @deprecated Use `registry.use()` instead. */
    plugin(component: Component, config?: any, getOuterStack?: () => string[]): Fiber & PromiseLike<Fiber>;
    use(component: Component, config?: any, getOuterStack?: () => string[]): Fiber & PromiseLike<Fiber>;
}
export {};
