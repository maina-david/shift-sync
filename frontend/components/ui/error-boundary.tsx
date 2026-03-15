"use client";

import React from "react";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}
interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(err: Error): State {
    return { hasError: true, message: err.message };
  }

  componentDidCatch(err: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", err, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex flex-col items-center justify-center h-full gap-3 p-8 text-center">
            <p className="text-destructive font-medium">Something went wrong</p>
            <p className="text-sm text-muted-foreground">
              {this.state.message}
            </p>
            <button
              className="text-sm underline text-muted-foreground"
              onClick={() => this.setState({ hasError: false, message: "" })}
            >
              Try again
            </button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
