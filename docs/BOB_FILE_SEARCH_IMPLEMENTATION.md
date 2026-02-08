# Bob Agent & Google File Search API — Full Implementation Guide

This document describes the end-to-end implementation of **Bob** (the project AI assistant) using **Google’s File Search API** (Gemini) for RAG over project documents. Use it as a reference when adding the same feature to the web app or other clients.

---

## 1. Architecture Overview

Bob runs in two places:

- **Backend (Supabase Edge Functions):** All Gemini File Search usage (create store, upload files, chat with RAG) runs server-side so the API key stays secret and files are read from Supabase Storage.
- **Client (mobile or web):** Calls the Edge Functions for “sync” and “chat”; does not call Gemini directly.

```text
┌─────────────┐     POST bob-sync      ┌──────────────────┐     create store      ┌─────────────────────┐
│   Client   │ ────────────────────► │  Supabase Edge    │ ───────────────────► │  Google Gemini      │
│ (app/web)  │     POST bob-chat      │  Functions        │  upload files         │  File Search API    │
│            │ ◄──────────────────── │  (bob-sync,       │  generateContent      │  (fileSearchStores) │
└─────────────┘     JSON response     │   bob-chat)       │ ◄─────────────────────┘                     │
       │                             └─────────┬──────────┘
       │                                       │
       │                             ┌─────────▼──────────┐
       │                             │  Supabase          │
       └─────────────────────────────│  • project_files   │
             supabase client         │  • projects        │
                                     │  • Storage bucket  │
                                     └───────────────────┘
```

**Data flow:**

1. **Sync:** Client calls `bob-sync` with `project_id` → Edge Function loads `project_files`, downloads files from Storage, creates a Gemini File Search store, uploads each file, saves the store name on `projects` → returns `{ storeName, fileCount }`.
2. **Chat:** Client calls `bob-chat` with `project_id` and `message` → Edge Function reads the project’s store name, calls Gemini `generateContent` with the File Search tool → returns `{ text, citations }`.

---

## 2. Database

### 2.1 Tables

**`projects`** — add two columns used by Bob:

| Column | Type | Description |
|--------|------|-------------|
| `gemini_file_search_store_name` | `text` (nullable) | Gemini store name, e.g. `fileSearchStores/abc123`. Used by `bob-chat`. |
| `gemini_file_search_synced_at` | `timestamptz` (nullable) | When the store was last synced (optional; for future “resync when files change”). |

**Migration (Supabase SQL):**

```sql
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS gemini_file_search_store_name text,
  ADD COLUMN IF NOT EXISTS gemini_file_search_synced_at timestamptz;
```

**`project_files`** — existing table that lists documents per project:

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` | Primary key. |
| `project_id` | `uuid` | FK to `projects.id`. |
| `name` | `text` | Display name (e.g. `site-safety-guidelines.pdf`). |
| `file_path` | `text` | Object path inside the Storage bucket (e.g. `{project_id}/file.pdf`). |
| `file_size` | `bigint` (nullable) | Size in bytes. |
| `content_type` | `text` (nullable) | MIME type (e.g. `application/pdf`, `text/plain`). |
| `uploaded_by` | `uuid` (nullable) | FK to `auth.users`. |
| `created_at` | `timestamptz` (nullable) | Insert time. |

Ensure RLS allows project members to read `project_files` and that the Edge Function can read them (e.g. using the service role).

### 2.2 TypeScript types (for reference)

```ts
// projects row includes:
gemini_file_search_store_name: string | null;
gemini_file_search_synced_at: string | null;

// project_files row:
id: string;
project_id: string;
name: string;
file_path: string;
file_size: number | null;
content_type: string | null;
uploaded_by: string | null;
created_at: string | null;
```

---

## 3. Storage

- **Bucket name:** `project-files` (must exist and be accessible to the Edge Function with the service role).
- **Path convention:** `file_path` in `project_files` is the full object path within the bucket, e.g. `{project_id}/site-safety-guidelines.pdf`.
- **RLS / access:** The Edge Function uses the **Supabase service role** to download objects; no public URL is required for sync.

---

## 4. Google File Search API (Gemini)

### 4.1 SDK and docs

- **SDK:** `@google/genai` (npm package `@google/genai`), class `GoogleGenAI`. This is the **Gemini Developer API** (File Search is not available on Vertex AI in the same way).
- **Docs:** [Gemini API — File Search](https://ai.google.dev/gemini-api/docs/file-search).

### 4.2 Concepts

1. **File Search store** — A container per project. Created once per sync; name stored in `projects.gemini_file_search_store_name`.
2. **Upload files to store** — Each project file (from Storage) is uploaded to the store with a display name and MIME type. The API chunks and indexes for RAG.
3. **Generate with File Search** — `generateContent` is called with `config.tools = [{ fileSearch: { fileSearchStoreNames: [storeName] } }]` so the model can retrieve from that store when answering.

### 4.3 Supported file types (RAG)

We only upload “RAG-friendly” types; others (e.g. images) are skipped. Example allowlist:

- `text/plain`
- `application/pdf`
- `text/csv`
- `text/html`
- `application/json`
- Any `text/*`

### 4.4 API usage (backend only)

All of the following run **only in the Edge Functions** (or another backend), not in the browser:

1. **Create store**

   ```ts
   const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
   const fileSearchStore = await ai.fileSearchStores.create({
     config: { displayName: `project-${projectId}` },
   });
   const storeName = fileSearchStore.name; // e.g. "fileSearchStores/abc123"
   ```

2. **Upload a file to the store**

   - File content must be a **Blob** or **Buffer** (e.g. from Storage download).
   - Upload returns an **operation**; poll until `operation.done === true`.

   ```ts
   let operation = await ai.fileSearchStores.uploadToFileSearchStore({
     fileSearchStoreName: storeName,
     file: fileBlob,
     config: {
       displayName: row.name,
       mimeType: row.content_type || "application/octet-stream",
     },
   });
   while (operation?.done === false) {
     await new Promise((r) => setTimeout(r, 2000));
     operation = await ai.operations.get({ operation });
   }
   ```

3. **Generate content with File Search**

   ```ts
   const response = await ai.models.generateContent({
     model: "gemini-2.5-flash",
     contents: [{ role: "user", parts: [{ text: userMessage }] }],
     config: {
       systemInstruction: "You are Bob, the AI assistant for the construction project \"...\".",
       tools: [
         {
           fileSearch: {
             fileSearchStoreNames: [storeName],
           },
         },
       ],
     },
   });
   const text = response?.text ?? "";
   const citations = response?.candidates?.[0]?.citationMetadata?.citations ?? null;
   ```

### 4.5 Secrets

- Set **`GEMINI_API_KEY`** in Supabase: **Project Settings → Edge Functions → Secrets** (same key you use for Gemini elsewhere, or a dedicated server key).
- Do **not** expose this key in the client; the web app must use the Edge Functions as the only way to talk to File Search.

---

## 5. Edge Functions

### 5.1 Common behavior (both functions)

- **CORS:** Respond to `OPTIONS` and set `Access-Control-Allow-Origin` (e.g. request origin or `*`), `Access-Control-Allow-Methods: POST, OPTIONS`, `Access-Control-Allow-Headers: Authorization, Content-Type`.
- **Auth:** Read `Authorization: Bearer <jwt>`, then `supabase.auth.getUser(jwt)` with the **service role** client. Reject if no user.
- **Project membership:** Query `project_members` for `(project_id, user_id)`; reject with 403 if not a member.
- **Supabase client:** Use `createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)` so the function can read `project_files`, download from Storage, and update `projects`.

### 5.2 `bob-sync`

**Purpose:** Build or refresh the Gemini File Search store for a project using current `project_files` and Storage.

**Request:**

- Method: `POST`
- Headers: `Authorization: Bearer <supabase_jwt>`, `Content-Type: application/json`
- Body: `{ "project_id": "<uuid>" }`

**Logic (summary):**

1. Validate JWT and project membership (as above).
2. Load project row and all `project_files` for `project_id`.
3. Create one File Search store: `ai.fileSearchStores.create({ config: { displayName } })`.
4. For each `project_files` row:
   - Download file from Storage: `supabase.storage.from("project-files").download(row.file_path)`.
   - If content type is not RAG-friendly, skip (optional: log).
   - Call `uploadToFileSearchStore` with the blob and display name / MIME type; poll `ai.operations.get` until done; on error, skip and continue.
5. Update project: `projects.gemini_file_search_store_name = storeName`, `gemini_file_search_synced_at = now()`.
6. Return `{ "storeName": "...", "fileCount": number }` or `{ "error": "..." }`.

**Response (success):** `200` with `{ storeName, fileCount }`.  
**Response (error):** `4xx/5xx` with `{ error: string }`.

**Note:** Each sync creates a **new** store and overwrites `gemini_file_search_store_name`. Old stores are not deleted (optional cleanup can be added later).

### 5.3 `bob-chat`

**Purpose:** Answer one user message using the project’s File Search store.

**Request:**

- Method: `POST`
- Headers: `Authorization: Bearer <supabase_jwt>`, `Content-Type: application/json`
- Body: `{ "project_id": "<uuid>", "message": "<user message string>", "access_token": "<optional; user JWT when Authorization header is not forwarded>" }`

**Logic (summary):**

1. Validate JWT and project membership.
2. Load project and `gemini_file_search_store_name`. If missing or empty, return `400` with a message like “No file search store for this project. Sync files first.”
3. Call Gemini `generateContent` with:
   - `model`: e.g. `gemini-2.5-flash`
   - `contents`: `[{ role: "user", parts: [{ text: message }] }]`
   - `config.systemInstruction`: Bob persona and instruction to use project documents.
   - `config.tools`: `[{ fileSearch: { fileSearchStoreNames: [storeName] } }]`
4. Return `{ "text": response.text, "citations": response.candidates?.[0]?.citationMetadata?.citations ?? undefined }`.

**Response (success):** `200` with `{ text: string, citations?: Array<...> }`.  
**Response (error):** `4xx/5xx` with `{ error: string }`.

### 5.4 Deploying the Edge Functions

- **Runtime:** Deno (Supabase Edge Functions).
- **Imports:** Use `npm:@google/genai` for `GoogleGenAI` and ESM Supabase client (e.g. `https://esm.sh/@supabase/supabase-js@2`).
- **Verify JWT:** Use `verify_jwt: false` for both `bob-sync` and `bob-chat`. The gateway’s built-in JWT verification is incompatible with [new JWT Signing Keys](https://supabase.com/docs/guides/auth/signing-keys) (ES256); with `verify_jwt: true` the gateway returns 401 before the function runs. With `verify_jwt: false`, the gateway does not forward the `Authorization` header, so for `bob-chat` the client sends `access_token` in the request body and the function validates it via `supabase.auth.getUser(token)` (which supports both legacy and new signing keys).

Example deploy (Supabase CLI or MCP): deploy two functions, `bob-sync` and `bob-chat`, each with a single `index.ts` entrypoint and the same env (Supabase URL, service role key, and `GEMINI_API_KEY`).

---

## 6. Client Implementation (Web or Mobile)

### 6.1 Invoking Edge Functions

Use the same Supabase client that has the user session so the `Authorization` header is sent automatically:

```ts
const { data, error } = await supabase.functions.invoke("bob-sync", {
  body: { project_id: currentProject.id },
});

const { data, error } = await supabase.functions.invoke("bob-chat", {
  body: { project_id: currentProject.id, message: userMessage },
});
```

Handle `error` (network/relay) and `data.error` (application error from the function).

### 6.2 Sync (ensure store is ready)

- **When:** When the user opens the “Bob” / “Chat” view for a project (or when the project’s Files tab is first viewed). Optionally: once per project per session (track with a ref or state so you don’t sync on every tab focus).
- **UI:** Show a “Syncing files with Bob…” (or similar) state while the request is in flight; on success, allow chat; on error, show the error and still allow chat (chat will then return “Sync first” if the store is missing).

```ts
// Example: sync when entering Bob view for this project (once per project)
const hasSyncedForProject = useRef<string | null>(null);
useEffect(() => {
  if (!currentProject || hasSyncedForProject.current === currentProject.id) return;
  setSyncing(true);
  supabase.functions.invoke("bob-sync", { body: { project_id: currentProject.id } })
    .then(({ data, error }) => {
      setSyncing(false);
      if (!error && !data?.error) hasSyncedForProject.current = currentProject.id;
      if (data?.error) setSyncError(data.error);
    });
}, [currentProject?.id]);
```

### 6.3 Chat

- On “Send”:
  1. Append the user message to the UI.
  2. Call `bob-chat` with `project_id` and `message`.
  3. On success: append `data.text` as the assistant message; if `data.citations` is present, show it (e.g. “Based on: …” or a list of sources).
  4. On error: append an error message or toast.

```ts
const { data, error } = await supabase.functions.invoke("bob-chat", {
  body: { project_id: currentProject.id, message: text },
});
if (error) { /* show error */ return; }
if (data?.error) { /* show data.error */ return; }
// Append message: content = data.text, citations = data.citations
```

### 6.4 Citations

- The API may return `citations` as an array of objects with e.g. `title`, `uri`, or similar. Normalize and display in your UI (e.g. “Based on: Doc A, Doc B” or links).
- Mobile app example: `citations?.map(c => c?.title || c?.uri).filter(Boolean).join(", ")`.

### 6.5 Files list

- List project documents by querying `project_files` for the current `project_id` (same as today). No change required for listing; only sync and chat use the Edge Functions.

---

## 7. Web App Checklist

Use this when porting Bob + File Search to the web app:

1. **Database**
   - [ ] Add `gemini_file_search_store_name` and `gemini_file_search_synced_at` to `projects` (migration).
   - [ ] Ensure `project_files` exists and has `project_id`, `name`, `file_path`, `content_type` (and optionally `file_size`, `uploaded_by`, `created_at`).

2. **Storage**
   - [ ] Bucket `project-files` exists; objects keyed by e.g. `{project_id}/{filename}`; Edge Function can read with service role.

3. **Secrets**
   - [ ] Set `GEMINI_API_KEY` in Supabase Edge Functions secrets.

4. **Edge Functions**
   - [ ] Deploy `bob-sync` (POST, body: `project_id`, auth + project membership, create store, upload files from Storage, update project, return `storeName` / `fileCount`).
   - [ ] Deploy `bob-chat` (POST, body: `project_id`, `message`, auth + project membership, load store name, call Gemini with File Search tool, return `text` and optional `citations`).
   - [ ] CORS and error responses consistent with your web origin.

5. **Web client**
   - [ ] Bob / Chat page: on enter (or first view), call `bob-sync` once per project; show syncing state and errors.
   - [ ] Chat input: on send, call `bob-chat` with `project_id` and message; append user message and assistant reply; show citations if returned.
   - [ ] Use `supabase.functions.invoke("bob-sync", ...)` and `supabase.functions.invoke("bob-chat", ...)` with the logged-in client so the JWT is sent.

6. **Optional**
   - [ ] “Upload document” flow: upload file to `project-files`, insert row into `project_files`, then trigger sync (or next sync on next open).
   - [ ] Resync when file list changes (e.g. compare `gemini_file_search_synced_at` with latest `project_files` update).
   - [ ] Multi-turn: pass conversation history to `bob-chat` (if you extend the function to accept `history` and send it to Gemini).

---

## 8. File References in This Repo

| What | Where |
|------|--------|
| **End-to-end flow** | `docs/BOB_END_TO_END.md` (how Bob works from user tap to answer) |
| DB types | `types/database.ts` (`project_files`, `projects` with `gemini_*` columns) |
| Edge: bob-sync | `supabase/functions/bob-sync/index.ts` |
| Edge: bob-chat | `supabase/functions/bob-chat/index.ts` |
| Client: Bob screen | `app/(tabs)/project.tsx` (sync effect, handleSend, plain text + source links at bottom) |
| Example docs | `docs/bob-examples/*.pdf` (+ README and seed script) |

---

## 9. References

- [Gemini API — File Search](https://ai.google.dev/gemini-api/docs/file-search)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Supabase JS — invoke](https://supabase.com/docs/reference/javascript/functions-invoke): `supabase.functions.invoke(name, { body })`
- npm: `@google/genai` (GoogleGenAI, `fileSearchStores`, `models.generateContent`)
