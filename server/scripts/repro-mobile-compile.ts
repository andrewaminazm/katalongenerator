import { compileKatalonScript } from "../src/services/katalonCompiler/index.js";

const r1 = compileKatalonScript({
  platform: "mobile",
  testCaseName: "TC_Mobile_Smoke",
  steps: ["tap login", 'type username "john"'],
  locatorsText: "Login = resource-id=com.app:id/login\nUsername = accessibility id = username",
});

console.log("=== case 1 (ok) ===");
console.log("validationErrors:", r1.validationErrors);
console.log(r1.code.split("\n").slice(0, 80).join("\n"));

const r2 = compileKatalonScript({
  platform: "mobile",
  testCaseName: "TC_Mobile_MissingValue",
  steps: ["tap login", "type username"],
  locatorsText: "Login = resource-id=com.app:id/login\nUsername = accessibility id = username",
});

console.log("\n=== case 2 (missing value) ===");
console.log("validationErrors:", r2.validationErrors);
console.log(r2.code.split("\n").slice(0, 40).join("\n"));

