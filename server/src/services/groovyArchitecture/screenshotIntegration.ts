export function screenshotImports(): string[] {
  return [
    "import com.kms.katalon.core.webui.keyword.WebUiBuiltInKeywords as WebUI",
    "import com.kms.katalon.core.model.FailureHandling",
  ];
}

export function captureScreenshotLine(plan: { projectReuse: { screenshotHelper?: string } }, indent = "        "): string {
  if (plan.projectReuse.screenshotHelper) {
    return `${indent}CustomKeywords.'${plan.projectReuse.screenshotHelper}'('failure_capture')`;
  }
  return `${indent}WebUI.takeScreenshot('failure_capture_' + System.currentTimeMillis())`;
}
