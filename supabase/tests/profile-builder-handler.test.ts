// @vitest-environment node
import { build } from "esbuild";
import vm from "node:vm";
import { beforeAll, it, expect } from "vitest";
import { APPROVAL_REGISTRY } from "../functions/_shared/preset-approval";
import { templateFromPreset } from "../functions/_shared/profile-builder-service";
import {
  templateFixture,
  pearsonTemplate,
  syllabus,
  ownerEvidence,
} from "./profile-builder-fixtures";
import { SOURCE_REGISTRY } from "../functions/_shared/profile-source-registry";
let code: string;
beforeAll(async () => {
  const result = await build({
    entryPoints: ["supabase/functions/profile-builder/index.ts"],
    bundle: true,
    write: false,
    platform: "node",
    format: "cjs",
    plugins: [
      {
        name: "test-boundaries",
        setup(b) {
          b.onResolve({ filter: /^https:\/\/esm.sh\/@supabase/ }, () => ({
            path: "supabase",
            namespace: "fixture",
          }));
          b.onResolve({ filter: /^npm:unpdf/ }, () => ({
            path: "unpdf",
            namespace: "fixture",
          }));
          b.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => ({
            contents:
              path === "supabase"
                ? "export const createClient=()=>globalThis.testClient;"
                : "export const getDocumentProxy=globalThis.testPdf;",
            loader: "js",
          }));
        },
      },
    ],
  });
  code = result.outputFiles[0].text;
});
function runtime(responses: unknown[] = [], userId = "owner") {
  const receipts = new Map<string, any>(),
    profiles = new Map<string, any>(),
    costs: any[] = [],
    provider: any[] = [];
  let quotas = 0,
    handler: any;
  const client = {
    auth: {
      getUser: async (token: string) => ({
        data: { user: token === "fixture-token" ? { id: userId } : null },
        error: null,
      }),
    },
    from(table: string) {
      let op = "select",
        value: any;
      const filters: Record<string, unknown> = {};
      const query: any = {};
      for (const method of ["select", "eq", "maybeSingle", "update"])
        query[method] = (...args: any[]) => {
          if (method === "update") {
            op = "update";
            value = args[0];
          }
          if (method === "eq") filters[args[0]] = args[1];
          return query;
        };
      query.then = (resolve: any) => {
        let data: any = null;
        if (table === "profile_builder_requests") {
          const r = receipts.get(
            String(filters.user_id) + String(filters.request_id),
          );
          if (r && (!filters.state || r.state === filters.state)) {
            if (op === "update") {
              Object.assign(r, value);
              data = [{ request_id: filters.request_id }];
            } else data = r;
          }
        }
        if (table === "subject_exam_profiles") {
          const r = profiles.get(String(filters.id));
          if (r?.user_id === filters.user_id) data = r;
        }
        return Promise.resolve({ data, error: null }).then(resolve);
      };
      return query;
    },
    async rpc(name: string, args: any) {
      if (name === "reserve_ai_request") {
        quotas++;
        return { data: { allowed: true, reason: "ok" }, error: null };
      }
      const key =
        String(args.p_owner) + String(args.p_request ?? args.p_proposal);
      if (name === "claim_profile_builder_request") {
        const old = receipts.get(key);
        if (old) {
          if (old.hash !== args.p_hash) return { error: { code: "mismatch" } };
          return {
            data: {
              state: old.state === "running" ? "busy" : old.state,
              result: old.result,
            },
            error: null,
          };
        }
        receipts.set(key, { state: "running", hash: args.p_hash });
        return { data: { state: "claimed" }, error: null };
      }
      if (name === "record_profile_builder_call") {
        costs.push({ owner: args.p_owner, key, intent: true });
        return { data: null, error: null };
      }
      if (name === "record_profile_builder_usage") {
        costs.push(args.p_usage);
        return { data: null, error: null };
      }
      if (name === "save_builder_profile") {
        const receipt = receipts.get(key),
          id =
            args.p_profile ?? receipt?.saved_profile_id ?? crypto.randomUUID(),
          old = profiles.get(id);
        if (args.p_profile && old?.user_id !== args.p_owner)
          return { error: { code: "42501" } };
        const p = {
          ...old,
          ...args.p_settings,
          id,
          user_id: args.p_owner,
          profile_name: args.p_name,
          profile_template: args.p_context,
        };
        profiles.set(id, p);
        if (receipt) receipt.saved_profile_id = id;
        return { data: p, error: null };
      }
      throw Error("Unexpected RPC " + name);
    },
  };
  vm.runInNewContext(code, {
    console: { error() {} },
    URL,
    Request,
    Response,
    Headers,
    AbortSignal,
    ReadableStream,
    TextEncoder,
    TextDecoder,
    crypto,
    atob,
    setTimeout,
    clearTimeout,
    structuredClone,
    testClient: client,
    testPdf: () => {
      throw Error("PDF must use isolated parser tests");
    },
    Deno: {
      env: {
        get: (name: string) =>
          name === "LOVABLE_API_KEY" ? "fixture-provider" : "fixture-value",
      },
      serve(fn: any) {
        handler = fn;
      },
    },
    fetch: async (url: string, init: any) => {
      expect(url).toBe("https://ai.gateway.lovable.dev/v1/chat/completions");
      provider.push(JSON.parse(init.body));
      return new Response(
        JSON.stringify({
          usage: { prompt_tokens: 7, completion_tokens: 3 },
          choices: [
            { message: { content: JSON.stringify(responses.shift()) } },
          ],
        }),
      );
    },
  });
  const call = async (input: any, token = "fixture-token") => {
    const response = await handler(
      new Request("https://fixture.invalid/profile-builder", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      }),
    );
    return { status: response.status, body: await response.json() };
  };
  return {
    call,
    receipts,
    profiles,
    costs,
    provider,
    get quotas() {
      return quotas;
    },
  };
}
it("real handler authenticates before accepting catalogue or paid requests", async () => {
  const r = runtime(),
    result = await r.call({ action: "propose" }, "invalid-token");
  expect(result.status).toBe(401);
  expect(r.provider).toHaveLength(0);
});
it("real catalogue propose → save → reopen → duplicate re-evaluates approval with zero provider calls", async () => {
  const e = APPROVAL_REGISTRY.find(
      (e) => e.component === "H420/03" && e.mode === "short_practice",
    )!,
    p = templateFromPreset(e.id),
    r = runtime(),
    requestId = crypto.randomUUID();
  const proposal = await r.call({
    action: "propose",
    requestId,
    identity: p.template.identity,
    mode: p.template.mode,
  });
  expect(proposal.status).toBe(200);
  expect(proposal.body.proposal.presetId).toBe(e.id);
  const save = await r.call({
    action: "save",
    proposalId: requestId,
    profileName: "Unified",
    template: p.template,
  });
  expect(save.status).toBe(200);
  expect(save.body.approval.status).toBe("approved");
  const stored = r.profiles.get(save.body.profile.id);
  expect(stored.profile_template.template.marks).toBe(20);
  const copy = await r.call({
    action: "duplicate",
    requestId: crypto.randomUUID(),
    profileId: stored.id,
    profileName: "Copy",
  });
  expect(copy.status).toBe(200);
  expect(copy.body.profile.id).not.toBe(stored.id);
  expect(copy.body.approval.status).toBe("approved");
  expect(r.quotas).toBe(0);
  expect(r.provider).toHaveLength(0);
});
it("real source-backed example uses quota/cost accounting, saves a compiled draft and retains no approval", async () => {
  const t = pearsonTemplate(),
    r = runtime([t]),
    requestId = crypto.randomUUID();
  const p = await r.call({
    action: "propose",
    requestId,
    identity: t.identity,
    mode: t.mode,
    sourceId: SOURCE_REGISTRY[0].id,
  });
  expect(p.status).toBe(200);
  expect(r.quotas).toBe(1);
  expect(r.costs).toHaveLength(2);
  const result = await r.call({
    action: "save",
    proposalId: requestId,
    profileName: "Pearson evidence draft",
    template: t,
  });
  expect(result.status).toBe(200);
  expect(result.body.approval.status).toBe("not_approved");
  expect(result.body.profile.profile_template.evidenceVersion).toMatch(
    /^[a-f0-9]{64}$/,
  );
  expect(result.body.profile.paper_blueprint).toBe(null);
});
it("real institutional upload keeps checksum-bound owner evidence and ignores embedded approval instructions", async () => {
  const t = templateFixture(),
    r = runtime([await ownerEvidence(), t]),
    requestId = crypto.randomUUID(),
    result = await r.call({
      action: "propose",
      requestId,
      identity: t.identity,
      mode: t.mode,
      upload: {
        contentType: "text/plain",
        base64: Buffer.from(syllabus).toString("base64"),
      },
    });
  expect(result.status).toBe(200);
  expect(result.body.proposal.origin).toBe("source_backed_ai");
  expect(result.body.proposal.presetId).toBe(null);
  expect(r.provider[0].messages[0].content).toContain("UNTRUSTED DATA");
});
it("client-forged origin/approval and foreign proposal save are rejected by the actual handler", async () => {
  const r = runtime();
  expect(
    (
      await r.call({
        action: "save",
        proposalId: crypto.randomUUID(),
        profileName: "Forged",
        template: templateFixture(),
        approval: "approved",
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await r.call({
        action: "save",
        proposalId: crypto.randomUUID(),
        profileName: "Foreign",
        template: templateFixture(),
      })
    ).status,
  ).toBe(404);
  expect(r.profiles.size).toBe(0);
});
