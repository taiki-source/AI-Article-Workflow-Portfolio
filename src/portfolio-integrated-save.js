import 'dotenv/config';
import fs from 'node:fs';
import { google } from 'googleapis';
import { DATA_RANGE, FIRST_DATA_ROW, isBlankRow, planSave } from './portfolio-row-workflow.js';

const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
const credentialsPath = process.env.GOOGLE_CREDENTIALS_PATH;
if (!spreadsheetId || !credentialsPath) throw new Error('Google Sheets configuration is missing in .env');

async function main() {
  if (!fs.existsSync(credentialsPath)) throw new Error('Credentials file not found');
  const auth = new google.auth.GoogleAuth({ keyFile: credentialsPath, scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] });
  const sheets = google.sheets({ version: 'v4', auth });
  const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: DATA_RANGE });
  const summary = { SAVE_ORIGINAL: 0, SAVE_REVISED: 0, SKIP: 0, WAIT: 0 };
  console.log('--- Portfolio Integrated Save ---');
  console.log('MODE: DRY RUN / READ ONLY');
  for (const [index, row] of (response.data.values ?? []).entries()) {
    if (isBlankRow(row)) continue;
    const plan = planSave(row);
    summary[plan.action] = (summary[plan.action] ?? 0) + 1;
    console.log(`Row ${FIRST_DATA_ROW + index}: ${plan.action}`);
  }
  console.log('SUMMARY:', JSON.stringify(summary));
  console.log('Actual writes: 0');
  console.log('OpenAI API requests: 0');
}

main().catch(error => { console.error('ERROR:', error.name); process.exitCode = 1; });
