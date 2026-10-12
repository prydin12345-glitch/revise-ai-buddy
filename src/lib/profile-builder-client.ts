import { supabase } from "@/integrations/supabase/client";
import type { BuilderProposal } from "../../supabase/functions/_shared/profile-builder-service";
import type { ApprovalResult } from "../../supabase/functions/_shared/preset-approval";
export type BuilderResponse = {
  proposalId?: string;
  proposal?: BuilderProposal;
  profile?: Record<string, any>;
  approval?: ApprovalResult;
};
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
