# Bob — End-to-End How It Works

This document explains how **Bob** (the project AI assistant) works from the user’s tap to the answer on screen: data flow, auth, and why we use the patterns we do.

---

## 1. What Bob Does

Bob lets users ask questions about the **current project** (e.g. “What are the site safety guidelines?”). Answers are based on **project documents** (PDFs, text files, etc.) stored in Supabase and indexed with **Google’s File Search API** (Gemini). Bob does **not** call Gemini from the app; all AI and file access happen in **Supabase Edge Functions**.

---

## 2. High-Level Flow

```
User opens Bob tab
       │
       ▼
┌──────────────────────────────────────────────────────────────────┐
│ 1. SYNC (once per project / when “Resync” is tapped)              │
│    App → bob-sync(project_id)                                     │
│    Edge Function: read project_files, download from Storage,       │
│    create Gemini File Search store, upload files, save store name │
│    on projects → { storeName, fileCount }                         │
└──────────────────────────────────────────────────────────────────┘
       │
       ▼
User types a question and sends
       │
       ▼
┌──────────────────────────────────────────────────────────────────┐
│ 2. CHAT                                                            │
│    App → bob-chat(project_id, message, access_token)              │
│    Edge Function: validate user, load store name, call Gemini     │
│    generateContent with File Search tool → { text, citations }     │
└──────────────────────────────────────────────────────────────────┘
       │
       ▼
App shows Bob’s reply as plain text and, at the bottom, link(s) to the
source document(s) (e.g. open PDF in preview).
```

---

## 3. Where Data Lives

| What              | Where |
|-------------------|--------|
| Project list      | `projects` table |
| Documents list    | `project_files` (per project); files live in Storage bucket `project-files` |
| Gemini index      | Google File Search store; store name stored in `projects.gemini_file_search_store_name` |
| Who’s in a project| `project_members` (used by Edge Functions to allow/deny access) |

The app only talks to Supabase (DB, Storage, Edge Functions). The Edge Functions talk to Supabase (DB, Storage) and to the Gemini API.

---

## 4. Sync (bob-sync)

**When:** User opens the Bob tab (and no recent sync for this project) or taps “Resync files”.

**Request:** `POST /functions/v1/bob-sync` with body `{ project_id }`. The Supabase client sends the user’s session (JWT) via its default fetch.

**Edge Function:**

1. Validates the JWT (with service role client) and checks the user is in `project_members` for that project.
2. Loads the project and all rows from `project_files` for that `project_id`.
3. Creates **one** Gemini File Search store for the project.
4. For each project file: downloads from Storage bucket `project-files` (using `file_path`), skips non–RAG-friendly types, uploads the file to the Gemini store (and polls until the upload op is done).
5. Updates `projects` with `gemini_file_search_store_name` and `gemini_file_search_synced_at`.
6. Returns `{ storeName, fileCount }`.

**Config:** `verify_jwt: false` so the request reaches the function; the function does its own JWT validation. The function uses the **service role** to read DB and Storage.

---

## 5. Chat (bob-chat)

**When:** User sends a message in the Bob chat.

**Request:** `POST /functions/v1/bob-chat` with body:

- `project_id` — current project
- `message` — user’s question
- `access_token` — user’s Supabase Auth JWT (session access token)

We send the token **in the body** because:

- The project uses **new JWT Signing Keys** (ES256). The Edge Function gateway’s built-in `verify_jwt` is **incompatible** with that and returns 401 before the function runs if we rely only on the `Authorization` header.
- With `verify_jwt: false`, the gateway does **not** forward the `Authorization` header to the function, so the function would not see the user’s JWT if we only used the header.
- Putting `access_token` in the body guarantees the function receives it; the function then validates it with `supabase.auth.getUser(token)`, which supports both legacy and new signing keys.

**Edge Function:**

1. Reads `access_token` from the body (or falls back to `Authorization: Bearer <token>` if present).
2. Validates the token with `supabase.auth.getUser(token)` and checks the user is in `project_members` for the given project.
3. Loads the project’s `gemini_file_search_store_name`. If missing, returns 400 “sync first”.
4. Calls Gemini `generateContent` with:
   - Model (e.g. `gemini-2.5-flash`)
   - User message
   - System instruction (Bob persona + “use project documents”)
   - Tool: File Search with `fileSearchStoreNames: [storeName]`
5. Returns `{ text, citations, groundingChunks, groundingSupports }`.

**Config:** `verify_jwt: false`; auth is done entirely inside the function using the body token (or header if provided).

---

## 6. What the App Shows

- **User messages:** Plain text in a bubble.
- **Bob messages:**
  - **Body:** Plain text only (no inline links in the middle of the answer).
  - **Bottom of the bubble:** “Source:” or “Sources:” with one or more links. Each link opens the relevant document (e.g. project PDF) in the document preview when the name matches a file in `project_files`, or opens a URL if it’s an external link.

Citations come from the `citations` (and optionally grounding metadata) returned by the Edge Function; the app deduplicates by title and renders them as the last element of the message so the answer reads as normal text with source links at the end.

---

## 7. Security Summary

- **API key:** Gemini API key lives only in Supabase Edge Function secrets, never in the app.
- **Auth:** Both `bob-sync` and `bob-chat` validate the user (JWT + project membership) before doing any work.
- **Data:** Only project members can sync or chat for that project; the Edge Function uses the service role to read `project_files` and Storage.

---

## 8. Files to Look At

| Purpose              | Location |
|----------------------|----------|
| Full implementation  | `docs/BOB_FILE_SEARCH_IMPLEMENTATION.md` |
| This end-to-end flow | `docs/BOB_END_TO_END.md` |
| Bob UI + invoke      | `app/(tabs)/project.tsx` |
| Edge: sync           | `supabase/functions/bob-sync/index.ts` |
| Edge: chat           | `supabase/functions/bob-chat/index.ts` |
