import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface QuizQuestionErrorBoundaryProps {
  questionId: string;
  children: ReactNode;
}

interface QuizQuestionErrorBoundaryState {
  hasError: boolean;
}

export class QuizQuestionErrorBoundary extends Component<
  QuizQuestionErrorBoundaryProps,
  QuizQuestionErrorBoundaryState
> {
  state: QuizQuestionErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): QuizQuestionErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[QuizQuestionErrorBoundary] Question render failed", {
      questionId: this.props.questionId,
      error,
      errorInfo,
    });
  }

  componentDidUpdate(prevProps: QuizQuestionErrorBoundaryProps) {
    if (prevProps.questionId !== this.props.questionId && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">
                This question failed to render safely.
              </p>
              <Button type="button" variant="outline" size="sm" onClick={this.handleRetry}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Try again
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
