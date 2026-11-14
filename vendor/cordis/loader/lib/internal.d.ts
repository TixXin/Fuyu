/** Node's internal ESM loader, of which the loader only imports modules. */
export interface InternalLoader {
    import(specifier: string, parentURL: string, importAttributes: ImportAttributes): Promise<any>;
}
/**
 * Get Node's internal ESM loader, through `--expose-internals` or
 * `node-addon-require-builtin`.
 * @returns the loader, or `undefined` when it is unreachable.
 */
export declare function getInternalLoader(): InternalLoader | undefined;
/** Get the component exported by a module namespace. */
export declare function unwrapExports(exports: any): any;
