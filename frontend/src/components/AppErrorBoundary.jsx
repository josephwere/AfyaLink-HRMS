import React from "react";

const isDev = typeof import.meta !== "undefined" && import.meta.env && import.meta.env.DEV;

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    if (!isDev) return;
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
              We hit a problem loading this screen. Reload to recover.
            </p>
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
