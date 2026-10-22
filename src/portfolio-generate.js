import 'dotenv/config';
import { google } from 'googleapis';
import { generateArticle } from './portfolio-ai.js';
import {
  DATA_RANGE,
  findFirstTarget,
  headerValidationSummary,
  validateHeaders
} from './portfolio-row-workflow.js';

const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
const credentialsPath = process.env.GOOGLE_CREDENTIALS_PATH;
const runAI = process.argv.includes('--generate');

if (!spreadsheetId || !credentialsPath) {
  throw new Error('Google Sheets configuration is missing in .env');
}

async function main() {
  const auth = new google.auth.GoogleAuth({
    keyFile: credentialsPath,
    scopes: [runAI
      ? 'https://www.googleapis.com/auth/spreadsheets'
      : 'https://www.googleapis.com/auth/spreadsheets.readonly']
  });
  const sheets = google.sheets({ version: 'v4', auth });
  const headers = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'L1:V1' });
  const headerCheck = validateHeaders(headers.data.values?.[0] ?? []);
  if (!headerCheck.valid) {
    console.log(`STOP: Header validation failed (${headerValidationSummary(headerCheck)})`);
    return;
  }
  const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: DATA_RANGE });
  const target = findFirstTarget(response.data.values ?? [], 'GENERATE');
  console.log('--- Portfolio Article Generator ---');
  console.log('MODE:', runAI ? 'GENERATE + WRITE' : 'DRY RUN');
  if (!target) return console.log('STOP: No row is ready to generate');

  const readRow = async () => {
    const current = await sheets.spreadsheets.values.get({
      spreadsheetId, range: `L${target.rowNumber}:V${target.rowNumber}`
    });
    return current.data.values?.[0] ?? [];
  };
  const theme = String(target.row[0] ?? '').trim();
  console.log(`Row ${target.rowNumber}: READY_TO_GENERATE`);
  if (!runAI) {
    console.log('OpenAI API requests: 0');
    console.log('Google Sheets writes: 0');
    return;
  }
  const article = await generateArticle(theme);
  const latest = await readRow();
  if (JSON.stringify(latest) !== JSON.stringify(target.row) || latest.slice(1).some(value => String(value ?? '').trim())) {
    return console.log('STOP: Sheet changed or article data already exists');
  }
  await sheets.spreadsheets.values.update({
    spreadsheetId, range: `M${target.rowNumber}:N${target.rowNumber}`,
    valueInputOption: 'RAW', requestBody: { values: [[article.title, article.body]] }
  });
  const verify = await readRow();
  if (verify[1] !== article.title || verify[2] !== article.body) throw new Error('Article save verification failed');
  console.log('ARTICLE GENERATED AND SAVED');
}

main().catch(error => { console.error('ERROR:', error.message); process.exitCode = 1; });
