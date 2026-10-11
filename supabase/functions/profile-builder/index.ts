import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getDocumentProxy } from "npm:unpdf@1.8.1";
import {
  builderRequestSchema,
  proposeProfile,
  prepareProfileSave,
  type BuilderProposal,
} from "../_shared/profile-builder-service.ts";
import { checkGenerationRateLimit } from "../_shared/rate-limiter.ts";
import { corsHeaders } from "../_shared/cors-headers.ts";
import {
  extractPdfPages,
  readLimitedBody,
} from "../_shared/profile-document-io.ts";
import { canonical, checksum } from "../_shared/profile-template.ts";
import { resolveSavedTemplate } from "../_shared/profile-template-context.ts";
import { evaluateApproval } from "../_shared/preset-approval.ts";
const headers = {
  ...corsHeaders,
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers });
class SafeError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);
  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const token = req.headers
    .get("Authorization")
    ?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return reply({ error: "Sign in to build an exam profile." }, 401);
  const {
    data: { user },
    error: authError,
  } = await db.auth.getUser(token);
  if (authError || !user)
    return reply({ error: "Sign in to build an exam profile." }, 401);
  const rpc = async (name: string, args: unknown) => {
    const { data, error } = await db.rpc(name, args);
    if (error)
      throw new SafeError(
        /42883|42703|PGRST202|PGRST204/.test(error.code)
          ? "Profile Builder needs its reviewed migration/backend deployment. Existing profiles are unchanged."
          : "Profile operation could not finish. Retry with the same request ID.",
        503,
      );
    return data;
  };
  try {
    const input = builderRequestSchema.parse(
      JSON.parse(
        new TextDecoder().decode(await readLimitedBody(req.body, 4_100_000)),
      ),
    );
    if (input.action === "propose") {
      const key = Deno.env.get("LOVABLE_API_KEY");
      const proposal = await proposeProfile(user.id, input, {
        providerReady: () => {
          if (!key)
            throw new SafeError(
              "The backend AI provider is not configured.",
              503,
            );
        },
        claim: (owner, id, hash) =>
          rpc("claim_profile_builder_request", {
            p_owner: owner,
            p_request: id,
            p_hash: hash,
          }),
        reserve: async (owner) => {
          const r = await checkGenerationRateLimit(
            db,
            owner,
            "profile_builder",
            { dailyLimit: 10, burstLimit: 3 },
          );
          if (!r.allowed) throw new SafeError(r.message, r.status ?? 429);
        },
        beginCall: (owner, id) =>
          rpc("record_profile_builder_call", { p_owner: owner, p_request: id }),
        usage: (owner, id, usage) =>
          rpc("record_profile_builder_usage", {
            p_owner: owner,
            p_request: id,
            p_usage: usage,
          }),
        finish: async (owner, id, state, result) => {
          const { data, error } = await db
            .from("profile_builder_requests")
            .update({ state, result, finished_at: new Date().toISOString() })
            .eq("user_id", owner)
            .eq("request_id", id)
            .eq("state", "running")
            .select("request_id");
          if (error || data?.length !== 1)
            throw new SafeError(
              "Could not persist the builder result. Retry with the same request ID.",
              503,
            );
        },
        loadProposal: async (owner, id) => {
          const { data, error } = await db
            .from("profile_builder_requests")
            .select("result,state")
            .eq("user_id", owner)
            .eq("request_id", id)
            .maybeSingle();
          if (error || data?.state !== "complete")
            throw new SafeError(
              "Saved proposal not found in your account.",
              404,
            );
          return data.result;
        },
        parsePdf: (b) => extractPdfPages(b, getDocumentProxy as any),
        model: async (system, payload, budgetMs) => {
          const response = await fetch(
            "https://ai.gateway.lovable.dev/v1/chat/completions",
            {
              method: "POST",
              signal: AbortSignal.timeout(budgetMs),
              headers: {
                Authorization: `Bearer ${key}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "google/gemini-2.5-flash",
                messages: [
                  { role: "system", content: system },
                  { role: "user", content: JSON.stringify(payload) },
                ],
                max_tokens: 12000,
                temperature: 0.2,
                response_format: { type: "json_object" },
              }),
            },
          );
          if (!response.ok)
            throw new SafeError(
              "The provider could not finish. This request cannot repeat a paid call.",
              502,
            );
          const data = JSON.parse(
            new TextDecoder().decode(
              await readLimitedBody(response.body, 250_000, 45_000),
            ),
          );
          let value: unknown;
          try {
            value = JSON.parse(data.choices?.[0]?.message?.content ?? "");
          } catch {
            value = { invalidOutput: true };
          }
          const tokens = (v: unknown) =>
            Number.isSafeInteger(Number(v)) &&
            Number(v) >= 0 &&
            Number(v) <= 10_000_000
              ? Number(v)
              : 0;
          return {
            value,
            promptTokens: tokens(data.usage?.prompt_tokens),
            completionTokens: tokens(data.usage?.completion_tokens),
          };
        },
      });
      return reply({ proposalId: input.requestId, proposal });
    }
    if (input.action === "duplicate") {
      const { data: profile, error } = await db
        .from("subject_exam_profiles")
        .select("*")
        .eq("id", input.profileId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (error || !profile?.profile_template)
        throw new SafeError("Owned built profile not found.", 404);
      resolveSavedTemplate(profile);
      const claim = await rpc("claim_profile_builder_request", {
        p_owner: user.id,
        p_request: input.requestId,
        p_hash: await checksum(canonical(input)),
      });
      if (claim.state === "complete") return reply(claim.result);
      if (claim.state !== "claimed")
        throw new SafeError(
          "Duplication already running; retry the same request.",
          409,
        );
      const approval = evaluateApproval(
          profile,
          profile.profile_template.presetId,
        ),
        saved = await rpc("save_builder_profile", {
          p_owner: user.id,
          p_profile: null,
          p_name: input.profileName,
          p_settings: profile,
          p_context: {
            ...profile.profile_template,
            proposalId: input.requestId,
          },
          p_proposal: input.requestId,
        });
      const original = profile.profile_template;
      const proposal: BuilderProposal = {
        proposalVersion: 1,
        promptVersion: 1,
        origin: original.origin,
        template: original.template,
        evidence: original.evidence,
        evidenceVersion: original.evidenceVersion,
        presetId: original.presetId,
        profileSettings: null,
      };
      const result = { profile: saved, approval, ...proposal };
      const { data, error: finishError } = await db
        .from("profile_builder_requests")
        .update({
          state: "complete",
          result,
          finished_at: new Date().toISOString(),
        })
        .eq("user_id", user.id)
        .eq("request_id", input.requestId)
        .eq("state", "running")
        .select("request_id");
      if (finishError || data?.length !== 1)
        throw new SafeError(
          "Copy saved but receipt failed. Contact support with this request ID; do not create another copy.",
          503,
        );
      return reply(result);
    }
    const { data: row, error } = await db
      .from("profile_builder_requests")
      .select("result,state")
      .eq("user_id", user.id)
      .eq("request_id", input.proposalId)
      .maybeSingle();
    if (error || row?.state !== "complete" || !row.result)
      throw new SafeError("Owned proposal not found; build it again.", 404);
    const prepared = prepareProfileSave(
      row.result as BuilderProposal,
      input.template,
    );
    const profile = await rpc("save_builder_profile", {
      p_owner: user.id,
      p_profile: input.profileId ?? null,
      p_name: input.profileName,
      p_settings: {
        ...prepared.settings,
        subject_name:
          input.subjectName ?? prepared.context.template.identity.subject,
      },
      p_context: { ...prepared.context, proposalId: input.proposalId },
      p_proposal: input.proposalId,
    });
    return reply({ profile, approval: prepared.approval });
  } catch (error) {
    if (error instanceof SafeError)
      return reply({ error: error.message }, error.status);
    if (
      error instanceof Error &&
      (error.name === "ZodError" || error.name === "SyntaxError")
    )
      return reply(
        {
          error:
            "Invalid profile input. Check required fields and supported formats.",
        },
        400,
      );
    console.error(
      "profile_builder_failed",
      error instanceof Error ? error.name : "unknown",
    );
    return reply(
      {
        error:
          error instanceof Error
            ? error.message.slice(0, 500)
            : "Profile request failed.",
      },
      400,
    );
  }
});
