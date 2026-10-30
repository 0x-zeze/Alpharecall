import path from "node:path";
import { pathToFileURL } from "node:url";

const rootDir = process.cwd();

export async function resolve(specifier, context, nextResolve) {
  let target = specifier;

  if (target === "next/server") {
    target = "next/server.js";
  } else if (target.startsWith("@/")) {
    const rel = target.slice(2);
    target = pathToFileURL(path.join(rootDir, rel)).href;
  }

  if (target.startsWith("./") || target.startsWith("../") || target.startsWith("file://")) {
    try {
      return await nextResolve(target, context);
    } catch (e) {
      if (e.code === "ERR_MODULE_NOT_FOUND") {
        try {
          return await nextResolve(target + ".ts", context);
        } catch {
          try {
            return await nextResolve(target + ".tsx", context);
          } catch {
            return await nextResolve(target + "/index.ts", context);
          }
        }
      }
      throw e;
    }
  }

  return nextResolve(target, context);
}
