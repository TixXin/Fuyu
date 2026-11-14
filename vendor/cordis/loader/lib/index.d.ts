import { Context, Fiber, Service } from 'cordis';
import { Awaitable } from 'cosmokit';
import { Entry, EntryOptions } from './config/entry.ts';
import { EntryChange, EntryTree } from './config/tree.ts';
export * from './config/entry.ts';
export * from './config/group.ts';
export * from './config/isolate.ts';
export * from './config/tree.ts';
export * from './config/utils.ts';
declare module 'cordis' {
    interface Events {
        'exit'(signal: NodeJS.Signals): Promise<void>;
        'loader/config-update'(): void;
        'loader/entry-init'(entry: Entry): void;
        'loader/partial-dispose'(entry: Entry, legacy: Partial<EntryOptions>, active: boolean): void;
        'loader/patch-context'(entry: Entry, next: () => Awaitable<void>): Awaitable<void>;
    }
    interface Context {
        loader: Loader;
    }
    interface EnvData {
        startTime?: number;
    }
    interface Fiber {
        entry?: Entry;
    }
}
export declare namespace Loader {
    interface Config {
        baseUrl?: string;
    }
    interface Intercept {
        await?: boolean;
    }
}
export declare class Loader extends EntryTree {
    config: Loader.Config;
    [Service.metadata]: Loader.Intercept;
    envData: any;
    name: string;
    internal: import("./internal.ts").InternalLoader | undefined;
    constructor(ctx: Context, config?: Loader.Config);
    commit(_change: EntryChange): void;
    [Service.check](): boolean;
    showLog(entry: Entry, type: string): void;
    locate(fiber?: Fiber): string | undefined;
    unwrapExports(exports: any): any;
}
export default Loader;
