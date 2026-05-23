import { wrapGroovyClass } from "./architectureTemplateEngine.js";
import { logInfo, loggingImports } from "./loggingPatternGenerator.js";
import type { ArchitecturePlan } from "./types.js";

export function buildDatabaseUtility(plan: ArchitecturePlan): { code: string; buildersUsed: string[] } {
  const imports = [
    "import groovy.sql.Sql",
    "import java.sql.DriverManager",
    ...loggingImports(),
  ];

  const bodyLines = [
    "    private static Sql openSql() {",
    "        def url = GlobalVariable.DB_URL ?: System.getenv('DB_URL')",
    "        def user = GlobalVariable.DB_USER ?: System.getenv('DB_USER')",
    "        def pass = GlobalVariable.DB_PASS ?: System.getenv('DB_PASS')",
    "        def driver = Class.forName('org.postgresql.Driver')",
    "        return Sql.newInstance(url, user, pass, driver.name)",
    "    }",
    "",
    `    static List<Map> ${plan.primaryMethod}(String query) {`,
    ...(plan.intent.features.logging ? [logInfo("DB: execute query")] : []),
    "        def sql = openSql()",
    "        try {",
    "            return sql.rows(query ?: 'SELECT 1')",
    "        } finally {",
    "            sql.close()",
    "        }",
    "    }",
  ];

  return {
    code: wrapGroovyClass({ className: plan.className, imports, bodyLines }),
    buildersUsed: ["databaseUtilityGenerator"],
  };
}
