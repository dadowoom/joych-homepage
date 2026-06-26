import { cn } from "@/lib/utils";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Component, ReactNode } from "react";

const CHUNK_RELOAD_KEY = "joych:dynamic-import-reload-attempted-at";
const CHUNK_RELOAD_RETRY_MS = 2 * 60 * 1000;

function getErrorText(error: unknown) {
  if (error instanceof Error) {
    return `${error.name}\n${error.message}\n${error.stack ?? ""}`;
  }
  return String(error ?? "");
}

function isDynamicImportLoadError(error: unknown) {
  const text = getErrorText(error).toLowerCase();
  return [
    "failed to fetch dynamically imported module",
    "importing a module script failed",
    "chunkloaderror",
    "loading chunk",
    "module script load failed",
  ].some((pattern) => text.includes(pattern));
}

function shouldRetryByReload() {
  if (typeof window === "undefined") return false;

  const lastAttempt = Number(
    window.sessionStorage.getItem(CHUNK_RELOAD_KEY) ?? "0"
  );

  return !lastAttempt || Date.now() - lastAttempt > CHUNK_RELOAD_RETRY_MS;
}

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    if (!isDynamicImportLoadError(error) || !shouldRetryByReload()) return;

    window.sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
    window.location.reload();
  }

  render() {
    if (this.state.hasError) {
      const isDynamicImportError = isDynamicImportLoadError(this.state.error);

      return (
        <div className="flex items-center justify-center min-h-screen p-8 bg-background">
          <div className="flex flex-col items-center w-full max-w-2xl p-8">
            <AlertTriangle
              size={48}
              className="text-destructive mb-6 flex-shrink-0"
            />

            <h2 className="text-xl mb-3 text-center font-semibold">
              {isDynamicImportError
                ? "새 버전 파일을 다시 불러와야 합니다."
                : "페이지를 불러오는 중 문제가 생겼습니다."}
            </h2>

            <p className="mb-6 text-center text-sm text-muted-foreground">
              {isDynamicImportError
                ? "배포 직후 이전 화면 파일이 남아 있을 때 생길 수 있습니다. 아래 버튼을 눌러 새로고침해 주세요."
                : "잠시 후 다시 시도해 주세요. 같은 문제가 반복되면 관리자에게 알려주세요."}
            </p>

            {!isDynamicImportError ? (
              <details className="mb-6 w-full rounded bg-muted p-4">
                <summary className="cursor-pointer text-sm text-muted-foreground">
                  오류 상세 보기
                </summary>
                <pre className="mt-3 text-sm text-muted-foreground whitespace-break-spaces">
                  {this.state.error?.stack ?? this.state.error?.message}
                </pre>
              </details>
            ) : null}

            <button
              onClick={() => window.location.reload()}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg",
                "bg-primary text-primary-foreground",
                "hover:opacity-90 cursor-pointer"
              )}
            >
              <RotateCcw size={16} />
              페이지 새로고침
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
