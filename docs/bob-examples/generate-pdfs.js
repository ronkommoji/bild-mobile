/**
 * Generates PDFs from the .txt files in this folder.
 * Run from repo root: node docs/bob-examples/generate-pdfs.js
 */

const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const DIR = path.join(__dirname);
const FILES = [
  'site-safety-guidelines.txt',
  'scope-of-work.txt',
  'project-schedule.txt',
  'specifications.txt',
  'contacts-and-roles.txt',
];

function generatePdf(txtPath, pdfPath) {
  const text = fs.readFileSync(txtPath, 'utf8');
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const out = fs.createWriteStream(pdfPath);
    doc.pipe(out);
    doc.fontSize(11);
    doc.text(text, { align: 'left', lineGap: 4 });
    doc.end();
    out.on('finish', () => resolve());
    out.on('error', reject);
    doc.on('error', reject);
  });
}

async function main() {
  for (const name of FILES) {
    const txtPath = path.join(DIR, name);
    const pdfPath = path.join(DIR, name.replace(/\.txt$/, '.pdf'));
    if (!fs.existsSync(txtPath)) {
      console.warn('Skip (not found):', name);
      continue;
    }
    await generatePdf(txtPath, pdfPath);
    console.log('Generated:', path.basename(pdfPath));
  }
  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
