import type { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { SCHEMA_SQL } from "./schema.js";

// Retrieved via process.getBuiltinModule (rather than a static `import`) so bundlers/test
// runners that don't yet recognize the newer "node:sqlite" builtin don't try to resolve it
// as a package on npm.
const { DatabaseSync: DatabaseSyncCtor } = process.getBuiltinModule("node:sqlite") as typeof import("node:sqlite");

export type Database = DatabaseSync;

/**
 * Opens (creating if needed) the SQLite database at `path` and applies the
 * schema. Uses Node's built-in node:sqlite so the project has zero native
 * dependencies to compile or download.
 */
export function openDatabase(path: string): Database {
  if (path !== ":memory:") {
    mkdirSync(dirname(path), { recursive: true });
  }
  const db = new DatabaseSyncCtor(path);
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA_SQL);
  return db;
}
