import assert from 'node:assert/strict';
import { findFirstTarget, nextAction, planSave, validateHeaders } from './portfolio-row-workflow.js';

const headers = [
  'テーマ', '記事タイトル', '記事本文', '初回判定', '修正指示',
  '修正後タイトル', '修正後本文', '修正後判定', '保存状態',
  '保存済みタイトル', '保存済み本文'
];

assert.equal(validateHeaders(headers).valid, true);
assert.equal(nextAction(['テーマ']), 'GENERATE');
assert.equal(nextAction(['テーマ', '題', '本文']), 'WAIT_REVIEW');
assert.equal(nextAction(['テーマ', '題', '本文', '修正', '分かりやすく']), 'REVISE');
assert.equal(nextAction(['テーマ', '題', '本文', '修正', '指示', '修正版', '本文', '承認']), 'SAVE_REVISED');
assert.equal(nextAction(['テーマ', '題', '本文', '承認', '', '', '', '', '承認済み']), 'SKIP');
assert.deepEqual(planSave(['テーマ', '題', '本文', '承認']), { action: 'SAVE_ORIGINAL', title: '題', body: '本文' });
assert.equal(findFirstTarget([[], ['テーマ']], 'GENERATE').rowNumber, 3);
console.log('Workflow mock test: PASS');
console.log('OpenAI API requests: 0');
console.log('Google Sheets writes: 0');
