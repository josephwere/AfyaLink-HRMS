import React from "react";

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: String(error?.message || "Unexpected application error") };
  }

  componentDidCatch(error, errorInfo) {
    // Keep lightweight console trace for debugging.
    // eslint-disable-next-line no-console
    console.error("App runtime error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary-shell">
          <div className="card premium-card error-boundary-card">
            <h2>Something went wrong</h2>
            <p className="muted">
              A page error occurred. Reload to recover. If it persists, report the action that caused it.
            </p>
            <pre className="premium-code">{this.state.message}</pre>
            <button type="button" className="btn-primary" onClick={() => window.location.reload()}>
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
