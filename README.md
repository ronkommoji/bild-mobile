# Bild Mobile

React Native (Expo) app for the Bild construction workflow: today’s tasks, proof capture (photos + voice), project chat, and AI summaries.

## Stack

- **Expo** (SDK 54) with **expo-router**
- **Supabase** (auth, Postgres, storage, realtime)
- **Google Gemini** (transcription, summaries, proof checks)
- **React Native** with TypeScript

## Setup

1. **Clone and install**

   ```bash
   cd bild-mobile
   npm install --legacy-peer-deps
   ```

2. **Environment**

   Copy `.env.example` to `.env` and set:

   - `EXPO_PUBLIC_SUPABASE_URL` – Supabase project URL
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY` – Supabase anon key
   - `EXPO_PUBLIC_GEMINI_API_KEY` – Google AI (Gemini) API key

3. **Run**

   ```bash
   npx expo start
   ```

   Then open on iOS simulator, Android emulator, or device via Expo Go.

## Features

- **Auth** – Email/password sign up and login (Supabase Auth)
- **Projects** – Create projects, join by **join code**, edit name/description; switch current project
- **Today** – Tasks due today: to-do and completed sections (completed collapsed by default). Mark complete with the circle on each card; tap again to mark incomplete. Swipe right = In progress, swipe left = Blocked (voice reason).
- **Capture** – Select a task, take photos, optional voice note; submit proof. Only non-completed tasks appear.
- **Task detail** – View task, proofs, and blocked reason; submit proof from here.
- **Project** – Activity feed and project chat.
- **Profile** – Dark mode toggle, sign out.
- **Voice** – Recording uses `expo-audio`; transcription via Gemini. iOS requires microphone permission and audio session (handled in-app).

## Project structure

- `app/` – Expo Router screens: `(auth)`, `(tabs)` (Today, Capture, Project), `task/[id]`, `profile`, `index` (redirect).
- `components/` – TaskCard, ProjectSwitcher, VoiceRecorder, ChatMessage, AISummary.
- `context/` – AppContext (auth, projects, members), ThemeContext (light/dark).
- `hooks/` – useAuth, useProjects, useTasks, useChat.
- `lib/` – supabase client, Gemini (transcribe, summaries), storage (upload photos/voice).
- `types/` – Database types (Supabase).

## Join a project by code

- **Supervisors** see the current project’s **join code** in the Projects modal and can share it.
- **Workers** tap “Join project” in the Projects modal, enter the code, and are added as a worker. The project appears in their list.

## License

Private.
