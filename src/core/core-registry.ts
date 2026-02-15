// =============================================================================
// Core class registry — built by parsing the Wren stub strings.
//
// Replaces the hand-maintained CORE_INSTANCE_METHODS / CORE_STATIC_METHODS /
// CORE_SUPERCLASS maps with a properly parsed registry that tracks arities.
// =============================================================================

import { Lexer } from "../lexer.js";
import { Parser } from "../parser.js";
import { buildClassRegistry } from "../type-checker.js";
import type { ClassInfo } from "../type-checker.js";
import { SourceFile } from "../source-file.js";
import { CORE_MODULE_SOURCE, RANDOM_MODULE_SOURCE, META_MODULE_SOURCE } from "./stubs.js";

/** Built-in module names provided by the Wren VM — no .wren file to resolve. */
export const BUILTIN_MODULES = new Set(["meta", "random"]);

export function isBuiltinModule(name: string): boolean {
  return BUILTIN_MODULES.has(name);
}

// ---------------------------------------------------------------------------
// Lazy-cached registries
// ---------------------------------------------------------------------------

let coreRegistryCache: Map<string, ClassInfo> | null = null;
let randomRegistryCache: Map<string, ClassInfo> | null = null;
let metaRegistryCache: Map<string, ClassInfo> | null = null;

/**
 * Parse a Wren source string and build a class registry from it.
 * Uses the analyzer's own Lexer → Parser → buildClassRegistry pipeline.
 */
function parseStubSource(source: string, path: string): Map<string, ClassInfo> {
  const sourceFile = new SourceFile(path, source);
  const lexer = new Lexer(sourceFile);
  const parser = new Parser(lexer);
  const module = parser.parseModule();
  return buildClassRegistry(module);
}

/**
 * Returns the class registry for all Wren core classes (Object, Bool, Num,
 * String, List, Map, Range, Fiber, Fn, Sequence, System, etc.).
 *
 * The result is cached — the stub is only parsed once.
 */
export function getCoreRegistry(): Map<string, ClassInfo> {
  if (!coreRegistryCache) {
    coreRegistryCache = parseStubSource(CORE_MODULE_SOURCE, "<core>");
  }
  return coreRegistryCache;
}

/**
 * Returns the class registry for a built-in module ("random" or "meta"),
 * or null if the module name is not a known built-in.
 *
 * Results are cached per module.
 */
export function getBuiltinModuleRegistry(
  moduleName: string,
): Map<string, ClassInfo> | null {
  switch (moduleName) {
    case "random":
      if (!randomRegistryCache) {
        randomRegistryCache = parseStubSource(RANDOM_MODULE_SOURCE, "<random>");
      }
      return randomRegistryCache;

    case "meta":
      if (!metaRegistryCache) {
        metaRegistryCache = parseStubSource(META_MODULE_SOURCE, "<meta>");
      }
      return metaRegistryCache;

    default:
      return null;
  }
}
