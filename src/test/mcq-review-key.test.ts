import {describe,it,expect} from 'vitest';
import {releasedMcqKeyIndex} from '@/lib/mcq-review-key';
describe('released MCQ review highlighting',()=>{
 it('matches the notation accepted by exam/practice marking',()=>{
  expect(releasedMcqKeyIndex('80\\,μF',['$80\\,\\mu\\mathrm{F}$','100 μF','120 μF','140 μF'])).toBe(0);
  expect(releasedMcqKeyIndex('R',['$r$','$R$','$2R$','$R/2$'])).toBe(1);
  expect(releasedMcqKeyIndex('B',['small','medium','large'])).toBe(1);
 });
 it('keeps ambiguous, contradictory and unreleased keys unhighlighted',()=>{
  expect(releasedMcqKeyIndex(undefined,['a','b','c','d'])).toBeNull();
  expect(releasedMcqKeyIndex('A\n\nB',['small','medium','large','largest'])).toBeNull();
  expect(releasedMcqKeyIndex('A',['$R$','R','2R','3R'])).toBeNull();
 });
});
