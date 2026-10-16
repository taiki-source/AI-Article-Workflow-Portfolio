
import 'dotenv/config';
import { google } from 'googleapis';
import { generateArticle } from './portfolio-ai.js';

const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
const credentialsPath = process.env.GOOGLE_CREDENTIALS_PATH;

if (!spreadsheetId || !credentialsPath) {
  throw new Error('Google Sheets configuration is missing in .env');
}

const runAI = process.argv.includes('--generate');

async function main() {
  const auth = new google.auth.GoogleAuth({
    keyFile: credentialsPath,
    scopes: [
      runAI
        ? 'https://www.googleapis.com/auth/spreadsheets'
        : 'https://www.googleapis.com/auth/spreadsheets.readonly'
    ]
  });

  const sheets = google.sheets({ version: 'v4', auth });

  const readRow = async () => {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'L8:V8'
    });

    return response.data.values?.[0] ?? [];
  };

  const row = await readRow();

  const theme = String(row[0] ?? '').trim();

  console.log('--- Portfolio Article Generator ---');
  console.log('MODE:', runAI ? 'GENERATE + WRITE' : 'DRY RUN');
  console.log('Theme:', theme);

  if (!theme) {
    console.log('STOP: Theme is empty');
    return;
  }

  if (row.slice(1).some(v => String(v ?? '').trim())) {
    console.log('SKIP: Article data already exists');
    return;
  }

  if (!runAI) {
    console.log('READY: Article can be generated');
    console.log('OpenAI API requests: 0');
    console.log('Google Sheets writes: 0');
    return;
  }

  const article = await generateArticle(theme);

  // AI生成中に人間が変更していないか再確認
  const latest = await readRow();

  if (JSON.stringify(latest) !== JSON.stringify(row)) {
    console.log('STOP: Sheet changed during generation');
    return;
  }

  if (
    latest.slice(1).some(v => String(v ?? '').trim())
  ) {
    console.log('STOP: Article data already exists');
    return;
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'M8:N8',
    valueInputOption: 'RAW',
    requestBody: {
      values: [[article.title, article.body]]
    }
  });

  const verify = await readRow();

  if (
    verify[1] !== article.title ||
    verify[2] !== article.body
  ) {
    throw new Error('Article save verification failed');
  }

  console.log('ARTICLE GENERATED AND SAVED');
  console.log('Title:', article.title);
  console.log('Body length:', article.body.length);
  console.log('Next action: WAIT_REVIEW');
}

main().catch(error => {
  console.error('ERROR:', error.message);
  process.exitCode = 1;
});
