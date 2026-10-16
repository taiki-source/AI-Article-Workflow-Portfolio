
import 'dotenv/config';
import fs from 'node:fs';
import { google } from 'googleapis';

const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
const credentialsPath = process.env.GOOGLE_CREDENTIALS_PATH;

if (!spreadsheetId || !credentialsPath) {
  throw new Error('Google Sheets configuration is missing in .env');
}

function planSave(row) {
  const [
    theme = '', title = '', body = '',
    decision = '', instruction = '',
    revisedTitle = '', revisedBody = '',
    revisedDecision = '', status = '',
    savedTitle = '', savedBody = ''
  ] = row.map(value => String(value ?? ''));

  if ([status, savedTitle, savedBody].some(v => v.trim())) {
    return { action: 'SKIP' };
  }

  // 修正後の記事がある場合は、初回承認より優先する
  if (revisedTitle.trim() || revisedBody.trim()) {
    if (!revisedTitle.trim() || !revisedBody.trim()) {
      return { action: 'WAIT' };
    }

    if (revisedDecision.trim() === '承認') {
      return {
        action: 'SAVE_REVISED',
        title: revisedTitle,
        body: revisedBody
      };
    }

    return { action: 'WAIT' };
  }

  // 初回記事が承認された場合
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
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
  });

  const sheets = google.sheets({ version: 'v4', auth });

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'L2:V100'
  });

  const rows = response.data.values ?? [];

  console.log('--- Portfolio Integrated Save ---');
  console.log('MODE: DRY RUN / READ ONLY');

  const summary = {
    SAVE_ORIGINAL: 0,
    SAVE_REVISED: 0,
    SKIP: 0,
    WAIT: 0
  };

  for (const [index, row] of rows.entries()) {
    if (!row.some(value => String(value ?? '').trim())) {
      continue;
    }

    const result = planSave(row);
    const rowNumber = index + 2;

    summary[result.action]++;

    console.log(`Row ${rowNumber}: ${result.action}`);

    if (result.action.startsWith('SAVE_')) {
      console.log(`  Target: T${rowNumber}:V${rowNumber}`);
      console.log(`  Title: ${result.title}`);
      console.log(`  Body length: ${result.body.length}`);
    }
  }

  console.log('SUMMARY:', JSON.stringify(summary));
  console.log('Actual writes: 0');
  console.log('OpenAI API requests: 0');
}

main().catch(error => {
  console.error('ERROR:', error.name);
  process.exitCode = 1;
});
