import { wrapGroovyClass } from "./architectureTemplateEngine.js";
import { logInfo, loggingImports } from "./loggingPatternGenerator.js";
import type { ArchitecturePlan } from "./types.js";

export function buildFrameworkService(plan: ArchitecturePlan): { code: string; buildersUsed: string[] } {
  const imports = loggingImports();
  const bodyLines = [
    "    private static Map<String, String> cache = [:].asSynchronized()",
    "",
    `    static String ${plan.primaryMethod}(String key, String defaultValue = '') {`,
    ...(plan.intent.features.logging ? [logInfo("Config: resolve key")] : []),
    "        if (!key?.trim()) return defaultValue",
    "        if (cache.containsKey(key)) return cache[key]",
    "        def value = RunConfiguration.getExecutionProfile() ?: defaultValue",
    "        cache[key] = value",
    "        return value",
    "    }",
    "",
    "    static void clearCache() {",
    "        cache.clear()",
    "    }",
  ];

  return {
    code: wrapGroovyClass({ className: plan.className, imports, bodyLines }),
    buildersUsed: ["frameworkServiceGenerator"],
  };
}
