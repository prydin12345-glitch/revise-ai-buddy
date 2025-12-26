/**
 * Shared exam navigation utilities
 * Used by /dashboard, /my-exams, and other pages for consistent navigation
 */

export type ExamState = 'not-started' | 'in-progress' | 'completed' | 'graded';

export interface ExamSubmissionStatus {
  id: string;
  status: 'in_progress' | 'submitted' | 'completed' | 'graded';
  hasAnswers?: boolean;
}

/**
 * Determine the state of an exam based on submission status
 */
export function getExamState(submission?: ExamSubmissionStatus | null): ExamState {
  if (!submission) return 'not-started';
  
  switch (submission.status) {
    case 'in_progress':
      return 'in-progress';
    case 'submitted':
    case 'completed':
    case 'graded':
      return 'completed';
    default:
      return submission.hasAnswers ? 'in-progress' : 'not-started';
  }
}

/**
 * Get the URL to navigate to for a given exam based on its state
 */
export function getExamNavigationUrl(examId: string, state: ExamState): string {
  switch (state) {
    case 'in-progress':
      return `/exam/${examId}/in-progress?mode=student`;
    case 'completed':
    case 'graded':
      return `/exam/${examId}/review`;
    case 'not-started':
    default:
      return `/exam/${examId}/take`;
  }
}

/**
 * Get button configuration for an exam based on its state
 */
export function getExamButtonConfig(examId: string, state: ExamState): {
  label: string;
  url: string;
  variant: 'default' | 'outline' | 'secondary';
  canNavigate: boolean;
} {
  switch (state) {
    case 'in-progress':
      return {
        label: 'Continue',
        url: getExamNavigationUrl(examId, state),
        variant: 'default',
        canNavigate: true,
      };
    case 'completed':
    case 'graded':
      return {
        label: 'Review',
        url: getExamNavigationUrl(examId, state),
        variant: 'outline',
        canNavigate: true,
      };
    case 'not-started':
    default:
      return {
        label: 'Start',
        url: getExamNavigationUrl(examId, state),
        variant: 'default',
        canNavigate: true,
      };
  }
}
