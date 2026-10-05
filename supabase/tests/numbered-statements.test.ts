import {expect,it} from 'vitest';
import {statementCombinationIssue} from '../functions/_shared/numbered-statements';
import {declaredStatementText} from '../functions/_shared/numbered-statements';
import {normalizeGeneratedQuestion,assembledModelText} from '../functions/_shared/model-question-normalization';
import {validateQuestionCandidates} from '../functions/_shared/question-contract-validator';
import {analyseGroupRepair} from '../functions/_shared/prepare-group-repair';
import {buildQuestionRepairPrompt} from '../functions/_shared/question-repair';
import {biologyScopeFromContext} from '../functions/_shared/gcse-biology-scope';
import {combinations,fermentationContext,fermentationTask,fermentationStem,ocrPaper2V2Fixture} from './ocr-alevel-paper2-v2-fixtures';
const broken={id:'original-q13',question_number:'13',parent_question_number:'13',question_type:'mcq',marks:1,question_text:'Consider the following statements about batch and continuous fermentation processes:\n\nWhich of the statements are correct?',options:combinations,correct_answer:combinations[0]};
const valid={...broken,question_text:fermentationStem};
it('blocks the exact pasted Q13 despite valid choices and a matching private answer',()=>{
  const result=validateQuestionCandidates([broken]);
  expect(result.defects).toEqual([expect.objectContaining({partId:'original-q13',code:'invalid_statements',detail:expect.stringContaining('1, 2, 3')})]);
});
it.each(['1','2','3'])('requires every referenced proposition, including statement %s',number=>{
  const stem=fermentationStem.replace(new RegExp('^'+number+'\\. .+\\n?','m'),'');
  expect(statementCombinationIssue(stem,combinations)).toContain(number);
});
it.each(['3.','3. ...','3. Statement 3'])('refuses an empty/placeholder final proposition: %s',replacement=>{
  expect(statementCombinationIssue(fermentationStem.replace(/^3\. .+$/m,replacement),combinations)).not.toBeNull();
});
it('accepts complete numeral, bold and roman-numbered propositions',()=>{
  expect(validateQuestionCandidates([valid]).ok).toBe(true);
  expect(statementCombinationIssue(fermentationStem.replace(/^(\d)\./gm,'**$1.**'),combinations)).toBeNull();
  const roman=fermentationStem.replace(/^1\./m,'(i)').replace(/^2\./m,'(ii)').replace(/^3\./m,'(iii)');
  expect(statementCombinationIssue(roman,['(i) and (ii) only','(i) and (iii) only','(ii) and (iii) only','(i), (ii) and (iii)'])).toBeNull();
});
it('rejects duplicate labels and duplicate propositions',()=>{
  expect(statementCombinationIssue(fermentationStem+'\n1. Another proposition.',combinations)).toContain('duplicate');
  expect(statementCombinationIssue('1. Medium is added.\n2. Medium is added.\n3. Culture is removed.\n\nWhich statements are correct?',combinations)).toContain('duplicate');
});
it('accepts the unchanged Paper 1 inline statement convention without changing its fixture or contract',()=>{
  const stem='1. Enzymes lower activation energy. 2. Enzymes are used up. 3. Enzymes have active sites. Which combination of statements is correct?';
  expect(statementCombinationIssue(stem,['1 and 2 only','2 and 3 only','1 and 3 only','1, 2 and 3'])).toBeNull();
  expect(statementCombinationIssue(stem.replace('2. Enzymes are used up. ',''),['1 and 2 only','2 and 3 only','1 and 3 only','1, 2 and 3'])).toContain('2');
});
it('preserves legitimate numeric MCQs and complete paired propositions inside choices',()=>{
  expect(statementCombinationIssue('Calculate the population estimate.',['1200','1500','1800','2100'])).toBeNull();
  expect(statementCombinationIssue('Which two statements correctly describe membrane transport?',['1. Active transport uses ATP. 2. Facilitated diffusion is passive.','1. Osmosis uses ATP. 2. Diffusion always uses ATP.','1. Water moves up water potential gradients. 2. Osmosis moves solutes.','1. Ions move freely through lipids. 2. ATP is always required.'])).toBeNull();
});
it('preserves a public statements array through generation normalization and repeated assembly',()=>{
  const statements=fermentationContext.split('\n').filter(s=>/^\d\./.test(s)).map(s=>s.replace(/^\d\. /,''));
  const normalized=normalizeGeneratedQuestion({...broken,context:'Compare the two culture methods.',task:fermentationTask,statements});
  expect(normalized.question_text).toContain('1. In a closed batch');
  expect(assembledModelText(normalized)).toBe(normalized.question_text);
  expect(validateQuestionCandidates([normalized]).ok).toBe(true);
  const unsafe=normalizeGeneratedQuestion({...broken,statements:[{text:'A fact',correct:true}]});
  expect(unsafe.question_text).not.toContain('true');expect(validateQuestionCandidates([unsafe]).ok).toBe(false);
});
it('accepts numbered propositions in a student-visible canonical table and refuses hidden private-only statements',()=>{
  const rows=fermentationContext.split('\n').filter(s=>/^\d\./.test(s)).map(s=>[Number(s[0]),s.slice(3)]);
  const table={type:'data_table',headers:['Statement number','Statement'],rows};
  expect(validateQuestionCandidates([{...broken,diagram_config:table}]).ok).toBe(true);
  expect(validateQuestionCandidates([{...broken,diagram_config:{...table,rows:rows.slice(0,2)}}]).ok).toBe(false);
  expect(validateQuestionCandidates([{...broken,correct_answer:fermentationContext}]).defects.some(d=>d.code==='invalid_statements')).toBe(true);
});
it('preserves explicit proposition numbers and rejects mixed implicit/explicit identities',()=>{
  expect(declaredStatementText(['3. A false proposition.','1. A true proposition.','2. Another true proposition.'])).toBe('3. A false proposition.\n1. A true proposition.\n2. Another true proposition.');
  expect(declaredStatementText(['1. Explicit first statement.','Unlabelled second statement.'])).toBe('');
});
it('accepts a complete full-group repair and rejects missing statements, stale keys and changed task-only sources',()=>{
  const f=ocrPaper2V2Fixture(),scope=biologyScopeFromContext(f.snapshot),part={...valid,context:fermentationContext,task:fermentationTask};
  expect(analyseGroupRepair([broken],[part],scope).ok).toBe(true);
  expect(analyseGroupRepair([broken],[{...part,context:broken.question_text,question_text:broken.question_text}],scope).diagnostics.some(d=>d.code==='invalid_statements')).toBe(true);
  expect(analyseGroupRepair([broken],[{...part,correct_answer:'No matching choice'}],scope).ok).toBe(false);
  expect(analyseGroupRepair([broken],[part],scope,new Set(),new Set(['13']),'task_only').diagnostics.some(d=>d.code==='source_changed')).toBe(true);
  const prompt=buildQuestionRepairPrompt({group:[broken],subject:'Biology',scope,defects:'Q13: invalid_statements',mode:'full_group',targetNumbers:new Set(),plan:f.plan});
  expect(prompt).toContain('STATEMENT REPAIR');expect(prompt).toContain('original answer cannot be recovered');
});
