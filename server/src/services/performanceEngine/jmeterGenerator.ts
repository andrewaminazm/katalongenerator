import type { ClassifiedEndpoint, LoadModel } from "./types.js";
import { authEndpointFirst, buildCorrelationExtractors } from "./correlationEngine.js";
import { jmeterThreadParams } from "./loadModel.js";

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function hashTree(inner: string): string {
  return `<hashTree>${inner}</hashTree>`;
}

function resolveUrl(baseUrl: string, ep: ClassifiedEndpoint): string {
  const path = ep.pathTemplate ?? ep.path;
  if (path.startsWith("http")) return path;
  const origin = baseUrl.replace(/\/$/, "");
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}

function jsonBody(ep: ClassifiedEndpoint): string {
  if (!ep.requestBodyExample || !Object.keys(ep.requestBodyExample).length) return "";
  return JSON.stringify(ep.requestBodyExample);
}

function buildJsonExtractor(name: string, jsonPath: string, targetVar: string): string {
  return `<JSONPostProcessor guiclass="JSONPostProcessorGui" testclass="JSONPostProcessor" testname="${xmlEscape(name)}" enabled="true">
  <stringProp name="JSONPostProcessor.referenceNames">${xmlEscape(targetVar)}</stringProp>
  <stringProp name="JSONPostProcessor.jsonPathExprs">${xmlEscape(jsonPath)}</stringProp>
  <stringProp name="JSONPostProcessor.match_numbers">1</stringProp>
  <stringProp name="JSONPostProcessor.defaultValues">NOT_FOUND</stringProp>
</JSONPostProcessor>`;
}

function buildHttpSamplerBlock(ep: ClassifiedEndpoint, baseUrl: string, withExtractors: string): string {
  const url = resolveUrl(baseUrl, ep);
  const body = jsonBody(ep);
  const label = ep.businessAction ?? ep.name ?? `${ep.method} ${ep.path}`;

  const sampler = `<HTTPSamplerProxy guiclass="HttpTestSampleGui" testclass="HTTPSamplerProxy" testname="${xmlEscape(label)}" enabled="true">
  <stringProp name="HTTPSampler.domain"></stringProp>
  <stringProp name="HTTPSampler.port"></stringProp>
  <stringProp name="HTTPSampler.protocol"></stringProp>
  <stringProp name="HTTPSampler.path">${xmlEscape(url)}</stringProp>
  <stringProp name="HTTPSampler.method">${ep.method}</stringProp>
  <boolProp name="HTTPSampler.follow_redirects">true</boolProp>
  <boolProp name="HTTPSampler.use_keepalive">true</boolProp>
  <boolProp name="HTTPSampler.postBodyRaw">${body ? "true" : "false"}</boolProp>
  <elementProp name="HTTPsampler.Arguments" elementType="Arguments">
    <collectionProp name="Arguments.arguments">
      <elementProp name="" elementType="HTTPArgument">
        <boolProp name="HTTPArgument.always_encode">false</boolProp>
        <stringProp name="Argument.value">${xmlEscape(body)}</stringProp>
        <stringProp name="Argument.metadata">=</stringProp>
      </elementProp>
    </collectionProp>
  </elementProp>
</HTTPSamplerProxy>`;

  const assertion = `<ResponseAssertion guiclass="AssertionGui" testclass="ResponseAssertion" testname="Status ${ep.successStatus ?? 200}" enabled="true">
  <collectionProp name="Asserion.test_strings"><stringProp name="">${ep.successStatus ?? 200}</stringProp></collectionProp>
  <stringProp name="Assertion.test_field">Assertion.response_code</stringProp>
  <boolProp name="Assertion.assume_success">false</boolProp>
  <intProp name="Assertion.test_type">8</intProp>
</ResponseAssertion>`;

  const timer = `<UniformRandomTimer guiclass="UniformRandomTimerGui" testclass="UniformRandomTimer" testname="Think time" enabled="true">
  <stringProp name="ConstantTimer.delay">500</stringProp>
  <stringProp name="RandomTimer.range">300</stringProp>
</UniformRandomTimer>`;

  return hashTree(sampler + hashTree(assertion + timer + withExtractors));
}

export function generateJmeterPlan(
  suiteName: string,
  baseUrl: string,
  endpoints: ClassifiedEndpoint[],
  loadModel: LoadModel
): string {
  const ordered = authEndpointFirst(endpoints);
  const extractors = buildCorrelationExtractors(ordered);
  const { threads, rampSeconds, durationSeconds } = jmeterThreadParams(loadModel);

  let hostname = "localhost";
  let protocol = "https";
  try {
    const u = new URL(baseUrl.startsWith("http") ? baseUrl : `https://${baseUrl}`);
    hostname = u.hostname;
    protocol = u.protocol.replace(":", "");
  } catch {
    /* keep defaults */
  }

  const extractorXml = extractors.map((e) => buildJsonExtractor(e.name, e.jsonPath, e.targetVar)).join("");

  const samplerBlocks = ordered
    .map((ep, i) => buildHttpSamplerBlock(ep, baseUrl, i === 0 ? extractorXml : ""))
    .join("");

  const csvConfig = `<CSVDataSet guiclass="TestBeanGUI" testclass="CSVDataSet" testname="CSV Data — users" enabled="true">
  <stringProp name="filename">perf-users.csv</stringProp>
  <stringProp name="fileEncoding">UTF-8</stringProp>
  <stringProp name="variableNames">username,password</stringProp>
  <boolProp name="quotedData">true</boolProp>
  <boolProp name="recycle">true</boolProp>
  <stringProp name="shareMode">shareMode.all</stringProp>
</CSVDataSet>`;

  const headerMgr = `<HeaderManager guiclass="HeaderPanel" testclass="HeaderManager" testname="HTTP Headers" enabled="true">
  <collectionProp name="HeaderManager.headers">
    <elementProp name="" elementType="Header"><stringProp name="Header.name">Content-Type</stringProp><stringProp name="Header.value">application/json</stringProp></elementProp>
    <elementProp name="" elementType="Header"><stringProp name="Header.name">Accept</stringProp><stringProp name="Header.value">application/json</stringProp></elementProp>
    <elementProp name="" elementType="Header"><stringProp name="Header.name">Authorization</stringProp><stringProp name="Header.value">Bearer \${authToken}</stringProp></elementProp>
  </collectionProp>
</HeaderManager>`;

  const defaults = `<ConfigTestElement guiclass="HttpDefaultsGui" testclass="ConfigTestElement" testname="HTTP Request Defaults" enabled="true">
  <elementProp name="HTTPsampler.Arguments" elementType="Arguments"><collectionProp name="Arguments.arguments"/></elementProp>
  <stringProp name="HTTPSampler.domain">${xmlEscape(hostname)}</stringProp>
  <stringProp name="HTTPSampler.protocol">${protocol}</stringProp>
</ConfigTestElement>`;

  const threadGroup = `<ThreadGroup guiclass="ThreadGroupGui" testclass="ThreadGroup" testname="${xmlEscape(suiteName)} — ${loadModel.mode}" enabled="true">
  <stringProp name="ThreadGroup.on_sample_error">continue</stringProp>
  <elementProp name="ThreadGroup.main_controller" elementType="LoopController" guiclass="LoopControlPanel" testclass="LoopController" testname="Loop Controller" enabled="true">
    <boolProp name="LoopController.continue_forever">false</boolProp>
    <intProp name="LoopController.loops">-1</intProp>
  </elementProp>
  <stringProp name="ThreadGroup.num_threads">${threads}</stringProp>
  <stringProp name="ThreadGroup.ramp_time">${rampSeconds}</stringProp>
  <boolProp name="ThreadGroup.scheduler">true</boolProp>
  <stringProp name="ThreadGroup.duration">${durationSeconds}</stringProp>
  <boolProp name="ThreadGroup.same_user_on_next_iteration">true</boolProp>
</ThreadGroup>`;

  const threadChildren =
    hashTree(csvConfig) +
    hashTree(headerMgr) +
    samplerBlocks;

  return `<?xml version="1.0" encoding="UTF-8"?>
<jmeterTestPlan version="1.2" properties="5.0" jmeter="5.6.3">
  <hashTree>
    <TestPlan guiclass="TestPlanGui" testclass="TestPlan" testname="${xmlEscape(suiteName)}" enabled="true">
      <stringProp name="TestPlan.comments">Performance Test — ${loadModel.mode} — ${xmlEscape(baseUrl)}</stringProp>
      <boolProp name="TestPlan.functional_mode">false</boolProp>
      <boolProp name="TestPlan.serialize_threadgroups">false</boolProp>
      <elementProp name="TestPlan.user_defined_variables" elementType="Arguments">
        <collectionProp name="Arguments.arguments">
          <elementProp name="baseUrl" elementType="Argument"><stringProp name="Argument.name">baseUrl</stringProp><stringProp name="Argument.value">${xmlEscape(baseUrl)}</stringProp></elementProp>
        </collectionProp>
      </elementProp>
    </TestPlan>
    ${hashTree(defaults + hashTree("") + threadGroup + hashTree(threadChildren))}
  </hashTree>
</jmeterTestPlan>`;
}
