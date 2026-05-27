import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  generateApiFromCurl,
  generateApiFromEndpoint,
  generateApiFromPostman,
  generateApiFromSwagger,
  generatePostmanCollection,
  type ApiCodegenResult,
  type PostmanGeneratePayload,
  type PostmanGenerateResult,
} from "../../api";

export type ApiInputMode = "swagger" | "postman" | "endpoint" | "curl";

type AIApiGeneratorContextValue = {
  inputMode: ApiInputMode;
  setInputMode: (m: ApiInputMode) => void;
  swaggerText: string;
  setSwaggerText: (v: string) => void;
  postmanText: string;
  setPostmanText: (v: string) => void;
  curlText: string;
  setCurlText: (v: string) => void;
  endpointMethod: string;
  setEndpointMethod: (v: string) => void;
  endpointPath: string;
  setEndpointPath: (v: string) => void;
  endpointUrl: string;
  setEndpointUrl: (v: string) => void;
  requestJson: string;
  setRequestJson: (v: string) => void;
  responseJson: string;
  setResponseJson: (v: string) => void;
  testCaseName: string;
  setTestCaseName: (v: string) => void;
  loading: boolean;
  postmanLoading: boolean;
  error: string | null;
  result: ApiCodegenResult | null;
  postmanResult: PostmanGenerateResult | null;
  onGenerate: () => Promise<void>;
  onGeneratePostman: () => Promise<void>;
  onClear: () => void;
};

const AIApiGeneratorContext = createContext<AIApiGeneratorContextValue | null>(null);

export function useAIApiGenerator(): AIApiGeneratorContextValue {
  const ctx = useContext(AIApiGeneratorContext);
  if (!ctx) throw new Error("useAIApiGenerator requires AIApiGeneratorProvider");
  return ctx;
}

export function AIApiGeneratorProvider({
  children,
  activeProjectId,
  aiMemoryMode,
}: {
  children: ReactNode;
  activeProjectId: string | null;
  aiMemoryMode?: string;
}) {
  const [inputMode, setInputMode] = useState<ApiInputMode>("endpoint");
  const [swaggerText, setSwaggerText] = useState("");
  const [postmanText, setPostmanText] = useState("");
  const [curlText, setCurlText] = useState("");
  const [endpointMethod, setEndpointMethod] = useState("POST");
  const [endpointPath, setEndpointPath] = useState("/login");
  const [endpointUrl, setEndpointUrl] = useState("");
  const [requestJson, setRequestJson] = useState("");
  const [responseJson, setResponseJson] = useState("");
  const [testCaseName, setTestCaseName] = useState("ApiLoginFlow");
  const [loading, setLoading] = useState(false);
  const [postmanLoading, setPostmanLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ApiCodegenResult | null>(null);
  const [postmanResult, setPostmanResult] = useState<PostmanGenerateResult | null>(null);

  const basePayload = useCallback(
    () => ({
      projectId: activeProjectId ?? undefined,
      testCaseName: testCaseName.trim() || undefined,
      aiMemoryMode,
      aiMemoryEnabled: aiMemoryMode !== "disabled" && Boolean(activeProjectId),
      includeNegative: true,
      includeBoundary: true,
      includeHelpers: true,
      generatedApiFlow: true,
    }),
    [activeProjectId, testCaseName, aiMemoryMode]
  );

  const buildPostmanPayload = useCallback((): PostmanGeneratePayload => {
    const base = basePayload();
    if (inputMode === "swagger") {
      return { ...base, inputType: "swagger", spec: swaggerText, swagger: swaggerText };
    }
    if (inputMode === "postman") {
      return { ...base, inputType: "postman", collection: postmanText };
    }
    if (inputMode === "curl") {
      return { ...base, inputType: "curl", curl: curlText };
    }
    return {
      ...base,
      inputType: "endpoint",
      method: endpointMethod,
      path: endpointPath,
      url: endpointUrl || undefined,
      requestJson,
      responseJson,
    };
  }, [
    basePayload,
    inputMode,
    swaggerText,
    postmanText,
    curlText,
    endpointMethod,
    endpointPath,
    endpointUrl,
    requestJson,
    responseJson,
  ]);

  const validateInput = useCallback(() => {
    if (inputMode === "swagger" && !swaggerText.trim()) {
      throw new Error("Paste Swagger or OpenAPI JSON or YAML");
    }
    if (inputMode === "postman" && !postmanText.trim()) {
      throw new Error("Paste Postman collection JSON or use another input tab");
    }
    if (inputMode === "curl" && !curlText.trim()) {
      throw new Error("Paste a cURL command");
    }
    if (inputMode === "endpoint" && !endpointPath.trim() && !endpointUrl.trim()) {
      throw new Error("Provide endpoint path or URL");
    }
  }, [inputMode, swaggerText, postmanText, curlText, endpointPath, endpointUrl]);

  const onGenerate = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      validateInput();
      let out: ApiCodegenResult;
      const base = basePayload();
      if (inputMode === "swagger") {
        out = await generateApiFromSwagger({ ...base, spec: swaggerText });
      } else if (inputMode === "postman") {
        out = await generateApiFromPostman({ ...base, collection: postmanText });
      } else if (inputMode === "curl") {
        out = await generateApiFromCurl({ ...base, curl: curlText });
      } else {
        out = await generateApiFromEndpoint({
          ...base,
          method: endpointMethod,
          path: endpointPath,
          url: endpointUrl || undefined,
          requestJson,
          responseJson,
        });
      }
      setResult(out);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [
    validateInput,
    inputMode,
    swaggerText,
    postmanText,
    curlText,
    endpointMethod,
    endpointPath,
    endpointUrl,
    requestJson,
    responseJson,
    basePayload,
  ]);

  const onGeneratePostman = useCallback(async () => {
    setError(null);
    setPostmanLoading(true);
    try {
      validateInput();
      const out = await generatePostmanCollection(buildPostmanPayload());
      setPostmanResult(out);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPostmanResult(null);
    } finally {
      setPostmanLoading(false);
    }
  }, [validateInput, buildPostmanPayload]);

  const onClear = useCallback(() => {
    setSwaggerText("");
    setPostmanText("");
    setCurlText("");
    setRequestJson("");
    setResponseJson("");
    setError(null);
    setResult(null);
    setPostmanResult(null);
  }, []);

  const value = useMemo(
    () => ({
      inputMode,
      setInputMode,
      swaggerText,
      setSwaggerText,
      postmanText,
      setPostmanText,
      curlText,
      setCurlText,
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
      loading,
      postmanLoading,
      error,
      result,
      postmanResult,
      onGenerate,
      onGeneratePostman,
      onClear,
    }),
    [
      inputMode,
      swaggerText,
      postmanText,
      curlText,
      endpointMethod,
      endpointPath,
      endpointUrl,
      requestJson,
      responseJson,
      testCaseName,
      loading,
      postmanLoading,
      error,
      result,
      postmanResult,
      onGenerate,
      onGeneratePostman,
      onClear,
    ]
  );

  return <AIApiGeneratorContext.Provider value={value}>{children}</AIApiGeneratorContext.Provider>;
}
