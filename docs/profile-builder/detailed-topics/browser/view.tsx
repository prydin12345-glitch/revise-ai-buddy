import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { ExamProfileBuilder } from '../../../../src/components/profiles/ExamProfileBuilder';
import { WorkspaceContext, WorkspaceStore } from '../../../../src/hooks/use-workspace-session';
import type { BuilderApi } from '../../../../src/lib/profile-builder-client';
import { ownerEvidence, templateFixture } from '../../../../supabase/tests/profile-builder-fixtures';
import { evidenceFingerprint, validateEvidence } from '../../../../supabase/functions/_shared/profile-evidence';
import {
  builderRequestSchema, prepareProfileSave, type BuilderProposal,
} from '../../../../supabase/functions/_shared/profile-builder-service';
import {
  checksum, type SavedTemplateContext,
} from '../../../../supabase/functions/_shared/profile-template';

const scenario = new URLSearchParams(location.search).get('scenario') === 'legacy' ? 'legacy' : 'detailed';
const owner = 'synthetic-browser-owner';
const store = new WorkspaceStore(owner);
const receipt = '10000000-0000-4000-8000-000000000001';
const profileId = '20000000-0000-4000-8000-000000000001';
const storageKey = `synthetic:detailed-topic-browser:v1:${scenario}`;
const copy = <T,>(value: T): T => structuredClone(value);
const topics = ['1.1.1 Market research', '1.1.2 Market positioning', '2.1.1 Sources of finance'];
const broadTopics = ['Marketing and people', 'Business strategy'];
const addedTopic = 'Independent pricing experiment';
const research = '1.1.1 Market research\na) Primary research: ethnographic observation and customer interviews.\nb) Secondary research: published market reports; evaluate reliability and sampling bias.';
const researchContinuation = '1.1.1 Market research\nc) Compare qualitative and quantitative methods and explain how sample size affects confidence in the findings.';
const positioning = '1.1.2 Market positioning\na) Use a market map to compare price and quality.\nb) Evaluate product differentiation and the usefulness of a unique selling proposition.';
const finance = '2.1.1 Sources of finance\na) Compare retained profit, bank loans, share capital and crowdfunding.\nb) Explain how the choice depends on business size, risk, cost and repayment terms.\nc) Evaluate the suitability of a hypothetical microenterprise/community/cooperative/long-term-investment scenario with evidence from the assessment brief.';

interface SyntheticProfile {
  id: string;
  profile_name: string;
  profile_template: SavedTemplateContext;
}
interface FixtureState {
  profile: SyntheticProfile;
  calls: Record<string, unknown>[];
  updateEvents: number;
}

async function boot() {
  const evidence = await ownerEvidence();
  evidence.identity = {
    ...evidence.identity, educationSystem: 'US', qualification: 'College (4-year)',
    subject: 'Business', course: 'BUS101', module: 'Markets and finance',
  };
  evidence.facts.topics = scenario === 'legacy' ? broadTopics : topics;
  const details = [
    { topic: topics[0], path: ['Theme 1: Marketing and people', '1.1 Meeting customer needs'], sources: [
      { documentId: 'owner-doc', page: 14, text: research },
      { documentId: 'owner-doc', page: 15, text: researchContinuation },
    ] },
    { topic: topics[1], path: ['Theme 1: Marketing and people', '1.1 Meeting customer needs'], sources: [
      { documentId: 'owner-doc', page: 16, text: positioning },
    ] },
    { topic: topics[2], path: ['Theme 2: Business activities', '2.1 Raising finance'], sources: [
      { documentId: 'owner-doc', page: 27, text: finance },
    ] },
  ];
  // Each detail is literal synthetic source text. The same production validation
  // and evidence fingerprint used by the builder must accept this saved context.
  if (scenario === 'detailed') evidence.topicDetails = details;
  const summary = `BUS101 Final. This assessment is untiered. 6 marks; 30 minutes. ${evidence.facts.topics.join('; ')}. Short structured answers. Answer all questions. No calculator allowed.`;
  const source = [summary, ...(scenario === 'detailed' ? [research, researchContinuation, positioning, finance] : [])].join('\n\n');
  evidence.documents[0] = {
    ...evidence.documents[0], title: 'Synthetic Business syllabus', checksum: await checksum(source),
    locations: [
      { id: 'brief', page: 1, section: 'Assessment brief', text: summary },
      ...(scenario === 'detailed' ? details.flatMap(detail => detail.sources.map((item, index) => ({
        id: `topic-${item.page}-${index}`, page: item.page, section: detail.topic, text: item.text,
      }))) : []),
    ],
  };
  evidence.claims = evidence.claims.map(claim => claim.field === 'topics'
    ? { ...claim, quote: evidence.facts.topics.join('; ') } : claim);
  const checkedEvidence = validateEvidence(evidence);
  const template = templateFixture();
  template.identity = copy(checkedEvidence.identity);
  template.mode = 'full_mock';
  template.topics = copy(checkedEvidence.facts.topics);
  template.sections[0].title = 'Synthetic Business assessment';
  template.sections[0].groups[0].parts[0].topic = template.topics[0];
  template.sections[0].groups[0].parts[1].topic = template.topics.at(-1)!;
  template.designDecisions = ['Two short-answer parts are a synthetic fixture layout choice.'];
  const proposal: BuilderProposal = {
    proposalVersion: 1, promptVersion: 1, origin: 'source_backed_ai',
    template, evidence: checkedEvidence, evidenceVersion: await evidenceFingerprint(checkedEvidence),
    presetId: null, profileSettings: null,
  };
  const prepared = prepareProfileSave(proposal, template);
  prepared.context.proposalId = receipt;
  const seed: SyntheticProfile = {
    id: profileId, profile_name: scenario === 'legacy' ? 'Synthetic legacy profile' : 'Synthetic detailed profile',
    profile_template: prepared.context,
  };
  const state: FixtureState = JSON.parse(localStorage.getItem(storageKey) || 'null') || {
    profile: copy(seed), calls: [], updateEvents: 0,
  };
  const persist = () => localStorage.setItem(storageKey, JSON.stringify(state));
  const api: BuilderApi = async input => {
    state.calls.push(copy(input));
    persist();
    const request = builderRequestSchema.parse(input);
    if (request.action !== 'save') throw Error('Only the synthetic save action is enabled.');
    if (request.profileId !== profileId || request.proposalId !== receipt || request.subjectName !== 'Business')
      throw Error('Synthetic save receipt/owner scope mismatch.');
    // Derive context from the original owned proposal, never request evidence.
    const result = prepareProfileSave(proposal, request.template);
    result.context.proposalId = receipt;
    state.profile = { id: profileId, profile_name: request.profileName, profile_template: result.context };
    persist();
    return { profile: copy(state.profile), approval: result.approval };
  };
  window.addEventListener('examly-profiles-updated', () => { state.updateEvents++; persist(); });
  Object.assign(window, {
    __detailedFixture: () => copy({
      scenario, seed, proposal, state, topics, broadTopics, addedTopic,
      excerpts: { research, researchContinuation, positioning, finance },
      boundary: 'Actual builder and prepareProfileSave; synthetic injected API and synthetic-only local persistence.',
    }),
  });

  function App() {
    const [open, setOpen] = useState(false);
    return <WorkspaceContext.Provider value={{ ownerId: owner, ready: true, store }}>
      <main className="min-h-screen bg-background p-4 text-foreground">
        <div className="mx-auto max-w-3xl space-y-4">
          <h1 className="font-serif text-2xl">Detailed topic verification</h1>
          <p className="text-sm text-muted-foreground">Synthetic saved profile · offline API · no student data</p>
          <button className="min-h-11 rounded-md border border-border px-4" onClick={() => setOpen(true)}>Edit saved profile</button>
          <ExamProfileBuilder subjectName="Business" examBoard="Example University" educationalLevel="undergrad"
            curriculumRegion="US" accountId={owner} initialProfile={state.profile} open={open} onOpenChange={setOpen}
            onManual={() => { throw Error('Manual navigation is outside the saved-profile fixture.'); }} api={api} />
        </div>
      </main>
    </WorkspaceContext.Provider>;
  }
  createRoot(document.getElementById('root')!).render(<MemoryRouter><App /></MemoryRouter>);
}

boot().catch(error => {
  console.error(error);
  const root = document.getElementById('root')!;
  root.textContent = `Synthetic fixture setup failed: ${error.message}`;
  root.dataset.fixtureError = 'true';
});
