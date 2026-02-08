/**
 * One-off script to upload the example Bob docs to a project's project_files.
 * Run from repo root: node docs/bob-examples/seed-project-files.js <project_id>
 *
 * Requires: EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env.
 */

const fs = require('fs');
const path = require('path');

const PROJECT_FILES_BUCKET = 'project-files';
const FILES = [
  'site-safety-guidelines.pdf',
  'scope-of-work.pdf',
  'project-schedule.pdf',
  'specifications.pdf',
  'contacts-and-roles.pdf',
];

async function main() {
  const projectId = process.argv[2];
  if (!projectId) {
    console.error('Usage: node docs/bob-examples/seed-project-files.js <project_id>');
    process.exit(1);
  }

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Set EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const baseDir = path.join(process.cwd(), 'docs', 'bob-examples');

  for (const name of FILES) {
    const filePath = path.join(baseDir, name);
    if (!fs.existsSync(filePath)) {
      console.warn('Skip (not found):', name);
      continue;
    }
    const buffer = fs.readFileSync(filePath);
    const storagePath = `${projectId}/${name}`;
    const { error: uploadError } = await supabase.storage
      .from(PROJECT_FILES_BUCKET)
      .upload(storagePath, buffer, {
        contentType: 'application/pdf',
        upsert: true,
      });
    if (uploadError) {
      console.error('Upload failed for', name, uploadError.message);
      continue;
    }
    const { error: insertError } = await supabase.from('project_files').insert({
      project_id: projectId,
      name,
      file_path: storagePath,
      file_size: buffer.length,
      content_type: 'application/pdf',
    });
    if (insertError) {
      console.error('Insert failed for', name, insertError.message);
      continue;
    }
    console.log('Added:', name);
  }

  console.log('Done. Open the app, go to Bob tab, and sync to index these files.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
