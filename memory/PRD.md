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

## Iteration 31 (2026-06) — Fixed fatal player crash
- BUG: clicking play on a YouTube lesson crashed with React "insertBefore ... NotFoundError" runtime overlay.
- ROOT CAUSE: YouTube IFrame API REPLACES the mount div with its <iframe>; that div was a direct sibling of overlays (ClipChip/play button/BottomBar). On overlay re-render React ran insertBefore against the now-detached mount node -> crash.
- FIX (VideoPlayer.jsx): mount div is now the sole child of a stable `absolute inset-0 pointer-events-none` wrapper; overlays are siblings of that wrapper, so React never reorders around the replaced node.
- VERIFIED: testing agent iter31 used the REAL YouTube API (no stub) on both crash URLs; 100% pass, no insertBefore/NotFoundError across play/pause, mute, seek, fullscreen, resume, and SPA nav.

## Iteration 32 (2026-06) — Final spec-gap closeout + mobile packaging
- "Remember me" at login: UserLogin.remember (bool); create_access_token exp 30d(true)/1d(false)/7d(none, backward-compat); cookie max-age matches. Frontend Login "Keep me signed in" checkbox (default on); tokenStore uses localStorage (persist) vs sessionStorage (session-only). VERIFIED 12/12 backend + 3/3 frontend.
- AI leads CSV export: GET /admin/assistant/leads/export.csv (admin) + "Export leads CSV" button in admin AI card (settings-assistant-leads-export). Covers spec 5 "send to CRM/Google Sheet".
- Mobile packaging (spec 2): added /app/frontend/capacitor.config.json + /app/MOBILE_BUILD.md (Capacitor Android/iOS wrap steps, permissions, live-reload, store assets). PWA already installable (manifest standalone/portrait/maskable, viewport-fit=cover, apple meta, sw.js). Responsive audit: no horizontal overflow on home/programs/shop/schedule; member app is mobile-first (centered column + bottom tab bar).
- SPEC NOW ~100%. Optional hardening noted (Secure cookie, login lockout) — deferred.

## Retreats cleanup (2026-06)
- User: keep only the coming December Core 40 retreat; remove old dates.
- Live DB: deactivated Core 26+ (Apr), Yoga Holiday (May), Core 84 (Jul); kept Tree of Yoga · Core 40 (Dec 1-7).
- seed.py: now seeds only the Core 40 December retreat.
- GET /api/workshops now filters is_active AND end_date>=now (upcoming only). Verified: /workshops returns 1 (Core 40 Dec); marketing Retreats section shows just that card.

## Iteration 33 (2026-06) — Retreat admin + deposit reminders + login lockout
- Add Retreat (admin): new Admin "Retreats" tab (RetreatsPane) + backend GET/POST/PATCH/DELETE /api/admin/workshops. WorkshopCreate/Update now carry deposit_eur. Create publishes; toggle Active/Hidden; delete. Public /api/workshops still upcoming+active only.
- Per-retreat deposit: reserve_retreat uses workshop.deposit_eur; Marketing + WorkshopDetail (hero, balance, button, Stripe label) all read w.deposit_eur ?? 500 (fixed hardcoded €500 spots flagged by tester).
- Deposit reminders: send_balance_reminders_tick (bg loop) now sends 7-days-before-due AND a due-now email (balance_due_now_sent_at), idempotent. Balance due = start − 30 days.
- Secure login: brute-force lockout in auth.py (login_attempts, 5 fails/IP+email → 15-min 429; success clears). Uses X-Forwarded-For IP (ingress rotates request.client.host).
- VERIFIED: testing agent iter33 backend 11/11 + 5/5 direct-invocation PASS. Fixed the 2 hardcoded-deposit copy bugs after. Admin Retreats UI confirmed via screenshot.
- Store build (#4): NOT doable server-side — requires macOS/Xcode + Android Studio + developer accounts; documented in /app/MOBILE_BUILD.md.

## Iteration 34 (2026-06) — Retreat gallery + waitlist (+ confirmed email/balance-pay already existed)
- #1 Email SMTP: ALREADY built (admin Settings Email·SMTP fields + email_enabled toggle + POST /admin/email/test). No build needed — user just enters SMTP creds.
- #2 Deposit/balance payments: ALREADY built (payments item_type workshop_balance; Profile "Pay €balance" button → PayPal/Stripe → fulfillment marks paid_in_full).
- #3 Retreat Photos: workshops gallery: Optional[List[str]] (Create+Update). Admin RetreatsPane "Gallery URLs" textarea (retreat-gallery). WorkshopDetail renders workshop-gallery grid.
- #4 Waitlist: retreats.py join_waitlist (POST /retreats/waitlist), retreat_availability (GET /retreats/{id}/availability), cancel_reservation (POST /retreats/{id}/cancel) + _promote_waitlist (earliest waitlisted -> seat_offered + notify_user push + email). reserve bypasses capacity for seat_offered users and clears waitlist/offer rows. WorkshopDetail: join-waitlist / waitlisted-note / claim-seat buttons driven by availability + /retreats/mine.
- Fixed: WorkshopDetail reserve form now prefills name/email once auth user hydrates (useEffect on user).
- VERIFIED: testing agent iter34 backend 7/7 + full waitlist promotion flow curl-verified; frontend gallery + waitlist UI pass; prefill fix confirmed via screenshot.


## Iteration 35 (2026-06) — Photo uploads + cancel/refund + 48h waitlist expiry + date display
- Photo Uploads: new routers/uploads.py — POST /api/admin/uploads (admin, multipart) -> Emergent object storage (init_storage on startup, run_in_threadpool for the blocking requests calls, 10 MB cap, jpg/png/gif/webp only) returning {url,path}; public GET /api/files/{path:path} serves the object (retreat photos are public marketing content), DB source of truth = uploaded_files (soft-delete flag). Admin RetreatsPane got an "Upload photos" control (retreat-photo-upload) with thumbnail preview grid (retreat-gallery-preview) + remove (×, visible on mobile) + kept paste-URL textarea fallback. Stores full ${API_BASE}/files/{path} URLs into the gallery array.
- Cancel & Refund: retreats.py cancel_reservation now computes a 60-day rule (REFUND_CUTOFF_DAYS=60): paid + cancelled >=60d before start -> refund_status 'refund_pending'; paid + <60d -> 'non_refundable'; unpaid -> 'not_applicable'; repeat cancel -> 400. Returns {refund_eligible, refund_status, message}. NOTE: money refund is manual by Tony via PayPal/Stripe dashboard — app only marks status. Profile shows a "Cancel reservation" button (retreat-cancel-{id}) opening a shadcn AlertDialog (retreat-cancel-dialog) that shows days-until-start + the correct refund note before confirming.
- Waitlist 48h Expiry: _promote_waitlist sets seat_offer_expires_at = now+48h (SEAT_OFFER_HOURS). New expire_seat_offers_tick() (in retreats.py, wired into server.py 60s loop) flips expired seat_offered rows to 'offer_expired' + notifies + promotes the next waitlister. WorkshopDetail claim-seat button (workshop-claim-seat-btn) shows an "(Xh left)" countdown from seat_offer_expires_at.
- Date display: per user request retreats now show month+year only (e.g. "December 2026") on Marketing card, WorkshopDetail Dates card, and Profile — not a specific day. (Active retreat "Tree of Yoga · Core 40" still starts 2026-12-01 in DB for balance/refund math.)
- VERIFIED: testing agent iter35 — backend 22/22 pytest pass, frontend 100% of tested flows. Fixed post-test: mobile-invisible remove button (opacity), blocking requests -> run_in_threadpool, added 10 MB upload cap. Object storage uses EMERGENT_LLM_KEY, "Object storage initialised" logged at startup.
- Open (non-blocking, deferred): orphaned-object cleanup on gallery photo removal (storage has no delete API — soft-delete only); swap admin native date inputs for shadcn date picker; round AlertDialog corners on mobile.

## Iteration 36 (2026-06) — Admin sidebar redesign + live SMTP + register/enquiry emails
- Admin console REDESIGN (user: "fix the admin layout, standard side menu"): replaced the overflowing horizontal circular-pill tab bar with a standard VERTICAL SIDEBAR (Admin.jsx ADMIN_NAV array + AdminNavItem w/ lucide icons). Desktop (md+): sticky white sidebar card, dark #1C221F active item; content pane to the right inside max-w-6xl. Mobile: same nav collapses to a horizontal scrollable strip (+right-edge fade affordance), content below. Removed old Tab component + PageHeader from Admin. Data-testids unchanged (admin-tabs, admin-tab-*). VERIFIED testing_agent iter36: 11/11 tabs switch + ?tab= sync + deep-link, no overflow desktop/mobile, 0 console errors.
- LIVE SMTP: user provided Gmail creds (tonyoga.online@gmail.com + app password). Saved via PATCH /admin/settings (email_enabled=true, smtp.gmail.com:587, sender Tony Sanchez Yoga). Test email sent OK. NOTE: creds stored in DB app_settings (smtp_password is a masked secret field), NOT in .env.
- REGISTER + ENQUIRY emails to the user (user request): email_service.py new send_welcome_email() (wired into auth.py register) and send_enquiry_ack() (wired into assistant.py assistant_lead when payload.email present). Both best-effort, no-op if SMTP disabled. VERIFIED: '[EMAIL sent]' log lines for both, backend 16/16 pytest pass.
- Backlog (optional, from iter36): split Admin.jsx (1900+ lines) into src/pages/admin/*.jsx; derive validTabs from ADMIN_NAV.map; explicit CORS_ORIGINS + allow_credentials if httpOnly cookie is to be used; remove hardcoded ADMIN_PASSWORD fallback in seed.py; orphaned-object cleanup on retreat gallery photo removal.

## Iteration 37 (2026-06) — Booking emails + Admin.jsx split + mobile nav cue + i18n foundation
- BOOKING EMAILS: email_service.send_retreat_booking(reg, kind) sends guest confirmation + admin copies to RETREAT_ADMIN_EMAILS = [tony@tonysanchezyoga.com, tonyoga.online@gmail.com]. Wired into payments._fulfill_payment for workshop_deposit ("Booking confirmed") and workshop_balance ("Payment complete"). VERIFIED via live SMTP ([EMAIL sent] for guest + both admins, deposit & balance).
- REGISTER + ENQUIRY emails (prev turn, live): auth.register -> send_welcome_email; assistant.assistant_lead -> send_enquiry_ack. Verified sending.
- SMTP LIVE: Gmail tonyoga.online@gmail.com configured in admin settings (DB, masked). Test email OK.
- ADMIN.JSX SPLIT: monolith (~1950 lines) refactored into src/pages/admin/{StatsPane,CoursesPane,BundlesPane,StudentsPane,ClassesPane,ApplicationsPane,BroadcastPane,RetreatsPane,GiftCardsPane,SettingsPane,ImportPane}.jsx + shared.jsx (Field/Toggle/inputCls). Admin.jsx now 112-line shell (ADMIN_NAV + AdminNavItem + tab router). Code relocated verbatim. testing_agent iter37: 11/11 tabs render, deep-link + mobile OK. FIX: CoursesPane was missing `import { useAuth }` after split (tester-applied, kept) — do NOT remove it. Panes carry a broad lucide import (unused-icon warnings only).
- MOBILE NAV CUE: admin sidebar mobile strip now has a fade + animate-pulse ChevronRight affordance at the right edge.
- I18N FOUNDATION (English-only first pass, user-approved react-i18next): added i18next@26 + react-i18next@17 + i18next-browser-languagedetector. New src/i18n/{index.js, locales/en.json, locales/es.json}. index.js: keySeparator/nsSeparator=false (flat literal keys), lng:"en" LOCKED, fallbackLng en, supportedLngs [en,es], detector caches localStorage 'ty_lang'. src/lib/i18n.js t() rewired to i18next (backward compatible with the ~20 existing `t("i18n:...")` call sites). Imported in src/index.js before App. en.json = migrated membership DICT + common/nav scaffold; es.json = placeholder. VERIFIED: /memberships renders Essential/Unlimited/Annual VIP + feature labels correctly, no raw-key leak, compiles clean.

## Audit / Gap analysis (2026-06) — remaining GAPS vs 7-module spec
- BUILT & working: Auth, LMS (Core 20/40/84 + YouTube segmenting + assignments/certs/bundles), Live Studio (Zoom + waitlists + replays), Shop/commerce (products/memberships/passes/giftcards/workshops/retreats + PayPal/Stripe), Student dashboard (streaks/certs/wishlist/leaderboard/notifications/push), Admin console, AI assistant (chat+voice+leads).
- PARTIAL: i18n (framework now in, English-only — Spanish strings + toggle pending); per-user timezone auto-conversion (field exists, no conversion UI); PWA offline (shell only, no lesson downloads).
- MISSING (backlog, prioritized): 1) Spanish translations + language toggle (finish i18n); 2) Interactive Asana Index (flagship LMS page); 3) Cohort/Community feed (no router/UI); 4) Offline lesson downloads (IndexedDB/media cache).

## Iteration 38 (2026-06) — Course library enrichment: per-lesson description + cover upload + related products
- USER REQUEST (voice): each pose/lesson needs an admin-editable DESCRIPTION under its video + a COVER PHOTO upload; plus related BOOKS/PRODUCTS surfaced on the course to buy.
- Backend was ALREADY capable (Video/LessonUpsert/LessonPatch have description+cover_image; admin_update_lesson/admin_add_lesson persist them; VideoPlayer already renders v.description + uses cover_image as poster). Gap was purely the ADMIN UI + a products relation.
- ADDED: models.py ProgramCreate/ProgramUpdate -> related_product_ids: Optional[List[str]]. content.py get_program now returns program['related_products'] (expanded from ids, order-preserved, bad ids filtered).
- FRONTEND admin (CoursesPane.jsx / LessonsEditor): lesson form now has a Description textarea (lesson-description) + Cover photo upload (lesson-cover-upload via /admin/uploads, preview lesson-cover-preview, remove lesson-cover-remove); openEdit loads existing; save sends description+cover_image. Program editor has a Related products chip picker (course-products / course-product-{id}) loaded from /products; save sends related_product_ids.
- FRONTEND display: new components/RelatedProducts.jsx grid. ProgramDetail shows "Shop for this practice" (p.related_products). VideoPlayer shows "Shop this practice" below the lesson description (from parent program's related_products).
- VERIFIED testing_agent iter38: backend 7/7 pytest, frontend 100% (5 flows), no functional defects. Demo data left: Core 26+ Series (id 7585a2ef-01a1-4854-84f5-1eba68cfea66) related_product_ids = [Cork Yoga Mat, Yogi's Daily Journal].
- KNOWN pre-existing (NOT this feature): a seeded lesson YouTube id (EeZrRo1PNmU) shows "Video unavailable" — invalid seed video id; admin can replace the link. Cosmetic backlog: /admin/uploads always stores under 'retreats/' prefix (lesson covers land there too); consider a `kind` param. CoursesPane.jsx ~450 lines — extract LessonsEditor before 700-line threshold.

## Iteration 39 (2026-06) — Enable Spanish (EN⇄ES toggle, react-i18next)
- USER: reversed earlier "English-only" → turn on EN⇄ES toggle + translate core screens.
- i18n/index.js unlocked (removed lng:"en" lock; detector order ["localStorage"], cache 'ty_lang', fallback en). New components/LanguageToggle.jsx (data-testid language-toggle, lang-en/lang-es).
- Translated & wired useTranslation: AppShell (bottom-nav labels + staff bar), Login, Register, Marketing nav (items + Sign in + Open the app), Memberships (full chrome: eyebrow/title/cycle/per-period/Most popular/Choose {plan}/free-trial + plan data already via i18n: keys). Toggle placed in Marketing nav, Login, Register, and AppShell top-right (app pages).
- locales/en.json + es.json expanded (nav, common, lang, shell, login, register, marketing, memb.* + membership i18n: keys). Spanish drafted by agent.
- VERIFIED testing_agent iter39: toggle switches instantly on /login, persists to localStorage ty_lang, survives reload, applies to Register/Marketing nav/app nav/Memberships; NO console errors; changeLanguage works. window.__i18n debug hook was added then REMOVED.
- IMPORTANT LEARNING: the screenshot_tool harness does NOT reliably execute post-load clicks / DOM mutations AND a registered service worker (src/index.js) can serve a STALE JS bundle — this caused the main agent's false "toggle broken" observation. For interaction/i18n verification, use testing_agent, not screenshot_tool. Consider SW cache-version bump.
- COVERAGE REMAINING (documented follow-up, currently English = consistent, not mixed): Home dashboard (/home), Marketing hero/body sections, program level/duration labels. Detector is localStorage-only (first-time es-browser users still get English) — add 'navigator' to order if auto-detect desired.

## Iteration 40 (2026-06) — Finish Spanish: Home dashboard + Marketing body
- Translated & wired useTranslation: Home.jsx (greeting, hero, all section headings, continue-learning, upcoming/live, Core Series, membership CTA, retreats/shop tiles, journal + es-ES date locale via i18n.language), Marketing.jsx (Hero, Story, Programs header + "Ver programa", Retreats header + "depósito", AppCTA, Footer newsletter/links), StreakCard, FreeClassRibbon (bar: variants headline/accent + Claim/claimed).
- locales/en.json + es.json expanded with home.* / mkt.* / streak.* / ribbon.* (key parity verified 0 missing by testing agent).
- VERIFIED testing_agent iter40: 100% of requested ES strings present on / and /home; EN restores; persists across /login /memberships; 0 console errors; no raw-key leaks. Then main agent fixed the 3 flagged polish items (promo ribbon bar, streak card, Home date locale) — compiles clean, same proven i18n pattern.
- REMAINING English (documented follow-up, lower marketing sections + ribbon modal): FeatureStrip, StatsBar, ValueProps, HeroTestimonial, Testimonials, InlineSignup, FAQ, and the FreeClassRibbon expanded email-capture modal. Suggest a CI en/es key-parity check as strings grow.
- STILL PENDING from user's picks: Fix Demo Video (needs user's real Core 26/40 YouTube links — dead seed id EeZrRo1PNmU), Asana Index (searchable pose library), Bundle Upsell.

## Iteration 42 (2026-06) — Course page restructure (demo video + locked Library)
- RENAME: "Core 26+ Series" -> "Core 26+" (seed + live DB; also stripped any trailing " Series").
- DEMO/INTRO VIDEO: new admin-editable per-course field demo_video_url (models.py ProgramCreate/Update; admin CoursesPane "Demo / intro video (YouTube)" field, data-testid course-demo-video). content.py get_program returns program.demo_video = {youtube_id, start_seconds} — admin URL wins, else falls back to the first lesson clip. ProgramDetail.jsx renders a click-to-play DemoVideo at the TOP of every course page (poster -> YouTube iframe), playable by EVERYONE (enrolled or not).
- LOCKED LIBRARY: curriculum section renamed "Library · N lessons". Non-enrolled visitors now see ALL lessons LOCKED with NO play button (play gated on hasAccess = viewer.is_staff||owns_program||free||(membership&&active), not on is_free_preview) + a library-locked-note. Enrolled/staff/members see the library playable (respecting drip/assignment gates). Applies to ALL courses.
- Testids: lesson play lesson-play-{id}, locked pill lesson-locked-{id}, demo-video / demo-video-play / demo-video-iframe, library-locked-note.
- VERIFIED testing_agent iter42 (backend 90%, frontend 95%) across anon/student/admin + Core 40/84 + asana/bundle regressions. Two issues found and FIXED after: (1) demo field was un-clearable (CoursesPane now sends "" not null; update_program keeps "" since it's not None) — curl-verified set dQw4w9WgXcQ then clear -> fallback EeZrRo1PNmU; (2) DB had 6 duplicate stale course records (historical, pre-dating seed's title guard) — deleted the 6 dups + 136 orphan lessons/videos; /programs now returns exactly 3 courses.
- STILL PENDING: Fix Demo Video — the seeded demo clip (EeZrRo1PNmU) is a dead placeholder; awaiting the user's real Core 26/40 YouTube link to set via Admin -> Courses -> Demo/intro video.
- BACKLOG (tester notes, optional): update_program's `if v is not None` filter blocks clearing any nullable field (only demo worked around via ""); consider a single server `viewer.has_access` flag to avoid UI/back-end drift; move content.py _demo_yt regex to module scope.

## Iteration 41 (2026-06) — Asana Index + Bundle Upsell (2 of the 3 user picks)
- ASANA INDEX (searchable pose library): new backend routers/asanas.py — public GET /api/asanas (q + category filter), /api/asanas/categories, /api/asanas/{id}; admin CRUD /api/admin/asanas (+ image upload via existing /admin/uploads). models.py AsanaCreate/AsanaUpdate. seed.py seeds 12 poses idempotently (name, Sanskrit, benefits, category, difficulty, cover image; optional YouTube clip w/ start/end). Frontend: public /asanas page (Asanas.jsx) with search box, category chips, responsive grid (2/3/4 cols) + a detail modal (cover or embedded YouTube clip + benefits). Admin AsanasPane.jsx (create/edit/delete + cover UPLOAD button + URL fallback + optional program link + published toggle) wired as new admin sidebar tab 'Asana Index' (admin-tab-asanas). Discovery: 'Asana Index' link card on /library (library-asana-link) + public route /asanas. Public/members-agnostic (visible to everyone). NOTE: the 12 seeded Unsplash/Pexels cover images were re-picked (first batch had broken/mismatched IDs) — now all load; admins can replace per pose.
- BUNDLE UPSELL ('Add the mat + book & save 15%'): models.py ProgramCreate/Update gain bundle_discount_pct (default 15, admin-editable). content.py get_program returns bundle_discount_pct. ProgramDetail.jsx BundleUpsell card (shows a course's related physical products, struck-through full price, exact discounted price + savings, 'Add bundle to cart'). cart.js gains promo (setPromo/getPromo/clearPromo) + discount(); Cart.jsx shows a discount row + discounted total and passes bundle_program_id to /orders/create. orders.py create_order SERVER-RECOMPUTES the discount and only applies it when the WHOLE related-product set is in the cart (anti-tamper); stores subtotal/discount/total/bundle. Payment resolves from the persisted (discounted) order.total, so the charge is correct. Verified: full set -> discount 17.55/total 99.45; partial/bogus -> 0.
- VERIFIED testing_agent iter41: backend 18/18 pytest, frontend 100% (all asana + bundle flows). No bugs. Applied 2 cosmetic polish items after: bundle card now shows EXACT $99.45/$17.55 (was rounded $99/$18) matching checkout; /asanas grid widened to lg:grid-cols-4 / max-w-5xl for desktop fill. DB left clean (12 poses).
- STILL PENDING: Fix Demo Video — still awaiting the user's real Core 26/40 YouTube links (dead seed id EeZrRo1PNmU). Lower-section Spanish (FAQ/Testimonials/InlineSignup + ribbon modal) still English.
- BACKLOG (from tester, optional): parameterize /admin/uploads folder (asana covers currently stored under 'retreats/'); move asana public search to a Mongo text/regex query if the library grows; AsanasPane delete uses window.confirm (native) — could use in-app modal.
