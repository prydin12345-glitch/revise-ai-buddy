import assert from "node:assert/strict";
import { build } from "esbuild";
import vm from "node:vm";

let code: string;
export async function buildHandlerFixture() {
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
}
export function handlerRuntime(
  responses: Array<unknown | ((payload: any) => unknown | Promise<unknown>)> = [],
  userId = "owner",
  jobRpc?: (name: string, args: any) => unknown,
) {
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
      if (
        jobRpc &&
        /^(?:create|read|cached|acquire|commit|reserve|begin|finish)_profile_builder_(?:job|source)/.test(
          name,
        )
      ) {
        const result = await jobRpc(name, args);
        return result && typeof result === "object" && "__rpcError" in result
          ? { data: null, error: (result as any).__rpcError }
          : { data: result, error: null };
      }
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
      assert.equal(url, "https://ai.gateway.lovable.dev/v1/chat/completions");
      provider.push(JSON.parse(init.body));
      const next = responses.shift();
      const value = typeof next === "function" ? await next(JSON.parse(JSON.parse(init.body).messages[1].content)) : next;
      return new Response(
        JSON.stringify({
          usage: { prompt_tokens: 7, completion_tokens: 3 },
          choices: [
            { message: { content: JSON.stringify(value) } },
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
