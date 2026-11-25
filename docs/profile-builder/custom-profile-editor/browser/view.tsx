import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { createFixtureRuntime, FixtureApp } from './fixture-app';
import { memory } from './offline-client';

const params = new URLSearchParams(location.search);
const scenario = params.get('scenario') === 'guided' ? 'guided' : params.get('scenario') === 'legacy' ? 'legacy' : 'custom';
const runtime = createFixtureRuntime(scenario, params.get('creating') === '1');
Object.assign(window, {
  __customProfileFixture: runtime.snapshot,
  __customProfileFailNextSave: (phase: 'core' | 'tier' = 'core') => { memory.failures[phase] = 1; },
});
createRoot(document.getElementById('root')!).render(<MemoryRouter><FixtureApp runtime={runtime} /></MemoryRouter>);
