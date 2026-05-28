import React from "react";
import AppShellSkeleton from "./AppShellSkeleton";

const isDev = typeof import.meta !== "undefined" && import.meta.env && import.meta.env.DEV;
const RECOVERY_DELAY_MS = 1600;
const MAX_AUTO_RECOVERIES = 1;

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, retryNonce: 0, autoRecoveries: 0 };
    this.recoveryTimer = null;
    this.recoverSoon = this.recoverSoon.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidMount() {
    window.addEventListener("online", this.recoverSoon);
    window.addEventListener("focus", this.recoverSoon);
  }

  componentDidUpdate(_prevProps, prevState) {
    if (!prevState.hasError && this.state.hasError) {
      if (this.state.autoRecoveries < MAX_AUTO_RECOVERIES) {
        this.armRecoveryTimer();
      }
    }
    if (prevState.hasError && !this.state.hasError) {
      this.clearRecoveryTimer();
    }
  }

  componentWillUnmount() {
    this.clearRecoveryTimer();
    window.removeEventListener("online", this.recoverSoon);
    window.removeEventListener("focus", this.recoverSoon);
  }

  componentDidCatch(error, errorInfo) {
    if (!isDev) return;
    // eslint-disable-next-line no-console
    console.error("App runtime error:", error, errorInfo);
  }

  armRecoveryTimer() {
    this.clearRecoveryTimer();
    this.recoveryTimer = window.setTimeout(this.recoverSoon, RECOVERY_DELAY_MS);
  }

  clearRecoveryTimer() {
    if (this.recoveryTimer) {
      window.clearTimeout(this.recoveryTimer);
      this.recoveryTimer = null;
    }
  }

  recoverSoon() {
    this.setState((current) =>
      current.hasError
        ? {
            hasError: false,
            retryNonce: current.retryNonce + 1,
            autoRecoveries: current.autoRecoveries + 1,
          }
        : null
    );
  }

  render() {
    if (this.state.hasError) {
      return (
        <AppShellSkeleton
          title="Loading workspace"
          detail="Restoring this screen and syncing the latest interface."
          status="Reconnecting"
        />
      );
    }
    return <React.Fragment key={this.state.retryNonce}>{this.props.children}</React.Fragment>;
  }
}
