import { Context } from 'cordis';
import { Awaitable } from 'cosmokit';
export type WatchFilter = string[] | ((path: string, isDirectory: boolean) => boolean);
export interface WatchOptions {
    /**
     * Decides which entries below a watched directory are kept.
     */
    filter?: WatchFilter;
}
export interface WatchEvents {
    /** A file at or below the watched location is modified. */
    change(url: URL): Awaitable<void>;
    /** The initial scan is done. A listener added afterwards is called at once. */
    ready(): Awaitable<void>;
    /** An error is logged as a warning without a listener. */
    error(error: unknown): Awaitable<void>;
}
/**
 * A watch on a location, which ends with the calling fiber. The provider that
 * the location is routed to reports its events, and another provider takes
 * over when the routing changes.
 */
export declare class Watcher {
    private ctx;
    url: URL;
    options: WatchOptions;
    private _hooks;
    private _ready;
    private _closed;
    /** Ends the watch. */
    dispose: () => Promise<void>;
    /** `connect` starts serving the watch, and returns a function that disposes it. */
    constructor(ctx: Context, url: URL, options: WatchOptions, connect: (watcher: Watcher) => () => Promise<void>);
    /** Adds a listener, and returns a function that removes it. */
    on<K extends keyof WatchEvents>(name: K, listener: WatchEvents[K]): () => void;
    /**
     * Reports an event, as the provider that serves the watch does. Only the
     * first `ready` is dispatched, so a provider that takes over the watch does
     * not report it again.
     */
    emit<K extends keyof WatchEvents>(name: K, ...args: Parameters<WatchEvents[K]>): void;
    private _dispatch;
    private _call;
    private _error;
}
