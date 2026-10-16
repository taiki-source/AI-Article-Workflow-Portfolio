

import 'dotenv/config';
import fs from 'node:fs';
import { google } from 'googleapis';


const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
const credentialsPath = process.env.GOOGLE_CREDENTIALS_PATH;

if (!spreadsheetId || !credentialsPath) {
  throw new Error('Google Sheets configuration is missing in .env');
}

const writeMode = process.argv.includes('--write');
const targets = [6, 7, 8];

function planSave(row) {
  const a = Array.from(
    { length: 11 },
    (_, i) => String(row[i] ?? '')
  );

  const [
    theme, title, body, decision, instruction,
    revisedTitle, revisedBody, revisedDecision,
    status, savedTitle, savedBody
  ] = a;

  if ([status, savedTitle, savedBody].some(v => v.trim())) {
    return { action: 'SKIP' };
  }

  if (revisedTitle.trim() || revisedBody.trim()) {
    if (
      decision.trim() === '修正' &&
      revisedTitle.trim() &&
      revisedBody.trim() &&
      revisedDecision.trim() === '承認'
    ) {
      return {
        action: 'SAVE_REVISED',
        title: revisedTitle,
        body: revisedBody
      };
    }
    return { action: 'WAIT' };
  }

  if (
    title.trim() &&
    body.trim() &&
    decision.trim() === '承認'
  ) {
    return {
      action: 'SAVE_ORIGINAL',
      title,
      body
    };
  }

  return { action: 'WAIT' };
}

async function main() {
  if (!fs.existsSync(credentialsPath)) {
    throw new Error('Credentials file not found');
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: credentialsPath,
    scopes: [
      writeMode
        ? 'https://www.googleapis.com/auth/spreadsheets'
        : 'https://www.googleapis.com/auth/spreadsheets.readonly'
    ]
  });

  const sheets = google.sheets({ version: 'v4', auth });

  console.log('--- Portfolio Save Execution ---');
  console.log('MODE:', writeMode ? 'WRITE' : 'DRY RUN');

  for (const n of targets) {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `L${n}:V${n}`
    });

    const originalRow = response.data.values?.[0] ?? [];
    const plan = planSave(originalRow);

    if (!plan.action.startsWith('SAVE_')) {
      console.log(`Row ${n}: ${plan.action}`);
      continue;
    }

    console.log(`Row ${n}: ${plan.action}`);
    console.log(`Target: T${n}:V${n}`);

    if (!writeMode) {
      console.log('DRY RUN: no changes');
      continue;
    }

    // 保存直前に再取得して変更がないか確認
    const latestResponse =
      await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `L${n}:V${n}`
      });

    const latest = latestResponse.data.values?.[0] ?? [];

    if (JSON.stringify(latest) !== JSON.stringify(originalRow)) {
      console.log(`Row ${n}: STOP (source changed)`);
      continue;
    }

    const checked = planSave(latest);

    if (
      checked.action !== plan.action ||
      checked.title !== plan.title ||
      checked.body !== plan.body
    ) {
      console.log(`Row ${n}: STOP (approval changed)`);
      continue;
    }

    const values = [
      '承認済み',
      plan.title,
      plan.body
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `T${n}:V${n}`,
      valueInputOption: 'RAW',
      requestBody: { values: [values] }
    });

    const verify = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `T${n}:V${n}`
    });

    const saved = verify.data.values?.[0] ?? [];

    if (JSON.stringify(saved) !== JSON.stringify(values)) {
      throw new Error(`Row ${n}: save verification failed`);
    }

    console.log(`Row ${n}: SAVED AND VERIFIED`);
  }

  console.log('Portfolio save execution finished.');
}

main().catch(error => {
  console.error('ERROR:', error.name, error.message);
  process.exitCode = 1;
});
