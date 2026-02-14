import { readFileSync, existsSync } from "node:fs";
import { join, dirname, basename } from "node:path";

/**
 * Resolves Wren module import paths to filesystem paths.
 *
 * Wren modules are identified by string names in import statements:
 *   import "some_module"
 *   import "some_module" for SomeClass
 *
 * Resolution strategy:
 * 1. Relative to the importing file's directory
 * 2. Each search path in order
 *
 * The module name maps to `<name>.wren` on disk.
 */
export class ModuleResolver {
  private searchPaths: string[];
  private cache = new Map<string, string | null>();

  constructor(searchPaths: string[] = []) {
    this.searchPaths = searchPaths;
  }

  /**
   * Resolve a module name to a filesystem path.
   * @param moduleName  The import path string (e.g. "some_module")
   * @param fromPath    The path of the file containing the import
   * @returns           The resolved filesystem path, or null if not found
   */
  resolve(moduleName: string, fromPath: string): string | null {
    const cacheKey = `${fromPath}::${moduleName}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const result = this.doResolve(moduleName, fromPath);
    this.cache.set(cacheKey, result);
    return result;
  }

  private doResolve(moduleName: string, fromPath: string): string | null {
    const fileName = moduleName + ".wren";

    // 1. Relative to the importing file
    const fromDir = dirname(fromPath);
    const relativePath = join(fromDir, fileName);
    if (existsSync(relativePath)) {
      return relativePath;
    }

    // 2. Search paths
    for (const searchPath of this.searchPaths) {
      const candidate = join(searchPath, fileName);
      if (existsSync(candidate)) {
        return candidate;
      }
    }

    return null;
  }

  /**
   * Read the contents of a resolved module file.
   * Returns null if the file cannot be read.
   */
  readModule(resolvedPath: string): string | null {
    try {
      return readFileSync(resolvedPath, "utf-8");
    } catch {
      return null;
    }
  }
}
