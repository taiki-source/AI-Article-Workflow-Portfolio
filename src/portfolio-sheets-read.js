
import 'dotenv/config';
import fs from 'node:fs';
import { google } from 'googleapis';

const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
const credentialsPath = process.env.GOOGLE_CREDENTIALS_PATH;

if (!spreadsheetId || !credentialsPath) {
  throw new Error('Google Sheets configuration is missing in .env');
}

function decideNextAction(row) {
  const [
    theme = '',
    title = '',
    body = '',
    decision = '',
    instruction = '',
    revisedTitle = '',
    revisedBody = '',
    revisedDecision = '',
    savedStatus = '',
    savedTitle = '',
    savedBody = ''
  ] = row;

  if ([savedStatus, savedTitle, savedBody].some(
    value => String(value).trim()
  )) return 'SKIP';

  if (revisedTitle && revisedBody) {
    if (revisedDecision === '承認') return 'SAVE_REVISED';
    if (revisedDecision === '却下') return 'REJECT';

    if (revisedDecision === '修正') {
      return instruction.trim()
        ? 'REVISE_AGAIN'
        : 'WAIT_INSTRUCTION';
    }

    return 'WAIT_REVIEW';
  }

  if (title && body) {
    if (decision === '承認') return 'SAVE_ORIGINAL';
    if (decision === '却下') return 'REJECT';

    if (decision === '修正') {
      return instruction.trim()
        ? 'REVISE'
        : 'WAIT_INSTRUCTION';
    }

    return 'WAIT_REVIEW';
  }

  return String(theme).trim() ? 'GENERATE' : 'WAIT_THEME';
}

async function main() {
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

  console.log('--- Portfolio Sheets Integration ---');
  console.log('MODE: READ ONLY');

  let count = 0;

  for (const [index, row] of rows.entries()) {
    if (!row.some(value => String(value ?? '').trim())) {
      continue;
    }

    const action = decideNextAction(row);

    console.log(`Row ${index + 2}: ${action}`);
    count++;
  }

  console.log('Articles checked:', count);
  console.log('OpenAI API requests: 0');
  console.log('Google Sheets writes: 0');
}

main().catch(error => {
  console.error('ERROR:', error.name, error.message);
  process.exitCode = 1;
});
