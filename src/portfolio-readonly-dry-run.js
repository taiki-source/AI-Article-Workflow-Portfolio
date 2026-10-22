import 'dotenv/config';
import fs from 'node:fs';
import { google } from 'googleapis';
import {
  DATA_RANGE,
  FIRST_DATA_ROW,
  WORKFLOW_COLUMNS,
  actionReason,
  headerValidationSummary,
  isBlankRow,
  nextAction,
  validateHeaders
} from './portfolio-row-workflow.js';

const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
const credentialsPath = process.env.GOOGLE_CREDENTIALS_PATH;
const forbiddenFlags = new Set(['--ai', '--generate', '--revise', '--write']);

if (process.argv.slice(2).some(flag => forbiddenFlags.has(flag))) {
  throw new Error('Write or AI flags are forbidden in read-only dry run');
}
if (!spreadsheetId || !credentialsPath) {
  throw new Error('Google Sheets configuration is missing in .env');
}

async function main() {
  if (!fs.existsSync(credentialsPath)) throw new Error('Credentials file not found');
  const auth = new google.auth.GoogleAuth({
    keyFile: credentialsPath,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
  });
  const sheets = google.sheets({ version: 'v4', auth });
  const [headerResponse, rowsResponse] = await Promise.all([
    sheets.spreadsheets.values.get({ spreadsheetId, range: 'L1:V1' }),
    sheets.spreadsheets.values.get({ spreadsheetId, range: DATA_RANGE })
  ]);
  const headerCheck = validateHeaders(headerResponse.data.values?.[0] ?? []);
  const populated = [];
  for (const [index, row] of (rowsResponse.data.values ?? []).entries()) {
    if (isBlankRow(row)) continue;
    const action = nextAction(row);
    populated.push({ rowNumber: FIRST_DATA_ROW + index, action, reason: actionReason(row, action) });
  }
  console.log('--- Portfolio Read-Only Dry Run ---');
  console.log('MODE: READ ONLY');
  console.log('OpenAI API requests: 0');
  console.log('Google Sheets writes: 0');
  console.log(`Range read: ${DATA_RANGE}`);
  console.log(`Header validation: ${headerCheck.valid ? 'PASS' : 'FAIL'} (${headerValidationSummary(headerCheck)})`);
  console.log(`Code column mapping: ${WORKFLOW_COLUMNS.join(', ')}`);
  for (const item of populated) console.log(`Row ${item.rowNumber}: ${item.action} (${item.reason})`);
}

main().catch(error => {
  console.error('ERROR:', error.message);
  process.exitCode = 1;
});
