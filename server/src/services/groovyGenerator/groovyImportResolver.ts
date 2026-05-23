import type { GroovyUtilityPlatform } from "../testDsl/groovyUtilityIntent.js";

export function resolveUtilityImports(
  platform: GroovyUtilityPlatform,
  needs: {
    webui?: boolean;
    mobile?: boolean;
    ws?: boolean;
    keyword?: boolean;
    testObject?: boolean;
  }
): string[] {
  const lines: string[] = [];
  if (needs.keyword) {
    lines.push("import com.kms.katalon.core.annotation.Keyword");
  }
  if (platform === "web" || needs.webui) {
    lines.push("import com.kms.katalon.core.webui.keyword.WebUiBuiltInKeywords as WebUI");
    lines.push("import com.kms.katalon.core.model.FailureHandling");
  }
  if (platform === "mobile" || needs.mobile) {
    lines.push("import com.kms.katalon.core.mobile.keyword.MobileBuiltInKeywords as Mobile");
  }
  if (platform === "api" || needs.ws) {
    lines.push("import com.kms.katalon.core.webservice.keyword.WSBuiltInKeywords as WS");
    lines.push("import com.kms.katalon.core.testobject.RequestObject");
    lines.push("import com.kms.katalon.core.model.FailureHandling");
  }
  if (needs.testObject || needs.webui || needs.mobile) {
    if (!lines.some((l) => l.includes("FailureHandling"))) {
      lines.push("import com.kms.katalon.core.model.FailureHandling");
    }
  }
  return [...new Set(lines)];
}

export function defaultPackage(): string {
  return "common";
}
