import { readFileSync } from "node:fs";

const load = (name) => JSON.parse(readFileSync(new URL(`../schema/${name}`, import.meta.url), "utf8"));

let cache = null;

export function protocol() {
  cache ??= { manifestSchema: load("manifest.schema.json"), rpc: load("rpc.json") };
  return cache;
}

export function methodPermissions() {
  return new Map(protocol().rpc.methods.map((method) => [method.name, method.permission ?? null]));
}

export function eventPermissions() {
  return new Map(protocol().rpc.events.map((event) => [event.name, event.permission ?? null]));
}
