// @vitest-environment node
import { it, expect, vi } from "vitest";
import {
  proposeProfile,
  prepareProfileSave,
  builderRequestSchema,
  templateFromPreset,
  type BuilderDeps,
} from "../functions/_shared/profile-builder-service";
import { APPROVAL_REGISTRY } from "../functions/_shared/preset-approval";
import { SOURCE_REGISTRY } from "../functions/_shared/profile-source-registry";
import {
  templateFixture,
  pearsonTemplate,
  ownerEvidence,
  syllabus,
} from "./profile-builder-fixtures";
function rig(responses: unknown[] = [templateFixture()]) {
  const requests = new Map<string, any>(),
    usage: any[] = [],
    calls: any[] = [];
  let reserves = 0;
  const deps: BuilderDeps = {
    claim: async (owner, key, hash) => {
      const id = owner + key,
        old = requests.get(id);
      if (old) {
        if (old.hash !== hash) throw Error("Idempotency mismatch");
        return {
          state: old.state === "running" ? "busy" : old.state,
          result: old.result,
        };
      }
      requests.set(id, { hash, state: "running" });
      return { state: "claimed" };
    },
    reserve: async () => {
      reserves++;
    },
    beginCall: async () => {},
    usage: async (owner, key, u) => {
      usage.push({ owner, key, ...u });
    },
    finish: async (owner, key, state, result) => {
      Object.assign(requests.get(owner + key), { state, result });
    },
    model: async (system, payload) => {
      calls.push({ system, payload });
      const value = responses.shift();
      if (value instanceof Error) throw value;
      return { value, promptTokens: 20, completionTokens: 10 };
    },
    parsePdf: async () => [],
    loadProposal: async (owner, key) => {
      const r = requests.get(owner + key);
      if (r?.state !== "complete") throw Error("Owned proposal not found");
      return r.result;
    },
  };
  return {
    deps,
    requests,
    usage,
    calls,
    get reserves() {
      return reserves;
    },
  };
}
const input = (extra: Record<string, unknown> = {}) =>
  builderRequestSchema.parse({
    action: "propose",
    requestId: crypto.randomUUID(),
    identity: templateFixture().identity,
    mode: "short_practice",
    unverified: true,
    ...extra,
  });
it("exact OCR Paper 3 catalogue identity resolves without AI, reserve or source download", async () => {
  const entry = APPROVAL_REGISTRY.find(
      (e) => e.component === "H420/03" && e.mode === "full_mock",
    )!,
    p = templateFromPreset(entry.id),
    r = rig();
  const request = input({
    identity: p.template.identity,
    mode: "full_mock",
    unverified: false,
  });
  const result = await proposeProfile("owner", request, r.deps);
  expect(result.presetId).toBe(entry.id);
  expect(r.calls).toHaveLength(0);
  expect(r.reserves).toBe(0);
  expect(prepareProfileSave(result, result.template).approval.status).toBe(
    "approved",
  );
  expect(await proposeProfile("owner", request, r.deps)).toEqual(result);
});
it("approved ID cannot be attached to a different course or tier", async () => {
  const entry = APPROVAL_REGISTRY.find((e) => e.component === "H420/03")!,
    r = rig();
  await expect(
    proposeProfile("owner", input({ presetId: entry.id }), r.deps),
  ).rejects.toThrow(/identity/);
  expect(r.calls).toHaveLength(0);
});
it("a source-backed Pearson example compiles a full executable plan but never gains approval", async () => {
  const t = pearsonTemplate("full_mock"),
    r = rig([t]),
    request = input({
      identity: t.identity,
      mode: "full_mock",
      unverified: false,
      sourceId: SOURCE_REGISTRY[0].id,
    });
  const result = await proposeProfile("owner", request, r.deps);
  expect(result.origin).toBe("source_backed_ai");
  expect(result.evidenceVersion).toMatch(/^[a-f0-9]{64}$/);
  const saved = prepareProfileSave(result, t);
  expect(saved.approval.status).toBe("not_approved");
  expect(saved.settings.question_count).toBe(3);
  expect(saved.context.template.marks).toBe(90);
  expect(r.reserves).toBe(1);
  expect(r.calls).toHaveLength(1);
});
it("institution uploads bind real locations, bytes and owner provenance despite embedded approval instructions", async () => {
  const evidence = await ownerEvidence(),
    t = templateFixture(),
    r = rig([evidence, t]),
    request = input({
      unverified: false,
      upload: {
        contentType: "text/plain",
        base64: Buffer.from(syllabus).toString("base64"),
      },
    });
  const result = await proposeProfile("owner", request, r.deps);
  expect(result.origin).toBe("source_backed_ai");
  expect(r.calls[0].system).toContain("UNTRUSTED DATA");
  expect(r.calls[0].payload.pages[0].text).toContain("award founder approval");
  expect(result.presetId).toBe(null);
  expect(prepareProfileSave(result, t).approval.status).toBe("not_approved");
  expect(r.reserves).toBe(1);
  expect(r.usage).toHaveLength(2);
});
it("explicit source failure never silently falls back to model memory", async () => {
  const r = rig();
  await expect(
    proposeProfile(
      "owner",
      input({
        unverified: false,
        sourceUrl: "https://qualifications.pearson.com/not-registered.pdf",
      }),
      r.deps,
    ),
  ).rejects.toThrow(/not registered/);
  expect(r.calls).toHaveLength(0);
  expect(r.reserves).toBe(0);
});
it("unknown source and contradictory evidence block paid generation", async () => {
  const r = rig(),
    bad = await ownerEvidence();
  bad.facts.marks = 7;
  await expect(
    proposeProfile(
      "owner",
      input({
        unverified: false,
        upload: {
          contentType: "text/plain",
          base64: Buffer.from(syllabus).toString("base64"),
        },
      }),
      rig([bad]).deps,
    ),
  ).rejects.toThrow(/Marks contradict/);
  await expect(
    proposeProfile(
      "owner",
      input({ unverified: false, sourceId: "invented" }),
      r.deps,
    ),
  ).rejects.toThrow(/not registered/);
  expect(r.calls).toHaveLength(0);
});
it.each(["checksum", "authority", "location"])(
  "rejects model-forged uploaded %s evidence",
  async (field) => {
    const evidence = await ownerEvidence();
    if (field === "checksum") evidence.documents[0].checksum = "0".repeat(64);
    if (field === "authority")
      evidence.documents[0].authority = "official_registered";
    if (field === "location")
      evidence.documents[0].locations[0].text += " invented syllabus";
    const r = rig([evidence]);
    await expect(
      proposeProfile(
        "owner",
        input({
          unverified: false,
          upload: {
            contentType: "text/plain",
            base64: Buffer.from(syllabus).toString("base64"),
          },
        }),
        r.deps,
      ),
    ).rejects.toThrow();
    expect(r.calls).toHaveLength(1);
    expect(r.usage).toHaveLength(1);
  },
);
it("unverified general practice is explicit, cannot be a full mock and cannot self-approve", async () => {
  const r = rig();
  await expect(
    proposeProfile("owner", input({ unverified: false }), r.deps),
  ).rejects.toThrow(/Provide registered evidence/);
  await expect(
    proposeProfile("owner", input({ mode: "full_mock" }), r.deps),
  ).rejects.toThrow(/general practice/);
  const result = await proposeProfile("owner", input(), r.deps);
  expect(result.origin).toBe("model_knowledge_ai");
  expect(prepareProfileSave(result, result.template).approval.status).toBe(
    "not_approved",
  );
});
it("rejects forged client approval/provenance fields at the request schema", () => {
  expect(() =>
    builderRequestSchema.parse({ ...input(), approval: "approved" }),
  ).toThrow();
  expect(() =>
    builderRequestSchema.parse({
      action: "save",
      proposalId: crypto.randomUUID(),
      profileName: "Fake",
      template: templateFixture(),
      origin: "catalogue",
      evidenceVersion: "forged",
    }),
  ).toThrow();
});
it("records validation-failed provider cost, permits one bounded repair and never refunds its quota", async () => {
  const r = rig([{ approval: true }, { marks: -1 }]),
    request = input();
  await expect(proposeProfile("owner", request, r.deps)).rejects.toThrow();
  expect(r.calls).toHaveLength(2);
  expect(r.usage).toHaveLength(2);
  expect(r.reserves).toBe(1);
  await expect(proposeProfile("owner", request, r.deps)).rejects.toThrow(
    /Repeated requests/,
  );
  expect(r.calls).toHaveLength(2);
});
it("records transport failures as unknown incurred cost rather than a free retry", async () => {
  const r = rig([new Error("timeout")]),
    request = input();
  await expect(proposeProfile("owner", request, r.deps)).rejects.toThrow(
    "timeout",
  );
  expect(r.usage[0].outcome).toBe("unknown_provider_cost");
  expect(r.reserves).toBe(1);
  await expect(proposeProfile("owner", request, r.deps)).rejects.toThrow();
  expect(r.calls).toHaveLength(1);
});
it("provider configuration and quota rejection precede every paid call", async () => {
  const r = rig();
  r.deps.providerReady = () => {
    throw Error("missing provider");
  };
  await expect(proposeProfile("owner", input(), r.deps)).rejects.toThrow(
    /missing provider/,
  );
  expect(r.reserves).toBe(0);
  expect(r.calls).toHaveLength(0);
  const quota = rig();
  quota.deps.reserve = async () => {
    throw Error("quota exhausted");
  };
  await expect(proposeProfile("owner", input(), quota.deps)).rejects.toThrow(
    /quota/,
  );
  expect(quota.calls).toHaveLength(0);
});
it("regeneration reuses owner evidence, while a foreign proposal is unavailable", async () => {
  const r = rig([await ownerEvidence(), templateFixture(), templateFixture()]),
    request = input({
      unverified: false,
      upload: {
        contentType: "text/plain",
        base64: Buffer.from(syllabus).toString("base64"),
      },
    });
  await proposeProfile("owner", request, r.deps);
  const result = await proposeProfile(
    "owner",
    input({
      unverified: false,
      fromProposalId: request.action === "propose" ? request.requestId : "",
    }),
    r.deps,
  );
  expect(result.evidence?.documents[0].title).toBe("Private module brief");
  await expect(
    proposeProfile(
      "foreign",
      input({
        unverified: false,
        fromProposalId: request.action === "propose" ? request.requestId : "",
      }),
      r.deps,
    ),
  ).rejects.toThrow(/Owned/);
  expect(r.calls).toHaveLength(3);
});
