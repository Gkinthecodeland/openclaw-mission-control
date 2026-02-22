"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CrErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface CrErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class CrErrorBoundary extends Component<CrErrorBoundaryProps, CrErrorBoundaryState> {
  constructor(props: CrErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): CrErrorBoundaryState {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-mc-status-error/10">
            <AlertTriangle className="h-6 w-6 text-mc-status-error" />
          </div>
          <h3 className="text-lg font-medium text-mc-text-secondary">
            Something went wrong
          </h3>
          <p className="mt-1 max-w-sm text-sm text-mc-text-muted">
            {this.state.error?.message || "An unexpected error occurred"}
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => this.setState({ hasError: false })}
          >
            Try Again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
