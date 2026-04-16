import { convertCommandsToMobileArtifacts } from "../src/services/mobile/appiumRecordProxy.js";

const cmds = [
  {
    ts: 1,
    method: "POST",
    path: "/session/abc/element",
    bodyJson: { using: "id", value: "com.app:id/login" },
    responseJson: { value: { "element-6066-11e4-a52e-4f735466cecf": "E1" } },
  },
  { ts: 2, method: "POST", path: "/session/abc/element/E1/click", bodyJson: {}, responseJson: { value: null } },
  {
    ts: 3,
    method: "POST",
    path: "/session/abc/element",
    bodyJson: { using: "accessibility id", value: "username" },
    responseJson: { value: { ELEMENT: "E2" } },
  },
  { ts: 4, method: "POST", path: "/session/abc/element/E2/value", bodyJson: { text: "john" }, responseJson: { value: null } },
] as any;

console.log(convertCommandsToMobileArtifacts(cmds));

