import { Context } from 'cordis';
import { Dict } from 'cosmokit';
import { Entry, EntryOptions } from './entry.ts';
import { EntryGroup } from './group.ts';
import { SourceLocation } from './utils.ts';
export declare class ModuleNotFoundError extends Error {
    specifier: string;
    name: string;
    code: string;
    constructor(specifier: string, message: string);
}
/**
 * One tree-side mutation, reported to `EntryTree.commit()` synchronously after
 * it has been applied to `entry.options` / `group.data`.
 *
 * - `options` absent: the entry was removed from `group`.
 * - `legacy` absent: the entry was created in `group`.
 * - both present: the entry was updated and now lives in `group`; `from` is
 *   the group it left if the update moved it within the same tree.
 *
 * A move into another tree is reported as a removal to the source tree and a
 * creation to the target tree.
 */
export interface EntryChange {
    id: string;
    group: EntryGroup;
    from?: EntryGroup;
    options?: EntryOptions;
    legacy?: EntryOptions;
}
export declare abstract class EntryTree {
    static readonly sep = ":";
    ctx: Context;
    enableLogs?: boolean;
    root: EntryGroup;
    store: Dict<Entry>;
    constructor(ctx: Context);
    get context(): Context;
    entries(): Generator<Entry, void, void>;
    getTasks(): Promise<void>[];
    await(): Promise<void>;
    ensureId(options: Partial<EntryOptions>): string;
    resolve(id: string): Entry;
    resolveGroup(id: string | null): EntryGroup;
    create(options: Omit<EntryOptions, 'id'>, parent?: string | null, position?: number): Promise<string>;
    remove(id: string): void;
    update(id: string, options: Omit<EntryOptions, 'id' | 'name'>, parent?: string | null, position?: number): Promise<void>;
    import(name: string, getOuterStack?: () => string[]): Promise<any>;
    abstract commit(change: EntryChange): void;
    /**
     * Where a value of the entry options is written. A path that leaves the
     * source falls back to its deepest written ancestor.
     */
    getLocation(_id: string, _path: PropertyKey[]): SourceLocation | undefined;
    locateExpr(_id: string, _path: PropertyKey[], _expr: string, _offset: number): SourceLocation | undefined;
}
