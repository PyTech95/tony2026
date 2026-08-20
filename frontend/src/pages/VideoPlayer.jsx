import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Lock, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import PageHeader from "@/components/PageHeader";
import Spinner from "@/components/Spinner";
import { isYouTube, parseYouTubeId } from "@/lib/youtube";

// Lazy-load the YouTube IFrame Player API once.
let ytApiPromise = null;
function loadYT() {
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise((resolve) => {
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { if (prev) prev(); resolve(window.YT); };
  });
  return ytApiPromise;
}

export default function VideoPlayer() {
  const { id } = useParams();
  const { user } = useAuth();
  const [v, setV] = useState(null);
  const [resume, setResume] = useState(0);
  const [done, setDone] = useState(false);
  const [ready, setReady] = useState(false); // resume-position fetched, safe to build player

  const ytHostRef = useRef(null);
  const playerRef = useRef(null);
  const videoRef = useRef(null);
  const timerRef = useRef(null);
  const lastSave = useRef(0);

  // Load video + existing progress
  useEffect(() => {
    let mounted = true;
    setReady(false);
    (async () => {
      const res = await api.get(`/videos/${id}`).catch(() => ({ data: false }));
      if (!mounted) return;
      setV(res.data);
      if (res.data && res.data.is_unlocked && user) {
        try {
          const { data } = await api.get(`/progress/mine`);
          const rec = data.find((p) => p.video_id === id);
          if (rec) { if (!rec.completed) setResume(rec.seconds || 0); setDone(!!rec.completed); }
        } catch { /* noop */ }
      }
      if (mounted) setReady(true);
    })();
    return () => { mounted = false; };
  }, [id, user]);

  const saveProgress = async (seconds, completed = false) => {
    if (!user) return;
    const now = Date.now();
    if (!completed && now - lastSave.current < 4000) return;
    lastSave.current = now;
    try { await api.post(`/progress`, { video_id: id, seconds: Math.floor(seconds), completed }); } catch { /* noop */ }
    if (completed) setDone(true);
  };

  // Build the YouTube player (with resume + progress + completion) once ready
  useEffect(() => {
    if (!ready || !v || !v.is_unlocked || !v.video_url || !isYouTube(v.video_url)) return;
    let cancelled = false;
    const start = v.start_seconds || 0;
    const end = v.end_seconds || undefined;
    const beginAt = (resume && resume > start + 2 && (!end || resume < end - 2)) ? Math.floor(resume) : start;

    loadYT().then((YT) => {
      if (cancelled || !ytHostRef.current) return;
      playerRef.current = new YT.Player(ytHostRef.current, {
        host: "https://www.youtube-nocookie.com",
        videoId: parseYouTubeId(v.video_url),
        playerVars: { start: Math.floor(beginAt), end: end ? Math.floor(end) : undefined, rel: 0, modestbranding: 1, playsinline: 1 },
        events: {
          onStateChange: (e) => {
            const P = window.YT.PlayerState;
            clearInterval(timerRef.current);
            if (e.data === P.PLAYING) {
              // Poll every 1s to (a) save progress and (b) hard-enforce the segment
              // end boundary — YouTube's `end` playerVar is unreliable and often
              // lets the full video keep playing past the lesson clip.
              timerRef.current = setInterval(() => {
                try {
                  const t = playerRef.current.getCurrentTime();
                  if (end && t >= end - 0.25) {
                    try { playerRef.current.pauseVideo(); } catch { /* noop */ }
                    try { playerRef.current.seekTo(end, true); } catch { /* noop */ }
                    clearInterval(timerRef.current);
                    saveProgress(end, true);
                    return;
                  }
                  saveProgress(t, false);
                } catch { /* noop */ }
              }, 400);
            } else if (e.data === P.PAUSED) {
              try { saveProgress(playerRef.current.getCurrentTime(), false); } catch { /* noop */ }
            } else if (e.data === P.ENDED) {
              try { saveProgress(end || playerRef.current.getCurrentTime(), true); } catch { /* noop */ }
            }
          },
        },
      });
    });

    return () => {
      cancelled = true;
      clearInterval(timerRef.current);
      try { if (playerRef.current?.getCurrentTime) saveProgress(playerRef.current.getCurrentTime(), false); } catch { /* noop */ }
      try { playerRef.current?.destroy?.(); } catch { /* noop */ }
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, v]);

  if (v === null) return <><PageHeader back /><Spinner /></>;
  if (v === false) return <><PageHeader back title="Not found" /></>;

  const playable = v.is_unlocked && v.video_url;
  const youtube = playable && isYouTube(v.video_url);
  const segStart = v.start_seconds || 0;
  const segEnd = v.end_seconds || undefined;

  return (
    <div data-testid="video-player-page" className="pb-8">
      <PageHeader eyebrow={v.style} title={v.title} back testId="video-header" />

      <div className="mx-auto max-w-3xl px-5 space-y-5">
        {playable ? (
          youtube ? (
            <div className="rounded-3xl overflow-hidden bg-black aspect-video" data-testid="video-youtube">
              <div ref={ytHostRef} className="h-full w-full" />
            </div>
          ) : (
            <div className="rounded-3xl overflow-hidden bg-black aspect-video">
              <video
                ref={videoRef}
                data-testid="video-el"
                controls
                playsInline
                className="h-full w-full"
                poster={v.cover_image}
                src={v.video_url}
                onLoadedMetadata={() => {
                  const el = videoRef.current; if (!el) return;
                  const begin = (resume && resume > segStart + 2 && (!segEnd || resume < segEnd - 2)) ? resume : segStart;
                  if (begin > 0) el.currentTime = begin;
                }}
                onTimeUpdate={() => {
                  const el = videoRef.current; if (!el) return;
                  if (segEnd && el.currentTime >= segEnd - 0.3) {
                    el.pause();
                    try { el.currentTime = segEnd; } catch { /* noop */ }
                    saveProgress(segEnd, true);
                    return;
                  }
                  saveProgress(el.currentTime, false);
                }}
                onEnded={() => { const el = videoRef.current; if (el) saveProgress(segEnd || el.duration || el.currentTime, true); }}
              />
            </div>
          )
        ) : (
          <div className="rounded-3xl relative aspect-video overflow-hidden bg-[#1C221F]" data-testid="video-locked">
            {v.cover_image && <img src={v.cover_image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-[#FAFAF7] gap-3 px-6 text-center">
              <div className="h-14 w-14 rounded-full bg-[#B25A45] flex items-center justify-center">
                <Lock className="h-5 w-5" />
              </div>
              <div className="serif text-2xl">Members-only practice</div>
              <p className="text-sm text-white/70 max-w-sm">Join Tony Yoga to unlock the full library and every practice.</p>
              <Link to="/memberships" data-testid="video-unlock-cta" className="pill pill-primary mt-2">See memberships</Link>
            </div>
          </div>
        )}

        <div>
          <div className="text-xs text-[#6B7269] mb-2 flex items-center gap-2">
            <span>{v.duration_minutes} min · {v.level}</span>
            {done && (
              <span data-testid="video-completed" className="inline-flex items-center gap-1 text-[#839682] font-semibold">
                <CheckCircle2 className="h-4 w-4" /> Completed
              </span>
            )}
            {resume > 5 && !done && playable && (
              <span data-testid="video-resumed" className="text-[#B25A45] font-semibold">Resuming where you left off</span>
            )}
          </div>
          <p className="text-[15px] text-[#545E56] leading-relaxed">{v.description}</p>
        </div>
      </div>
    </div>
  );
}
