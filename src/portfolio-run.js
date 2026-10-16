
import 'dotenv/config';
import fs from 'node:fs';
import { google } from 'googleapis';


const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
const credentialsPath = process.env.GOOGLE_CREDENTIALS_PATH;

if (!spreadsheetId || !credentialsPath) {
  throw new Error('Google Sheets configuration is missing in .env');
}

function nextAction(row) {
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
    return 'SKIP';
  }

  if (revisedTitle.trim() || revisedBody.trim()) {
    if (!revisedTitle.trim() || !revisedBody.trim()) {
      return 'WAIT';
    }

    if (decision.trim() !== '修正') {
      return 'WAIT';
    }

    if (revisedDecision.trim() === '承認') {
      return 'SAVE_REVISED';
    }

    if (revisedDecision.trim() === '却下') {
      return 'REJECT';
    }

    // 再修正は専用の指示欄を用意するまで停止
    if (revisedDecision.trim() === '修正') {
      return 'WAIT_NEW_INSTRUCTION';
    }

    return 'WAIT_REVIEW';
  }

  if (title.trim() || body.trim()) {
    if (!title.trim() || !body.trim()) return 'WAIT';

    if (decision.trim() === '承認') {
      return 'SAVE_ORIGINAL';
    }

    if (decision.trim() === '却下') {
      return 'REJECT';
    }

    if (decision.trim() === '修正') {
      return instruction.trim()
        ? 'REVISE'
        : 'WAIT_INSTRUCTION';
    }

    return 'WAIT_REVIEW';
  }

  if (theme.trim()) return 'GENERATE';

  return 'WAIT_THEME';
}

async function main() {
  if (
    process.argv.includes('--write') ||
    process.argv.includes('--ai')
  ) {
    throw new Error(
      'This version supports read-only dry run only.'
    );
  }

  if (!fs.existsSync(credentialsPath)) {
    throw new Error('Credentials file not found');
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: credentialsPath,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets.readonly'
    ]
  });

  const sheets = google.sheets({
    version: 'v4',
    auth
  });

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'L2:V100'
  });

  const rows = response.data.values ?? [];
  const summary = {};

  console.log('--- Portfolio Unified Workflow ---');
  console.log('MODE: DRY RUN / READ ONLY');

  for (const [index, row] of rows.entries()) {
    if (!row.some(value => String(value ?? '').trim())) {
      continue;
    }

    const action = nextAction(row);
    summary[action] = (summary[action] ?? 0) + 1;

    console.log(`Row ${index + 2}: ${action}`);
  }

  console.log('SUMMARY:', JSON.stringify(summary));
  console.log('OpenAI API requests: 0');
  console.log('Google Sheets writes: 0');
}

main().catch(error => {
  console.error('ERROR:', error.message);
  process.exitCode = 1;
});
