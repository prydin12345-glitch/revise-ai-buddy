import {fingerprint} from "./profile-fingerprint.ts";
import {BIOLOGY_PAPER_PACKS,getBiologyPaperPack} from "./biology-course-packs.ts";
import {COURSE_CAPABILITIES,canonicalCourseId,getCourseCapability} from "./assessment-tier.ts";
import {canonical,checksum} from "./profile-template.ts";
import type {PaperPlan} from "./paper-contract-types.ts";
import {PRESET_APPROVAL_RECORDS,APPROVAL_REVISION_RECORDS} from "./preset-approval-records.ts";
export interface PresetApprovalRecord {
  id:string;packId:string;country:string;educationSystem:string;organisation:string;qualification:string;
  course:string;courseCode:string;subject:string;paper:string;component:string;specificationVersion:string;
  tier:PaperPlan["tier"];mode:"full_mock"|"short_practice";contractVersion:number;
  contractFingerprint:string;settingsFingerprint:string;settingsCanonical:string;
  status:"approved"|"superseded"|"revoked"|"pending";approvalRecord:string|null;revision:string;
  implementation:string;recommended:boolean;
}
export const APPROVAL_REGISTRY:readonly PresetApprovalRecord[]=PRESET_APPROVAL_RECORDS;
const hasApprovalRecord=(e:PresetApprovalRecord)=>APPROVAL_REVISION_RECORDS.some(r=>r.id===e.approvalRecord&&r.presetVersions.includes(e.id));
export function settingsForPlan(plan:PaperPlan) {
  const pack=getBiologyPaperPack(plan.courseId,plan.paperId,plan.contractVersion)!;
  const topics=plan.parts.some(p=>p.assessmentRole==="synoptic_essay")||(plan.courseId==="ocr_alevel_biology_a_h420"&&plan.paperId==="paper_3")?[...pack.definition(plan.tier).topics]:[...new Set(plan.parts.map(p=>p.topic))];
  const mcq=plan.parts.filter(p=>p.responseType==="mcq_single").length;
  return {
    exam_board:pack.examBoard,educational_tier:pack.curriculum.qualification==="A-level"?"level3":"level2",
    topics,question_count:plan.partCount,time_limit_minutes:plan.durationMinutes,mcq_count:mcq,written_question_count:plan.partCount-mcq,mcq_options_count:4,
    question_structure:canonicalCourseId(plan.courseId)==="aqa_gcse_biology"?"sub_questions":"mixed",
    parent_question_count:plan.parentCount,max_parts_per_question:Math.max(...plan.parts.map(p=>plan.parts.filter(q=>q.parentId===p.parentId).length)),
    mcq_position:["edexcel_gcse_biology_1bi0","ocr_gcse_biology_b_j257","wjec_gcse_biology_wales_3400","pearson_edexcel_alevel_biology_b_9bi0"].includes(plan.courseId)?"mixed":"start",
    mark_distribution:{},include_extended:false,extended_marks:0,difficulty_progression:"ascending",calculator_policy:"allowed",
    include_graphs:plan.parts.some(p=>p.resource==="graph"),include_tables:plan.parts.some(p=>p.resource==="data_table"),assessment_tier:plan.tier,
    paper_blueprint:{courseSelection:{courseId:plan.courseId,paperId:plan.paperId,...(plan.specificationVersion?{specificationVersion:plan.specificationVersion}:{})},paperContract:{courseId:plan.courseId,paperId:plan.paperId,mode:plan.mode,contractVersion:plan.contractVersion,...(plan.specificationVersion?{specificationVersion:plan.specificationVersion}:{})}},
  };
}
/** All generation fields, plus the implementation/rules binding; no names or UI state. */
export function profileSettingsCanonical(profile:Record<string,any>):string {
  const bp=profile.paper_blueprint??{}, {biologyBCustomSettings:_custom,...generationBlueprint}=bp,contract=bp.paperContract;
  const capability=contract?getCourseCapability({subject:profile.subject_name??"Biology",examBoard:profile.exam_board,educationalTier:profile.educational_tier,courseId:contract.courseId}):null;
  const pack=contract?getBiologyPaperPack(contract.courseId,contract.paperId,contract.contractVersion):null;
  let plan:PaperPlan|null=null;
  try{if(pack&&["foundation","higher","not_tiered"].includes(profile.assessment_tier)&&["full_mock","short_practice"].includes(contract.mode))plan=pack.build(contract.mode,profile.assessment_tier);}catch{/* Invalid edits never confer approval. */}
  const contractBinding=plan&&pack?fingerprint(canonical({plan,rules:pack.rules??null,systemPrompt:pack.generation.systemPrompt??null,instructions:pack.instructions(plan),repairInstructions:plan.parts.map(p=>pack.repairPartInstructions?.(p,true)??null),validation:pack.validation})):null;
  const fields=["topics","question_count","time_limit_minutes","mcq_count","written_question_count","mcq_options_count","question_structure","parent_question_count","max_parts_per_question","mcq_position","mark_distribution","include_extended","extended_marks","difficulty_progression","calculator_policy","include_graphs","include_tables","assessment_tier"];
  return canonical({contractBinding,board:capability?(getBiologyPaperPack(capability.id,contract.paperId,contract.contractVersion)?.examBoard??profile.exam_board):(profile.exam_board??null),qualification:capability?(capability.curriculum?.qualification??"GCSE"):(profile.educational_tier??null),studied_texts:profile.studied_texts??[],...Object.fromEntries(fields.map(k=>[k,k==="topics"?[...(profile[k]??[])].sort():(profile[k]??null)])),paper_blueprint:generationBlueprint});
}
export type ApprovalResult={status:"approved"|"superseded"|"revoked"|"customised"|"not_approved";entry:PresetApprovalRecord|null};
export function evaluateApproval(profile:Record<string,any>,lineageId?:string|null):ApprovalResult {
  const contract=profile.paper_blueprint?.paperContract;
  if(contract&&getCourseCapability({subject:profile.subject_name??"Biology",examBoard:profile.exam_board,educationalTier:profile.educational_tier,courseId:contract.courseId})) {
    const e=APPROVAL_REGISTRY.find(e=>e.course===canonicalCourseId(contract.courseId)&&e.paper===contract.paperId&&e.mode===contract.mode&&e.tier===profile.assessment_tier&&e.contractVersion===contract.contractVersion&&e.settingsCanonical===profileSettingsCanonical(profile));
    if(e&&hasApprovalRecord(e)&&e.status!=="pending")return {status:e.status,entry:e};
  }
  const parent=APPROVAL_REGISTRY.find(e=>e.id===lineageId&&hasApprovalRecord(e)&&e.status!=="pending");
  return {status:parent?"customised":"not_approved",entry:parent??null};
}
export function approvedPreset(entryId:string) {
  const entry=APPROVAL_REGISTRY.find(e=>e.id===entryId);
  if(!entry||!hasApprovalRecord(entry)||!["approved","superseded"].includes(entry.status))throw Error("This preset is not approved or has been revoked.");
  const pack=getBiologyPaperPack(entry.course,entry.paper,entry.contractVersion),plan=pack?.build(entry.mode,entry.tier);
  if(!plan||profileSettingsCanonical(settingsForPlan(plan))!==entry.settingsCanonical)throw Error("Preset implementation changed. Explicit founder review and registration required.");
  return {entry,plan,settings:settingsForPlan(plan)};
}
export async function auditApprovals() {
  return Promise.all(APPROVAL_REGISTRY.map(async e=>{
    const pack=getBiologyPaperPack(e.course,e.paper,e.contractVersion),plan=pack?.build(e.mode,e.tier);
    return {id:e.id,status:e.status,ok:!!plan&&(e.status==="pending"?e.approvalRecord===null:hasApprovalRecord(e))&&(await checksum(canonical(plan)))===e.contractFingerprint&&(await checksum(e.settingsCanonical))===e.settingsFingerprint&&profileSettingsCanonical(settingsForPlan(plan))===e.settingsCanonical};
  }));
}
export const approvalCatalogue=()=>APPROVAL_REGISTRY.filter(e=>e.status==="approved"&&e.recommended&&hasApprovalRecord(e));
export const availablePacks=BIOLOGY_PAPER_PACKS;
export const courseCatalogue=COURSE_CAPABILITIES;
