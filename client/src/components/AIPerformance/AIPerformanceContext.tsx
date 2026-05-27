import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  generatePerformanceSuite,
  type PerformanceGeneratePayload,
  type PerformanceGenerateResult,
  type PerformanceMode,
} from "../../api";

export type PerfInputMode = "swagger" | "postman" | "endpoint" | "curl";
export type PerfEnvironment = "local" | "qa" | "staging" | "production";

type AIPerformanceContextValue = {
  inputMode: PerfInputMode;
  setInputMode: (m: PerfInputMode) => void;
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
  suiteName: string;
  setSuiteName: (v: string) => void;
  mode: PerformanceMode;
  setMode: (m: PerformanceMode) => void;
  vus: number;
  setVus: (n: number) => void;
  duration: string;
  setDuration: (v: string) => void;
  rampUp: string;
  setRampUp: (v: string) => void;
  environment: PerfEnvironment;
  setEnvironment: (e: PerfEnvironment) => void;
  baseUrl: string;
  setBaseUrl: (v: string) => void;
  useProjectApis: boolean;
  setUseProjectApis: (v: boolean) => void;
  loading: boolean;
  error: string | null;
  result: PerformanceGenerateResult | null;
  onGenerateJmeter: () => Promise<void>;
  onGenerateK6: () => Promise<void>;
  onGenerateFull: () => Promise<void>;
  onConvertPostman: () => Promise<void>;
  onClear: () => void;
};

const AIPerformanceContext = createContext<AIPerformanceContextValue | null>(null);

export function useAIPerformance(): AIPerformanceContextValue {
  const ctx = useContext(AIPerformanceContext);
  if (!ctx) throw new Error("useAIPerformance requires AIPerformanceProvider");
  return ctx;
}

export function AIPerformanceProvider({
  children,
  activeProjectId,
}: {
  children: ReactNode;
  activeProjectId: string | null;
}) {
  const [inputMode, setInputMode] = useState<PerfInputMode>("endpoint");
  const [swaggerText, setSwaggerText] = useState("");
  const [postmanText, setPostmanText] = useState("");
  const [curlText, setCurlText] = useState("");
  const [endpointMethod, setEndpointMethod] = useState("POST");
  const [endpointPath, setEndpointPath] = useState("/login");
  const [endpointUrl, setEndpointUrl] = useState("");
  const [requestJson, setRequestJson] = useState("");
  const [responseJson, setResponseJson] = useState("");
  const [suiteName, setSuiteName] = useState("PerfSuite");
  const [mode, setMode] = useState<PerformanceMode>("baseline");
  const [vus, setVus] = useState(10);
  const [duration, setDuration] = useState("5m");
  const [rampUp, setRampUp] = useState("30s");
  const [environment, setEnvironment] = useState<PerfEnvironment>("qa");
  const [baseUrl, setBaseUrl] = useState("");
  const [useProjectApis, setUseProjectApis] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PerformanceGenerateResult | null>(null);

  const buildPayload = useCallback(
    (output?: PerformanceGeneratePayload["output"]): PerformanceGeneratePayload => {
      const config = {
        vus,
        duration,
        rampUp,
        environment,
        baseUrl: baseUrl.trim() || undefined,
      };
      const base = {
        projectId: activeProjectId ?? undefined,
        testCaseName: suiteName.trim() || undefined,
        mode,
        config,
        useProjectApis: useProjectApis && Boolean(activeProjectId),
        output,
      };
      if (inputMode === "swagger") {
        return { ...base, inputType: "openapi", spec: swaggerText, swagger: swaggerText };
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
    },
    [
      activeProjectId,
      baseUrl,
      curlText,
      duration,
      endpointMethod,
      endpointPath,
      endpointUrl,
      environment,
      inputMode,
      mode,
      postmanText,
      rampUp,
      requestJson,
      responseJson,
      suiteName,
      swaggerText,
      useProjectApis,
      vus,
    ]
  );

  const runGenerate = useCallback(
    async (output?: PerformanceGeneratePayload["output"]) => {
      setLoading(true);
      setError(null);
      try {
        const data = await generatePerformanceSuite(buildPayload(output));
        setResult(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setResult(null);
      } finally {
        setLoading(false);
      }
    },
    [buildPayload]
  );

  const onGenerateJmeter = useCallback(() => runGenerate(["jmeter", "strategy"]), [runGenerate]);
  const onGenerateK6 = useCallback(() => runGenerate(["k6", "strategy"]), [runGenerate]);
  const onGenerateFull = useCallback(() => runGenerate(undefined), [runGenerate]);
  const onConvertPostman = useCallback(() => {
    setInputMode("postman");
    return runGenerate(undefined);
  }, [runGenerate]);

  const onClear = useCallback(() => {
    setSwaggerText("");
    setPostmanText("");
    setCurlText("");
    setError(null);
    setResult(null);
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
      suiteName,
      setSuiteName,
      mode,
      setMode,
      vus,
      setVus,
      duration,
      setDuration,
      rampUp,
      setRampUp,
      environment,
      setEnvironment,
      baseUrl,
      setBaseUrl,
      useProjectApis,
      setUseProjectApis,
      loading,
      error,
      result,
      onGenerateJmeter,
      onGenerateK6,
      onGenerateFull,
      onConvertPostman,
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
      suiteName,
      mode,
      vus,
      duration,
      rampUp,
      environment,
      baseUrl,
      useProjectApis,
      loading,
      error,
      result,
      onGenerateJmeter,
      onGenerateK6,
      onGenerateFull,
      onConvertPostman,
      onClear,
    ]
  );

  return <AIPerformanceContext.Provider value={value}>{children}</AIPerformanceContext.Provider>;
}
