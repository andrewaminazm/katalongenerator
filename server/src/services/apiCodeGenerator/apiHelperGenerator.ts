import type { AuthType } from "./types.js";
import type { GeneratedGroovyFile } from "./types.js";

const KEYWORD_PKG = "Keywords.api";

function file(path: string, content: string): GeneratedGroovyFile {
  return { path, kind: "keyword", content };
}

export function generateApiPayloadBuilder(): GeneratedGroovyFile {
  return file(
    `${KEYWORD_PKG}/ApiPayloadBuilder.groovy`,
    [
      "package api",
      "",
      "import com.kms.katalon.core.testobject.RequestObject",
      "import com.kms.katalon.core.testobject.impl.HttpTextBodyContent",
      "import groovy.json.JsonOutput",
      "",
      "/** Clone-safe JSON body attachment — always pass a fresh RequestObject from ApiRequestBuilder.prepare */",
      "class ApiPayloadBuilder {",
      "",
      "    static RequestObject withBody(RequestObject request, Map payload) {",
      "        request.setBodyContent(",
      "            new HttpTextBodyContent(",
      "                JsonOutput.toJson(payload),",
      '                "UTF-8",',
      '                "application/json"',
      "            )",
      "        )",
      "        return request",
      "    }",
      "",
      "    static RequestObject withRawBody(RequestObject request, String rawJson) {",
      "        request.setBodyContent(",
      "            new HttpTextBodyContent(rawJson, \"UTF-8\", \"application/json\")",
      "        )",
      "        return request",
      "    }",
      "}",
    ].join("\n")
  );
}

export function generateApiRequestBuilder(): GeneratedGroovyFile {
  return file(
    `${KEYWORD_PKG}/ApiRequestBuilder.groovy`,
    [
      "package api",
      "",
      "import com.kms.katalon.core.testobject.RequestObject",
      "import com.kms.katalon.core.webservice.keyword.WSBuiltInKeywords as WS",
      "import com.kms.katalon.core.model.FailureHandling",
      "import static com.kms.katalon.core.testobject.ObjectRepository.findTestObject",
      "",
      "class ApiRequestBuilder {",
      "",
      "    /** Fresh RequestObject instance — avoids mutating a shared template */",
      "    static RequestObject prepare(String objectRepositoryPath) {",
      "        return findTestObject(objectRepositoryPath)",
      "    }",
      "",
      "    static def send(RequestObject request, int expectedStatus = 200) {",
      "        def response = WS.sendRequest(request, FailureHandling.STOP_ON_FAILURE)",
      "        WS.verifyResponseStatusCode(response, expectedStatus)",
      "        return response",
      "    }",
      "",
      "    static def sendExpecting(RequestObject request, List<Integer> allowedStatuses) {",
      "        def response = WS.sendRequest(request, FailureHandling.CONTINUE_ON_FAILURE)",
      "        assert allowedStatuses.contains(response.getStatusCode()) :",
      "            \"Unexpected status ${response.getStatusCode()}, expected one of ${allowedStatuses}\"",
      "        return response",
      "    }",
      "}",
    ].join("\n")
  );
}

export function generateResponseValidator(): GeneratedGroovyFile {
  return file(
    `${KEYWORD_PKG}/ResponseValidator.groovy`,
    [
      "package api",
      "",
      "import com.kms.katalon.core.webservice.keyword.WSBuiltInKeywords as WS",
      "",
      "class ResponseValidator {",
      "",
      "    static void assertStatus(def response, int expectedCode) {",
      "        WS.verifyResponseStatusCode(response, expectedCode)",
      "    }",
      "",
      "    static void assertJsonField(def response, String jsonPath, def expected) {",
      "        WS.verifyElementPropertyValue(response, jsonPath, expected)",
      "    }",
      "",
      "    static void validateRequiredFields(def response, List<String> fields) {",
      "        for (String field : fields) {",
      "            def value = response.getPropertyValue(field)",
      "            assert value != null : \"Missing required response field: ${field}\"",
      "            WS.verifyElementPropertyValue(response, field, value)",
      "        }",
      "    }",
      "",
      "    static void validateFieldType(def response, String field, Class expectedType) {",
      "        def value = response.getPropertyValue(field)",
      "        assert value != null : \"Field ${field} is null\"",
      "        assert expectedType.isInstance(value) || value.getClass().name.contains(expectedType.simpleName) :",
      "            \"Field ${field} type mismatch\"",
      "    }",
      "",
      "    static void assertResponseTime(def response, int maxMs) {",
      "        WS.verifyResponseTime(response, maxMs)",
      "    }",
      "}",
    ].join("\n")
  );
}

export function generateTokenManagerHelper(auth: AuthType): GeneratedGroovyFile {
  const lines = [
    "package api",
    "",
    "import com.kms.katalon.core.testobject.RequestObject",
    "import com.kms.katalon.core.webservice.keyword.WSBuiltInKeywords as WS",
    "import com.kms.katalon.core.model.FailureHandling",
    "import static com.kms.katalon.core.testobject.ObjectRepository.findTestObject",
    "import internal.GlobalVariable as GlobalVariable",
    "",
    "/** Auth via profiles / GlobalVariable — never hardcode secrets */",
    "class TokenManager {",
    "",
  ];

  if (auth === "bearer" || auth === "jwt") {
    lines.push(
      "    static String getBearerToken() {",
      "        if (GlobalVariable.apiToken) return GlobalVariable.apiToken.toString()",
      "        RequestObject auth = findTestObject('Object Repository/API/Auth_Token')",
      "        def response = WS.sendRequest(auth, FailureHandling.STOP_ON_FAILURE)",
      "        WS.verifyResponseStatusCode(response, 200)",
      "        String token = response.getPropertyValue('token') ?: response.getPropertyValue('access_token')",
      "        assert token : 'Auth response did not return a token'",
      "        GlobalVariable.apiToken = token",
      "        return token",
      "    }",
      ""
    );
  } else if (auth === "basic") {
    lines.push(
      "    static String getBasicAuthHeader() {",
      "        String user = GlobalVariable.apiUser?.toString() ?: ''",
      "        String pass = GlobalVariable.apiPassword?.toString() ?: ''",
      "        assert user && pass : 'Set GlobalVariable.apiUser and apiPassword in profile'",
      "        return 'Basic ' + (user + ':' + pass).bytes.encodeBase64().toString()",
      "    }",
      ""
    );
  } else if (auth === "apiKey") {
    lines.push(
      "    static String getApiKey() {",
      "        String key = GlobalVariable.apiKey?.toString() ?: ''",
      "        assert key : 'Set GlobalVariable.apiKey in execution profile'",
      "        return key",
      "    }",
      ""
    );
  } else {
    lines.push("    // No auth scheme detected in API spec", "");
  }

  lines.push("}");
  return file(`${KEYWORD_PKG}/TokenManager.groovy`, lines.join("\n"));
}

export function generateApiRetryHelper(): GeneratedGroovyFile {
  return file(
    `${KEYWORD_PKG}/ApiRetryHelper.groovy`,
    [
      "package api",
      "",
      "import com.kms.katalon.core.testobject.RequestObject",
      "import com.kms.katalon.core.webservice.keyword.WSBuiltInKeywords as WS",
      "import com.kms.katalon.core.model.FailureHandling",
      "",
      "class ApiRetryHelper {",
      "    static def sendWithRetry(RequestObject request, int attempts = 3) {",
      "        def last",
      "        for (int i = 0; i < attempts; i++) {",
      "            last = WS.sendRequest(request, FailureHandling.CONTINUE_ON_FAILURE)",
      "            if (last.getStatusCode() < 500) return last",
      "        }",
      "        return last",
      "    }",
      "}",
    ].join("\n")
  );
}

export function generateAllHelperFiles(auth: AuthType): GeneratedGroovyFile[] {
  return [
    generateApiPayloadBuilder(),
    generateApiRequestBuilder(),
    generateResponseValidator(),
    generateTokenManagerHelper(auth),
    generateApiRetryHelper(),
  ];
}
