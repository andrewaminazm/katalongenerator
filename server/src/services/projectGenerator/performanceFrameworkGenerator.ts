import type { ArchitecturePlan } from "./architectureEngine.js";
import type { GeneratedFile } from "./types.js";

export function generatePerformanceFramework(plan: ArchitecturePlan): GeneratedFile[] {
  if (!plan.includePerformance) return [];

  const root = plan.projectName;
  const files: GeneratedFile[] = [];

  files.push({
    path: `${root}/performance/k6/smoke.js`,
    kind: "performance",
    content: `import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 10,
  duration: '1m',
  thresholds: {
    http_req_duration: ['p(95)<800'],
  },
};

export default function () {
  const res = http.get(__ENV.BASE_URL || 'https://example.com');
  check(res, { 'status is 200': (r) => r.status === 200 });
  sleep(1);
}
`,
    summary: "k6 smoke profile",
  });

  files.push({
    path: `${root}/performance/jmeter/smoke.jmx`,
    kind: "performance",
    content: `<?xml version="1.0" encoding="UTF-8"?>
<jmeterTestPlan version="1.2">
  <hashTree>
    <TestPlan guiclass="TestPlanGui" testname="Smoke Plan">
      <stringProp name="TestPlan.comments">Generated performance scaffold</stringProp>
    </TestPlan>
  </hashTree>
</jmeterTestPlan>
`,
    summary: "JMeter smoke plan scaffold",
  });

  files.push({
    path: `${root}/performance/SLAUtils.groovy`,
    kind: "performance",
    content: `class SLAUtils {
    static void assertP95Below(long ms, long actual) {
        assert actual <= ms : "P95 \${actual}ms exceeds SLA \${ms}ms"
    }
}
`,
  });

  for (const profile of ["Smoke", "Baseline", "Stress"]) {
    files.push({
      path: `${root}/performance/profiles/${profile}.json`,
      kind: "performance",
      content: JSON.stringify(
        { profile, vus: profile === "Stress" ? 100 : 10, duration: "5m" },
        null,
        2
      ),
    });
  }

  return files;
}
