# EduMeet — Combined Frontend + Backend Project Setup

> **Single source of truth** for the EduMeet platform. This replaces the previous split setup (backend Nest + separate Next frontend). Everything lives in **one Next.js 15 project** — UI in `app/(role)/` pages, API in `app/api/*` route handlers.
>
> **Database**: Cloud Firestore only. **No MongoDB, no Prisma, no ORM.**
>
> Consolidates all features discussed: Firebase Auth, Firestore, Cloudinary, VideoSDK, Stripe, AI providers, all four portals (Teacher v1, Student v1, Admin v1, Parent v2), live classes, canvas, agenda/notes/resources, live quizzes, attendance, breakouts, chat, AI co-pilot, summaries, teacher profile, teacher dashboard, and assessments (MCQ / Short Answer / True-False).

---

## 1. Why ONE Next.js project

You're tight on time. Most of what you originally planned as a separate Nest backend fits cleanly into **Next.js App Router API route handlers** inside the same project.

- **One deploy target** (Vercel).
- **One codebase, one `tsconfig`, one env file**.
- **Shared TypeScript types + Zod schemas** between UI and API — no drift.
- **Firebase Admin SDK** still runs server-side, inside API routes.
- **Firestore + Firebase Auth** unchanged; no replacement needed.
- **No Mongo, no Mongoose, no separate ORM.**
- If the app ever outgrows this, extracting `app/api/` into a standalone service later is a clean refactor.

**Trade-off**: API routes run serverless on Vercel. That's fine for auth verification, Firestore reads/writes, Cloudinary uploads, Stripe webhooks, VideoSDK token minting, and AI calls. The only thing serverless can't do well is long-lived websockets (e.g., canvas sync), and you don't need that — **tldraw's own sync service and Firestore `onSnapshot` handle real-time**.

---

## 2. Tech Stack (final)

| Layer               | Choice                                                 | Notes                                                           |
| ------------------- | ------------------------------------------------------ | --------------------------------------------------------------- |
| Framework           | **Next.js 15** (App Router, TypeScript, strict)        | UI + `app/api/*` backend                                        |
| Styling             | Tailwind CSS + CSS variables from the mockup           | DM Sans + DM Mono fonts                                         |
| UI primitives       | shadcn/ui (Nova preset) + `lucide-react`               | Already initialized                                             |
| Server state        | TanStack Query                                         | Caching + mutations                                             |
| Client state        | Zustand                                                | Modals, panels, current selection                               |
| Forms               | react-hook-form + zod                                  | All forms incl. assessment builder                              |
| Auth                | **Firebase Auth** (web SDK) + Firebase Admin (server)  | ID tokens verified in API route middleware                      |
| Database            | **Cloud Firestore**                                    | Only DB                                                         |
| Media storage       | **Cloudinary**                                         | Signed uploads via API routes                                   |
| Live video          | `@videosdk.live/react-sdk` (client) + token from API   | Secret stays server-side                                        |
| Whiteboard          | **tldraw** (multiplayer built in)                      | Use their sync service                                          |
| Payments            | Stripe (client + webhook handler)                      | Raw body required for webhooks                                  |
| AI                  | Gemini / Groq / Claude / Grok behind provider interface| Chosen per use-case                                             |
| Real-time           | Firestore `onSnapshot` from client                     | Chat, hand-raises, quiz responses, attendance                   |
| Charts              | Recharts                                               | Insights / summary                                              |
| Toasts              | Sonner                                                 | Matches mockup                                                  |
| Date/time           | date-fns                                               |                                                                 |
| Validation (shared) | Zod                                                    | Same schemas in UI forms AND API route handlers                 |
| Testing             | Vitest + Playwright (later)                            |                                                                 |
| Deploy              | **Vercel**                                             | One project                                                     |

---

## 3. Folder Structure

```
edumeet/
├── app/
│   ├── layout.tsx                                  # root, fonts, providers
│   ├── globals.css                                 # tailwind + CSS vars from mockup
│   ├── page.tsx                                    # landing / redirect by role
│   │
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── signup/page.tsx
│   │   └── layout.tsx
│   │
│   ├── (teacher)/
│   │   ├── layout.tsx                              # teacher shell + role guard
│   │   ├── dashboard/page.tsx                      # upcoming + past classes + create assessment
│   │   ├── profile/page.tsx
│   │   ├── classes/page.tsx
│   │   ├── classroom/[meetingId]/page.tsx          # THE live class portal (mockup)
│   │   └── assessments/
│   │       ├── page.tsx                            # all assessments
│   │       └── [id]/page.tsx                       # grade + view responses
│   │
│   ├── (student)/
│   │   ├── layout.tsx
│   │   ├── dashboard/page.tsx                      # classes + assigned assessments
│   │   ├── classroom/[meetingId]/page.tsx
│   │   └── assessments/[id]/page.tsx               # attempt assessment
│   │
│   ├── (admin)/
│   │   ├── layout.tsx
│   │   ├── users/page.tsx
│   │   ├── subjects/page.tsx
│   │   ├── agendas/page.tsx
│   │   ├── resources/page.tsx
│   │   └── analytics/page.tsx
│   │
│   ├── (parent)/                                   # v2 placeholder
│   │   └── layout.tsx
│   │
│   └── api/                                        # ────── THE BACKEND ──────
│       ├── auth/
│       │   ├── session/route.ts                    # POST: verify token, return user+role
│       │   └── role/route.ts                       # POST: (admin) assign role
│       │
│       ├── users/
│       │   ├── me/route.ts
│       │   └── [uid]/
│       │       ├── route.ts                        # GET / PATCH / DELETE
│       │       └── profile/route.ts                # aggregated stats
│       │
│       ├── classrooms/
│       │   ├── route.ts
│       │   └── [id]/
│       │       ├── route.ts
│       │       ├── enroll/route.ts
│       │       ├── link-parent/route.ts
│       │       └── agenda/route.ts
│       │
│       ├── meetings/
│       │   ├── route.ts                            # POST create
│       │   ├── upcoming/route.ts                   # GET teacher's upcoming
│       │   ├── past/route.ts                       # GET teacher's past
│       │   └── [id]/
│       │       ├── route.ts
│       │       ├── token/route.ts                  # POST mint VideoSDK JWT
│       │       ├── end/route.ts
│       │       ├── notes/route.ts
│       │       ├── attendance/
│       │       │   ├── route.ts
│       │       │   └── event/route.ts
│       │       ├── breakouts/
│       │       │   ├── route.ts
│       │       │   ├── recall/route.ts
│       │       │   ├── broadcast/route.ts
│       │       │   └── [rid]/route.ts
│       │       ├── chat/
│       │       │   ├── route.ts
│       │       │   └── dm/route.ts
│       │       ├── quizzes/
│       │       │   └── [qid]/
│       │       │       ├── post/route.ts
│       │       │       ├── close/route.ts
│       │       │       ├── respond/route.ts
│       │       │       └── stats/route.ts
│       │       ├── insights/
│       │       │   ├── route.ts
│       │       │   ├── generate/route.ts
│       │       │   └── [iid]/dismiss/route.ts
│       │       └── summary/
│       │           ├── route.ts
│       │           └── pdf/route.ts
│       │
│       ├── subjects/route.ts
│       ├── agendas/
│       │   ├── route.ts
│       │   └── [id]/
│       │       ├── route.ts
│       │       ├── topics/[topicId]/route.ts
│       │       └── subtopics/[subId]/route.ts
│       │
│       ├── notes/
│       │   ├── route.ts
│       │   └── [id]/route.ts
│       │
│       ├── resources/
│       │   ├── route.ts
│       │   └── [id]/route.ts
│       │
│       ├── quizzes/                                # live question bank (in-class)
│       │   ├── route.ts
│       │   └── [id]/route.ts
│       │
│       ├── assessments/                            # standalone homework assessments
│       │   ├── route.ts
│       │   └── [id]/
│       │       ├── route.ts
│       │       ├── assign/route.ts
│       │       ├── submit/route.ts                 # student submits answers
│       │       ├── grade/route.ts                  # teacher grades short-answer
│       │       ├── responses/route.ts
│       │       ├── results/route.ts
│       │       └── questions/
│       │           ├── route.ts
│       │           └── [qid]/route.ts
│       │
│       ├── media/
│       │   ├── upload/route.ts
│       │   ├── signed-url/route.ts
│       │   └── [publicId]/route.ts
│       │
│       ├── ai/
│       │   ├── chat/route.ts
│       │   ├── suggest/route.ts
│       │   ├── copilot/route.ts
│       │   └── generate-assessment/route.ts
│       │
│       ├── payments/
│       │   ├── checkout-session/route.ts
│       │   ├── subscriptions/route.ts
│       │   └── webhooks/route.ts                   # raw body — Stripe signature verify
│       │
│       └── admin/
│           ├── users/route.ts
│           └── analytics/overview/route.ts
│
├── src/
│   ├── components/                                 # ── UI ──
│   │   ├── ui/                                     # shadcn primitives
│   │   ├── layout/
│   │   │   ├── topbar.tsx
│   │   │   ├── sidenav.tsx
│   │   │   └── three-column-shell.tsx
│   │   ├── shared/
│   │   │   ├── avatar.tsx
│   │   │   ├── class-card.tsx
│   │   │   ├── kpi-card.tsx
│   │   │   ├── chip.tsx
│   │   │   └── empty-state.tsx
│   │   ├── teacher/
│   │   │   ├── profile-form.tsx
│   │   │   ├── dashboard-upcoming.tsx
│   │   │   ├── dashboard-past.tsx
│   │   │   ├── create-assessment-modal.tsx
│   │   │   └── question-item.tsx
│   │   ├── classroom/
│   │   │   ├── left-panel/
│   │   │   │   ├── agenda-tab.tsx
│   │   │   │   ├── notes-tab.tsx
│   │   │   │   └── resources-tab.tsx
│   │   │   ├── main/
│   │   │   │   ├── video-pane.tsx
│   │   │   │   ├── slide-presenter.tsx
│   │   │   │   ├── questions-pane.tsx
│   │   │   │   ├── attendees-pane.tsx
│   │   │   │   └── breakout-pane.tsx
│   │   │   ├── copilot/
│   │   │   │   ├── insights-tab.tsx
│   │   │   │   ├── trends-tab.tsx
│   │   │   │   └── ask-ai-tab.tsx
│   │   │   ├── modals/
│   │   │   │   ├── add-question.tsx
│   │   │   │   ├── student-profile.tsx
│   │   │   │   └── end-class-summary.tsx
│   │   │   └── canvas/whiteboard.tsx
│   │   ├── student/
│   │   │   ├── attempt-assessment.tsx
│   │   │   └── result-view.tsx
│   │   └── admin/
│   │       ├── users-table.tsx
│   │       ├── agendas-editor.tsx
│   │       └── resources-uploader.tsx
│   │
│   ├── hooks/                                      # React Query + UI hooks
│   │   ├── use-current-user.ts
│   │   ├── use-role-guard.ts
│   │   ├── use-meeting.ts
│   │   ├── use-agenda.ts
│   │   ├── use-assessments.ts
│   │   ├── use-quiz-live.ts
│   │   └── use-firestore-sub.ts                   # generic onSnapshot wrapper
│   │
│   ├── stores/                                     # Zustand
│   │   ├── ui-store.ts
│   │   ├── meeting-store.ts
│   │   └── selection-store.ts
│   │
│   ├── providers/
│   │   ├── query-provider.tsx
│   │   ├── auth-provider.tsx                      # firebase auth state listener
│   │   ├── theme-provider.tsx
│   │   └── toast-provider.tsx
│   │
│   ├── lib/                                       # ── CLIENT-only helpers ──
│   │   ├── api/                                   # calls to /api/*
│   │   │   ├── client.ts                          # axios + firebase token interceptor
│   │   │   ├── auth.ts
│   │   │   ├── meetings.ts
│   │   │   ├── agendas.ts
│   │   │   ├── assessments.ts
│   │   │   └── ...one file per resource
│   │   ├── firebase/
│   │   │   ├── client.ts                          # web SDK init
│   │   │   └── firestore.ts                       # subscription helpers
│   │   ├── videosdk/
│   │   │   ├── provider.tsx
│   │   │   └── hooks.ts
│   │   ├── theme/tokens.css                       # CSS vars from mockup
│   │   ├── utils/{cn.ts, format.ts}
│   │   └── constants.ts
│   │
│   ├── server/                                    # ── SERVER-only (used only by app/api/*) ──
│   │   ├── firebase-admin.ts                      # Admin SDK singleton
│   │   ├── firestore/
│   │   │   ├── collections.ts                     # collection name constants
│   │   │   └── helpers.ts                         # typed CRUD wrappers
│   │   ├── auth/
│   │   │   ├── verify-token.ts                    # extracts + verifies Bearer token
│   │   │   └── require-role.ts                    # role guard
│   │   ├── providers/
│   │   │   ├── cloudinary.ts
│   │   │   ├── stripe.ts
│   │   │   ├── videosdk.ts                        # mint JWT for a user+meeting
│   │   │   └── ai/
│   │   │       ├── index.ts                       # AIProvider interface + selector
│   │   │       ├── gemini.ts
│   │   │       ├── groq.ts
│   │   │       ├── claude.ts
│   │   │       └── grok.ts
│   │   ├── services/                              # business logic reused across routes
│   │   │   ├── users.service.ts
│   │   │   ├── classrooms.service.ts
│   │   │   ├── meetings.service.ts
│   │   │   ├── agendas.service.ts
│   │   │   ├── notes.service.ts
│   │   │   ├── resources.service.ts
│   │   │   ├── quizzes.service.ts
│   │   │   ├── assessments.service.ts
│   │   │   ├── attendance.service.ts
│   │   │   ├── breakouts.service.ts
│   │   │   ├── chat.service.ts
│   │   │   ├── insights.service.ts
│   │   │   ├── summaries.service.ts
│   │   │   └── payments.service.ts
│   │   ├── pdf/summary-builder.ts                 # PDF export for class summary
│   │   └── utils/
│   │       ├── errors.ts                          # ApiError helper
│   │       ├── response.ts                        # uniform JSON response shape
│   │       └── raw-body.ts                        # Stripe webhook
│   │
│   ├── shared/                                    # ── USED BY BOTH sides ──
│   │   ├── schemas/                               # Zod schemas (form + API validation)
│   │   │   ├── auth.schema.ts
│   │   │   ├── user.schema.ts
│   │   │   ├── classroom.schema.ts
│   │   │   ├── meeting.schema.ts
│   │   │   ├── agenda.schema.ts
│   │   │   ├── assessment.schema.ts
│   │   │   └── ...
│   │   ├── types/
│   │   │   ├── domain.ts                          # User, Meeting, Agenda, Assessment, ...
│   │   │   ├── api.ts                             # request/response types
│   │   │   └── enums.ts                           # UserRole, AssessmentType, MeetingStatus, ...
│   │   └── constants/
│   │       └── collections.ts
│   │
│   └── middleware.ts                              # role-based page protection
│
├── public/{fonts,icons}
├── _design/teacher_portal_mockup.html             # reference (gitignored)
├── tests/{unit,e2e}
├── .env.local                                     # gitignored
├── .env.example
├── .gitignore
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
├── components.json                                # shadcn
└── README.md
```

### Three buckets in `src/` — **respect this boundary**
- **`src/server/`** — runs ONLY inside `app/api/*/route.ts`. Imports Firebase Admin, Cloudinary secret, Stripe secret, VideoSDK secret, AI SDKs. **NEVER** imported from React components or pages. Put `import 'server-only'` at the top of every file here as a compile-time safeguard.
- **`src/lib/`** — runs ONLY in the browser / React components. Imports Firebase web SDK, axios, client-safe helpers.
- **`src/shared/`** — pure TypeScript: types, Zod schemas, enums, constants. Safe on both sides.

---

## 4. Architectural Conventions

### 4.1 API route handler template
Every `app/api/*/route.ts` follows this pattern:

```ts
import 'server-only';
import { NextRequest } from 'next/server';
import { verifyToken } from '@/server/auth/verify-token';
import { requireRole } from '@/server/auth/require-role';
import { ok, fail } from '@/server/utils/response';
import { AssessmentCreateSchema } from '@/shared/schemas/assessment.schema';
import { assessmentsService } from '@/server/services/assessments.service';

export async function POST(req: NextRequest) {
  try {
    const user = await verifyToken(req);
    requireRole(user, ['teacher']);
    const body = AssessmentCreateSchema.parse(await req.json());
    const created = await assessmentsService.create(user.uid, body);
    return ok(created, 201);
  } catch (e) { return fail(e); }
}
```

Order: **auth → role → Zod parse → service call → uniform response**. Controllers never touch Firestore directly — only via `src/server/services/*`.

### 4.2 Auth flow
1. Frontend signs in via Firebase Auth → gets an **ID token**.
2. Axios interceptor attaches `Authorization: Bearer <token>` to every `/api/*` request.
3. `verifyToken(req)` decodes via Firebase Admin and loads user profile/role from Firestore.
4. `requireRole(user, roles)` throws → 403 on mismatch.
5. `middleware.ts` also guards pages for UX, but API remains the real enforcement layer.

### 4.3 Roles
```
TEACHER   — create classrooms, host meetings, assessments, AI suggestions, upload slides
STUDENT   — join classrooms, attend meetings, attempt assessments, AI chatbot
PARENT    — read-only linked-student view (v2)
ADMIN     — everything + moderation + analytics
```
Role stored on the user's Firestore doc; optionally mirrored as a Firebase custom claim.

### 4.4 Provider abstractions
- `AIProvider` interface (`chat`, `complete`, `embed`). One impl per vendor; chosen by env/use-case.
- Cloudinary is the only media provider for v1; wrap it behind a `mediaProvider` object so S3/Azure swap later is one file.

### 4.5 Stripe webhooks
- Read raw body with `await req.text()` **before** anything parses JSON.
- Idempotent: dedupe on `event.id` in `processedStripeEvents/{eventId}`.

### 4.6 VideoSDK tokens
- Secret lives in env, read only in `src/server/providers/videosdk.ts`.
- `/api/meetings/[id]/token` mints short-lived JWT per user with role-based permissions (teacher = host, student = participant).

### 4.7 Real-time strategy
- For chat / hand-raises / quiz responses / attendance events: **backend writes to Firestore, frontend subscribes directly** via `onSnapshot`.
- Wrap in a single `useFirestoreSub` hook. No websocket gateway.
- Whiteboard sync handled by tldraw's own service.

### 4.8 Uniform response envelope
```json
{ "ok": true, "data": {...} }
{ "ok": false, "error": { "code": "...", "message": "...", "details": ... } }
```
`fail(e)` maps: Zod → 400, auth → 401/403, Firestore NotFound → 404, else → 500.

### 4.9 Shared Zod schemas
Schemas in `src/shared/schemas/` are imported by BOTH React Hook Form on the frontend AND API route handlers on the backend. Single source of truth for shape + validation.

### 4.10 Naming
- Files `kebab-case`, components/types `PascalCase`, functions `camelCase`, env vars `UPPER_SNAKE_CASE`.

---

## 5. Environment Variables (`.env.local`)

```dotenv
# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# ── Firebase web (shipped to browser) ──
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# ── Firebase Admin (server-only) ──
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# ── Cloudinary ──
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=

# ── VideoSDK ──
VIDEOSDK_API_KEY=
VIDEOSDK_SECRET_KEY=
NEXT_PUBLIC_VIDEOSDK_API_KEY=
VIDEOSDK_API_ENDPOINT=https://api.videosdk.live

# ── Stripe ──
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# ── AI providers (only those in use) ──
GEMINI_API_KEY=
GROQ_API_KEY=
ANTHROPIC_API_KEY=
XAI_API_KEY=
DEFAULT_AI_PROVIDER=gemini
```

> Rule: **anything prefixed `NEXT_PUBLIC_` is shipped to the browser**. Everything else stays server-only.

---

## 6. Firestore Collections (complete list)

```
users/{uid}                                 role, email, displayName, photoUrl,
                                            bio?, subjects?[], linkedStudents?[uid],
                                            createdAt, updatedAt

subjects/{subjectId}                        name, gradeLevels[]

classrooms/{classroomId}                    teacherId, subjectId, grade, name,
                                            description, code, studentIds[], createdAt

classroomAgendas/{classroomId}              sourceAgendaId, overrides, currentTopicId, currentSubId

agendas/{agendaId}                          subjectId, grade, title, ownerScope,
                                            topics:[{id,title,status,subtopics:[...]}]

notes/{noteId}                              ownerScope, ownerId, agendaId?, topicId?,
                                            meetingId?, tag, body, codeSnippet?, createdAt

resources/{resourceId}                      ownerScope, ownerId, subjectId, grade,
                                            type:'tool'|'doc'|'link', title, subtitle,
                                            mediaId?, url?, icon?, createdAt

meetings/{meetingId}                        classroomId, teacherId, videosdkRoomId,
                                            status:'scheduled'|'live'|'ended',
                                            startedAt, endedAt, recordingUrl?,
                                            currentSlide?, participantIds[]

canvasSessions/{sessionId}                  meetingId, snapshots[], createdAt

media/{mediaId}                             ownerId, providerId, url, type, sizeBytes,
                                            category:'slide_deck'|'video'|'pdf'|'image'|'link'

# live in-class quizzes
quizzes/{quizId}                            classroomId, subjectId, text, codeSnippet?,
                                            options[4], correctIndex, difficulty,
                                            createdBy, createdAt
quizSessions/{meetingId}/items/{qid}        status, postedAt, closedAt, stats
quizResponses/{meetingId}/{qid}/{uid}       answerIndex, correct, respondedAt, timeMs

# standalone assessments (homework-style)
assessments/{assessmentId}                  classroomId, teacherId, title, instructions?,
                                            dueAt, totalPoints, status:'draft'|'assigned'|'closed',
                                            createdAt, updatedAt
assessmentQuestions/{assessmentId}/{qid}    type:'mcq'|'short'|'tf', text,
                                            options?[], correctIndex?, correctText?,
                                            correctBool?, points, order
assessmentSubmissions/{assessmentId}/{uid}  answers:[{questionId,value}], submittedAt,
                                            autoScore, manualScore?, finalScore?,
                                            status:'submitted'|'graded',
                                            gradedBy?, gradedAt?, feedback?

attendanceEvents/{meetingId}/{eventId}      uid, type:'join'|'leave'|'hand'|'mic'|'away'|'attentive', ts

breakouts/{meetingId}/rooms/{rid}           name, studentIds[], videosdkRoomId, timerEndsAt?

chats/{meetingId}/messages/{mid}            fromUid, toUid?(null=class), body, ts

insights/{meetingId}/cards/{cid}            kind:'live_insight'|'trend', icon, title, text,
                                            time, actions:[{label,actionKey}], dismissed, generatedBy

summaries/{meetingId}                       kpis, comprehension, followUps[], topicAnalysis[],
                                            studentQuestions[], sessionIssues:{flags[],impact,notes},
                                            teacherRemarks, status, submittedAt, pdfMediaId?

payments/{paymentId}                        userId, stripeCustomerId, stripeSessionId,
                                            status, amount, currency, createdAt
processedStripeEvents/{eventId}             processedAt                                     # idempotency

aiInteractions/{id}                         userId, provider, prompt, response, useCase, createdAt
```

---

## 7. Full API Surface

### Auth & users
```
POST   /api/auth/session
POST   /api/auth/role                       (admin)
GET    /api/users/me
PATCH  /api/users/me
GET    /api/users/:uid
PATCH  /api/users/:uid
DELETE /api/users/:uid
GET    /api/users/:uid/profile              aggregated stats (for attendee drawer)
```

### Subjects / classrooms
```
GET    /api/subjects
POST   /api/subjects                        (admin)
PATCH  /api/subjects/:id                    (admin)

GET    /api/classrooms                      role-aware
POST   /api/classrooms                      (teacher)
GET    /api/classrooms/:id
PATCH  /api/classrooms/:id
POST   /api/classrooms/:id/enroll           (student)
POST   /api/classrooms/:id/link-parent      (parent)
GET    /api/classrooms/:id/agenda
POST   /api/classrooms/:id/agenda
```

### Agendas / notes / resources
```
GET    /api/agendas?subjectId=&grade=
POST   /api/agendas                         (admin)
GET    /api/agendas/:id
PATCH  /api/agendas/:id/topics/:topicId
PATCH  /api/agendas/:id/subtopics/:subId

GET    /api/notes?agendaId=&topicId=
POST   /api/notes
PATCH  /api/notes/:id
DELETE /api/notes/:id

GET    /api/resources?subjectId=&grade=&type=
POST   /api/resources
DELETE /api/resources/:id
```

### Meetings (live class)
```
POST   /api/meetings
GET    /api/meetings/upcoming
GET    /api/meetings/past
GET    /api/meetings/:id
POST   /api/meetings/:id/token              mint VideoSDK JWT
POST   /api/meetings/:id/end
GET    /api/meetings/:id/notes

GET    /api/meetings/:id/attendance
POST   /api/meetings/:id/attendance/event
POST   /api/meetings/:id/breakouts
PATCH  /api/meetings/:id/breakouts/:rid
POST   /api/meetings/:id/breakouts/recall
POST   /api/meetings/:id/breakouts/broadcast
DELETE /api/meetings/:id/breakouts/:rid
GET    /api/meetings/:id/chat
POST   /api/meetings/:id/chat
POST   /api/meetings/:id/chat/dm

POST   /api/meetings/:id/quizzes/:qid/post
POST   /api/meetings/:id/quizzes/:qid/close
POST   /api/meetings/:id/quizzes/:qid/respond
GET    /api/meetings/:id/quizzes/:qid/stats

GET    /api/meetings/:id/insights
POST   /api/meetings/:id/insights/generate
POST   /api/meetings/:id/insights/:iid/dismiss

POST   /api/meetings/:id/summary
GET    /api/meetings/:id/summary
GET    /api/meetings/:id/summary/pdf
```

### Live question bank (separate from assessments)
```
GET    /api/quizzes?classroomId=
POST   /api/quizzes
PATCH  /api/quizzes/:id
```

### Assessments (homework-style)
```
GET    /api/assessments?classroomId=
POST   /api/assessments                     (teacher) create draft
GET    /api/assessments/:id
PATCH  /api/assessments/:id                 edit while draft
DELETE /api/assessments/:id
POST   /api/assessments/:id/assign          draft → assigned
POST   /api/assessments/:id/submit          (student)
POST   /api/assessments/:id/grade           (teacher) short-answer grades
GET    /api/assessments/:id/responses       (teacher)
GET    /api/assessments/:id/results         (student)

GET    /api/assessments/:id/questions
POST   /api/assessments/:id/questions
PATCH  /api/assessments/:id/questions/:qid
DELETE /api/assessments/:id/questions/:qid
```

### Media / AI / payments / admin
```
POST   /api/media/upload
POST   /api/media/signed-url
DELETE /api/media/:publicId

POST   /api/ai/chat                         student chatbot
POST   /api/ai/suggest                      teacher suggestions
POST   /api/ai/copilot                      Ask-AI in live class
POST   /api/ai/generate-assessment          Create Assessment modal

POST   /api/payments/checkout-session
POST   /api/payments/subscriptions
POST   /api/payments/webhooks               raw body

GET    /api/admin/users
GET    /api/admin/analytics/overview
```

---

## 8. Pages

### Auth
- `/login`, `/signup`

### Teacher
- `/teacher/dashboard` — upcoming class (hero card) + past classes list + Create Assessment
- `/teacher/profile` — avatar, name, email, bio, subjects, change password, delete account
- `/teacher/classes` — full class list
- `/teacher/classroom/[meetingId]` — **THE live class portal** (mockup)
- `/teacher/assessments` — all assessments across classes
- `/teacher/assessments/[id]` — view responses + grade short-answer

### Student
- `/student/dashboard` — classes + assigned assessments + results
- `/student/classroom/[meetingId]` — read-only versions of teacher panels; can raise hand, answer live quiz, chat
- `/student/assessments/[id]` — attempt (timer, per-type UI, submit)

### Admin
- `/admin/users`, `/admin/subjects`, `/admin/agendas`, `/admin/resources`, `/admin/analytics`

### Parent (v2)
- `/parent/dashboard` — read-only linked-student view

---

## 9. Teacher Dashboard — UI behaviour

Layout (matches mockup tokens):
```
Topbar  [ EduMeet ]                        [ Profile avatar ▾ ]
Sidenav │                                                      │
        │  Upcoming Class (hero card)                          │
        │  ┌──────────────────────────────────────────────┐    │
        │  │  Algebra — Grade 9                           │    │
        │  │  Today, 10:00 AM · 13 students               │    │
        │  │  [ Join live ]  [ Create assessment ]        │    │
        │  └──────────────────────────────────────────────┘    │
        │                                                      │
        │  Past Classes                                        │
        │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐     │
        │  │ Card        │ │ Card        │ │ Card        │     │
        │  │ [Recording] │ │[Summary PDF]│ │[Assessment] │     │
        │  └─────────────┘ └─────────────┘ └─────────────┘     │
```

- Click card → `/teacher/classroom/[meetingId]` (live/upcoming) or class recap page (past).
- **Create Assessment** → opens `<CreateAssessmentModal classroomId={...} />`.

### Create Assessment modal — full flow
1. **Step 1 — Basics**: title, instructions, due date, total points (auto-computed), default question type (MCQ).
2. **Step 2 — Questions**: add manually OR click **"Generate with AI"** → calls `POST /api/ai/generate-assessment { subject, grade, topic, type, count }` → returns draft questions → edit inline.
3. Each question row has a **type switcher**: MCQ shows 4 option inputs + correct radio; Short shows correct-answer input; T/F shows True/False toggle.
4. **Save as draft** (status=`draft`) or **Assign now** (status=`assigned`, students see it immediately).
5. After assigning, teacher lands on `/teacher/assessments/[id]` with a live responses table as submissions arrive.

---

## 10. Assessments — grading logic

**On student submit** (`POST /api/assessments/:id/submit`):
- For each answer:
  - **MCQ** → compare `answerIndex === correctIndex` → `correct` bool, awards `points` if correct.
  - **True/False** → compare `answerBool === correctBool`.
  - **Short Answer** → leave `correct` null; teacher grades later.
- Sum `autoScore`. If assessment has **any** short-answer questions, `status = 'submitted'` (awaiting teacher). Otherwise `status = 'graded'`, `finalScore = autoScore`.
- Students see auto-graded parts immediately; final score appears once teacher submits manual grades.

**On teacher grade** (`POST /api/assessments/:id/grade`):
- Posts `{uid, perQuestionScores: [...]}` for short-answer items.
- Server computes `manualScore`, `finalScore = autoScore + manualScore`, sets `status = 'graded'`.
- Optional `feedback` text.

---

## 11. Build order (for Claude Code)

1. **Setup & theme**: tokens, fonts (DM Sans/Mono), Tailwind config, providers (`QueryProvider`, `AuthProvider`, `ToastProvider`).
2. **Firebase**: web SDK init (`src/lib/firebase/client.ts`); Admin SDK singleton (`src/server/firebase-admin.ts`); `verifyToken` helper.
3. **Auth pages**: login/signup + `/api/auth/session` + role guard (`middleware.ts` + `requireRole`).
4. **Layout shell**: topbar, sidenav, three-column shell.
5. **Teacher profile page** + `/api/users/me` endpoints.
6. **Teacher dashboard** + `/api/meetings/upcoming`, `/api/meetings/past`.
7. **Classrooms CRUD** + subjects (admin stub OK).
8. **Classroom page shell** (teacher) with tabs + mock data.
9. **Meetings create + VideoSDK token**; wire Video pane.
10. **Agenda + Notes + Resources**.
11. **Live Quiz flow** (question bank + post/respond).
12. **Attendance + hand-raise** via Firestore subs.
13. **Breakouts + Chat**.
14. **AI providers + co-pilot** (`/api/ai/*`).
15. **Assessments** (full CRUD + assign + submit + grade + AI generate).
16. **Summary modal + PDF export**.
17. **Whiteboard (tldraw)**.
18. **Student portal** (reuse 80% of teacher components).
19. **Admin portal** (users, subjects, master agendas, resources).
20. **Payments** (Stripe + webhooks).
21. **Parent portal** (v2 — skip).

Every module gets a smoke Vitest case at minimum.

---

## 12. Setup Commands (Windows / PowerShell, from `D:\Web`)

```powershell
# 1. Scaffold Next.js 15
npx create-next-app@latest edumeet --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
cd edumeet

# 2. Runtime deps (client + server combined)
npm install firebase firebase-admin axios @tanstack/react-query zustand `
  react-hook-form zod @hookform/resolvers `
  @videosdk.live/react-sdk jsonwebtoken `
  cloudinary stripe `
  @google/generative-ai groq-sdk @anthropic-ai/sdk `
  lucide-react recharts react-markdown remark-gfm sonner date-fns `
  clsx tailwind-merge tldraw `
  pdfkit server-only

# 3. Dev deps
npm install -D @types/node @types/jsonwebtoken @types/pdfkit `
  prettier eslint-plugin-tailwindcss eslint-config-prettier `
  vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom

# 4. shadcn/ui (you already ran init with Nova preset)
npx shadcn@latest add button input textarea label dialog dropdown-menu select `
  tabs tooltip badge avatar card separator scroll-area sheet sonner

# 5. Folder skeleton — paste as one block
$folders = @(
  "app/(auth)/login","app/(auth)/signup",
  "app/(teacher)/dashboard","app/(teacher)/profile","app/(teacher)/classes",
  "app/(teacher)/classroom/[meetingId]","app/(teacher)/assessments/[id]",
  "app/(student)/dashboard","app/(student)/classroom/[meetingId]","app/(student)/assessments/[id]",
  "app/(admin)/users","app/(admin)/subjects","app/(admin)/agendas","app/(admin)/resources","app/(admin)/analytics",
  "app/(parent)",
  "app/api/auth/session","app/api/auth/role",
  "app/api/users/me","app/api/users/[uid]/profile",
  "app/api/subjects",
  "app/api/classrooms/[id]/enroll","app/api/classrooms/[id]/link-parent","app/api/classrooms/[id]/agenda",
  "app/api/agendas/[id]/topics/[topicId]","app/api/agendas/[id]/subtopics/[subId]",
  "app/api/notes/[id]","app/api/resources/[id]",
  "app/api/meetings/upcoming","app/api/meetings/past",
  "app/api/meetings/[id]/token","app/api/meetings/[id]/end","app/api/meetings/[id]/notes",
  "app/api/meetings/[id]/attendance/event",
  "app/api/meetings/[id]/breakouts/[rid]","app/api/meetings/[id]/breakouts/recall","app/api/meetings/[id]/breakouts/broadcast",
  "app/api/meetings/[id]/chat/dm",
  "app/api/meetings/[id]/quizzes/[qid]/post","app/api/meetings/[id]/quizzes/[qid]/close",
  "app/api/meetings/[id]/quizzes/[qid]/respond","app/api/meetings/[id]/quizzes/[qid]/stats",
  "app/api/meetings/[id]/insights/generate","app/api/meetings/[id]/insights/[iid]/dismiss",
  "app/api/meetings/[id]/summary/pdf",
  "app/api/quizzes/[id]",
  "app/api/assessments/[id]/assign","app/api/assessments/[id]/submit","app/api/assessments/[id]/grade",
  "app/api/assessments/[id]/responses","app/api/assessments/[id]/results",
  "app/api/assessments/[id]/questions/[qid]",
  "app/api/media/upload","app/api/media/signed-url","app/api/media/[publicId]",
  "app/api/ai/chat","app/api/ai/suggest","app/api/ai/copilot","app/api/ai/generate-assessment",
  "app/api/payments/checkout-session","app/api/payments/subscriptions","app/api/payments/webhooks",
  "app/api/admin/users","app/api/admin/analytics/overview",
  "src/components/ui","src/components/layout","src/components/shared",
  "src/components/teacher","src/components/student","src/components/admin",
  "src/components/classroom/left-panel","src/components/classroom/main",
  "src/components/classroom/copilot","src/components/classroom/modals","src/components/classroom/canvas",
  "src/components/icons",
  "src/hooks","src/stores","src/providers",
  "src/lib/api","src/lib/firebase","src/lib/videosdk","src/lib/theme","src/lib/utils",
  "src/server/firestore","src/server/auth","src/server/providers/ai",
  "src/server/services","src/server/pdf","src/server/utils",
  "src/shared/schemas","src/shared/types","src/shared/constants",
  "public/fonts","public/icons","_design","tests/unit","tests/e2e"
)
$folders | ForEach-Object { New-Item -ItemType Directory -Force -Path $_ | Out-Null }
New-Item -ItemType File -Force -Path .env.local, .env.example | Out-Null
Write-Host "Folder skeleton created."

# 6. Sanity check
npm run dev
```

Save the HTML mockup at `_design/teacher_portal_mockup.html` and add `_design/` to `.gitignore`.

---

## 13. Things to NOT do

- **No MongoDB, no Prisma, no ORM**. Firestore is the only database.
- Do not import `src/server/*` from any component or page. `import 'server-only'` at the top of every server file.
- Do not call Firebase Admin SDK from the browser.
- Do not call AI providers from the client; always go through `/api/ai/*`.
- Do not parse JSON on the Stripe webhook route.
- Do not trust role from the client; re-verify on every API call.
- Do not duplicate components per portal — lift to `src/components/shared/`.
- Do not store large blobs in Firestore — Cloudinary only; save URL/publicId.
- Do not use Pages Router. App Router only.

---

## 14. Future (stubbed)

- Parent portal (v2).
- WebSocket gateway (only if Firestore subs + tldraw become insufficient).
- Background jobs (Upstash QStash or BullMQ + Redis) for recording post-processing and emails.
- Caching (Upstash Redis) for hot Firestore reads.
- Multi-cloud media (S3 / Azure).
- Observability (Sentry + OpenTelemetry).
- Rate limiting (Upstash + middleware).

---

## 15. Instructions for Claude Code

1. **Read this file end-to-end before writing any code.**
2. Start with the numbered **build order in §11**. Confirm the plan for the current step before writing files.
3. Respect the **`src/server/` vs `src/lib/` vs `src/shared/`** boundary. In doubt: types/schemas → `shared`, UI helpers → `lib`, secret-using code → `server`.
4. Every API route MUST: verify token → check role → Zod parse → service call → uniform response envelope.
5. Every form MUST use the SAME Zod schema from `src/shared/schemas/` that its API route uses.
6. Keep this doc current: if you invent new collections, endpoints, or conventions, update §6, §7, and §4 here before moving on.

---

_Last updated: keep this header current whenever architecture changes._
