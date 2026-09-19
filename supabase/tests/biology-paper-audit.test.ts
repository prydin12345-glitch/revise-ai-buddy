// @vitest-environment node
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { auditBiologyTemplates, auditBiologyDraft, type BiologyDraftAuditInput } from '../functions/_shared/biology-paper-audit.ts';
import { buildPaperPlan } from '../functions/_shared/biology-paper-contract.ts';
import { gatewayFixture } from './ocr-fixtures.ts';

function input(tier: 'foundation' | 'higher' = 'foundation'): BiologyDraftAuditInput {
  return { courseId: 'ocr_gcse_biology_a_j247', paperId: 'first_paper', contractVersion: 1, tier, mode: 'full_mock', questions: gatewayFixture(tier).rows };
}

describe('offline Biology audit', () => {
  it('reports all twelve supported combinations and no invented external scores', () => {
    const rows = auditBiologyTemplates();
    expect(rows).toHaveLength(12);
    expect(new Set(rows.map(r => `${r.packId}/${r.tier}/${r.mode}`)).size).toBe(12);
    expect(rows.every(r => r.status === 'template_checked' && !r.realPaperGenerated && r.externalRating === null)).toBe(true);
    expect(rows.filter(r => r.packId === 'aqa-8461-paper-1-v1').every(r => r.annotatedMathsMarks === null)).toBe(true);
    expect(rows.filter(r => r.mode === 'full_mock').map(r => r.marks).sort()).toEqual([100, 100, 100, 100, 90, 90].sort());
  });

  it.each(['foundation', 'higher'] as const)('checks canonical OCR %s drafts without modifying them', tier => {
    const draft = input(tier), original = JSON.stringify(draft);
    const report = auditBiologyDraft(draft);
    expect(report.status).toBe('automated_checks_passed_review_required');
    expect(report.defects).toHaveLength(0);
    expect(report.reviewRequired.length).toBeGreaterThan(0);
    expect(JSON.stringify(draft)).toBe(original);
    expect(JSON.stringify(report)).not.toContain('correct_answer');
  });

  it.each(['foundation', 'higher'] as const)('checks canonical AQA %s drafts with the existing acceptance rules', tier => {
    const plan = buildPaperPlan('short_practice', tier)!;
    const questions = plan.parts.map(p => ({ id: p.partId, question_number: p.questionNumber, question_type: p.responseType === 'mcq_single' ? 'mcq' : p.responseType,
      question_text: 'State one function of this structure.', marks: p.marks, correct_answer: p.responseType === 'mcq_single' ? 'Nucleus' : 'A relevant scientific explanation.',
      options: p.responseType === 'mcq_single' ? ['Nucleus', 'Membrane', 'Ribosome', 'Cytoplasm'] : null,
      diagram_config: p.resource === 'data_table' ? { type: 'data_table', headers: ['Time / s', 'Mass / g'], rows: [[0, 3], [10, 4]] }
        : p.resource === 'graph' ? { type: 'line_chart', xAxisLabel: 'Time / s', yAxisLabel: 'Rate', datasets: [{ label: 'Trial', data: [{ x: 0, y: 1 }, { x: 10, y: 2 }] }] } : null,
    }));
    expect(auditBiologyDraft({ courseId: plan.courseId, paperId: plan.paperId, contractVersion: 1, tier, mode: 'short_practice', questions }).status)
      .toBe('automated_checks_passed_review_required');
  });

  it('reports missing tasks and resources, rather than passing on mark totals alone', () => {
    const draft = input();
    draft.questions[0].question_text = 'A plant cell contains several structures.';
    draft.questions.find(q => q.question_number === '19(b)')!.diagram_config = null;
    const report = auditBiologyDraft(draft);
    expect(report.status).toBe('blocked');
    expect(report.defects.some(d => d.code === 'missing_task')).toBe(true);
    expect(report.defects.some(d => d.code === 'missing_required_resource')).toBe(true);
  });

  it('requires explicit identity, tier and supported version', () => {
    for (const patch of [{ paperId: 'second_paper' }, { contractVersion: 999 }, { tier: null }, { mode: 'custom' }, { paperId: undefined }, { contractVersion: undefined }, { questions: [null] }]) {
      expect(() => auditBiologyDraft({ ...input(), ...patch } as any)).toThrow();
    }
  });

  it('the CLI returns usable JSON and a failing exit code for a blocked saved draft', () => {
    const inventory = JSON.parse(execFileSync(process.execPath, ['scripts/audit-biology.mjs', '--json'], { encoding: 'utf8' }));
    expect(inventory).toHaveLength(12);
    const directory = mkdtempSync(join(tmpdir(), 'examly-biology-audit-'));
    try {
      const draft = input(); draft.questions = draft.questions.slice(1);
      const file = join(directory, 'draft.json'); writeFileSync(file, JSON.stringify(draft));
      const result = spawnSync(process.execPath, ['scripts/audit-biology.mjs', '--input', file, '--json'], { encoding: 'utf8' });
      expect(result.status).toBe(1);
      expect(JSON.parse(result.stdout)[0].status).toBe('blocked');
    } finally { rmSync(directory, { recursive: true }); }
  });
});
