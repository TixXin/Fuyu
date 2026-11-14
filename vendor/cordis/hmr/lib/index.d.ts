import { Context, Fiber, Service } from 'cordis';
import z from 'schemastery';
declare module 'cordis' {
    interface Context {
        hmr: Hmr;
    }
}
type Awaitable<T> = T | Promise<T>;
declare class Hmr extends Service {
    config: Hmr.Config;
    /** The resolved `base`. `watch.files` and logged paths are relative to it. */
    baseDir: string;
    /** Node's internal ESM loader. */
    private _loader;
    /** Node's module caches. */
    private _modules;
    /**
     * The dependency tree of the main entry point. A change to any of these
     * modules can only be applied by restarting the process.
     */
    hostModules: Set<string>;
    /** The tail of the transaction queue. */
    private _queue;
    /** The running transaction, matched against the async context of a call. */
    private _current?;
    private _storage;
    constructor(ctx: Context, config: Hmr.Config);
    /**
     * Reconcile the changes collected over each debounce window. Skipped
     * changes are reported, since restarting is up to the host. The files that
     * concern an aborted unit are retried with the next batch.
     */
    private _watch;
    [Service.init](): AsyncGenerator<never, void, unknown>;
    /**
     * Run `callback` as the body of a transaction, and replace the components
     * affected by the roots that it resolves to. Transactions run one at a
     * time; one started from within the running transaction, including from
     * `callback`, is rejected. If `callback` throws, the transaction rejects
     * with its error and the module caches are left as they are.
     *
     * A root is an absolute path of a file or a directory:
     * - the loaded modules whose files are the root or lie below it are
     *   changed. Module URLs are real paths, so the caller passes the real path
     *   under which modules were loaded, such as the previous target of a link;
     * - later resolutions observe the file system below it. For a package, the
     *   caller also passes its location, such as a link or a directory where a
     *   package is added, since Node resolves package names through it.
     *
     * A component whose module is no longer where the import that loaded it now
     * resolves, e.g. after its package exports another entry or a link is
     * retargeted, is replaced from the module that the import resolves to. A
     * changed module that no component depends on is evicted too: its next import
     * gets the new code, while existing references keep the old one.
     *
     * Every transaction first removes the module jobs that failed to load, link
     * or evaluate, whether or not their files changed, so that the next import
     * of their modules tries again.
     */
    reconcile(callback: () => Awaitable<Iterable<string>>): Promise<Hmr.Result>;
    private _relative;
    /**
     * Classify the loaded modules into accepted (evicted from the module cache)
     * and declined (kept). The changed modules are accepted, and so is every
     * module that imports an accepted one. This does not depend on whether a
     * registered component uses them, so that a later import, such as by a component
     * that is enabled again, gets the new code. Host modules are declined.
     *
     * The returned `edges` are the dependencies of each loaded module before
     * the eviction, i.e. the old module graph.
     */
    private _analyze;
    /**
     * Partition the attempts into units: the connected components of the
     * relation in which two components are related if their closures, in the old
     * or the new module graph, share an evicted module.
     *
     * @param edges the dependencies of a module in the new module graph
     * @param retained the modules kept in the caches through the eviction,
     * which import no evicted module, so that the traversal stops at them
     */
    private _partition;
    /**
     * Find every loaded module that exports a registered component, through its
     * ESM namespace or the exports of its CJS module, so that a component that
     * only `require()` has loaded is found too.
     */
    private _discover;
    /**
     * Locate a module of a stale component again through the removed resolutions
     * to it, so that a module that has moved, e.g. to a new `exports` target or
     * through a retargeted link, is imported at its new URL. A resolution
     * counts if it records a request and its parent is not evicted, since an
     * evicted parent resolves its imports again by itself:
     * - without one, the module is imported at its URL;
     * - if every request now resolves to one module, it is imported through a
     *   request;
     * - otherwise, the component is skipped as `AmbiguousImport`.
     */
    private _locate;
    /**
     * The loaded modules outside `matched` that are changed because a request
     * now resolves elsewhere. For a removed ESM resolution whose request now
     * resolves to another module, or fails:
     * - if its parent links the previous result, the parent is changed, so that
     *   it resolves its imports again;
     * - otherwise the previous result was imported dynamically, such as a
     *   component entry, and is changed itself, so that it is imported again where
     *   the request now leads.
     *
     * CJS records no request. A CJS module below `<dir>` is changed if a root is
     * `<dir>/node_modules/<name>` and a child of the module belongs to a package
     * `<name>` in a `node_modules` above `<dir>`, which the new package may
     * shadow; a module that requested the child otherwise is reloaded needlessly.
     */
    private _moved;
    /**
     * The loaded modules whose files are one of `roots` or lie below one of
     * them. A root that matches no loaded module is logged.
     */
    private _match;
    private _reconcile;
}
declare namespace Hmr {
    interface WatchConfig {
        enabled: boolean;
        files: string[];
        debounce: number;
    }
    interface Config {
        base?: string;
        watch: WatchConfig;
    }
    const Config: z<Config>;
    /**
     * The running state is brought in line with the changes, as far as they can
     * be applied. Each change is applied, aborted or skipped.
     */
    interface Result {
        /** the replaced fibers; a fiber whose new component fails to apply is left `FAILED` */
        settled: Fiber[];
        /** the units whose new modules fail to import; a later transaction retries them */
        aborted: Abort[];
        /** the changes that cannot be applied in place; a restart applies them */
        skipped: Skip[];
    }
    /**
     * A new module of a unit failed to import, or does not export a component.
     * Nothing in the unit is applied: its module cache is restored, and so are
     * the resolutions to its modules. A later transaction retries the unit if
     * its roots include those that changed the unit, e.g. a manifest that moved
     * an entry, since the restored resolutions lead to the previous modules.
     * The other units of the transaction are not affected.
     */
    interface Abort {
        /** the evicted modules of the unit, whose cache entries are restored */
        urls: string[];
        /** the first error raised while importing the unit */
        error: unknown;
    }
    /**
     * A change that cannot be applied in place. The other changes are applied.
     * The modules of a skipped unit are restored, as those of an aborted one.
     */
    interface Skip {
        /** the changed module, or the evicted modules of the unit */
        urls: string[];
        reason: SkipReason;
    }
    /** Why a change cannot be applied in place. */
    const enum SkipReason {
        /** The module is reached statically from the main entry point, which runs once. */
        HostModule = "host-module",
        /** The module is a native addon, which a process cannot load again. */
        NativeAddon = "native-addon",
        /**
         * The imports that resolved to a component module now resolve to different
         * modules, e.g. after only one of two links to a package is retargeted.
         * A fiber does not record which import it comes from.
         */
        AmbiguousImport = "ambiguous-import",
        /**
         * The modules that exported one component now export different values. A
         * fiber does not record which module it comes from.
         */
        AmbiguousExport = "ambiguous-export"
    }
}
export default Hmr;
