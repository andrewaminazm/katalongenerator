import { FieldBlock } from "../../FieldTip";
import { useAIApiGenerator } from "./AIApiGeneratorContext";

export function EndpointInput() {
  const {
    endpointMethod,
    setEndpointMethod,
    endpointPath,
    setEndpointPath,
    endpointUrl,
    setEndpointUrl,
    requestJson,
    setRequestJson,
    responseJson,
    setResponseJson,
    testCaseName,
    setTestCaseName,
  } = useAIApiGenerator();

  return (
    <div className="stack">
      <FieldBlock tip="Optional suite name used in generated Groovy comments." label="Test name" htmlFor="api-test-name">
        <input
          id="api-test-name"
          className="input"
          value={testCaseName}
          onChange={(e) => setTestCaseName(e.target.value)}
        />
      </FieldBlock>
      <div className="row-2">
        <FieldBlock tip="HTTP method" label="Method" htmlFor="api-method">
          <select
            id="api-method"
            className="input"
            value={endpointMethod}
            onChange={(e) => setEndpointMethod(e.target.value)}
          >
            {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </FieldBlock>
        <FieldBlock tip="Path only, e.g. /login" label="Path" htmlFor="api-path">
          <input
            id="api-path"
            className="input"
            value={endpointPath}
            onChange={(e) => setEndpointPath(e.target.value)}
            dir="ltr"
          />
        </FieldBlock>
      </div>
      <FieldBlock tip="Optional full URL instead of path" label="URL (optional)" htmlFor="api-url">
        <input
          id="api-url"
          className="input"
          value={endpointUrl}
          onChange={(e) => setEndpointUrl(e.target.value)}
          placeholder="https://api.example.com/login"
          dir="ltr"
        />
      </FieldBlock>
      <FieldBlock tip="Example request JSON for payload and negative/boundary tests" label="Request JSON" htmlFor="api-req">
        <textarea
          id="api-req"
          className="input"
          value={requestJson}
          onChange={(e) => setRequestJson(e.target.value)}
          spellCheck={false}
          dir="ltr"
        />
      </FieldBlock>
      <FieldBlock tip="Example response JSON for schema assertions" label="Response JSON" htmlFor="api-res">
        <textarea
          id="api-res"
          className="input"
          value={responseJson}
          onChange={(e) => setResponseJson(e.target.value)}
          spellCheck={false}
          dir="ltr"
        />
      </FieldBlock>
    </div>
  );
}
