import { supabase } from "@/integrations/supabase/client";
import type { BuilderProposal } from "../../supabase/functions/_shared/profile-builder-service";
import type { ApprovalResult } from "../../supabase/functions/_shared/preset-approval";
export type { SourceJobView } from "../../supabase/functions/_shared/profile-builder-jobs";
import type { SourceJobView } from "../../supabase/functions/_shared/profile-builder-jobs";
export type BuilderResponse = {
  proposalId?: string;
  proposal?: BuilderProposal;
  profile?: Record<string, any>;
  approval?: ApprovalResult;
  job?: SourceJobView;
};

// Only an opaque receipt is retained. Uploaded files, evidence and drafts stay
// in the authenticated server store, never in a browser-wide document cache.
const pendingLifetime = 24 * 60 * 60 * 1000;
const receiptId =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function pendingKey(subject: string): Promise<string | null> {
  try {
    const result = await supabase.auth?.getSession?.();
    const owner = result?.data?.session?.user?.id;
    return owner && subject.trim()
      ? `examly:profile-builder:pending:v1:${owner}:${encodeURIComponent(subject.trim().toLowerCase())}`
      : null;
  } catch {
    return null;
  }
}
export async function readPendingBuilderJob(
  subject: string,
): Promise<{ jobId: string } | null> {
  const key = await pendingKey(subject);
  if (!key) return null;
  try {
    const stored = JSON.parse(localStorage.getItem(key) || "null");
    if (
      stored &&
      receiptId.test(stored.jobId) &&
      Number.isFinite(stored.expiresAt) &&
      stored.expiresAt > Date.now() &&
      stored.expiresAt <= Date.now() + pendingLifetime
    ) {
      return { jobId: stored.jobId };
    }
    localStorage.removeItem(key);
  } catch {
    // Browser storage can be disabled. Server status and saving still work.
  }
  return null;
}
export async function rememberPendingBuilderJob(
  subject: string,
  jobId: string,
): Promise<void> {
  if (!receiptId.test(jobId)) return;
  const key = await pendingKey(subject);
  if (!key) return;
  try {
    localStorage.setItem(
      key,
      JSON.stringify({ jobId, expiresAt: Date.now() + pendingLifetime }),
    );
  } catch {
    /* A receipt in browser storage is optional. */
  }
}
export async function clearPendingBuilderJob(
  subject: string,
  jobId?: string,
): Promise<void> {
  const key = await pendingKey(subject);
  if (!key) return;
  try {
    const stored = JSON.parse(localStorage.getItem(key) || "null");
    if (!jobId || stored?.jobId === jobId) localStorage.removeItem(key);
  } catch {
    /* Do not block a confirmed save on browser storage. */
  }
}
export type BuilderApi = (
  input: Record<string, unknown>,
) => Promise<BuilderResponse>;
export const invokeProfileBuilder: BuilderApi = async (input) => {
  const { data, error } = await supabase.functions.invoke("profile-builder", {
    body: input,
  });
  if (error) {
    let message =
      "Profile Builder could not finish. Your saved profiles are unchanged.";
    if (error.context instanceof Response) {
      try {
        const body = await error.context.clone().json();
        if (typeof body.error === "string") message = body.error.slice(0, 500);
        else if (error.context.status === 404 && body.code === "NOT_FOUND")
          message =
            "Profile Builder is not available yet. Its backend service needs to be deployed. Your saved profiles are unchanged.";
        else if (body.code === "BOOT_ERROR")
          message =
            "Profile Builder could not start. Its backend deployment needs attention. Your saved profiles are unchanged.";
        else if (error.context.status === 401)
          message =
            "Your sign-in session could not be verified. Sign in again before building a profile. Your saved profiles are unchanged.";
      } catch {
        /* Retain a safe transport error. */
      }
    } else if (
      error.name === "FunctionsFetchError" ||
      error.name === "FunctionsRelayError"
    ) {
      message =
        "Could not reach Profile Builder. Check your connection and retry the same profile choice. Your saved profiles are unchanged.";
    }
    throw new Error(message);
  }
  if (!data || data.error)
    throw new Error(data?.error ?? "Invalid builder response.");
  return data;
};
