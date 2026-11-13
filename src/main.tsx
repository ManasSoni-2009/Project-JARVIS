import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

class StudioErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen w-screen items-center justify-center bg-[#F2F2F7] p-6 text-[#1D1D1F]">
          <div className="max-w-md rounded-[22px] border border-black/10 bg-white p-6 shadow-xl">
            <div className="mb-1 font-mono text-xs text-rose-600">
              J.A.R.V.I.S Studio Recovery
            </div>
            <h1 className="mb-2 text-lg font-bold">
              Workspace UI encountered a render error
            </h1>
            <pre className="mb-4 max-h-36 overflow-auto rounded-xl bg-black/5 p-3 font-mono text-[11px] text-zinc-700">
              {this.state.errorMessage}
            </pre>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-xl bg-[#1D1D1F] px-4 py-2 text-xs font-semibold text-white cursor-pointer"
            >
              Reload J.A.R.V.I.S Studio
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(
    <StudioErrorBoundary>
      <App />
    </StudioErrorBoundary>
  );
}
