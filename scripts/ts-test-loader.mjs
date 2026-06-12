import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve as resolvePath } from "node:path";

const tsPath = `${process.cwd()}/node_modules/typescript/lib/typescript.js`;
const ts = await import(pathToFileURL(tsPath).href);

// Resolve @/ path aliases to the workspace root (mirrors tsconfig paths: { "@/*": ["./*"] })
const workspaceRoot = process.cwd();

export async function resolve(specifier, context, defaultResolve) {
  if (specifier.startsWith("@/")) {
    const relativePath = specifier.slice(2); // strip "@/"
    const absolutePath = resolvePath(workspaceRoot, relativePath);

    // Try the path as-is first (may already have .ts extension)
    try {
      const directUrl = pathToFileURL(absolutePath).href;
      return await defaultResolve(directUrl, context, defaultResolve);
    } catch {
      // Fall through to try with .ts extension
    }

    // Try appending .ts
    try {
      const tsUrl = pathToFileURL(absolutePath + ".ts").href;
      return await defaultResolve(tsUrl, context, defaultResolve);
    } catch {
      // Fall through to default resolution
    }
  }
  return defaultResolve(specifier, context, defaultResolve);
}

export async function load(url, context, defaultLoad) {
  if (url.endsWith(".ts")) {
    const source = await readFile(new URL(url), "utf8");
    const transpiled = ts.default.transpileModule(source, {
      compilerOptions: {
        module: ts.default.ModuleKind.ESNext,
        target: ts.default.ScriptTarget.ES2022,
        jsx: ts.default.JsxEmit.ReactJSX,
      },
      fileName: new URL(url).pathname,
    });

    return {
      format: "module",
      source: transpiled.outputText,
      shortCircuit: true,
    };
  }

  return defaultLoad(url, context, defaultLoad);
}
