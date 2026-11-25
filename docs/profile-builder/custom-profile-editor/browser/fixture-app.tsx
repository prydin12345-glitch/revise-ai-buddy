import React, { useRef, useState } from 'react';
import { ExamProfileModal } from '../../../../src/components/stats/ExamProfileModal';
import { useSubjectProfiles, type ExamProfile } from '../../../../src/hooks/useSubjectProfiles';
import { WorkspaceContext, WorkspaceStore } from '../../../../src/hooks/use-workspace-session';
import { workspaceQueryClient } from '../../../../src/lib/workspace-query-client';
import { buildCustomProfilePayload, type ProfileSaveArgs, type ProfileSaveResult } from '../../../../src/lib/custom-profile-save';
import { fixtureLibrary, fixtureOtherOwner, fixtureOwner, makeFixture } from './fixtures';
import { copy, memory, resetMemory } from './offline-client';

export function createFixtureRuntime(scenario: 'custom' | 'guided' | 'legacy' = 'custom', creating = false, overrides: Partial<ReturnType<typeof makeFixture>> = {}) {
  const seed = { ...makeFixture(scenario), ...copy(overrides) };
  const otherOwnerRow = { ...copy(seed), id: 'synthetic-other-owner-profile', user_id: fixtureOtherOwner, profile_name: 'Other owner sentinel' };
  resetMemory(creating ? [otherOwnerRow] : [seed, otherOwnerRow]);
  const store = new WorkspaceStore(fixtureOwner);
  const client = workspaceQueryClient(store);
  // Seed only the actual hook's read cache. Every mutation still uses the real hook.
  client.setQueryDefaults(['workspace-profiles'], { staleTime: Infinity, gcTime: Infinity });
  client.setQueryData(['workspace-profiles'], {
    masterTopics: fixtureLibrary.map((topic, index) => ({ id: `synthetic-topic-${index}`, subject_name: seed.subject_name, topic })),
    examProfiles: creating ? [] : [copy(seed)],
  });
  const state = {
    profileId: creating ? null as string | null : seed.id,
    saves: [] as Array<{ args: ProfileSaveArgs; payload: ReturnType<typeof buildCustomProfilePayload>; result: ProfileSaveResult }>,
    closeEvents: 0,
  };
  return {
    seed, store, client, state, creating, scenario,
    snapshot: () => copy({
      seed, scenario, creating, profile: state.profileId ? memory.rows.get(state.profileId) : null,
      otherOwnerRow: memory.rows.get(otherOwnerRow.id), library: fixtureLibrary,
      rows: [...memory.rows.values()], calls: memory.calls, saves: state.saves,
      closeEvents: state.closeEvents,
    }),
  };
}
export type FixtureRuntime = ReturnType<typeof createFixtureRuntime>;

function Editor({ runtime }: { runtime: FixtureRuntime }) {
  const hook = useSubjectProfiles();
  const [open, setOpen] = useState(false);
  const [opening, setOpening] = useState<ExamProfile | undefined>();
  const createdId = useRef<string | null>(null);
  const onSave = async (...args: ProfileSaveArgs): Promise<ProfileSaveResult> => {
    // Actual SubjectDetail mapper and actual useSubjectProfiles mutations.
    const payload = buildCustomProfilePayload(...args);
    const id = opening?.id ?? createdId.current;
    const result = id ? await hook.updateProfile(id, payload) : await hook.createProfile(runtime.seed.subject_name, ...args);
    if (result.profileId) { runtime.state.profileId = result.profileId; if (!opening) createdId.current = result.profileId; }
    runtime.state.saves.push(copy({ args, payload, result }));
    return result;
  };
  const openEditor = () => {
    const current = runtime.state.profileId ? memory.rows.get(runtime.state.profileId) : null;
    setOpening(current ? copy(current) as unknown as ExamProfile : undefined);
    createdId.current = null;
    setOpen(true);
  };
  return <main className="min-h-screen bg-background p-6 text-foreground">
    <h1 className="font-serif text-2xl">Custom profile editor verification</h1>
    <p className="my-4 text-sm text-muted-foreground">Synthetic profiles · controlled memory storage · no account network</p>
    <button type="button" className="min-h-11 rounded-md border border-border px-4" onClick={openEditor}>
      {runtime.state.profileId ? 'Edit synthetic profile' : 'Create synthetic profile'}
    </button>
    <ExamProfileModal open={open} onOpenChange={value => { if (!value) runtime.state.closeEvents++; setOpen(value); }}
      subjectName={runtime.seed.subject_name} subjectColor="#956141" examBoard={runtime.seed.exam_board}
      availableTopics={fixtureLibrary} initialData={opening} onSave={onSave} />
  </main>;
}

export function FixtureApp({ runtime }: { runtime: FixtureRuntime }) {
  return <WorkspaceContext.Provider value={{ ownerId: fixtureOwner, ready: true, store: runtime.store }}>
    <Editor runtime={runtime} />
  </WorkspaceContext.Provider>;
}
