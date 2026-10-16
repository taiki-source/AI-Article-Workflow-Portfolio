
import 'dotenv/config';
import { google } from 'googleapis';
import { reviseArticle } from './portfolio-ai.js';

const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
const credentialsPath = process.env.GOOGLE_CREDENTIALS_PATH;

if (!spreadsheetId || !credentialsPath) {
  throw new Error('Google Sheets configuration is missing in .env');
}

const execute = process.argv.includes('--revise');
const REVISION = '\u4fee\u6b63';

async function main() {
  const auth = new google.auth.GoogleAuth({
    keyFile: credentialsPath,
    scopes: [
      execute
        ? 'https://www.googleapis.com/auth/spreadsheets'
        : 'https://www.googleapis.com/auth/spreadsheets.readonly'
    ]
  });

  const sheets = google.sheets({ version: 'v4', auth });

  async function readRow() {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'L8:V8'
    });

    return response.data.values?.[0] ?? [];
  }

  const row = await readRow();

  const title = String(row[1] ?? '').trim();
  const body = String(row[2] ?? '').trim();
  const decision = String(row[3] ?? '').trim();
  const instruction = String(row[4] ?? '').trim();

  console.log('--- Portfolio Article Revision ---');
  console.log('MODE:', execute ? 'AI REVISION + WRITE' : 'DRY RUN');

  // 修正記事や保存済みデータがあれば停止
  if (row.slice(5).some(value => String(value ?? '').trim())) {
    console.log('SKIP: Revision or saved data already exists');
    return;
  }

  if (
    !title ||
    !body ||
    decision !== REVISION ||
    !instruction
  ) {
    console.log('WAIT: Revision conditions not met');
    return;
  }

  if (!execute) {
    console.log('Row 8: READY_TO_REVISE');
    console.log('OpenAI API requests: 0');
    console.log('Google Sheets writes: 0');
    return;
  }

  const article = await reviseArticle(
    title,
    body,
    instruction
  );

  // AI処理中の変更を確認
  const latest = await readRow();

  if (JSON.stringify(latest) !== JSON.stringify(row)) {
    console.log('STOP: Sheet changed during AI revision');
    return;
  }

  if (latest.slice(5).some(value => String(value ?? '').trim())) {
    console.log('STOP: Revision data already exists');
    return;
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'Q8:R8',
    valueInputOption: 'RAW',
    requestBody: {
      values: [[article.title, article.body]]
    }
  });

  const verify = await readRow();

  if (
    verify[5] !== article.title ||
    verify[6] !== article.body
  ) {
    throw new Error('Revision save verification failed');
  }

  console.log('REVISED ARTICLE SAVED AND VERIFIED');
  console.log('Title:', article.title);
  console.log('Body length:', article.body.length);
  console.log('Next action: WAIT_REVIEW');
}

main().catch(error => {
  console.error('ERROR:', error.message);
  process.exitCode = 1;
});
