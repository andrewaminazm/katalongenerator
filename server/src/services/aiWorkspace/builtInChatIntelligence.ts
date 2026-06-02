/**
 * Built-in QA Chat Intelligence — works entirely without any external LLM.
 * Provides rich, actionable responses based on intent detection and QA knowledge.
 */

import type { WorkspaceIntent } from "./types.js";
import { SENIOR_QA_ENGINEER_NAME } from "./gosiBrainIdentity.js";

// ─── Language detection ──────────────────────────────────────────────────────

function isArabic(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

// ─── Pattern matchers ────────────────────────────────────────────────────────

function isGreeting(msg: string): boolean {
  return /^(hi+|hello+|hey+|greetings|good\s*(morning|afternoon|evening|day)|howdy|yo|sup|مرحبا|السلام عليكم|أهلا|اهلا|سلام|كيف حالك|صباح الخير|مساء الخير)/i.test(
    msg.trim()
  );
}

function asksAboutPlatform(msg: string): boolean {
  return /\b(web|mobile|android|ios|api|rest|soap|webservice|appium)\b/i.test(msg);
}

function mentionsKatalon(msg: string): boolean {
  return /\b(katalon|keyword|page.?object|test.?object|groovy|webui|mobile\.|ws\.|findtestobject|object.?repository|test.?suite|execution.?profile|checkpoint)\b/i.test(
    msg
  );
}

function wantsGeneration(msg: string): boolean {
  return /\b(generate|create|write|build|make|add|implement|code|script)\b/i.test(msg);
}

function wantsExplanation(msg: string): boolean {
  return /^(what|how|why|when|where|which|explain|describe|tell me|can you|ما|كيف|لماذا|متى|أين|اشرح|وضح)/i.test(
    msg.trim()
  );
}

function mentionsFlakyTests(msg: string): boolean {
  return /\b(flak(y|iness)|intermittent|unstable|randomly fail|sometimes fail|نضطرب|غير مستقر)\b/i.test(
    msg
  );
}

function mentionsLocators(msg: string): boolean {
  return /\b(locator|selector|xpath|css|findtestobject|element|object.?repository|OR\b|بيانات العنصر|محدد)\b/i.test(
    msg
  );
}

function mentionsPerformance(msg: string): boolean {
  return /\b(performance|load|stress|spike|soak|jmeter|k6|vus|throughput|latency|أداء|اختبار الحمل)\b/i.test(
    msg
  );
}

function mentionsApi(msg: string): boolean {
  return /\b(api|rest|swagger|openapi|postman|endpoint|curl|token|bearer|header|request|response|json|body|برمجة تطبيقات)\b/i.test(
    msg
  );
}

function mentionsTestStrategy(msg: string): boolean {
  return /\b(strateg|plan|approach|framework|architecture|design|best.?practice|pyramid|coverage|regression|smoke|sanity|استراتيجية|خطة اختبار)\b/i.test(
    msg
  );
}

function mentionsCoverage(msg: string): boolean {
  return /\b(coverage|covered|missing.?test|gap|untested|تغطية)\b/i.test(msg);
}

function mentionsCI(msg: string): boolean {
  return /\b(ci|cd|pipeline|jenkins|github.?action|azure|devops|build|deploy|trigger|تكامل مستمر)\b/i.test(
    msg
  );
}

function mentionsProjectReview(msg: string): boolean {
  return /\b(review|analyze|check|inspect|audit|scan|project|my\s+project|مشروع|راجع|افحص)\b/i.test(
    msg
  );
}

// ─── Response builders ───────────────────────────────────────────────────────

function greetingResponse(msg: string): string {
  const arabic = isArabic(msg);
  if (arabic) {
    return `مرحباً! أنا **${SENIOR_QA_ENGINEER_NAME}**، مدير ضمان الجودة للأتمتة.

يمكنني مساعدتك في:

- **توليد كود Groovy** — اكتب ما تريد إنشاؤه بالإنجليزية أو العربية
- **تحليل المشاريع** — ارفع مشروع Katalon للمراجعة الكاملة
- **استراتيجية الاختبار** — تصميم إطار اختبار احترافي
- **إصلاح الاختبارات** — تشخيص الاختبارات المتذبذبة وإصلاح المحددات (Locators)
- **اختبار الـ API** — توليد حالات اختبار من Swagger أو cURL
- **اختبار الأداء** — توليد استراتيجيات JMeter/k6

ماذا تريد أن نبدأ؟`;
  }
  return `Hello! I'm **${SENIOR_QA_ENGINEER_NAME}**, your QA Director for automation and release decisions.

Here's what I can help you with right now:

- **Generate Groovy code** — describe what you need (test script, keyword, page object, API helper…)
- **Analyze your project** — upload a Katalon project ZIP for a full health review
- **Test strategy** — design a framework from scratch or audit an existing one
- **Fix flaky tests** — diagnose unstable tests and heal broken locators
- **API test generation** — generate from Swagger, Postman, or a cURL command
- **Performance testing** — generate JMeter and k6 load test strategies

What would you like to work on?`;
}

function generationGuidanceResponse(msg: string): string {
  const arabic = isArabic(msg);
  const lower = msg.toLowerCase();

  if (/\b(page.?object|صفحة)\b/i.test(lower)) {
    return `To generate a **Page Object**, tell me:

1. **The page name** (e.g. "Login Page", "Checkout Page")
2. **The fields/actions** on the page (username field, password field, login button, etc.)
3. **Optional:** paste the URL and I'll auto-detect locators

**Example request:**
> Create a page object for the login page with username field, password field, remember me checkbox, and login button

Once I have that, I'll generate a production-ready Groovy Page Object class using your project's Object Repository.`;
  }

  if (/\b(keyword|custom.?keyword|كلمة مفتاحية)\b/i.test(lower)) {
    return `To generate a **Custom Keyword class**, describe:

1. **What the keyword does** (e.g. "retry a WebUI click up to 3 times")
2. **Platform** — Web, Mobile, or API
3. **Inputs and outputs** needed

**Example requests:**
> Create a custom keyword for retrying flaky WebUI clicks up to 3 times with logging
> Build a keyword that validates a Saudi national ID format

The generated keyword will follow Katalon's \`@Keyword\` annotation pattern with full error handling.`;
  }

  if (/\b(api|rest|ws\.|web.?service)\b/i.test(lower)) {
    return `To generate an **API test or helper**, provide:

1. **The endpoint** — URL, method (GET/POST/PUT/DELETE)
2. **Auth type** — Bearer token, API key, Basic, or none
3. **Request/response sample** (JSON) — optional but improves generation

**Or use the API Generator tab** — paste a Swagger spec or cURL command for full auto-generation.

**Example:**
> Create an API helper for POST /api/login with username and password body, Bearer token response`;
  }

  if (/\b(utility|helper|class|function|service|أداة)\b/i.test(lower)) {
    return `To generate a **utility class or helper**, describe:

1. **The purpose** — what problem does it solve?
2. **Inputs and outputs**
3. **Any specific constraints** (e.g. pure Groovy, no Katalon dependency)

**Examples:**
> Build a utility class for reading test data rows from Excel files
> Create a framework helper class for storing and retrieving test session variables
> Generate a DB utility for connecting to Oracle and running SELECT queries`;
  }

  // Generic generation guidance
  return `To generate Groovy code, describe **what you want to build** in plain English.

**Supported types:**
| Type | Example request |
|------|----------------|
| Test script | "Generate automation for login flow" |
| Custom keyword | "Create a keyword that retries clicks 3 times" |
| Page object | "Create a page object for the login page" |
| API helper | "Build an API helper for REST calls with Bearer token" |
| DB utility | "Create a DB utility for Oracle SELECT queries" |
| Framework helper | "Generate a helper for managing test session state" |

Just describe what you need — I'll generate production-ready Groovy that compiles in Katalon Studio.`;
}

function flakyTestResponse(): string {
  return `## Diagnosing Flaky Tests

Flaky tests fail intermittently without code changes. Here are the most common causes and fixes:

### 🔴 1. Timing / Wait Issues (most common — ~60% of cases)
**Problem:** Element not visible yet when the step runs.
\`\`\`groovy
// ❌ Fragile
WebUI.click(findTestObject('btn_login'))

// ✅ Stable
WebUI.waitForElementVisible(findTestObject('btn_login'), 15)
WebUI.click(findTestObject('btn_login'))
\`\`\`
**Fix:** Always \`waitForElementVisible\` or \`waitForElementClickable\` before interactions.

### 🔴 2. Dynamic Locators (XPath breaking after UI changes)
**Problem:** XPath like \`//div[3]/button[1]\` breaks when the DOM changes.
**Fix:** Use stable attribute-based selectors:
\`\`\`
CSS: button[data-testid='login-btn']
XPath: //button[@data-testid='login-btn']
\`\`\`

### 🟡 3. Test Data Conflicts
**Problem:** Tests share state (same user account, same database record).
**Fix:** Use unique test data per run (timestamps, UUIDs) or isolate with test profiles.

### 🟡 4. Missing Cleanup / Setup
**Problem:** A test leaves the app in a bad state for the next test.
**Fix:** Use \`@SetUp\` / \`@TearDown\` and browser clean-up between tests.

### 🟢 5. Network/Environment Flakiness
**Problem:** Slow CI machines, staging environment instability.
**Fix:** Increase global timeout in Katalon execution profile; add retry in CI pipeline.

---
**Want me to generate a retry keyword or analyze your specific failing test?**
Paste the error message or test steps and I'll diagnose further.`;
}

function locatorResponse(): string {
  return `## Locator Strategy Guide for Katalon

### Priority Order (most stable → least stable)

| Priority | Type | Example | When to use |
|----------|------|---------|-------------|
| 1 | \`id\` | \`#login-btn\` | Always prefer if ID exists |
| 2 | \`data-testid\` | \`[data-testid='submit']\` | Best for dynamic apps |
| 3 | \`name\` | \`input[name='username']\` | Forms |
| 4 | Stable CSS | \`button.login-button\` | Semantic classes |
| 5 | Role-based XPath | \`//button[@type='submit']\` | Semantic attributes |
| 6 | Text XPath | \`//button[text()='Login']\` | Last resort |
| ❌ | Index XPath | \`//div[3]/button[1]\` | Never — breaks easily |

### Katalon Object Repository Tips

\`\`\`groovy
// Always use findTestObject() — never hardcode selectors in scripts
WebUI.click(findTestObject('Page_Login/btn_Login'))

// For dynamic locators, use parameterized OR
findTestObject('Page_Products/row_Item', [('itemName'): productName])
\`\`\`

### Self-Healing Locators
Enable **Katalon Self-Healing** in Project Settings → Execution → Self-Healing.
It automatically tries backup selectors when the primary fails.

**Need me to generate an Object Repository entry or heal a broken locator?**
Paste the element's HTML and I'll write the optimal locator.`;
}

function testStrategyResponse(msg: string): string {
  const lower = msg.toLowerCase();
  const isWeb = /\bweb\b/i.test(lower);
  const isMobile = /\bmobile|android|ios\b/i.test(lower);
  const isApi = /\bapi|rest|service\b/i.test(lower);

  const platform = isMobile ? "Mobile" : isApi ? "API" : "Web";

  return `## ${platform} Test Automation Strategy

### Recommended Test Pyramid

\`\`\`
         ┌─────────────┐
         │  E2E / UI   │  ← 20% — critical user journeys only
         │  (Katalon)  │
        ┌┴─────────────┴┐
        │  Integration  │  ← 30% — API contracts, service flows
        │  (WS keywords)│
       ┌┴───────────────┴┐
       │    Unit Tests    │  ← 50% — business logic, utilities
       │   (pure Groovy)  │
       └─────────────────┘
\`\`\`

### Framework Architecture (Katalon Best Practices)

**Layer 1 — Object Repository**
- One folder per page/screen
- Naming: \`Page_<PageName>/<element_type>_<element_name>\`
- Parameterize dynamic elements

**Layer 2 — Custom Keywords**
- \`package common\` — shared reusable actions
- \`package api\` — REST/WS helpers
- \`package validation\` — assertion wrappers

**Layer 3 — Test Cases**
- Each test = one scenario, independent
- Use Execution Profiles for environments (dev/qa/staging/prod)
- Data-driven via CSV or Excel for repetitive scenarios

**Layer 4 — Test Suites**
- \`Regression\` — full suite (nightly)
- \`Smoke\` — critical paths (every deploy)
- \`API\` — services only (fast feedback)

### Critical Rules
1. Never use \`Thread.sleep()\` — use WebUI.waitFor* instead
2. Never hardcode URLs — use Global Variables in profiles
3. Keep test cases independent — no shared state between tests
4. Use \`@BeforeTestCase\` / \`@AfterTestCase\` for setup/teardown

**Want me to generate the framework structure? Tell me your modules and I'll scaffold it.**`;
}

function coverageResponse(): string {
  return `## Test Coverage Analysis

Without your project uploaded, here's how to assess and improve coverage:

### Coverage Checklist

**Functional Coverage**
- [ ] Happy path for each user journey
- [ ] Negative paths (invalid inputs, missing required fields)
- [ ] Boundary values (min/max, edge cases)
- [ ] Error states (network failure, timeout, 4xx/5xx responses)
- [ ] Permission/role-based scenarios

**Technical Coverage**
- [ ] Each Custom Keyword has at least one test exercising it
- [ ] All Object Repository entries are referenced in at least one test
- [ ] Critical API endpoints have contract tests
- [ ] Authentication flows (login, logout, session expiry, token refresh)

### Finding Coverage Gaps
Upload your Katalon project and I'll run a full analysis:
- Scripts missing assertions
- Unused Object Repository entries
- Untested API endpoints (if you provide Swagger)
- Duplicate test flows that can be consolidated

**To upload:** Use the Project Intelligence panel → Upload ZIP → run "Analyze"`;
}

function ciCdResponse(): string {
  return `## CI/CD Integration with Katalon

### Katalon Runtime Engine (KRE) in CI

\`\`\`bash
# Jenkins / GitHub Actions / Azure DevOps
katalonc \\
  -projectPath=/workspace/MyProject \\
  -testSuitePath="Test Suites/Regression" \\
  -executionProfile="staging" \\
  -browserType="Chrome (headless)" \\
  -apiKey=YOUR_KATALON_API_KEY
\`\`\`

### GitHub Actions Example
\`\`\`yaml
- name: Run Katalon Tests
  uses: katalon-studio/katalon-studio-github-action@v3
  with:
    version: '9.x'
    project-path: '.'
    args: >-
      -testSuitePath="Test Suites/Smoke"
      -executionProfile="staging"
      -browserType="Chrome (headless)"
      -apiKey=\${{ secrets.KATALON_API_KEY }}
\`\`\`

### Best Practices
1. **Run smoke suite on every PR** — fast feedback (<5 min)
2. **Run full regression nightly** — comprehensive, slower
3. **Fail fast on CRITICAL failures** — block merge if critical tests fail
4. **Archive reports** — store JUnit XML and HTML reports as artifacts
5. **Slack/Teams notifications** — alert the team on failures

**Need a specific CI platform setup? Tell me which CI tool you're using.**`;
}

function apiTestingResponse(): string {
  return `## API Testing with Katalon Web Services

### Quick Start — Testing a REST endpoint

\`\`\`groovy
import com.kms.katalon.core.webservice.keyword.WSBuiltinKeywords as WS
import com.kms.katalon.core.testobject.RequestObject
import com.kms.katalon.core.testobject.ResponseObject

// Make the request
ResponseObject response = WS.sendRequest(findTestObject('API/POST_Login'))

// Assert status code
WS.verifyResponseStatusCode(response, 200)

// Assert response body field
WS.verifyElementPropertyValue(response, 'data.token', GlobalVariable.expectedToken)

// Assert response time
assert response.waitingTime < 2000 : "Response too slow: ${response.waitingTime}ms"
\`\`\`

### Authentication Patterns

**Bearer Token:**
\`\`\`groovy
// In your API Helper keyword
String token = login(username, password)  // call login endpoint first
RequestObject req = findTestObject('API/GET_UserProfile')
req.setRestParameters([new TestObjectProperty('Authorization', 'Bearer ' + token, true)])
\`\`\`

**API Key:**
\`\`\`groovy
req.getHttpHeaders().add(new TestObjectProperty('x-api-key', GlobalVariable.apiKey, true))
\`\`\`

### Generating API Tests
Use the **API Generator tab** — paste:
- A Swagger/OpenAPI spec
- A Postman collection
- Or a cURL command

I'll generate complete Groovy test scripts with:
- Positive + negative scenarios
- Schema validation
- Auth handling
- Boundary tests`;
}

function projectReviewGuidance(): string {
  return `## How to Get a Full Project Review

To analyze your Katalon project, upload it here:

### Step 1 — Prepare your project
Export or ZIP your Katalon project folder (the one containing \`Test Cases/\`, \`Keywords/\`, \`Object Repository/\` folders).

### Step 2 — Upload
1. Go to **Project Intelligence** in the left nav
2. Click **Upload Project ZIP**
3. Wait for indexing (~15s)

### Step 3 — Run analysis
Once uploaded, I'll provide:
- **Health score** — overall framework quality
- **Flaky test risks** — tests likely to fail intermittently  
- **Unused assets** — dead code in Object Repository and Keywords
- **Weak assertions** — test cases with too few verifications
- **Coverage gaps** — missing negative/boundary scenarios
- **Architectural issues** — duplication, naming violations, coupling
- **Auto-fix suggestions** — I can apply fixes directly

**Already uploaded a project?** Select it from the context panel (top of this chat) and I'll run the analysis.`;
}

function performanceTestingResponse(): string {
  return `## Performance Test Strategy

### Test Types by Goal

| Type | Goal | Duration | Users |
|------|------|----------|-------|
| **Smoke** | Baseline — does it work? | 1–2 min | 1–5 |
| **Load** | Expected traffic | 10–30 min | target VUs |
| **Stress** | Breaking point | 30–60 min | 2–10× load |
| **Spike** | Sudden traffic burst | Short | 10× instant |
| **Soak** | Memory leaks, degradation | 2–8 hours | normal load |

### Generate a Performance Strategy

Use the **Performance tab** — provide:
- Swagger / OpenAPI spec, OR
- Postman collection, OR  
- Specific endpoint + method + payload

I'll generate:
- **k6 script** with staged ramp-up
- **JMeter test plan** (.jmx)
- **Load strategy** with VU counts and thresholds

### Key SLA Thresholds to Define
\`\`\`javascript
// k6 thresholds
thresholds: {
  http_req_duration: ['p95<500', 'p99<1000'],  // 95th percentile < 500ms
  http_req_failed: ['rate<0.01'],               // < 1% error rate
  http_reqs: ['rate>100'],                      // > 100 req/s
}
\`\`\`

**Paste your API spec or endpoint details to generate the full test.**`;
}

function whatIsKatalonResponse(msg: string): string {
  const lower = msg.toLowerCase();

  if (/\bpage.?object\b/i.test(lower)) {
    return `## What is a Page Object in Katalon?

A **Page Object** is a design pattern where each UI page is represented by a Groovy class. It encapsulates all elements and actions for that page.

\`\`\`groovy
package pages

class LoginPage {
  static void enterCredentials(String username, String password) {
    WebUI.setText(findTestObject('Page_Login/txt_Username'), username)
    WebUI.setText(findTestObject('Page_Login/txt_Password'), password)
  }

  static void clickLogin() {
    WebUI.waitForElementClickable(findTestObject('Page_Login/btn_Login'), 10)
    WebUI.click(findTestObject('Page_Login/btn_Login'))
  }

  static String getErrorMessage() {
    return WebUI.getText(findTestObject('Page_Login/lbl_Error'))
  }
}
\`\`\`

**Benefits:**
- Single place to update when UI changes
- Readable test scripts
- Reusable across multiple test cases

**Want me to generate one?** Tell me the page name and its elements.`;
  }

  if (/\bkeyword\b/i.test(lower)) {
    return `## What is a Custom Keyword in Katalon?

A **Custom Keyword** is a reusable Groovy method decorated with \`@Keyword\` that extends Katalon's built-in actions.

\`\`\`groovy
package common

import com.kms.katalon.core.annotation.Keyword
import com.kms.katalon.core.webui.keyword.WebUiBuiltInKeywords as WebUI

class CommonActions {
  @Keyword
  static void clickWithRetry(TestObject element, int maxRetries = 3) {
    int attempt = 0
    while (attempt < maxRetries) {
      try {
        WebUI.waitForElementClickable(element, 10)
        WebUI.click(element)
        return
      } catch (Exception e) {
        attempt++
        if (attempt == maxRetries) throw e
        WebUI.delay(1)
      }
    }
  }
}
\`\`\`

Once created, call it in any test: \`CustomKeywords.'common.CommonActions.clickWithRetry'(element)\`

**Want me to generate a specific keyword?** Describe what it should do.`;
  }

  if (/\btest.?suite\b/i.test(lower)) {
    return `## What is a Test Suite in Katalon?

A **Test Suite** is a collection of test cases that run together in a defined order.

**Types:**
- **Test Suite** — sequential list of test cases
- **Test Suite Collection** — runs multiple suites in parallel or series

**Best practices:**
- \`Smoke\` — 10–15 critical tests, runs on every deploy (<5 min)
- \`Regression\` — all tests, runs nightly
- \`API\` — API-only tests for fast feedback
- \`Module_Login\` — all tests for one feature area

**Parameterization:**  
Link an Execution Profile (dev/staging/prod) to each suite — no hardcoded URLs.`;
  }

  return `## Katalon Studio — Key Concepts

| Concept | Purpose |
|---------|---------|
| **Test Case** | Single automated scenario (a Groovy script) |
| **Test Suite** | Collection of test cases run together |
| **Object Repository** | Central store of UI element locators |
| **Custom Keyword** | Reusable \`@Keyword\` method (shared actions) |
| **Execution Profile** | Environment variables (URLs, credentials) |
| **Page Object** | Class encapsulating a page's elements + actions |
| **Test Listener** | Hooks for setup/teardown logic |
| **Data File** | External test data (CSV, Excel, DB) |

Ask me about any specific concept and I'll explain it with code examples.`;
}

function generalQaResponse(msg: string): string {
  return `I understand you're asking about: **"${msg.slice(0, 120)}${msg.length > 120 ? "…" : ""}"**

Here's how I can help:

**For code generation:**
- Describe what Groovy class/script/keyword you need
- I'll generate it immediately using the built-in compiler

**For QA questions:**
- Ask about test strategy, locators, flaky tests, CI/CD, API testing, or performance
- I have built-in knowledge on all Katalon + QA topics

**For project analysis:**
- Upload your Katalon ZIP via Project Intelligence
- I'll run a full health check

**Try asking:**
> "Create a custom keyword for retrying WebUI clicks"
> "How do I fix flaky tests?"  
> "What's the best locator strategy for dynamic tables?"
> "Generate a test strategy for an e-commerce app"`;
}

// ─── Generation confirmation ─────────────────────────────────────────────────

/** Brief acknowledgement shown when the compiler is already generating code. */
export function generationConfirmationResponse(message: string): string {
  const lower = message.toLowerCase();

  const type = /\bpage.?object\b/i.test(lower)
    ? "Page Object"
    : /\bcustom.?keyword\b/i.test(lower)
      ? "Custom Keyword"
      : /\bapi.?helper\b/i.test(lower)
        ? "API Helper"
        : /\bdb.?utility\b/i.test(lower)
          ? "DB Utility"
          : /\bframework.?helper\b/i.test(lower)
            ? "Framework Helper"
            : /\butility.?class\b/i.test(lower)
              ? "Utility Class"
              : "Test Script";

  // Extract subject from "generate X for <subject>"
  const subjectMatch = message.match(
    /(?:generate|create|write|build)\s+(?:a\s+)?(?:test\s+(?:script|case)|groovy|keyword|page\s*object|script)?\s*(?:for\s+|to\s+)?(.+)$/i
  );
  const subject = subjectMatch?.[1]?.trim();

  return `**Generating ${type}${subject ? ` — ${subject}` : ""}…**

The Katalon compiler is running. The generated Groovy will appear in the panel below. Copy it directly into Katalon Studio.`;
}

// ─── Main entry point ────────────────────────────────────────────────────────

export function respondWithBuiltInIntelligence(
  message: string,
  intent: WorkspaceIntent,
  _confidence: number
): string {
  const msg = message.trim();
  const lower = msg.toLowerCase();
  const arabic = isArabic(msg);

  // 1. Greetings
  if (isGreeting(msg)) {
    return greetingResponse(msg);
  }

  // 2. Flaky test questions
  if (mentionsFlakyTests(msg)) {
    return flakyTestResponse();
  }

  // 3. Locator / selector questions
  if (
    mentionsLocators(msg) &&
    (wantsExplanation(msg) || /\b(fix|broken|heal|best|strategy|priority|how)\b/i.test(lower))
  ) {
    return locatorResponse();
  }

  // 4. CI/CD
  if (mentionsCI(msg)) {
    return ciCdResponse();
  }

  // 5. Performance
  if (mentionsPerformance(msg) && !wantsGeneration(msg)) {
    return performanceTestingResponse();
  }

  // 6. API knowledge
  if (mentionsApi(msg) && wantsExplanation(msg) && !wantsGeneration(msg)) {
    return apiTestingResponse();
  }

  // 7. Test strategy / framework design
  if (mentionsTestStrategy(msg) || /\b(pyramid|architecture|framework design)\b/i.test(lower)) {
    return testStrategyResponse(msg);
  }

  // 8. Coverage questions
  if (mentionsCoverage(msg) && !wantsGeneration(msg)) {
    return coverageResponse();
  }

  // 9. Generation requests — guide to the generation flow
  if (wantsGeneration(msg) || intent === "generate") {
    return generationGuidanceResponse(msg);
  }

  // 10. Project review guidance
  if (mentionsProjectReview(msg) || intent === "analyze") {
    return projectReviewGuidance();
  }

  // 11. "What is" questions about Katalon concepts
  if (wantsExplanation(msg) && mentionsKatalon(msg)) {
    return whatIsKatalonResponse(msg);
  }

  // 12. Platform-specific questions
  if (asksAboutPlatform(msg)) {
    return testStrategyResponse(msg);
  }

  // 13. Arabic greeting / general
  if (arabic) {
    return `مرحباً! يمكنني مساعدتك في:

- **توليد Groovy** — صف ما تريد إنشاؤه
- **استراتيجية الاختبار** — تصميم إطار الاختبار
- **الاختبارات المتذبذبة** — تشخيص وإصلاح المشاكل
- **تحليل المشروع** — ارفع مشروع Katalon للمراجعة الكاملة
- **اختبار الـ API** — من Swagger أو cURL
- **اختبار الأداء** — JMeter و k6

ماذا تحتاج؟`;
  }

  // 14. Fallback — general guidance
  return generalQaResponse(msg);
}
