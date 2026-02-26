import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const tsPath = `${process.cwd()}/node_modules/typescript/lib/typescript.js`;
const ts = await import(pathToFileURL(tsPath).href);

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
