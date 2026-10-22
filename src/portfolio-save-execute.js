import 'dotenv/config';
import fs from 'node:fs';
import { google } from 'googleapis';
import {
  DATA_RANGE,
  FIRST_DATA_ROW,
  headerValidationSummary,
  isBlankRow,
  planSave,
  validateHeaders
} from './portfolio-row-workflow.js';

const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
const credentialsPath = process.env.GOOGLE_CREDENTIALS_PATH;
const writeMode = process.argv.includes('--write');
if (!spreadsheetId || !credentialsPath) throw new Error('Google Sheets configuration is missing in .env');

async function main() {
  if (!fs.existsSync(credentialsPath)) throw new Error('Credentials file not found');
  const auth = new google.auth.GoogleAuth({
    keyFile: credentialsPath,
    scopes: [writeMode
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
  const targets = (response.data.values ?? [])
    .map((row, index) => ({ rowNumber: FIRST_DATA_ROW + index, originalRow: row }))
    .filter(({ originalRow }) => !isBlankRow(originalRow));
  console.log('--- Portfolio Save Execution ---');
  console.log('MODE:', writeMode ? 'WRITE' : 'DRY RUN');

  for (const { rowNumber, originalRow } of targets) {
    const plan = planSave(originalRow);
    if (!plan.action.startsWith('SAVE_')) {
      console.log(`Row ${rowNumber}: ${plan.action}`);
      continue;
    }
    console.log(`Row ${rowNumber}: ${plan.action}`);
    console.log(`Target: T${rowNumber}:V${rowNumber}`);
    if (!writeMode) {
      console.log('DRY RUN: no changes');
      continue;
    }
    const latestResponse = await sheets.spreadsheets.values.get({ spreadsheetId, range: `L${rowNumber}:V${rowNumber}` });
    const latest = latestResponse.data.values?.[0] ?? [];
    const checked = planSave(latest);
    if (JSON.stringify(latest) !== JSON.stringify(originalRow) ||
        checked.action !== plan.action || checked.title !== plan.title || checked.body !== plan.body) {
      console.log(`Row ${rowNumber}: STOP (source or approval changed)`);
      continue;
    }
    const values = ['承認済み', plan.title, plan.body];
    await sheets.spreadsheets.values.update({
      spreadsheetId, range: `T${rowNumber}:V${rowNumber}`,
      valueInputOption: 'RAW', requestBody: { values: [values] }
    });
    const verify = await sheets.spreadsheets.values.get({ spreadsheetId, range: `T${rowNumber}:V${rowNumber}` });
    if (JSON.stringify(verify.data.values?.[0] ?? []) !== JSON.stringify(values)) {
      throw new Error(`Row ${rowNumber}: save verification failed`);
    }
    console.log(`Row ${rowNumber}: SAVED AND VERIFIED`);
  }
}

main().catch(error => { console.error('ERROR:', error.name, error.message); process.exitCode = 1; });
