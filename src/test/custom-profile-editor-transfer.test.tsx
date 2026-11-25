import React from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { FixtureApp, createFixtureRuntime, type FixtureRuntime } from '../../docs/profile-builder/custom-profile-editor/browser/fixture-app';
import { memory, supabase } from '../../docs/profile-builder/custom-profile-editor/browser/offline-client';
import { fixtureOwner, makeFixture } from '../../docs/profile-builder/custom-profile-editor/browser/fixtures';
import { useSubjectProfiles } from '@/hooks/useSubjectProfiles';
import { WorkspaceContext } from '@/hooks/use-workspace-session';
import { buildCustomProfilePayload, type ProfileSaveArgs } from '@/lib/custom-profile-save';

vi.mock('@/integrations/supabase/client', async () => {
  const offline = await import('../../docs/profile-builder/custom-profile-editor/browser/offline-client');
  return { supabase: offline.supabase };
});
vi.mock('@/hooks/useUserPreferences', () => ({ useUserPreferences: () => ({
  preferences: { preferred_educational_level: 'level2', curriculum_region: 'GB' }, loading: false, error: null,
}) }));

let runtime: FixtureRuntime | undefined;
beforeAll(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, value: () => {} });
});
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() => { throw Error('Unexpected HTTP blocked in custom profile transfer test'); }));
});
afterEach(() => {
  cleanup(); runtime?.client.clear(); runtime = undefined; vi.restoreAllMocks();
});

const modal = () => screen.getByRole('dialog', { name: /Edit exam profile|Create exam profile/ });
const section = (name: string | RegExp) => fireEvent.click(within(modal()).getByRole('button', { name }));
async function open(scenario: 'custom' | 'guided' | 'legacy' = 'custom') {
  runtime = createFixtureRuntime(scenario);
  render(<MemoryRouter><FixtureApp runtime={runtime} /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'Edit synthetic profile' }));
  await screen.findByRole('dialog', { name: 'Edit exam profile' });
  await waitFor(() => expect(within(modal()).getByRole('button', { name: /Topics\s*\d+/ })).toHaveAttribute('aria-current', 'page'));
  return runtime;
}
function rename(value: string) {
  section('Exam settings');
  fireEvent.change(within(modal()).getByRole('textbox', { name: 'Profile name' }), { target: { value } });
}
async function save() {
  fireEvent.click(within(modal()).getByRole('button', { name: 'Update Profile' }));
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Edit exam profile' })).toBeNull());
}
const row = (r: FixtureRuntime) => r.snapshot().profile;

describe('production custom editor → parent mapper → actual hook → owned memory persistence', () => {
  it('sends untouched raw topic strings, duplicates, order and unknown JSON through the actual save mapper without normalization', async () => {
    const rawTopics = ['  Shakespeare  ', 'Poetry anthology', 'Poetry anthology', 'poetry anthology', 'Legacy [link](https://fixtures.invalid/no-fetch)', ''];
    runtime = createFixtureRuntime('custom', false, { topics: rawTopics });
    const r = runtime;
    render(<MemoryRouter><FixtureApp runtime={r} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Edit synthetic profile' }));
    await screen.findByRole('dialog', { name: 'Edit exam profile' });
    section('Exam settings'); section('Paper layout'); section(/Topics\s*\d+/);
    expect(memory.calls).toEqual([]);
    rename('Raw values retained'); await save();
    expect(row(r)).toEqual({ ...r.seed, profile_name: 'Raw values retained' });
    expect(r.state.saves[0].payload.topics).toEqual(rawTopics);
    expect(r.state.saves[0].payload.paper_blueprint).toEqual(r.seed.paper_blueprint);
    expect(r.state.saves[0].payload.studied_texts).toEqual(r.seed.studied_texts);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('preserves every saved setting and unknown nested value after presentation-only browsing, rename, save and reopen', async () => {
    const r = await open();
    expect(within(modal()).getByRole('article', { name: 'Drama and dramatic craft' })).toHaveTextContent('Original name: Shakespeare');
    expect(within(modal()).getByRole('article', { name: 'Legacy local seminar: coastal voices' })).toBeInTheDocument();
    fireEvent.change(within(modal()).getByRole('searchbox', { name: 'Search topics' }), { target: { value: 'nothing matches' } });
    fireEvent.change(within(modal()).getByRole('combobox', { name: 'Sort topics' }), { target: { value: 'alphabetical' } });
    fireEvent.change(within(modal()).getByRole('searchbox', { name: 'Search topics' }), { target: { value: '' } });
    section('Exam settings'); section('Paper layout'); section(/Topics\s*\d+/);
    expect(memory.calls).toEqual([]);
    expect(row(r)).toEqual(r.seed);
    rename('Saved synthetic rename');
    await save();
    expect(row(r)).toEqual({ ...r.seed, profile_name: 'Saved synthetic rename' });
    expect(r.snapshot().otherOwnerRow?.profile_name).toBe('Other owner sentinel');
    expect(r.state.saves[0].payload).toEqual(buildCustomProfilePayload(...r.state.saves[0].args));
    fireEvent.click(screen.getByRole('button', { name: 'Edit synthetic profile' }));
    rename('Saved synthetic rename');
    expect(within(modal()).getByRole('textbox', { name: 'Profile name' })).toHaveValue('Saved synthetic rename');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('keeps canonical topic identity, label metadata and unrelated settings through removal, Undo and label save', async () => {
    const r = await open();
    rename('Name survives Undo'); section(/Topics\s*\d+/);
    fireEvent.click(within(modal()).getByRole('button', { name: 'Remove Legacy local seminar: coastal voices' }));
    expect(within(modal()).queryByRole('article', { name: 'Legacy local seminar: coastal voices' })).toBeNull();
    fireEvent.click(within(modal()).getByRole('button', { name: 'Undo last topic change' }));
    expect(within(modal()).getByRole('article', { name: 'Legacy local seminar: coastal voices' })).toBeInTheDocument();
    fireEvent.click(within(modal()).getByRole('button', { name: 'Edit Drama and dramatic craft' }));
    const existingAlias = await screen.findByRole('dialog', { name: 'Edit topic' });
    fireEvent.change(within(existingAlias).getByRole('textbox', { name: 'Topic name' }), { target: { value: 'Shakespeare in my own words' } });
    fireEvent.click(within(existingAlias).getByRole('button', { name: 'Done' }));
    fireEvent.click(within(modal()).getByRole('button', { name: 'Edit Poetry anthology' }));
    const edit = await screen.findByRole('dialog', { name: 'Edit topic' });
    fireEvent.change(within(edit).getByRole('textbox', { name: 'Topic name' }), { target: { value: 'Poetry in my own words' } });
    fireEvent.click(within(edit).getByRole('button', { name: 'Done' }));
    expect(memory.calls).toEqual([]);
    await save();
    const expected = structuredClone(r.seed);
    expected.profile_name = 'Name survives Undo';
    if (!expected.paper_blueprint || !('topicEdits' in expected.paper_blueprint)) throw Error('Rich fixture required');
    expected.paper_blueprint.topicEdits[0].label = 'Shakespeare in my own words';
    (expected.paper_blueprint.topicEdits as Array<Record<string, unknown>>).push({ topic: 'Poetry anthology', label: 'Poetry in my own words' });
    expect(row(r)).toEqual(expected);
    fireEvent.click(screen.getByRole('button', { name: 'Edit synthetic profile' }));
    expect(await screen.findByRole('article', { name: 'Poetry in my own words' })).toHaveTextContent('Original name: Poetry anthology');
  });

  it('merges an exact-layout mark edit without dropping optional counts or unknown section/question metadata', async () => {
    const r = await open(); section('Paper layout');
    const controls = within(modal()).getAllByRole('spinbutton', { name: 'Question 2 marks' });
    fireEvent.change(controls[0], { target: { value: '9' } });
    await save();
    const expected = structuredClone(r.seed);
    if (!expected.paper_blueprint || !('sections' in expected.paper_blueprint)) throw Error('Rich fixture required');
    expected.paper_blueprint.sections[0].questions[1].marks = 9;
    expect(row(r)).toEqual(expected);
  });

  it('keeps all draft edits on failed update, retries the same row, and Discard restores the reopened state', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = await open(); rename('Retry this exact draft');
    memory.failures.core = 1;
    fireEvent.click(within(modal()).getByRole('button', { name: 'Update Profile' }));
    expect(await within(modal()).findByRole('alert')).toHaveTextContent('Failed to update profile');
    expect(within(modal()).getByRole('textbox', { name: 'Profile name' })).toHaveValue('Retry this exact draft');
    expect(row(r)).toEqual(r.seed);
    expect(r.state.closeEvents).toBe(0);
    await save();
    expect(row(r)).toEqual({ ...r.seed, profile_name: 'Retry this exact draft' });
    expect(memory.calls.filter(call => call.action === 'insert')).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Edit synthetic profile' }));
    rename('Discard this');
    fireEvent.click(within(modal()).getByRole('button', { name: 'Discard changes' }));
    expect(within(modal()).getByRole('textbox', { name: 'Profile name' })).toHaveValue('Retry this exact draft');
    expect(row(r)?.profile_name).toBe('Retry this exact draft');
  });

  it('keeps zero written questions, MCQ-only structure, flat legacy topics and null timing/blueprint', async () => {
    const r = await open('legacy'); rename('Legacy retained'); await save();
    expect(row(r)).toEqual({ ...r.seed, profile_name: 'Legacy retained' });
    expect(row(r)?.written_question_count).toBe(0);
    expect(row(r)?.question_structure).toBe('mcq_only');
    expect(row(r)?.time_limit_minutes).toBeNull();
    expect(row(r)?.paper_blueprint).toBeNull();
  });

  it('preserves versioned guided identity and unknown metadata while topic and timing controls stay locked', async () => {
    const r = await open('guided');
    expect(within(modal()).getByRole('button', { name: 'Add topic' })).toBeDisabled();
    for (const button of within(within(modal()).getByRole('region', { name: 'Profile topics' })).getAllByRole('button', { name: /^Edit |^Remove / })) expect(button).toBeDisabled();
    section('Exam settings');
    expect(within(modal()).getByRole('spinbutton', { name: 'Time limit in minutes' })).toBeDisabled();
    section('Paper layout'); section(/Topics\s*\d+/);
    expect(memory.calls).toEqual([]);
    rename('Guided retained'); await save();
    expect(row(r)).toEqual({ ...r.seed, profile_name: 'Guided retained' });
  });

  it('returns a created ID on a partial tier failure, then updates that row on retry without a duplicate insert', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    runtime = createFixtureRuntime('guided', true);
    const r = runtime;
    const wrapper = ({ children }: { children: React.ReactNode }) => <WorkspaceContext.Provider value={{ ownerId: fixtureOwner, ready: true, store: r.store }}>{children}</WorkspaceContext.Provider>;
    const { result } = renderHook(() => useSubjectProfiles(), { wrapper });
    const seed = makeFixture('guided');
    const args: ProfileSaveArgs = [seed.profile_name, seed.topics, seed.question_count, seed.educational_tier, seed.time_limit_minutes,
      { profilePatch: seed, assessmentTier: 'higher' }, seed.written_question_count];
    // The lossless production patch is exactly what the actual modal supplies.
    memory.failures.tier = 1;
    let partial: Awaited<ReturnType<typeof result.current.createProfile>> | undefined;
    await act(async () => { partial = await result.current.createProfile(seed.subject_name, ...args); });
    expect(partial).toMatchObject({ ok: false, profileId: expect.any(String) });
    expect(memory.calls.filter(call => call.action === 'insert')).toHaveLength(1);
    const id = partial!.profileId!;
    expect(memory.rows.get(id)?.assessment_tier).toBeNull();
    let retried: Awaited<ReturnType<typeof result.current.updateProfile>> | undefined;
    await act(async () => { retried = await result.current.updateProfile(id, buildCustomProfilePayload(...args)); });
    expect(retried).toEqual({ ok: true, profileId: id });
    expect(memory.calls.filter(call => call.action === 'insert')).toHaveLength(1);
    expect([...memory.rows.values()].filter(record => record.user_id === fixtureOwner)).toHaveLength(1);
    expect(memory.rows.get(id)?.assessment_tier).toBe('higher');
    expect(result.current.examProfiles.filter(profile => profile.id === id)).toHaveLength(1);
  });

  it('rejects persistence to the other synthetic owner and never exposes real network access', async () => {
    runtime = createFixtureRuntime();
    const before = runtime.snapshot().otherOwnerRow;
    const result = await supabase.from('subject_exam_profiles').update({ profile_name: 'Forbidden' }).eq('id', 'synthetic-other-owner-profile').single();
    expect(result.error?.message).toMatch(/ownership/);
    expect(runtime.snapshot().otherOwnerRow).toEqual(before);
    expect(() => supabase.from('anything_else')).toThrow(/blocked/);
    expect(fetch).not.toHaveBeenCalled();
  });
});
