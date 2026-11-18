export type ExecutableKind = "PE" | "ELF" | "Mach-O" | "Java class" | "WebAssembly" | "Java archive";

export declare const EXECUTABLE_EXTENSIONS: readonly string[];
export declare function zipEntryNames(data: Uint8Array): string[];
export declare function executableKind(data: Uint8Array): ExecutableKind | null;
