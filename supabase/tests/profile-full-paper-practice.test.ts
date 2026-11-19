// @vitest-environment node
import { expect, it } from "vitest";
import { practice } from "./aqa-alevel-runtime";
import { ownerEvidence, templateFixture } from "./profile-builder-fixtures";
import { completeOwnedAssessmentEvidence } from "../functions/_shared/profile-evidence-ingestion";
import { evidenceFingerprint } from "../functions/_shared/profile-evidence";
import { prepareProfileSave } from "../functions/_shared/profile-builder-service";
import { snapshotTemplate } from "../functions/_shared/profile-template-context";
import { checksum, compileTemplate } from "../functions/_shared/profile-template";

async function fullPaper(coverPeople = true) {
  const text = "Pearson Edexcel A-level Business (9BS0), Paper 1 (9BS0/01). 100 marks; 2 hours. Marketing and People. Short and long answer questions. Answer all questions.";
  const evidence = await ownerEvidence();
  evidence.identity = { country: "GB", educationSystem: "UK", stage: "Secondary", qualification: "A-level", subject: "Business", organisation: "Pearson Edexcel", course: "9BS0", component: "9BS0/01", specificationVersion: "Not verified", tier: null };
  evidence.documents[0] = { ...evidence.documents[0], title: "Synthetic paper overview", kind: "specification", checksum: await checksum(text), locations: [{ id: "brief", page: 1, section: "Assessment", text }] };
  evidence.facts = { ...evidence.facts, marks: 100, durationMinutes: 120, topics: ["Marketing", "People"], tier: null, calculator: "unknown", formats: ["short_answer", "long_form"], selection: "all_compulsory" };
  evidence.claims = [["marks","100 marks"],["durationMinutes","2 hours"],["topics","Marketing and People"],["formats","Short and long answer questions"],["selection","Answer all questions"]].map(([field,quote]) => ({field,quote,documentId:evidence.documents[0].id,locationId:"brief",rule:"mandatory"}));
  const verified = completeOwnedAssessmentEvidence(evidence);
  const template = templateFixture();
  template.identity = verified.identity; template.mode = "full_mock";
  template.marks = 100; template.durationMinutes = 120; template.topics = verified.facts.topics; template.calculator = "unknown";
  const part = template.sections[0].groups[0].parts[0];
  template.sections[0].groups[0].parts = Array.from({length:4},(_,index) => ({...part,id:`part-${index}`,marks:25,topic:coverPeople && index%2 ? "People" : "Marketing",resource:"none"}));
  const saved = prepareProfileSave({ proposalVersion:1,promptVersion:1,origin:"source_backed_ai",template,evidence:verified,evidenceVersion:await evidenceFingerprint(verified),presetId:null,profileSettings:null },template);
  const plan = compileTemplate(template);
  return { template, snapshot: { context_version:2,resolved_by:"server",profile_id:"profile",subject_name:"Business",exam_board:"Pearson Edexcel",educational_tier:"A-level",assessment_tier:"not_tiered",course_id:plan.courseId,paper_id:plan.paperId,component_code:plan.componentCode,paper_contract:null,profile_template:snapshotTemplate({...saved.settings,profile_template:saved.context}) } };
}
const questions = (topic: string) => [{
  question_number:"1",question_type:"mcq",marks:1,subtopic:topic,topic_tag:topic,difficulty_level:"easy",
  question_text:"Which method collects information directly from customers?",task:"Which method collects information directly from customers?",
  choices:{A:"Customer survey",B:"Published census",C:"Trade statistics",D:"Annual report"},expected_answer:"A",
},{
  question_number:"2",question_type:"extended",marks:6,subtopic:topic,topic_tag:topic,difficulty_level:"medium",
  question_text:"Explain how customer research can support a business decision.",task:"Explain how customer research can support a business decision.",
  expected_answer:"1. Identify customer needs (1). 2. Estimate demand (1). 3. Compare product options (1). 4. Target a customer group (1). 5. Explain a pricing decision (1). 6. Reduce uncertainty using collected evidence (1). Maximum 6 marks; accept valid alternatives.",
}];

it.each(["generate-practice-questions","get-practice-questions"])("%s uses a full-paper profile for a two-question filtered quiz without changing the profile", async name => {
  const full = await fullPaper(), before = structuredClone(full.snapshot);
  const result = await practice(name,false,false,"paper_1",{snapshot:full.snapshot,questions:questions("Marketing"),topics:["Marketing"]});
  expect(result.set.extraction_status,JSON.stringify(result.errors)).toBe("completed");
  const write = result.writes.find(w => w.table === "practice_questions" && w.op === "insert");
  expect(write?.value).toHaveLength(2);
  expect(write?.value.every((q: any) => q.subtopic === "Marketing")).toBe(true);
  expect(full.snapshot).toEqual(before);
  expect(full.template).toMatchObject({mode:"full_mock",marks:100,durationMinutes:120,topics:["Marketing","People"]});
  expect(result.writes.some(w => w.table === "subject_exam_profiles")).toBe(false);
});

it("can practise a saved source topic even when it has no part in the stored draft layout", async () => {
  const full = await fullPaper(false);
  const result = await practice("generate-practice-questions",false,false,"paper_1",{snapshot:full.snapshot,questions:questions("People"),topics:["People"]});
  expect(result.set.extraction_status,JSON.stringify(result.errors)).toBe("completed");
});

it("does not save a deselected source topic into an explicitly filtered quiz", async () => {
  const full = await fullPaper();
  const result = await practice("generate-practice-questions",false,false,"paper_1",{snapshot:full.snapshot,questions:questions("People"),topics:["Marketing"]});
  expect(result.set.extraction_status).not.toBe("completed");
  expect(result.writes.some(w => w.table === "practice_questions" && w.op === "insert")).toBe(false);
});

it("does not turn a free-text quiz topic into new saved source scope", async () => {
  const full = await fullPaper();
  const result = await practice("get-practice-questions",false,false,"paper_1",{snapshot:full.snapshot,questions:questions("Astrophysics"),topics:["Astrophysics"]});
  expect(result.set.extraction_status).not.toBe("completed");
  expect(result.writes.some(w => w.table === "practice_questions" && w.op === "insert")).toBe(false);
});
