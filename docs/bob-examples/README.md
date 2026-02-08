# Bob Agent — Example Project Documents

This folder contains five example construction-project documents (PDF) used to test **Agent Bob** with the Google File Search (RAG) integration. Bob can answer questions like:

- "What's the emergency procedure?" (site-safety-guidelines.pdf)
- "Who is the superintendent?" (contacts-and-roles.pdf)
- "What are the key milestones?" (project-schedule.pdf)
- "What's in scope vs out of scope?" (scope-of-work.pdf)
- "What are the inspection hold points?" (specifications.pdf)

## Files

| File | Description |
|------|-------------|
| `site-safety-guidelines.pdf` | PPE, hazard reporting, emergency procedures, first aid |
| `scope-of-work.pdf` | Phases, deliverables, exclusions, assumptions |
| `project-schedule.pdf` | Milestones, key dates, dependencies |
| `specifications.pdf` | Materials, codes, tolerances, inspection |
| `contacts-and-roles.pdf` | PM, Superintendent, Safety Officer, subs, emergency |

The PDFs are generated from the source `.txt` files. To regenerate them after editing the text:  
`node docs/bob-examples/generate-pdfs.js`

## How to add these to a project for testing

### Option 1: Seed script (recommended for local/dev)

From the **project root** (bild-mobile), run:

```bash
# Set your Supabase service role key (Dashboard → Project Settings → API)
export SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
export EXPO_PUBLIC_SUPABASE_URL=your_project_url

# Run the script with your project UUID (from Today tab or Supabase projects table)
node docs/bob-examples/seed-project-files.js <project_id>
```

Example:

```bash
node docs/bob-examples/seed-project-files.js d53e4226-816a-4d73-aa65-df058b3b1dab
```

The script uploads each `.pdf` file to the `project-files` bucket and inserts a row into `project_files` for the given project. Then open the app, go to the Bob tab, and sync; Bob will index these files and you can chat.

### Option 2: Supabase Dashboard

1. In **Storage**, open the `project-files` bucket.
2. Create a folder with your project UUID (e.g. `d53e4226-816a-4d73-aa65-df058b3b1dab`).
3. Upload each `.pdf` file from this folder into that project folder.
4. In **Table Editor**, open `project_files` and insert one row per file:
   - `project_id`: your project UUID
   - `name`: display name (e.g. `site-safety-guidelines.pdf`)
   - `file_path`: path in bucket (e.g. `{project_id}/site-safety-guidelines.pdf`)
   - `content_type`: `application/pdf`
   - Optionally set `file_size` and `uploaded_by`.

### Option 3: In-app upload (when available)

If the app later adds "Upload document" in the Bob Files tab, you can add these files from the device or simulator.

## Edge Function secret

Ensure **GEMINI_API_KEY** is set in Supabase for Edge Functions (Dashboard → Project Settings → Edge Functions → Secrets). Bob uses it for File Search and chat.
