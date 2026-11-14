import { ModuleLoader } from './internal.ts';
/** The resolution caches that {@link invalidateResolution} can clear in this thread. */
export interface ResolutionSupport {
    /** Whether the realpath caches of ESM and CJS are cleared; for ESM, on Node 24.16+ and 26.1+. */
    realpath: boolean;
}
export declare function getResolutionSupport(): ResolutionSupport;
/** A resolution of the ESM resolve cache: a request from `parentURL` and the URL it resolved to. */
export interface Resolution {
    /** as the default resolution received it, after synchronous hooks */
    specifier: string;
    attributes: Record<string, string>;
    parentURL: string;
    url: string;
    /** the serialized request, as the key of the entry */
    key: string;
    /** the cached result, as the value of the entry */
    result: unknown;
}
/**
 * Make later resolutions observe the file system below `paths`, which may be
 * spelled through links:
 *
 * - the entries of the ESM resolve cache that a change below `paths` can
 *   affect are removed: those whose result or parent lies below one of
 *   `paths`, and those that resolve a package name from below a directory
 *   that one of `paths` adds it to as `node_modules/<name>`. A manifest stands
 *   for its directory;
 * - the CJS path cache and the realpath caches are cleared as a whole;
 * - a manifest at or below one of `paths`, as spelled or at the real path of
 *   its directory, is read from disk from now on, through the replacements of
 *   `activate()`, which must be in place.
 *
 * The entries kept in the resolve cache record the requests that resolved to
 * each module; the removed ones are returned, so that a module can be
 * imported again through the requests that resolved to it, and so that they
 * can be put back through {@link restoreResolutions}.
 */
export declare function invalidateResolution(paths: Iterable<string>): Resolution[];
/**
 * Put resolutions that {@link invalidateResolution} has removed back into the
 * resolve cache, as `ResolveCache` of `internal/modules/esm/module_map` sets
 * them, replacing the entries that their requests have got since.
 */
export declare function restoreResolutions(resolutions: Iterable<Resolution>): void;
/**
 * The package that `path` is the location of, if it is `<dir>/node_modules/<name>`
 * or its manifest, and the directory below which a package name resolves to it.
 */
export declare function locatePackage(path: string): {
    name: string;
    dir: string;
} | undefined;
/** Resolve a recorded request again, with the synchronous hooks. */
export declare function resolveRequest(loader: ModuleLoader, { specifier, attributes, parentURL }: Pick<Resolution, 'specifier' | 'attributes' | 'parentURL'>): string;
