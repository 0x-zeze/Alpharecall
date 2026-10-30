export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("./") || specifier.startsWith("../")) {
    try {
      return await nextResolve(specifier, context);
    } catch (e) {
      if (e.code === "ERR_MODULE_NOT_FOUND") {
        try {
          return await nextResolve(specifier + ".ts", context);
        } catch {
          try {
            return await nextResolve(specifier + ".tsx", context);
          } catch {
            return await nextResolve(specifier + "/index.ts", context);
          }
        }
      }
      throw e;
    }
  }
  return nextResolve(specifier, context);
}
