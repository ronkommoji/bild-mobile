# Bild — Product Requirements Document (PRD)

**Product Name:** Bild
**Tagline:** Proof-of-work for construction, without slowing the job.

---

## 1. Overview

**Bild** is a mobile-first task execution app for construction field workers, paired with a web-based dashboard for supervisors and project managers. Bild focuses on *simple daily execution* in the field using **photo proof + voice notes**, while giving leadership **real-time visibility** into project progress, blockers, and documentation.

Bild is intentionally minimal: workers should be able to open the app, understand what needs to be done, complete tasks with proof in seconds, and get back to work.

---

## 2. Problem Statement

Construction projects rely on accurate, timely updates from the field, yet current workflows are fragmented across:

* phone calls and texts
* inconsistent daily logs
* missing or unstructured photo documentation
* verbal handoffs that are never recorded

This leads to delays, rework, disputes, and a lack of trust in reported progress.

Industry research consistently highlights communication and data fragmentation as a major cost driver. FMI and PlanGrid research estimates that poor project data and miscommunication cost the U.S. construction industry **over $30B annually**. Field crews frequently describe documentation as *tedious*, *redundant*, or *something done after work, if at all*.

A common sentiment from working foremen:

> “Daily logs are a pain. Half the time they’re rushed, hard to read, or missing key info.” (Reddit, r/Construction)

Bild addresses this by embedding documentation *directly into the act of completing work*.

---

## 3. Goals and Non‑Goals

### Goals (v1)

* Make daily task execution frictionless for field workers
* Require proof-of-work without heavy reporting overhead
* Provide supervisors with real-time, trustworthy project status
* Support workers participating in multiple projects simultaneously
* Use AI only where it removes friction (not where it adds complexity)

### Non‑Goals (v1)

* No autonomous scheduling or subcontractor replacement
* No full CPM or enterprise ERP replacement
* No complex form builders in the mobile app

---

## 4. Target Users

### Field Workers (Mobile)

* Electricians
* Plumbers
* HVAC technicians
* General laborers
* Subcontractors

**Primary needs:**

* Clear list of what to do today
* Fast way to prove work is complete
* Minimal typing or navigation

### Supervisors / Project Managers (Web)

* Foremen
* Project managers
* Owners

**Primary needs:**

* Real-time project status
* Visibility into blockers
* Verifiable proof of completed work
* Simple reporting

---

## 5. Design Principles

1. **Three taps to complete a task**
2. **Voice-first, not text-first**
3. **Proof is built-in, not optional**
4. **Mobile stays simple; complexity lives on web**
5. **Offline-first capture**
6. **AI should feel invisible**

---

## 6. Branding & Color System

**Primary Background:** `#FFFDF1`
**Accent / Highlight:** `#FFCE99`
**Primary Action:** `#FF9644`
**Text / Contrast:** `#562F00`

Design intent: warm, construction‑adjacent tones that feel practical, not corporate. High contrast for outdoor readability.

---

## 7. Mobile App Architecture (3 Pages)

Global UI elements:

* Top-left: Project switcher
* Top-right: Profile icon
* Bottom navigation: 3 primary tabs

---

### Page 1: Today (Tasks)

**Purpose:** Show the worker exactly what needs to be done *today*.

**Components:**

* Date + project name
* Priority‑sorted task list
* Task cards showing:

  * Task title
  * Location / room (if available)
  * Priority badge
  * Status

**Actions:**

* Tap: open task details
* Swipe right: mark “In Progress”
* Swipe left: mark “Blocked” (voice reason required)
* Primary CTA: **Complete Task**

---

### Page 2: Capture (Proof)

**Purpose:** Fast proof‑of‑work capture.

**Flow:**

1. Take photo(s)
2. Record voice note (auto‑transcribed)
3. Optional photo annotation (draw / text)
4. Submit

**AI assistance:**

* Voice‑to‑text transcription
* Optional quality prompt if proof seems incomplete

---

### Page 3: Project (Updates & Chat)

**Sections:**

* **Updates:** activity feed of completed tasks
* **Chat:** project‑wide chat with @mentions and voice messages
* **Files:** read‑only access to key documents

**AI features:**

* “What happened yesterday?” summary
* “What’s left today?” overview

---

### Profile (Top‑Right Icon)

* User info
* Trade / role
* Project memberships
* Notification settings
* Offline upload status
* Help

---

## 8. Web App (Supervisor Dashboard)

### Key Sections

1. **Project Portfolio**

   * All projects with health indicators
2. **Project Dashboard**

   * Completion percentage
   * Task pipeline
   * Blockers
3. **Proof Viewer**

   * Task → photos → annotations → transcripts
4. **Blueprint View (v1.5)**

   * Upload blueprint
   * Manually define rooms
   * View tasks by room
5. **Reports**

   * Auto‑generated daily and weekly summaries

---

## 9. AI Features (Non‑Agentic)

* Voice‑to‑text transcription
* Project‑level Q&A over tasks and documents
* Daily and weekly summary generation
* Gentle completeness prompts for proof capture

All AI actions are user‑initiated or supportive — never autonomous.

---

## 10. Functional Requirements (v1)

### Mobile

* Users can belong to multiple projects
* Tasks require at least one photo to complete
* Voice notes are transcribed automatically
* Tasks can be marked blocked with a reason
* Offline capture with background sync

### Web

* Supervisors can create and assign tasks
* View proof‑of‑work per task
* Export daily reports

---

## 11. Metrics for Success

* Daily active workers per project
* Task completion rate
* On‑time completion percentage
* Average time to complete a task
* Percentage of tasks with complete proof

---

## 12. v1 Scope Summary

**Ship first:**

* Mobile Today + Capture + Project tabs
* Photo + voice proof
* Supabase auth, storage, and data
* Web dashboard with task tracking and proof viewer
* AI transcription and summaries

---

## 13. Product Vision

Bild becomes the *system of record for physical work* — not by forcing behavior change, but by quietly capturing the truth of what happens on a job site, every day.
