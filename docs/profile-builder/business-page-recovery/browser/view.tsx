import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { ExamProfileBuilder } from '../../../../src/components/profiles/ExamProfileBuilder';
import { WorkspaceContext, WorkspaceStore } from '../../../../src/hooks/use-workspace-session';
import type { BuilderApi, SourceJobView } from '../../../../src/lib/profile-builder-client';
import { indexDocumentPages } from '../../../../supabase/functions/_shared/profile-document-index';
import official from '../../../../supabase/tests/fixtures/edexcel-alevel-business-official.json';
import scope from '../../../../supabase/tests/fixtures/edexcel-alevel-business-scope.json';
import continuation from '../../../../supabase/tests/fixtures/edexcel-alevel-business-continuation.json';

const owner = 'synthetic-browser-owner', store = new WorkspaceStore(owner);
const scenario = new URLSearchParams(location.search).get('scenario') || 'pages';
const titles = ['Marketing, people and global businesses', 'Business activities, decisions and strategy', 'Investigating business in a competitive environment'];
const text = ['Pearson Edexcel A-level Business (9BS0)', ...titles.map((title, index) => `Paper ${index + 1}: ${title} (9BS0/0${index + 1})\n100 marks`)].join('\n');
const pages = Array<string>(68).fill('');
for (const fixture of [official, scope, continuation]) for (const page of fixture.excerpts) pages[page.page - 1] = page.text;
const calls: any[] = [], jobs = new Map<string, SourceJobView>();
const api: BuilderApi = async (input: any) => {
  calls.push(structuredClone(input));
  if (input.action === 'prepare_source') {
    const job: SourceJobView = { jobId: input.requestId, revision: 1, stage: scenario === 'failed' ? 'failed' : 'needs_details', canAdvance: false,
      identity: { ...input.identity, course: '9BS0', tier: scenario === 'tier' ? 'not_tiered' : null }, mode: input.mode,
      assessmentConfirmed: true, progress: { completed: 1, total: 2 },
      message: scenario === 'failed' ? 'This build stopped safely. Your saved profiles are unchanged.' : 'We need a little more assessment information.',
      ...(scenario === 'failed' ? {
        validationIssues: [{ attempt: 1, stage: 'extraction' as const, code: 'identity_conflict', field: 'tier', message: 'The returned tier did not match your selection.' }],
        validationContext: { component: '9BS0/01', documents: [{ document: 1, pages: [13,14,17,18,39,40,45] }] },
      } : { missingItems: scenario === 'tier' ? [{ field: 'tier' as const, question: 'These sources do not establish the assessment tier.', choices: [{ value: 'unknown_practice', label: 'Continue as short practice with tier unverified' }] }] : [{ field: 'source_pages' as const, question: "Which PDF page has this information? Add the syllabus page listing this paper's topics.", choices: [{ value: '1:18', label: 'PDF page 18 · printed page 6' }, { value: '1:40', label: 'PDF page 40 · printed page 28' }] }] }),
    };
    jobs.set(job.jobId, job); return { job: structuredClone(job) };
  }
  if (input.action === 'answer_source') {
    const previous = jobs.get(input.jobId)!;
    const next: SourceJobView = { ...previous, revision: 2, stage: 'ready', missingItems: [], message: 'Your assessment is ready to confirm.' };
    if (input.answers.tier) { next.mode = 'short_practice'; next.identity = { ...previous.identity!, tier: null }; }
    else {
      const requested = String(input.answers.source_pages).split(',').map(Number);
      const index = indexDocumentPages(pages, { component: '9BS0/01', componentAliases: ['Paper 1'], qualification: 'A-level', course: '9BS0', sourcePages: requested });
      if (!index.coverage.complete) throw Error(index.coverage.reason);
      const read = new Set(index.chunks.flatMap(chunk => chunk.pages.map(page => page.page)));
      next.pageReview = [{ document: 1, requestedPages: requested, readPages: requested.filter(page => read.has(page)), skippedPages: requested.filter(page => !read.has(page)), diagnostics: index.pageDiagnostics }];
    }
    jobs.set(next.jobId, next); return { job: structuredClone(next) };
  }
  if (input.action === 'source_status') return { job: structuredClone(jobs.get(input.jobId)!) };
  throw Error('Only controlled preparation, clarification and status are enabled.');
};
Object.assign(window, { __fixtures: { text }, __calls: () => structuredClone(calls) });
function App() {
  const [open, setOpen] = useState(false);
  return <WorkspaceContext.Provider value={{ ownerId: owner, ready: true, store }}><main className="min-h-screen bg-background p-4 text-foreground">
    <h1 className="font-serif text-2xl">Business page recovery verification</h1><p>Offline synthetic API; no account or AI calls.</p>
    <button className="min-h-11 rounded border px-4" onClick={() => setOpen(true)}>Build Business profile</button>
    <ExamProfileBuilder subjectName="Business" examBoard="Pearson Edexcel" educationalLevel="level3" curriculumRegion="GB" accountId={owner} initialMode={scenario === 'tier' ? 'full_mock' : 'short_practice'} open={open} onOpenChange={setOpen} api={api} />
  </main></WorkspaceContext.Provider>;
}
createRoot(document.getElementById('root')!).render(<MemoryRouter><App /></MemoryRouter>);
