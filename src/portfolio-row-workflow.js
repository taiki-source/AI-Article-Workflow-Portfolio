export const FIRST_DATA_ROW = 2;
export const DATA_RANGE = 'L2:V';
export const WORKFLOW_COLUMNS = [
  'theme', 'title', 'body', 'decision', 'instruction',
  'revisedTitle', 'revisedBody', 'revisedDecision',
  'savedStatus', 'savedTitle', 'savedBody'
];
export const WORKFLOW_HEADERS = [
  'テーマ', '記事タイトル', '記事本文', '初回判定', '修正指示',
  '修正後タイトル', '修正後本文', '修正後判定', '保存状態',
  '保存済みタイトル', '保存済み本文'
];

function normalizedHeader(value) {
  return String(value ?? '').trim().normalize('NFKC');
}

export function validateHeaders(headers) {
  const actual = Array.from(
    { length: WORKFLOW_HEADERS.length },
    (_, index) => normalizedHeader(headers[index])
  );
  const duplicateHeaders = [...new Set(
    actual.filter((header, index) =>
      header && actual.indexOf(header) !== index
    )
  )];
  const missingHeaders = WORKFLOW_HEADERS.filter(
    header => !actual.includes(header)
  );
  const unexpectedHeaders = [...new Set(actual.filter(
    header => header && !WORKFLOW_HEADERS.includes(header)
  ))];
  const orderErrors = WORKFLOW_HEADERS
    .map((header, index) =>
      actual[index] === header ? null : {
        column: String.fromCharCode(76 + index),
        expected: header,
        actual: actual[index] || '（空欄）'
      }
    )
    .filter(Boolean);

  return {
    valid: duplicateHeaders.length === 0 &&
      missingHeaders.length === 0 &&
      unexpectedHeaders.length === 0 &&
      orderErrors.length === 0,
    actual,
    duplicateHeaders,
    missingHeaders,
    unexpectedHeaders,
    orderErrors
  };
}

export function headerValidationSummary(result) {
  if (result.valid) return '列構成は一致';

  const details = [];
  if (result.missingHeaders.length) {
    details.push(`欠落: ${result.missingHeaders.join(', ')}`);
  }
  if (result.duplicateHeaders.length) {
    details.push(`重複: ${result.duplicateHeaders.join(', ')}`);
  }
  if (result.unexpectedHeaders.length) {
    details.push(`想定外: ${result.unexpectedHeaders.join(', ')}`);
  }
  if (result.orderErrors.length) {
    details.push(`順序不一致: ${result.orderErrors.map(
      error => error.column
    ).join(', ')}`);
  }
  return details.join(' / ');
}

function text(value) {
  return String(value ?? '').trim();
}

export function isBlankRow(row) {
  return !row.some(value => text(value));
}

export function nextAction(row) {
  const a = Array.from({ length: 11 }, (_, index) => text(row[index]));
  const [
    theme, title, body, decision, instruction,
    revisedTitle, revisedBody, revisedDecision,
    savedStatus, savedTitle, savedBody
  ] = a;

  if ([savedStatus, savedTitle, savedBody].some(Boolean)) return 'SKIP';

  if (revisedTitle || revisedBody) {
    if (!revisedTitle || !revisedBody) return 'WAIT';
    if (decision !== '修正') return 'WAIT';
    if (revisedDecision === '承認') return 'SAVE_REVISED';
    if (revisedDecision === '却下') return 'REJECT';
    if (revisedDecision === '修正') return 'WAIT_NEW_INSTRUCTION';
    return 'WAIT_REVIEW';
  }

  if (title || body) {
    if (!title || !body) return 'WAIT';
    if (decision === '承認') return 'SAVE_ORIGINAL';
    if (decision === '却下') return 'REJECT';
    if (decision === '修正') {
      return instruction ? 'REVISE' : 'WAIT_INSTRUCTION';
    }
    return 'WAIT_REVIEW';
  }

  return theme ? 'GENERATE' : 'WAIT_THEME';
}

export function actionReason(row, action = nextAction(row)) {
  const a = Array.from({ length: 11 }, (_, index) => text(row[index]));
  const [
    theme, title, body, decision, instruction,
    revisedTitle, revisedBody, revisedDecision,
    savedStatus, savedTitle, savedBody
  ] = a;

  if ([savedStatus, savedTitle, savedBody].some(Boolean)) return '保存済み列に値あり';
  if (action === 'GENERATE') return 'テーマあり、記事未作成';
  if (action === 'REVISE') return '初回記事あり、修正指示あり';
  if (action === 'SAVE_ORIGINAL') return '初回記事が承認済み、保存先は空';
  if (action === 'SAVE_REVISED') return '修正記事が承認済み、保存先は空';
  if (action === 'REJECT') return '却下済み';
  if (action === 'WAIT_INSTRUCTION') return '修正判断だが指示なし';
  if (action === 'WAIT_NEW_INSTRUCTION') return '再修正には専用指示欄が必要';
  if (action === 'WAIT_REVIEW') return '承認判断待ち';
  if (action === 'WAIT_THEME') return 'テーマ未入力';
  if ((title && !body) || (!title && body)) return '記事のタイトルまたは本文が不足';
  if ((revisedTitle && !revisedBody) || (!revisedTitle && revisedBody)) {
    return '修正記事のタイトルまたは本文が不足';
  }
  if (decision !== '修正' && (revisedTitle || revisedBody || revisedDecision)) {
    return '修正記事はあるが初回判断が修正ではない';
  }
  if (instruction) return '現在の状態では修正指示を使用しない';
  if (theme) return '現在の状態ではテーマを使用しない';
  return '処理条件を満たさない';
}

export function planSave(row) {
  const action = nextAction(row);
  const a = Array.from({ length: 11 }, (_, index) => text(row[index]));

  if (action === 'SAVE_ORIGINAL') return { action, title: a[1], body: a[2] };
  if (action === 'SAVE_REVISED') return { action, title: a[5], body: a[6] };
  return { action };
}

export function findFirstTarget(rows, wantedAction) {
  for (const [index, row] of rows.entries()) {
    if (!isBlankRow(row) && nextAction(row) === wantedAction) {
      return { rowNumber: FIRST_DATA_ROW + index, row };
    }
  }
  return null;
}
