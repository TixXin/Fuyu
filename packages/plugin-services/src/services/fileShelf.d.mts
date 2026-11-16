import type { ServiceDefinition } from "../define.mjs";
import type { FileShelfSnapshot } from "../generated/rust.mjs";

export type { FileShelfEntry, FileShelfSnapshot } from "../generated/rust.mjs";

export type FileShelfMethods = {
  list(): FileShelfSnapshot;
  add(params: { paths: string[] }): FileShelfSnapshot;
};

export const fileShelfV1: ServiceDefinition<FileShelfMethods, {}, {}>;
