export type ChatExample = {
  id: string;
  label: string;
  prompt: string;
  /** Shown on hover — e.g. when context panel setup is needed */
  hint?: string;
};

export type ChatExampleCategory = {
  id: string;
  title: string;
  description: string;
  examples: ChatExample[];
};

/** Everything Test Architect Chat can help with — click to send. */
export const CHAT_EXAMPLE_CATEGORIES: ChatExampleCategory[] = [
  {
    id: "generate",
    title: "Katalon Groovy generation",
    description: "Say the output type in chat — test script, keyword, page object, helper, etc.",
    examples: [
      {
        id: "auto",
        label: "Auto detect",
        prompt: `Generate automation for login:
Open https://app.example.com/login
Enter username admin
Enter password secret
Click Sign in
Verify dashboard is displayed`,
      },
      {
        id: "test_script",
        label: "Test script",
        prompt: `Create a test script for login:
Open https://app.example.com/login
Enter username admin
Enter password secret
Click Sign in
Verify Welcome message is displayed`,
      },
      {
        id: "custom_keyword",
        label: "Custom keyword",
        prompt:
          "Generate a custom keyword for login that accepts username and password parameters, opens the login page, submits the form, and verifies the home page loads",
      },
      {
        id: "groovy_function",
        label: "Groovy function",
        prompt:
          "Create a groovy function for validating and formatting Saudi national ID numbers before entering them in a WebUI field",
      },
      {
        id: "utility_class",
        label: "Utility class",
        prompt:
          "Build a utility class for reading test data rows from Excel files and returning them as maps for Katalon test cases",
      },
      {
        id: "framework_helper",
        label: "Framework helper",
        prompt:
          "Generate a framework helper class for retrying flaky WebUI clicks up to 3 times with a short wait between attempts",
      },
      {
        id: "page_object",
        label: "Page object",
        prompt:
          "Create a page object for the login page with username field, password field, sign-in button, and error message label",
      },
      {
        id: "api_helper",
        label: "API helper",
        prompt:
          "Create an API helper for REST calls with bearer token authorization, JSON request bodies, and response status or body assertions",
      },
      {
        id: "db_utility",
        label: "DB utility",
        prompt:
          "Build a DB utility for connecting to Oracle, running a SELECT query by user email, and returning the result row as a map",
      },
      {
        id: "framework_service",
        label: "Framework service",
        prompt:
          "Generate a framework service class for storing and retrieving test session tokens and user context across test cases in a Katalon suite",
      },
    ],
  },
  {
    id: "analyze",
    title: "Project analysis",
    description: "Select your active project in the context panel first.",
    examples: [
      {
        id: "review-project",
        label: "Full project review",
        prompt: "Review my project for risks, flaky tests, weak assertions, and coverage gaps.",
        hint: "Select active project in context panel",
      },
      {
        id: "risk-modules",
        label: "Release risk",
        prompt: "Analyze my active project — which modules have the highest release risk and why?",
        hint: "Select active project in context panel",
      },
      {
        id: "flaky-scan",
        label: "Flaky test scan",
        prompt: "Check my project for flaky tests and suggest stabilization priorities.",
        hint: "Select active project in context panel",
      },
    ],
  },
  {
    id: "document",
    title: "Documentation",
    description: "Project docs markdown attached when a project is selected.",
    examples: [
      {
        id: "gen-docs",
        label: "Project documentation",
        prompt:
          "Generate project documentation for my active Katalon project — structure, keywords, test coverage summary, and onboarding notes.",
        hint: "Select active project in context panel",
      },
    ],
  },
  {
    id: "api",
    title: "API testing",
    description: "API scenario design and assertion guidance.",
    examples: [
      {
        id: "api-negative",
        label: "API negative tests",
        prompt:
          "Help me design negative API test scenarios for login — invalid credentials, expired token, missing fields, and rate limiting.",
      },
      {
        id: "api-assertions",
        label: "REST assertions",
        prompt:
          "What assertions should I add for a REST create-user endpoint — status codes, schema, headers, and idempotency?",
      },
      {
        id: "api-chain",
        label: "Chained API flow",
        prompt:
          "Design an API test flow: authenticate, create order, verify order status, then cancel — with data dependencies between steps.",
      },
    ],
  },
  {
    id: "performance",
    title: "Performance testing",
    description: "Paste OpenAPI or Postman JSON in the context panel for load strategy + k6 output.",
    examples: [
      {
        id: "perf-smoke",
        label: "Smoke load strategy",
        prompt:
          "Generate a smoke load test strategy for my payment and checkout APIs — target RPS, duration, and pass/fail thresholds.",
        hint: "Paste Swagger or Postman in context panel",
      },
      {
        id: "perf-k6",
        label: "k6 starter",
        prompt:
          "Create a k6 starter script for a login API smoke test with think time and status checks.",
        hint: "Paste Swagger or Postman in context panel",
      },
    ],
  },
  {
    id: "convert",
    title: "Migration & conversion",
    description: "Postman, Swagger, and Katalon structure guidance.",
    examples: [
      {
        id: "postman-convert",
        label: "Postman → Katalon",
        prompt:
          "How should I convert my Postman collection into Katalon API tests — folders, variables, and assertion mapping?",
      },
      {
        id: "openapi-import",
        label: "OpenAPI import",
        prompt:
          "Explain the best way to import OpenAPI specs into Katalon and organize generated API test cases.",
      },
    ],
  },
  {
    id: "review",
    title: "Automation review",
    description: "Framework quality, patterns, and maintainability.",
    examples: [
      {
        id: "framework-review",
        label: "Framework review",
        prompt:
          "Review my automation approach — are we overusing custom keywords vs page objects? What would you change?",
      },
      {
        id: "assertion-review",
        label: "Weak assertions",
        prompt:
          "How do I find and fix weak assertions in my suite — tests that pass but don't validate behavior?",
      },
    ],
  },
  {
    id: "optimize",
    title: "Framework optimization",
    description: "Refactoring and reuse recommendations.",
    examples: [
      {
        id: "dedupe-login",
        label: "Reduce duplication",
        prompt:
          "How can I refactor duplicated login steps across 20 test cases without breaking maintainability?",
      },
      {
        id: "wait-strategy",
        label: "Wait strategy",
        prompt:
          "Recommend a wait and synchronization strategy for our WebUI tests to reduce flakiness without hard sleeps everywhere.",
      },
    ],
  },
  {
    id: "heal",
    title: "Locator healing & failures",
    description: "Broken locators, healing, and failure analysis.",
    examples: [
      {
        id: "heal-locator",
        label: "Broken locator",
        prompt:
          "My click step fails because the button locator changed — suggest a healing approach and more resilient locator strategy.",
      },
      {
        id: "failure-root-cause",
        label: "Failure analysis",
        prompt:
          "Help me analyze a failed test: element not found on checkout submit — is it locator, timing, or environment?",
      },
    ],
  },
  {
    id: "arabic",
    title: "Arabic (العربية)",
    description: "Same capabilities in Arabic plain text.",
    examples: [
      {
        id: "ar-design",
        label: "تصميم اختبار",
        prompt:
          "ساعدني في تصميم حالات اختبار لتسجيل الدخول — إيجابية وسلبية وحالات حدودية قبل الأتمتة",
      },
      {
        id: "ar-review",
        label: "مراجعة المشروع",
        prompt: "راجع مشروعي وابحث عن الاختبارات غير المستقرة ومخاطر الإصدار",
        hint: "اختر المشروع من لوحة السياق",
      },
      {
        id: "ar-page-object",
        label: "Page object",
        prompt:
          "أنشئ page object لصفحة تسجيل الدخول — حقل اسم المستخدم، كلمة المرور، زر الدخول، ورسالة الخطأ",
      },
      {
        id: "ar-script",
        label: "سكربت اختبار",
        prompt: `أنشئ test script لتسجيل الدخول:
افتح https://app.example.com/login
أدخل اسم المستخدم admin
أدخل كلمة المرور secret
اضغط تسجيل الدخول
تحقق من ظهور لوحة التحكم`,
      },
    ],
  },
  {
    id: "conversation",
    title: "Long conversations",
    description: "Start with a topic, then follow up naturally — Gosi Brain remembers context.",
    examples: [
      {
        id: "conv-starter",
        label: "Start a thread",
        prompt: "Help me automate login — I'll provide URL and locators step by step.",
      },
      {
        id: "conv-follow-negative",
        label: "Follow-up: negative cases",
        prompt: "What about negative cases and invalid password scenarios?",
        hint: "Send after a login discussion — or start fresh with the starter above first",
      },
      {
        id: "conv-follow-generate",
        label: "Follow-up: generate now",
        prompt: `Yes, generate the test script now:
Open https://app.example.com/login
Enter username test@example.com
Enter password WrongPass1
Click Sign in
Verify error message Invalid credentials`,
        hint: "Works best after you already discussed login scope in the same chat",
      },
    ],
  },
];

/** Flat list for tests or search */
export const ALL_CHAT_EXAMPLES: ChatExample[] = CHAT_EXAMPLE_CATEGORIES.flatMap(
  (c) => c.examples
);
