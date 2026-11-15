export interface ExprTrace {
    label: string;
    locate: (expr: string, offset: number) => SourceLocation | undefined;
    getOuterStack: () => string[];
}
export declare function evaluate(ctx: object, expr: string, trace?: ExprTrace): any;
export declare function interpolate(ctx: object, value: any, getTrace?: (path: PropertyKey[]) => ExprTrace, path?: PropertyKey[]): any;
export declare function isJsExpr(value: any): value is JsExpr;
export declare function swap<T extends {}>(target: T, source?: T | null): void;
export interface JsExpr {
    __jsExpr: string;
}
/** 1-based, with columns in UTF-16 code units. */
export interface SourceLocation {
    filename: string;
    line: number;
    column: number;
}
export declare function formatLocation(location: SourceLocation): string;
export declare function formatIssue(message: string, location?: SourceLocation, path?: string): string;
export interface Issue {
    message: string;
    path: PropertyKey[];
}
export type Locate = (path: PropertyKey[]) => SourceLocation | undefined;
export declare function formatIssues(title: string, issues: readonly Issue[], locate?: Locate): string;
export declare function relocate(error: Error, message: string, frames: string[]): void;
export declare class EntryValidationError extends TypeError {
    issues: Issue[];
    name: string;
    constructor(issues: Issue[]);
}
export declare function validateOptions(options: unknown, sep: string, deep?: boolean): Issue[];
