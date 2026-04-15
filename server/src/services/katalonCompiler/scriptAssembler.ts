import { DEFAULT_WAIT_SEC } from "./actionCompiler.js";
import type { InternalOp } from "./actionCompiler.js";
import { mapLocatorToVarName, buildTestObjectDeclarations, type TestObjectDecl } from "./testObjectBuilder.js";
import type { CompileKatalonInput, ResolvedLocator } from "./types.js";

function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

/** Single-line Groovy `//` comment from human step label (no string escaping). */
function groovyCommentLine(text: string): string {
  return `// ${text.replace(/\r?\n/g, " ").trim()}`;
}

/** Map Playwright-style key names to Selenium Keys expressions. */
function seleniumKeysExpr(key: string): string {
  const k = key.trim();
  if (/^enter$/i.test(k)) return "Keys.chord(Keys.ENTER)";
  if (/^tab$/i.test(k)) return "Keys.chord(Keys.TAB)";
  if (/^escape|esc$/i.test(k)) return "Keys.chord(Keys.ESCAPE)";
  if (/^backspace$/i.test(k)) return "Keys.chord(Keys.BACK_SPACE)";
  if (/^delete$/i.test(k)) return "Keys.chord(Keys.DELETE)";
  if (/^space$/i.test(k)) return "Keys.chord(Keys.SPACE)";
  if (/^arrowdown$/i.test(k)) return "Keys.chord(Keys.ARROW_DOWN)";
  if (/^arrowup$/i.test(k)) return "Keys.chord(Keys.ARROW_UP)";
  if (/^arrowleft$/i.test(k)) return "Keys.chord(Keys.ARROW_LEFT)";
  if (/^arrowright$/i.test(k)) return "Keys.chord(Keys.ARROW_RIGHT)";
  return `Keys.chord('${esc(k)}')`;
}

/** Mandatory stability stack before element interactions (compiler architecture). */
function webInteractionStability(objExpr: string): string[] {
  return [
    `WebUI.waitForPageLoad(${DEFAULT_WAIT_SEC})`,
    `WebUI.waitForElementPresent(${objExpr}, ${DEFAULT_WAIT_SEC})`,
    `WebUI.waitForElementClickable(${objExpr}, ${DEFAULT_WAIT_SEC})`,
  ];
}

function objectExpr(loc: ResolvedLocator, decls: TestObjectDecl[]): string {
  if (loc.kind === "orPath" && loc.orPath) {
    const p = loc.orPath.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
    return `findTestObject('${p}')`;
  }
  const vn = mapLocatorToVarName(loc, decls);
  if (!vn) return "/* missing TestObject */";
  return vn;
}

function collectInlineLocatorsFromOps(ops: InternalOp[]): ResolvedLocator[] {
  const m = new Map<string, ResolvedLocator>();
  for (const op of ops) {
    if (!("loc" in op) || !op.loc) continue;
    if (op.loc.kind === "orPath") continue;
    m.set(op.loc.label, op.loc);
  }
  return [...m.values()];
}

function headerComment(testCaseName?: string): string {
  const name = testCaseName?.trim() || "generated";
  return `// Katalon Groovy — deterministic compiler (web)\n// Test: ${esc(name)}`;
}

function headerCommentMobile(testCaseName?: string): string {
  const name = testCaseName?.trim() || "generated";
  return `// Katalon Groovy — deterministic compiler (mobile)\n// Test: ${esc(name)}`;
}

const WEB_IMPORTS = [
  "import com.kms.katalon.core.model.FailureHandling",
  "import com.kms.katalon.core.webui.keyword.WebUiBuiltInKeywords as WebUI",
  "import com.kms.katalon.core.testobject.TestObject",
  "import com.kms.katalon.core.testobject.ConditionType",
  "import org.openqa.selenium.Keys",
] as const;

const MOBILE_IMPORTS = [
  "import com.kms.katalon.core.model.FailureHandling",
  "import com.kms.katalon.core.mobile.keyword.MobileBuiltInKeywords as Mobile",
  "import com.kms.katalon.core.testobject.TestObject",
  "import com.kms.katalon.core.testobject.ConditionType",
] as const;

function needsFindTestObjectImport(ops: InternalOp[], decls: TestObjectDecl[]): boolean {
  for (const op of ops) {
    if (!("loc" in op) || !op.loc) continue;
    if (op.loc.kind === "orPath") return true;
  }
  return false;
}

function emitWebOperations(ops: InternalOp[], decls: TestObjectDecl[]): string[] {
  const lines: string[] = [];

  for (const op of ops) {
    switch (op.kind) {
      case "openBrowser": {
        const u = esc(op.url);
        lines.push(`WebUI.openBrowser('${u}', FailureHandling.STOP_ON_FAILURE)`);
        lines.push(`WebUI.waitForPageLoad(${DEFAULT_WAIT_SEC})`);
        break;
      }
      case "navigate": {
        lines.push(`WebUI.navigateToUrl('${esc(op.url)}')`);
        lines.push(`WebUI.waitForPageLoad(${DEFAULT_WAIT_SEC})`);
        break;
      }
      case "maximize": {
        lines.push(`WebUI.maximizeWindow()`);
        break;
      }
      case "waitPage": {
        lines.push(`WebUI.waitForPageLoad(${op.seconds})`);
        break;
      }
      case "click": {
        if (op.stepComment) {
          lines.push(groovyCommentLine(op.stepComment));
        }
        if (op.loc.recordingFallback) {
          lines.push("// Fallback: dynamic locator used (no OR path match)");
        }
        {
          const o = objectExpr(op.loc, decls);
          lines.push(...webInteractionStability(o));
          lines.push(`WebUI.click(${o})`);
        }
        break;
      }
      case "check": {
        if (op.loc.recordingFallback) {
          lines.push("// Fallback: dynamic locator used (no OR path match)");
        }
        {
          const o = objectExpr(op.loc, decls);
          lines.push(...webInteractionStability(o));
          lines.push(`WebUI.check(${o})`);
        }
        break;
      }
      case "uncheck": {
        if (op.loc.recordingFallback) {
          lines.push("// Fallback: dynamic locator used (no OR path match)");
        }
        {
          const o = objectExpr(op.loc, decls);
          lines.push(...webInteractionStability(o));
          lines.push(`WebUI.uncheck(${o})`);
        }
        break;
      }
      case "setText": {
        if (op.stepComment) {
          lines.push(groovyCommentLine(op.stepComment));
        }
        if (op.loc.recordingFallback) {
          lines.push("// Fallback: dynamic locator used (no OR path match)");
        }
        {
          const o = objectExpr(op.loc, decls);
          lines.push(...webInteractionStability(o));
          lines.push(`WebUI.setText(${o}, '${esc(op.text)}')`);
        }
        break;
      }
      case "sendEnter": {
        if (op.loc.recordingFallback) {
          lines.push("// Fallback: dynamic locator used (no OR path match)");
        }
        {
          const o = objectExpr(op.loc, decls);
          lines.push(...webInteractionStability(o));
          lines.push(`WebUI.sendKeys(${o}, Keys.chord(Keys.ENTER))`);
        }
        break;
      }
      case "sendKey": {
        if (op.loc.recordingFallback) {
          lines.push("// Fallback: dynamic locator used (no OR path match)");
        }
        {
          const o = objectExpr(op.loc, decls);
          lines.push(...webInteractionStability(o));
          lines.push(`WebUI.sendKeys(${o}, ${seleniumKeysExpr(op.key)})`);
        }
        break;
      }
      case "verifyTextPresent": {
        lines.push(`WebUI.verifyTextPresent('${esc(op.text)}', ${op.caseSensitive ? "true" : "false"})`);
        break;
      }
      case "verifyElementVisible": {
        if (op.loc.recordingFallback) {
          lines.push("// Fallback: dynamic locator used (no OR path match)");
        }
        {
          const o = objectExpr(op.loc, decls);
          lines.push(...webInteractionStability(o));
          lines.push(`WebUI.verifyElementVisible(${o})`);
        }
        break;
      }
      case "closeBrowser": {
        lines.push(`WebUI.closeBrowser()`);
        break;
      }
      case "compilerComment": {
        lines.push(`// ${op.text}`);
        break;
      }
      default:
        break;
    }
  }

  return lines;
}

function emitMobileOperations(ops: InternalOp[], decls: TestObjectDecl[]): string[] {
  const lines: string[] = [];

  for (const op of ops) {
    switch (op.kind) {
      case "startApplication": {
        const p = esc(op.path);
        lines.push(`Mobile.startApplication('${p}', false)`);
        break;
      }
      case "tap": {
        if (op.stepComment) {
          lines.push(groovyCommentLine(op.stepComment));
        }
        if (op.loc.recordingFallback) {
          lines.push("// Fallback: dynamic locator used (no OR path match)");
        }
        lines.push(`Mobile.waitForElementPresent(${objectExpr(op.loc, decls)}, ${DEFAULT_WAIT_SEC})`);
        lines.push(`Mobile.tap(${objectExpr(op.loc, decls)}, false)`);
        break;
      }
      case "mobileSetText": {
        if (op.stepComment) {
          lines.push(groovyCommentLine(op.stepComment));
        }
        if (op.loc.recordingFallback) {
          lines.push("// Fallback: dynamic locator used (no OR path match)");
        }
        lines.push(`Mobile.waitForElementPresent(${objectExpr(op.loc, decls)}, ${DEFAULT_WAIT_SEC})`);
        lines.push(`Mobile.setText(${objectExpr(op.loc, decls)}, '${esc(op.text)}')`);
        break;
      }
      case "swipeComment": {
        lines.push(`// TODO: Mobile.swipe — set start/end per device and Katalon Mobile API`);
        break;
      }
      case "verifyElementVisible": {
        if (op.loc.recordingFallback) {
          lines.push("// Fallback: dynamic locator used (no OR path match)");
        }
        lines.push(`Mobile.waitForElementPresent(${objectExpr(op.loc, decls)}, ${DEFAULT_WAIT_SEC})`);
        lines.push(`Mobile.verifyElementVisible(${objectExpr(op.loc, decls)}, ${DEFAULT_WAIT_SEC})`);
        break;
      }
      case "compilerComment": {
        lines.push(`// ${op.text}`);
        break;
      }
      default:
        break;
    }
  }

  return lines;
}

export function assembleWebScript(input: CompileKatalonInput, operations: InternalOp[]): string {
  const used = collectInlineLocatorsFromOps(operations);
  const usedNames = new Set<string>();
  const decls = buildTestObjectDeclarations(used, usedNames);

  const importLines: string[] = [...WEB_IMPORTS];
  if (needsFindTestObjectImport(operations, decls)) {
    importLines.splice(
      4,
      0,
      "import static com.kms.katalon.core.testobject.ObjectRepository.findTestObject"
    );
  }

  const blocks: string[] = [headerComment(input.testCaseName), "", ...importLines, ""];

  const actionLines = emitWebOperations(operations, decls);

  if (decls.length) {
    blocks.push("// TestObjects", ...decls.flatMap((d) => [...d.lines, ""]), "");
  }

  blocks.push("// Actions", ...actionLines, "");

  return blocks.join("\n").trimEnd() + "\n";
}

export function assembleMobileScript(input: CompileKatalonInput, operations: InternalOp[]): string {
  const used = collectInlineLocatorsFromOps(operations);
  const usedNames = new Set<string>();
  const decls = buildTestObjectDeclarations(used, usedNames);

  const importLines: string[] = [...MOBILE_IMPORTS];
  if (needsFindTestObjectImport(operations, decls)) {
    importLines.splice(
      4,
      0,
      "import static com.kms.katalon.core.testobject.ObjectRepository.findTestObject"
    );
  }

  const blocks: string[] = [headerCommentMobile(input.testCaseName), "", ...importLines, ""];

  const actionLines = emitMobileOperations(operations, decls);

  if (decls.length) {
    blocks.push("// TestObjects", ...decls.flatMap((d) => [...d.lines, ""]), "");
  }

  blocks.push("// Actions", ...actionLines, "");

  return blocks.join("\n").trimEnd() + "\n";
}
