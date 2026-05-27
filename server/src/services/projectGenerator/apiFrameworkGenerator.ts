import type { ArchitecturePlan } from "./architectureEngine.js";
import type { GeneratedFile, GeneratedKeyword } from "./types.js";

export function generateApiFramework(plan: ArchitecturePlan): {
  files: GeneratedFile[];
  apis: GeneratedKeyword[];
} {
  if (!plan.includeApi) return { files: [], apis: [] };

  const root = plan.projectName;
  const files: GeneratedFile[] = [];
  const apis: GeneratedKeyword[] = [];

  const authManager = `package api

import com.kms.katalon.core.webservice.keyword.WSBuiltInKeywords as WS
import internal.GlobalVariable as GlobalVariable

/**
 * Auth manager — token lifecycle for REST/GraphQL APIs.
 */
class AuthManager {
    static String bearerToken

    static void login(String username, String password) {
        def response = WS.sendRequest(findTestObject('Object Repository/API/Auth_Login'))
        bearerToken = WS.getResponseHeader(response, 'Authorization') ?: ''
    }

    static Map authHeaders() {
        return bearerToken ? [('Authorization'): 'Bearer ' + bearerToken] : [:]
    }
}
`;

  const requestBuilder = `package api

class RequestBuilder {
    static Map jsonBody(Map payload) {
        return [('Content-Type'): 'application/json', ('body'): groovy.json.JsonOutput.toJson(payload)]
    }

    static String buildPath(String resource, Map query = [:]) {
        if (query.isEmpty()) return resource
        return resource + '?' + query.collect { k, v -> k + '=' + URLEncoder.encode(String.valueOf(v), 'UTF-8') }.join('&')
    }
}
`;

  const schemaValidator = `package api

class SchemaValidator {
    static void assertJsonHasKeys(def json, List<String> requiredKeys) {
        requiredKeys.each { key ->
            assert json.containsKey(key) : "Missing key: " + key
        }
    }
}
`;

  const apiClient = `package api

import com.kms.katalon.core.webservice.keyword.WSBuiltInKeywords as WS

class RestApiClient {
    static def get(String path, Map headers = [:]) {
        def req = findTestObject('Object Repository/API/REST_Client')
        return WS.sendRequest(req)
    }

    static def post(String path, Map body, Map headers = [:]) {
        def req = findTestObject('Object Repository/API/REST_Client')
        return WS.sendRequest(req)
    }
}
`;

  const defs = [
    { name: "AuthManager.groovy", content: authManager, kw: "AuthManager", cat: "auth" as const },
    { name: "RequestBuilder.groovy", content: requestBuilder, kw: "RequestBuilder", cat: "api" as const },
    { name: "SchemaValidator.groovy", content: schemaValidator, kw: "SchemaValidator", cat: "api" as const },
    { name: "RestApiClient.groovy", content: apiClient, kw: "RestApiClient", cat: "api" as const },
  ];

  for (const d of defs) {
    files.push({
      path: `${root}/api/${d.name}`,
      kind: "api",
      content: d.content,
      summary: `API framework: ${d.kw}`,
    });
    apis.push({ name: d.kw, path: `api/${d.name}`, category: d.cat });
  }

  files.push({
    path: `${root}/Object Repository/API/REST_Client.rs`,
    kind: "or",
    content: `<?xml version="1.0" encoding="UTF-8"?>
<WebServiceRequestEntity>
  <description>Generic REST client template</description>
  <name>REST_Client</name>
  <restUrl>${"${GlobalVariable.apiBaseUrl}"}/</restUrl>
  <httpMethod>GET</httpMethod>
</WebServiceRequestEntity>
`,
    summary: "REST request template",
  });

  for (const mod of plan.modules.filter((m) => m.toLowerCase().includes("api") || m === "Auth" || m === "Payments" || m === "Orders")) {
    files.push({
      path: `${root}/Test Cases/API/TC_${mod}_Smoke.groovy`,
      kind: "script",
      content: `import api.RestApiClient
import api.AuthManager
import api.SchemaValidator

AuthManager.login('user@example.com', 'secret')
def response = RestApiClient.get('/${mod.toLowerCase()}', AuthManager.authHeaders())
SchemaValidator.assertJsonHasKeys([:], ['status'])
`,
      summary: `API smoke for ${mod}`,
    });
  }

  return { files, apis };
}
