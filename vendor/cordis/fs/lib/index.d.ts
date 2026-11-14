import { Context, Service } from 'cordis';
import { Awaitable } from 'cosmokit';
import { Watcher, WatchOptions } from './watcher.ts';
export * from './error.ts';
export * from './watcher.ts';
declare module 'cordis' {
    interface Context {
        fs: Fs;
    }
}
/**
 * The file system service, which forwards each operation to the provider
 * mounted at its location.
 */
export declare class Fs extends Service {
    private _mounts;
    /** the connection that serves each watch, if any */
    private _watchers;
    constructor(ctx: Context);
    /**
     * Mount a provider at a scheme, such as `s3:`, or at a URL, such as
     * `file:///`. A location goes to the provider of the longest prefix that
     * contains it. The mount ends with the calling fiber.
     *
     * Every watch follows the routing: a change of the mounts moves it to the
     * provider its location goes to, and a watch without a provider is resumed
     * once one is mounted. Changes while a watch has no provider are not reported.
     */
    mount(prefix: string | URL, provider: FsProvider): import("cordis").Disposable<Promise<void>>;
    /** Resolve a URL reference against `ctx.baseUrl`. */
    resolve(path: string | URL): URL;
    private _match;
    private _route;
    private _connect;
    private _disconnect;
    private _reroute;
    /** Watch a file or a directory. The watch ends with the calling fiber. */
    watch(path: string | URL, options?: WatchOptions): Watcher;
}
export interface FsProvider {
    /**
     * Start serving `watcher`, and return a function that disposes it. The
     * provider reports through `watcher.emit()`, with a `ready` once the initial
     * scan is done, and reports nothing once the returned function is called.
     */
    watch?(watcher: Watcher): () => Awaitable<void>;
}
export interface BaseFs extends FsProvider {
}
/** A provider that mounts itself, at `config.mount` or at its static `mount`. */
export declare abstract class BaseFs {
    ctx: Context;
    static inject: string[];
    /** The default mount point of the subclass. */
    static mount?: string;
    constructor(ctx: Context, config?: BaseFs.Config);
}
export declare namespace BaseFs {
    interface Config {
        /** a scheme such as `s3:`, or a URL such as `file:///` */
        mount?: string;
    }
}
export default Fs;
