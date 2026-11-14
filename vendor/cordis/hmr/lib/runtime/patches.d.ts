/** A manifest as serialized by Node's `modules` binding: name, main, type, imports, exports, path. */
type Manifest = [string | undefined, string | undefined, string, string | undefined, string | undefined, string];
export interface ManifestState {
    /** the invalidated paths, kept for the lifetime of the thread */
    paths: Set<string>;
    /** manifests read from disk since the last invalidation, `null` if absent */
    cache: Map<string, Manifest | null>;
    /** real paths of directories since the last invalidation */
    directories: Map<string, string>;
}
/**
 * Replace the methods that read Node's manifest caches and `Module._load`
 * for an HMR instance. The replacements that a disposed HMR has left are
 * restored first, and their invalidated paths are taken over, in one step,
 * so that no resolution in between reads Node's stale caches.
 * @returns a function that leaves the replacements to the next HMR, which
 * keeps them in place: restoring them would expose the stale caches again.
 */
export declare function activate(): () => void;
/** Make later resolutions read the manifests below `paths` from disk. */
export declare function invalidateManifests(paths: string[]): void;
export {};
