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
        const body = await error.context.json();
        if (typeof body.error === "string") message = body.error;
      } catch {
        /* Retain a safe transport error. */
      }
    }
    throw new Error(message);
  }
  if (!data || data.error)
    throw new Error(data?.error ?? "Invalid builder response.");
  return data;
};
