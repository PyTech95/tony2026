# Tony Yoga — PRD / Deployment Notes

## Problem statement
Deploy the existing `tony-yoga22-main` project. It turned out to be a full-stack
React (CRA + craco) + FastAPI + MongoDB app for Tony Sanchez Yoga (Málaga, Spain):
marketing site + web app with programs, live class schedule/booking, workshops,
retreats, memberships, passes, shop, referrals, streaks, wishlist, news, push
notifications, and Stripe/PayPal payments.

## Stack
- Frontend: React 19, CRA via @craco/craco, TailwindCSS, shadcn/ui, react-router-dom v7.
  All API calls via `process.env.REACT_APP_BACKEND_URL` (src/lib/api.js). PWA (sw.js, manifest).
- Backend: FastAPI, routers registered by side-effect import (routers/*.py) onto shared
  `/api` APIRouter in core.py. Motor/MongoDB. JWT auth (bcrypt). Idempotent seed on startup.
- DB: MongoDB (local via MONGO_URL).

## Env vars (/app/backend/.env)
- MONGO_URL, DB_NAME=tony_yoga, CORS_ORIGINS=*
- JWT_SECRET (generated)
- STRIPE_API_KEY=sk_test_emergent (Emergent Stripe proxy via emergentintegrations)
- EMERGENT_LLM_KEY
- FRONTEND_URL, ADMIN_EMAIL, ADMIN_PASSWORD
- Optional / graceful-degrade if unset: SMTP (email_service.py), VAPID (push), PayPal
  (PAYPAL_CLIENT_ID/SECRET/MODE).
- Frontend /app/frontend/.env: REACT_APP_BACKEND_URL (preview URL).

## Deployment setup done (2026-06)
- Extracted uploaded zip into /app (preserved .git, .emergent, protected .env keys).
- Resolved backend dep conflict: installed emergentintegrations from Emergent index,
  then remaining requirements (skipped conflicting pinned litellm wheel — compatible
  litellm pulled by emergentintegrations).
- yarn install for frontend.
- Wrote backend/.env with required keys; restarted supervisor.
- Verified: /api/health ok (seeded users/programs/workshops/products), admin login,
  public endpoints (programs, class-instances, products, instructors) all HTTP 200,
  frontend renders, SPA deep links resolve.
- deployment_agent readiness check: PASS (no hardcoded URLs/secrets, CORS ok, ports ok).

## Notes
- Payments run through Emergent Stripe test proxy (sk_test_emergent). Subscriptions are
  OFF by design; memberships process as one-time payments.
- Email/push/PayPal silently no-op until their creds are configured in admin settings/.env.

## Backlog / P1
- Configure real SMTP (Gmail app password) for booking confirmations & magic links.
- Configure VAPID keys for web push reminders.
- Add PayPal live/sandbox creds if PayPal checkout is wanted.
- For production Stripe (real charges + subscriptions), swap in a live Stripe key.

## Iteration 21 (2026-06) — Admin experience, PayPal-primary, Instagram control
- Role-aware nav (AppShell): admins get an "Admin mode" banner + bottom nav [Console, Classes, Programs, Library, Profile]; members keep [Home, Schedule, Programs, Library, Profile]. Fixes "admin behaves like a user / can't find the console".
- Admin content shortcuts: "Manage" button on Programs & Library pages deep-links to /admin?tab=courses (Courses & Videos → LessonsEditor for editing courses AND their videos). Admin console now supports ?tab= deep-linking.
- PayPal is PRIMARY everywhere: PaymentButtons shows PayPal first, card (Stripe) as backup ("Or pay with card"). providers.py gates PayPal on paypal_enabled + creds and reports primary. Profile retreat-balance also prefers PayPal.
- Admin PayPal config card in Settings (enable, sandbox/live, client id, secret masked) — Tony pastes his own PayPal keys here; stored in DB (paypal_client_secret is a secret field).
- Admin Instagram feed control in Settings: show/hide toggle (reels_enabled), profile handle (social_instagram), and add/remove reels (shortcode+caption, accepts full IG links). Homepage InstagramReels reads /settings/public + /marketing/reels.
- Verified: iteration_21.json — 100% backend + frontend, no issues. Live app left clean (PayPal off, curated default reels).

## How to enable real PayPal (for Tony)
1. Log in as admin → Console → Settings → PayPal card.
2. Toggle on, pick Sandbox or Live, paste Client ID + Secret from developer.paypal.com (Apps & Credentials, matching the environment), Save.
3. PayPal then shows as the primary button at every checkout.

## Iteration 22 (2026-06) — PayPal verify, staff CTA gating, Instagram auto-sync, Admin dashboard
- Admin Dashboard home (Overview tab): GET /api/admin/dashboard → month revenue, today's classes (booked/capacity), signups (7d) + recent signups list, recent payments. DashboardHome component in Admin.jsx.
- Staff checkout gating: PaymentButtons shows a "Staff preview — checkout disabled" note for admin/instructor instead of pay buttons (covers Memberships, Passes, Cart, WorkshopDetail).
- PayPal verify: POST /api/admin/paypal/verify (admin) does an OAuth token check so Tony can confirm keys before going Live; "Verify connection" button in the PayPal settings card. Graceful ok:false when no creds.
- Instagram auto-sync via official Meta/Instagram Graph API (graph.instagram.com media edge): settings hold instagram_access_token (secret) + instagram_user_id + instagram_auto_sync; POST /api/admin/instagram/sync ("Sync now") maps latest media -> instagram_reels; background tick auto-syncs ~every 30 min. Graceful: 400 not_connected (no token), 502 on Graph API errors; keeps cached reels on failure. Admin UI: token/account-id fields, auto-sync toggle, Sync now, last-sync/last-error status.
- Verified: iteration_22.json — 100% backend + frontend, no issues. Live app left clean (PayPal off, Instagram not connected, curated default reels).

## How to enable Instagram auto-sync (for Tony)
1. Convert IG to Business/Creator; create a Meta app with the Instagram product (Instagram API with Instagram Login), get the account id + a long-lived user access token (instagram_business_basic scope).
2. Console → Settings → Instagram → paste account id + token, toggle Auto-sync on, click "Sync now".

## Iteration 23 (2026-06) — Full LMS flow verified + fixed
Verified end-to-end (testing agent iteration_23): admin authors courses (title/desc/level/style/price + access model pills one_time|membership|free), adds video lessons (single + bulk chapters + reorder), schedules live classes (+ CSV import); student sees a proper enroll/access card and learns (watch via /library/{videoId}, progress tracked, certificate on completion).
Bugs fixed this iteration:
- ProgramDetail CTA was hardcoded "Enroll -> /memberships" for every course. Replaced with dynamic EnrollCard: program-purchase (one_time -> PayPal-primary PaymentButtons item_type=program), program-membership (-> /memberships), program-free, program-enrolled (owns/member/staff). Students can now actually BUY an individual course.
- Access logic ignored price_model=="free"; free courses stayed locked. Added free handling in get_program + _can_access_video.
- CRITICAL: progressive-unlock defaulted requires_submission to True when the field was absent, so lessons created via the admin editor (no assignments) locked lesson 2+. Changed default to False in content.py get_program (both gate checks). Verified: 2-lesson free course now unlocks both lessons for a student. Backward compatible (explicit requires_submission=True still gates).
Left clean: only the 3 seeded courses remain (TEST23 demo data removed).

## LMS flow summary (answer to Tony)
- Admin (Console -> Courses & Videos): create/edit courses, set price + access model + drip, add/reorder video lessons. Console -> Classes: schedule live classes (+ CSV import).
- Student: browse Programs -> buy a one_time course (PayPal/card) OR subscribe to a membership for membership courses OR open a free course -> watch lessons (progress saved, resume) -> certificate on completion. Live classes bookable from Schedule; passes/drop-ins available.

## Iteration 24 (2026-06) — Bundles, Assignments/Quizzes, Student Progress
- Course Bundles: new routers/bundles.py (GET /bundles public with programs+savings+viewer.owns_all; /admin/bundles CRUD). payments.py _resolve_price + _fulfill_payment handle item_type='bundle' (grants program_enrollments for every course in the bundle, one checkout). Admin: Console -> Bundles tab (BundlesPane: create/edit/delete, pick >=2 courses, live savings). Student: discounted bundle card on /programs (PayPal-primary buy). Seeded 'The Core Collection' (€799, 3 courses, save €298).
- Assignments & Quizzes: lessons gain requires_submission + assignment_prompt + pass_threshold (models + admin_add/update_lesson persist). Admin LessonsEditor exposes the toggle+prompt+pass mark. Student ProgramDetail shows AssignmentPanel (paste practice video -> POST /submissions/create -> async Gemini grade or pending_review; admin can manual-score via /admin/submissions/score). Progressive unlock: lesson N+1 stays LOCKED until lesson N's submission scores >= threshold.
  FIX: content.py get_program gate was checking the current lesson's flag (off-by-one); now each lesson unlocks on prev_passed. Verified: L2 locked pre-submission, unlocks after passing score.
- Student Progress View: GET /admin/students/progress (per student: enrollments with completed/total/pct, certified flag, active_member, certificates count). Admin: Console -> Students tab (StudentsPane) with progress bars + badges.
- Verified: iteration_24.json 100% backend + frontend (bundles, admin panes, checkout session); gating fix verified directly via API. Left clean (seeded bundle kept, test data removed).

## Restore + Deploy-Prep (2026-08-20)
- Re-uploaded `yoga-last-final-main.zip` restored into /app (workspace had reset to boilerplate). Preserved /app/.git, /app/.emergent, and protected .env keys.
- Secrets audit: clean — no hardcoded keys/URIs; all secrets via env or DB settings.
- backend/.env written: MONGO_URL(local), DB_NAME=tony_yoga, CORS_ORIGINS=preview domain (locked, not *), fresh JWT_SECRET, STRIPE_API_KEY=sk_test_emergent, EMERGENT_LLM_KEY, FRONTEND_URL, ADMIN_EMAIL/PASSWORD.
- Deps: emergentintegrations from Emergent index first, then remaining requirements skipping the pinned litellm wheel (conflict); yarn already up-to-date.
- Verified: /api/health ok (3 users, 3 programs, 4 workshops, 4 products, 28 class instances), admin login → admin token, public endpoints 200 via external URL, homepage renders and talks to live backend.
- deployment_agent readiness: PASS (no hardcoded URLs/secrets, CORS ok, ports ok, idempotent seed, no destructive startup).
- To go live: user clicks the Deploy button in the Emergent UI (CORS_ORIGINS auto-updated at deploy).

## Module 4.3 — Zoom Live Classes + Cloud Recordings + Limited Replay (2026-08-20)
Gap analysis vs new spec: YouTube segment lessons (4.2) and AI chat assistant + lead capture + WhatsApp wa.me handoff (Sec 5) were ALREADY built. Real gaps = Zoom (4.3) and Podcast/Broadcast (Sec 6).
Built this iteration (Zoom, per user ordering):
- backend/routers/zoom.py — Server-to-Server OAuth (account_credentials) with token cache; graceful MOCK when creds absent. Endpoints: GET/POST /admin/zoom/status|verify, POST /admin/class-instances/{id}/zoom-meeting, POST+DELETE /admin/class-instances/{id}/recording, GET /class-instances/{id}/recording (gated).
- Auto-provision a Zoom meeting when an ONLINE class instance is created (scheduling.create_instance, best-effort/mock).
- Limited replay: attach recording sets recording_expires_at = now + replay_days (default 3, admin-configurable). Student endpoint returns available/expired/not_ready; access = staff OR (booked/active member) AND within window. Booked students get a push notification when a recording is attached.
- Security: public /class-instances/{id} strips zoom_start_url (host-only) and recording_url (served only via the gated endpoint).
- settings.py: zoom_account_id/client_id/client_secret(secret)/host_user_id + zoom_enabled + recording_replay_days (env fallback ZOOM_*).
- Frontend: ClassDetail.jsx "Join on Zoom" + "Class recording" (watch + expiry / expired / pending). Admin Classes tab: per-class "Create Zoom meeting" + "Add/Remove recording" (URL + replay days). Settings: Zoom card (creds + verify + default replay days).
- Verified via curl + screenshot: mock meeting create, booking, recording attach (2-day expiry), gated student access, unbooked→403, no host/recording URL leak, frontend renders. Live Zoom stays MOCKED until Tony pastes S2S OAuth keys in Admin → Settings.

## Remaining gaps / backlog
- P0: Podcast/Broadcast module (Sec 6) — NOT built (current "Broadcast" tab is only push-notify).
- P1: AI assistant VOICE (OpenAI Whisper STT + TTS) — chat already works.
- P1: WhatsApp provider notifications for broadcasts/reminders (currently wa.me click-to-chat handoff only).

## Module Sec 6 — Podcast / Broadcast Episodes (2026-08-20)
- backend/routers/broadcasts.py: episodes CRUD (audio|video), optional scheduled release (publish_at), optional program tie, best-effort push-notify on publish, background broadcasts_publish_tick() auto-publishes due episodes. Public GET /broadcasts (published & due only) + media_type/tag filters; GET /broadcasts/{id} 404s unpublished for non-staff.
- Frontend: new public /broadcasts page (Broadcasts.jsx) with All/Audio/Video filters + inline players (YouTube iframe for video, <audio>/<video> for direct URLs); added "Podcast" bottom-nav item. Admin "Broadcast" tab now has an EpisodesManager (create/schedule/publish-now/delete) above the existing push-notification form.
- seed.py seeds 2 demo episodes.
- Verified via curl + screenshot + testing_agent (iteration_25): admin CRUD, scheduling gating (future hidden from public, publish-now reveals), public playback + filters, unauth blocked. 20/20 pytest pass.
- FIX (from iteration_25 HIGH finding): GET /api/class-instances (list_instances) was leaking zoom_start_url + recording_url to anonymous callers — now stripped (get_instance already did). Re-verified: 0 leaks, join_url/recording_expires_at retained for admin UI.

## Still pending / backlog
- P1: AI assistant VOICE (OpenAI Whisper STT + spoken TTS) — chat already works.
- P1: WhatsApp provider notifications (currently wa.me click-to-chat handoff only).
- P2 (from iteration_25 nits): swap native datetime-local for shadcn picker in episode scheduler; confirm whether non-booking active members should access class recordings (currently allowed by design); split Admin.jsx (1600+ lines) into per-pane files.

## Iteration — Assistant Voice + WhatsApp + Episode Series + Auto Recording Pull (2026-08-20)
1) ASSISTANT VOICE (Sec 5): assistant.py refactored to a shared _generate_reply(); new POST /assistant/voice (multipart mic audio -> OpenAI Whisper `whisper-1` STT -> LLM reply -> OpenAI TTS `tts-1` voice 'nova' spoken reply as base64 mp3) and POST /assistant/tts (read-aloud). AssistantWidget.jsx now uses MediaRecorder (getUserMedia) instead of the browser SpeechRecognition API (works in Safari), plays returned audio, and the speaker toggle uses server TTS. Uses EMERGENT_LLM_KEY. Verified full round-trip via curl (transcribe -> Core 26+ recommendation -> 905KB spoken reply).
2) WHATSAPP ALERTS (P1): whatsapp_service.py (Twilio, async via to_thread, graceful no-op/log when unconfigured). Wired into class reminder tick (push.send_reminders_tick, now runs when EITHER push or whatsapp is enabled) and new-episode fan-out (broadcasts._notify_subscribers). Settings: whatsapp_enabled + twilio_account_sid + twilio_auth_token(secret) + twilio_whatsapp_from (env fallback TWILIO_*). Admin Settings WhatsApp card + POST /admin/whatsapp/test. MOCKED until Twilio keys added. twilio==9.11.0 added to requirements.
3) EPISODE SERIES: broadcasts gain optional `series`; POST/PATCH persist it; GET /broadcasts?series= filter + GET /broadcasts/series (distinct). Admin episode form has a Series field; public Broadcasts page shows series filter chips. Seeded 2 demo episodes tagged series 'Foundations'.
4) AUTO RECORDING PULL: zoom.py adds zoom_recording_poll_tick() (every 60s via server loop; for online classes ended <24h with a real non-mock meeting id and no recording, auto-fetch cloud recording + attach with default replay days + notify) and POST /webhook/zoom (endpoint.url_validation handshake + recording.completed -> attach). No-op in mock mode.
- Verified: TTS + voice round-trip, /broadcasts/series, zoom webhook handshake, whatsapp test (ok:false unconfigured), settings persist, frontend compiles + renders (assistant mic UI, series chips). WhatsApp + live Zoom remain MOCKED until keys are pasted in Admin → Settings.

## Restore + Deploy-Prep (2026-06, current session)
- Re-uploaded `final-tony-main.zip` restored into /app (workspace was boilerplate). rsync excluded .env/node_modules/.git.
- Wrote /app/backend/.env: MONGO_URL(local), DB_NAME=tony_yoga, CORS_ORIGINS="*" (Bearer auth, allow_credentials=False → wildcard safe), fresh JWT_SECRET, STRIPE_API_KEY=sk_test_emergent, EMERGENT_LLM_KEY, FRONTEND_URL, ADMIN_EMAIL/PASSWORD.
- Deps: emergentintegrations (base image), pip install requirements (skipped pinned litellm wheel), pip freeze → requirements.txt. Frontend yarn up-to-date.
- Hardening: removed .env/*.env from .gitignore (platform needs env present); replaced admin_dashboard N+1 booking-count loop with a single $group aggregation.
- Verified: /api/health ok (3 users/programs, 4 workshops/products, 28 class instances), admin login (admin token), public /api/programs 200, /api/admin/dashboard 200, homepage renders live against backend.
- deployment_agent: PASS (no hardcoded URLs/secrets, CORS ok, /api prefix + /api/health, idempotent seed, no destructive startup).
- To go live: user clicks the Deploy button in the Emergent UI (CORS auto-updated at deploy).

## Iteration 26 (2026-06) — Closing the 5 spec gaps
Audited the full product spec against the 25-iteration codebase (~95% already built). Implemented the 5 genuinely-missing items:
1. Community Leaderboard — backend routers/leaderboard.py (GET /api/leaderboard, points = lessons*10 + attendance*8 + certs*50 + longest_streak*3; privacy-aware first-name-only, staff excluded, optional settings kill-switch leaderboard_enabled). Frontend Leaderboard.jsx page + /leaderboard route + Profile link.
2. Gift cards — routers/giftcards.py (admin create/list/deactivate, student redeem->store_credit, /me/store-credit, check). ATOMIC redeem via find_one_and_update (no double-spend). Admin console "Gift Cards" tab (GiftCardsPane) + Profile redeem UI + store-credit balance.
3. Certificates CSV export — GET /api/admin/certificates/export.csv + button in admin Students pane.
4. Assignment retry limits — max_attempts added to lesson models + admin lesson editor field; enforced in submissions.create_submission; GET /api/submissions/attempts/{lesson_id}; student AssignmentPanel shows remaining/lockout.
5. In-app Notification Center — routers/notifications.py (GET /api/notifications aggregates announcements + published broadcasts + expiring recordings; unread vs users.notifications_seen_at; POST /notifications/seen). NotificationBell.jsx bell + dropdown wired into AppShell for logged-in users.
Registered new routers in server.py. Demo accounts confirmed seeded: student@demo.com/Student2026!, instructor@demo.com/Instructor2026!.
Verified: testing agent iteration_26 — 100% backend (26/26) + 100% frontend (all 5 flows). Applied money-safety hardening (atomic gift-card redeem, deactivate guards active-only). Curl re-verified redeem 200 -> double 400 -> invalid 404.
Still-open (spec 'future'/optional, not built): leaderboard admin toggle UI, gift-card application at gateway checkout (credit is tracked/visible only), notification timestamp datetime-normalisation.

## Iterations 27-29 (2026-06) — Segmented-clip player overhaul
- iter27: Fixed segmented lessons playing past the clip end. YouTube `end` playerVar is unreliable; now a 400ms poll hard-enforces end (pause+seekTo(end)+mark complete). Also fixed direct <video> start/end clamp. Verified 8/8 via window.YT stub (YouTube media can't play in sandbox — env restriction, not a bug).
- iter27b: Clip-duration chip ("mm:ss clip", data-testid clip-duration-chip) on player.
- iter28: Auto-Advance overlay (autoadvance-overlay, play-now/cancel, 6s countdown to next unlocked lesson via GET /programs/{id} lesson order) + clip-only progress bar (clip-progress/-fill). Confirmed Chapter Markers (admin "Auto chapters" bulk split, data-testid lesson-bulk -> POST /admin/programs/{id}/lessons/bulk) already existed. 8/8 pass.
- iter29: Option A "YouTube clean-clip mode" — playerVars controls:0 (native scrubber/branding hidden), custom yt-toggle-play / native-toggle-play play/pause overlays, onReady seek-to-start+pause (start frame acts as poster), seekable clip-progress-track locked to [start,end], start lower-bound + end upper-bound lock. 7/7 pass; fixed direct-video play() promise rejection + seeded clipPct from resume.
- Decisions (user): do Option A now, cloud-hosted clips (Option B) LATER; poster = clip start frame (achieved via YouTube seek+pause on ready, since YouTube can't export an arbitrary-timestamp still); NO 7-12min duration validation.
- KNOWN YouTube limitation: cannot fully remove the brief YouTube logo flash on load, and clips require the source video to remain public/unlisted. Full control (clean scrubber, no branding, exact trim) needs Option B cloud hosting — deferred per user.
