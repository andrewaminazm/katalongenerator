import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { analyzeFailure, type FailureAnalysisResult } from "../../api";
import { EMPTY_FAILURE_INPUT, type FailureInputState } from "./LogUploadPanel";

type FailureAnalyzerContextValue = {
  inputs: FailureInputState;
  setInputs: React.Dispatch<React.SetStateAction<FailureInputState>>;
  screenshotPreview: string | null;
  screenshotBase64: string | undefined;
  onScreenshotFile: (file: File | null) => void;
  loading: boolean;
  error: string | null;
  result: FailureAnalysisResult | null;
  onAnalyze: () => Promise<void>;
  onClear: () => void;
};

const FailureAnalyzerContext = createContext<FailureAnalyzerContextValue | null>(null);

export function useFailureAnalyzer(): FailureAnalyzerContextValue {
  const ctx = useContext(FailureAnalyzerContext);
  if (!ctx) {
    throw new Error("useFailureAnalyzer must be used within FailureAnalyzerProvider");
  }
  return ctx;
}

export function FailureAnalyzerProvider({
  children,
  activeProjectId,
  authorizationToken,
  model,
}: {
  children: ReactNode;
  activeProjectId: string | null;
  authorizationToken?: string;
  model: string;
}) {
  const [inputs, setInputs] = useState<FailureInputState>(EMPTY_FAILURE_INPUT);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [screenshotBase64, setScreenshotBase64] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FailureAnalysisResult | null>(null);

  const onScreenshotFile = useCallback((file: File | null) => {
    if (!file) {
      setScreenshotPreview(null);
      setScreenshotBase64(undefined);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setScreenshotPreview(dataUrl);
      setScreenshotBase64(dataUrl);
    };
    reader.readAsDataURL(file);
  }, []);

  const onAnalyze = useCallback(async () => {
    const hasLogInput =
      Boolean(inputs.logs.trim()) ||
      Boolean(inputs.katalonReport.trim()) ||
      Boolean(inputs.appiumLog.trim());

    if (!hasLogInput && !inputs.stacktrace.trim() && !inputs.apiResponse.trim()) {
      setError("Paste Katalon execution logs (primary). Stacktrace and other fields are optional.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const analysis = await analyzeFailure({
        logs: inputs.logs || undefined,
        stacktrace: inputs.stacktrace || undefined,
        consoleLogs: inputs.consoleLogs || undefined,
        apiResponse: inputs.apiResponse || undefined,
        harLog: inputs.harLog || undefined,
        katalonReport: inputs.katalonReport || undefined,
        appiumLog: inputs.appiumLog || undefined,
        screenshot: screenshotBase64,
        screenshotDescription: inputs.screenshotDescription || undefined,
        projectId: activeProjectId ?? undefined,
        authorization_token: authorizationToken,
        model,
        executionMetadata: {
          testName: inputs.testName || undefined,
          failedStep: inputs.failedStep || undefined,
        },
      });
      setResult(analysis);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [inputs, screenshotBase64, activeProjectId, authorizationToken, model]);

  const onClear = useCallback(() => {
    setInputs(EMPTY_FAILURE_INPUT);
    setScreenshotPreview(null);
    setScreenshotBase64(undefined);
    setResult(null);
    setError(null);
  }, []);

  const value = useMemo(
    () => ({
      inputs,
      setInputs,
      screenshotPreview,
      screenshotBase64,
      onScreenshotFile,
      loading,
      error,
      result,
      onAnalyze,
      onClear,
    }),
    [
      inputs,
      screenshotPreview,
      screenshotBase64,
      onScreenshotFile,
      loading,
      error,
      result,
      onAnalyze,
      onClear,
    ]
  );

  return (
    <FailureAnalyzerContext.Provider value={value}>{children}</FailureAnalyzerContext.Provider>
  );
}
