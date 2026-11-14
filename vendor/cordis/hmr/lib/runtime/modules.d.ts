import { ModuleLoader } from './internal.ts';
/**
 * The modules that Node has loaded, in its ESM load cache and its CJS module
 * cache. A module is identified by its URL. A CJS module imported through
 * `import()` is in both caches under the URL of its file.
 *
 * The load cache, Node's `LoadCache`, is accessed through `Map.prototype`:
 * - an entry is `{ [type]: ModuleJob }`, one job per value of the `type`
 *   import attribute;
 * - its own `delete(url)` only clears the `javascript` slot and keeps the entry;
 * - it extends Node's internal `SafeMap`, which has the internal slots of
 *   `Map`, although `loadCache instanceof Map` is false.
 */
export declare class ModuleCaches {
    private _loader;
    private _cjs;
    constructor(_loader: ModuleLoader);
    /** Whether a module is loaded under `url` in either cache. */
    has(url: string): boolean;
    /** The URLs of the loaded modules, in either cache. */
    urls(): Set<string>;
    /**
     * The namespace of the module job of `url` imported without the `type`
     * attribute, or `undefined` if there is no such job, it has not been
     * instantiated, or its evaluation failed.
     */
    namespace(url: string): unknown;
    /**
     * The exports of the CJS module of `url`, or `undefined` if there is no
     * such module or it has not finished loading.
     */
    exports(url: string): unknown;
    /**
     * The direct dependencies of a module: the modules linked by its module
     * jobs in every type slot, and the children of its CJS module. A job that
     * failed to link contributes no dependencies.
     */
    edges(url: string): Promise<Set<string>>;
    /** The URLs of the children of the CJS module of `url`. */
    children(url: string): string[];
    /**
     * Remove the module jobs that failed to load, link or evaluate, each from
     * its own type slot, so that the next import of their modules tries again.
     * Node keeps such a job in the load cache, and every later import of the
     * module throws its error again. A job in progress has not failed and is
     * kept. The CJS module cache is left alone: Node removes a CJS module whose
     * evaluation failed.
     *
     * A job has failed if its module is errored, or if its `modulePromise`,
     * `linked` or `instantiated` promise has been rejected. A promise that has
     * settled runs its handlers before the next macrotask.
     */
    sweep(): Promise<void>;
    /**
     * Remove modules from both caches, so that their next import evaluates
     * their files again. Existing references keep the old instances.
     * @returns a backup of the removed entries
     */
    evict(urls: Iterable<string>): ModuleBackup;
    private _delete;
}
/** The entries removed by {@link ModuleCaches.evict}. */
export interface ModuleBackup {
    /**
     * Put the removed entries of `urls` back in place of the current ones. A
     * module that was not loaded when it was evicted is removed again.
     */
    restore(urls: Iterable<string>): void;
}
