import {afterEach, expect, it} from 'vitest';
import {cleanup, render} from '@testing-library/react';
import {WaveDiagramRenderer} from '@/components/physics/diagrams/WaveDiagramRenderer';

afterEach(cleanup);
it.each([1, 2, 3])('draws %i half-waves with nodes matching the specified standing-wave harmonic', (harmonicNumber) => {
  const view = render(<WaveDiagramRenderer config={{type:'wave_diagram',variant:'standing_wave',harmonicNumber,amplitude:1}} mode="assessment" />);
  const outline = view.container.querySelector('path')!.getAttribute('d')!;
  const ys = [...outline.matchAll(/[ML] [\d.-]+ ([\d.-]+)/g)].map(point => Number(point[1]));
  const signs = ys.map(y => Math.sign(Math.round((140 - y) * 10))).filter(Boolean);
  const lobes = signs.filter((sign, index) => index === 0 || sign !== signs[index - 1]).length;
  expect(lobes).toBe(harmonicNumber);
  expect(ys[0]).toBe(140);
  expect(ys.at(-1)).toBe(140);
  expect(view.container.querySelectorAll('circle')).toHaveLength(harmonicNumber + 1);
  const fill = view.container.querySelector('path[fill]:not([fill="none"])')!.getAttribute('d')!;
  expect(fill).toMatch(/^M [\d.-]+ [\d.-]+(?: L [\d.-]+ [\d.-]+)+ Z$/);
});
