import 'dotenv/config';
import fs from 'node:fs';
import { google } from 'googleapis';
import { DATA_RANGE, FIRST_DATA_ROW, isBlankRow, nextAction } from './portfolio-row-workflow.js';

const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
const credentialsPath = process.env.GOOGLE_CREDENTIALS_PATH;
if (!spreadsheetId || !credentialsPath) throw new Error('Google Sheets configuration is missing in .env');

async function main() {
  if (!fs.existsSync(credentialsPath)) throw new Error('Credentials file not found');
  const auth = new google.auth.GoogleAuth({ keyFile: credentialsPath, scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] });
  const sheets = google.sheets({ version: 'v4', auth });
  const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: DATA_RANGE });
  let count = 0;
  console.log('--- Portfolio Sheets Integration ---');
  console.log('MODE: READ ONLY');
  for (const [index, row] of (response.data.values ?? []).entries()) {
    if (isBlankRow(row)) continue;
    console.log(`Row ${FIRST_DATA_ROW + index}: ${nextAction(row)}`);
    count += 1;
  }
  console.log('Articles checked:', count);
  console.log('OpenAI API requests: 0');
  console.log('Google Sheets writes: 0');
}

main().catch(error => { console.error('ERROR:', error.name, error.message); process.exitCode = 1; });
