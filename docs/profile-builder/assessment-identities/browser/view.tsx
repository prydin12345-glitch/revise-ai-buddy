import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { ExamProfileBuilder } from '../../../../src/components/profiles/ExamProfileBuilder';
import { WorkspaceContext, WorkspaceStore } from '../../../../src/hooks/use-workspace-session';
import type { BuilderApi, SourceJobView } from '../../../../src/lib/profile-builder-client';
import { indexDocumentPages } from '../../../../supabase/functions/_shared/profile-document-index';

const owner = 'synthetic-browser-owner';
const store = new WorkspaceStore(owner);
const clone = <T,>(value: T): T => structuredClone(value);
const titles = ['Marketing, people and global businesses', 'Business activities, decisions and strategy', 'Investigating business in a competitive environment'];
const businessText = [
  'Pearson Edexcel Level 3 Advanced GCE in Business (9BS0)',
  'Assessment overview',
  ...titles.map((title, index) => `Paper ${index + 1} – ${title}`),
  'Assessment objective weightings',
  ...titles.map((title, index) => `Paper ${index + 1} – ${title} ${index === 2 ? '5 - 7 5 - 7 9 - 11 9 - 11 30%' : '6 - 8 7 - 9 9 - 11 8 - 10 35%'}`),
  'Paper 3 – Investigating business in a competitive',
  'environment',
  '80 marks',
  'Paper 1', 'Paper 2', 'Paper 3',
].join('\n');
const codedText = ['Pearson Edexcel Level 3 Advanced GCE in Business (9BS0)', 'Assessment overview', ...titles.map((title, index) => `Paper ${index + 1} – ${title} (9BS0/0${index + 1})\n100 marks`)].join('\n');
const pageTexts = Array.from({ length: 15 }, () => 'Supporting material');
pageTexts[0] = 'Pearson Edexcel Level 3 Advanced GCE in Business (9BS0)';
pageTexts[13] = [`Paper 1 – ${titles[0]}`, '100 marks', '120 minutes', 'Topics 1 to 2', `Paper 2 – ${titles[1]}`, '90 marks', '105 minutes', '12'].join('\n');
pageTexts[14] = [`Paper 2 – ${titles[1]}`, '90 marks', '105 minutes', '13'].join('\n');
const calls: any[] = [];
const jobs = new Map<string, SourceJobView>();
const indexes: any[] = [];
const scenario = new URLSearchParams(location.search).get('scenario') || 'business';
let prepareCount = 0;

const api: BuilderApi = async (input: any) => {
  calls.push({ ...clone(input), uploads: input.uploads?.map((upload: any) => ({ contentType: upload.contentType, bytes: atob(upload.base64).length })) });
  if (input.action === 'prepare_source') {
    prepareCount++;
    const job: SourceJobView = {
      jobId: input.requestId, revision: 1, stage: scenario === 'pages' ? 'needs_details' : 'ready', canAdvance: false,
      identity: { ...input.identity, course: input.identity.course || '9BS0', specificationVersion: 'Synthetic source edition 2026' },
      mode: input.mode, progress: { completed: 1, total: 1 }, message: 'Synthetic source check completed.',
      ...(input.manualComponentCode ? { manualComponentCode: { value: input.manualComponentCode.value, status: 'user_provided' as const } } : {}),
      ...(scenario === 'pages' ? { missingItems: [{ field: 'source_pages', question: 'Which PDF page shows the assessment overview?', choices: [{ value: '1:14', label: 'PDF page 14 (printed page 12)' }, { value: '1:15', label: 'PDF page 15 (printed page 13)' }] }] } : {}),
    };
    jobs.set(job.jobId, job);
    return { job: clone(job) };
  }
  if (input.action === 'answer_source') {
    const existing = jobs.get(input.jobId)!;
    const requested = String(input.answers.source_pages).split(',').map(Number);
    const index = indexDocumentPages(pageTexts, { component: 'Paper 1', subject: 'Business Studies', course: '9BS0', qualification: 'A-level', sourcePages: requested });
    const text = index.chunks.flatMap(chunk => chunk.pages).map(page => page.text).join('\n');
    indexes.push({ requested, coverage: clone(index.coverage), diagnostics: clone(index.pageDiagnostics), selectedText: text });
    const next: SourceJobView = {
      ...existing, revision: (existing.revision || 1) + 1,
      stage: index.coverage.complete ? 'ready' : 'needs_details',
      message: index.coverage.reason || 'The selected physical PDF page matches Paper 1.',
      pageReview: [{ document: 1, requestedPages: requested, readPages: index.coverage.complete ? requested : [], skippedPages: index.coverage.complete ? [] : requested, diagnostics: index.pageDiagnostics }],
      ...(index.coverage.complete ? { missingItems: [] } : {}),
    };
    jobs.set(existing.jobId, next);
    return { job: clone(next) };
  }
  if (input.action === 'source_status') return { job: clone(jobs.get(input.jobId)!) };
  throw Error('Only source preparation, page answers and source status are enabled in this offline fixture.');
};

Object.assign(window, {
  __fixtures: { businessText, codedText, titles },
  __counts: () => ({ calls: clone(calls), prepareCount, jobs: [...jobs.values()].map(clone), indexes: clone(indexes) }),
});

function App() {
  const [open, setOpen] = useState(false);
  return <WorkspaceContext.Provider value={{ ownerId: owner, ready: true, store }}>
    <main className="min-h-screen bg-background px-4 py-8 text-foreground"><div className="mx-auto max-w-4xl space-y-4">
      <h1 className="font-serif text-3xl">Assessment identity verification</h1>
      <p className="text-sm text-muted-foreground">Synthetic offline preview · local attachment inspection · no live account or AI calls</p>
      <button className="min-h-11 rounded-lg border border-border bg-card px-4 text-sm" onClick={() => setOpen(true)}>Build Business profile</button>
      <ExamProfileBuilder subjectName="Business Studies" examBoard="Pearson Edexcel" educationalLevel="level3" curriculumRegion="GB" accountId={owner} open={open} onOpenChange={setOpen} onManual={() => { throw Error('Manual settings navigation is outside this fixture.'); }} api={api} />
    </div></main>
  </WorkspaceContext.Provider>;
}
createRoot(document.getElementById('root')!).render(<MemoryRouter><App /></MemoryRouter>);

declare global { interface Window { __fixtures: { businessText: string; codedText: string; titles: string[] }; __counts: () => any } }
