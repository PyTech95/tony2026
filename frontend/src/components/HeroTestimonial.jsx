import { useEffect, useState, useRef } from "react";
import { Play, Quote, Volume2, VolumeX } from "lucide-react";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";

/**
 * Hero video testimonial that lives right above the text testimonials.
 * Reads the settings `hero_testimonial` object which shape is:
 *   { video_url, poster_url, name, role, headline }
 * If no video URL is configured, falls back to a poster + "Video coming soon" state
 * so Tony can drop a real clip in via /api/admin/settings when it's shot.
 */
const FALLBACK = {
  video_url: "",
  poster_url: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=1200&h=900&fit=crop",
  name: "María Castillo",
  role: "Student, Madrid",
  headline: "\"Tony gave me a practice I actually keep.\"",
};

export default function HeroTestimonial() {
  const { t } = useTranslation();
  const [cfg, setCfg] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const videoRef = useRef(null);

  useEffect(() => {
    api.get("/settings/public")
      .then(({ data }) => {
        const s = data?.hero_testimonial;
        setCfg(s && (s.video_url || s.poster_url) ? { ...FALLBACK, ...s } : FALLBACK);
      })
      .catch(() => setCfg(FALLBACK));
  }, []);

  if (!cfg) return null;
  const hasVideo = !!cfg.video_url;

  const play = () => {
    if (!hasVideo || !videoRef.current) return;
    videoRef.current.muted = false;
    setMuted(false);
    videoRef.current.play();
    setPlaying(true);
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setMuted(videoRef.current.muted);
  };

  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6 py-14 sm:py-20 lg:py-24" data-testid="hero-testimonial">
      <div className="grid lg:grid-cols-5 gap-6 lg:gap-10 items-center">
        {/* Video / poster */}
        <div className="lg:col-span-3 relative aspect-[9/16] sm:aspect-video max-w-md sm:max-w-none mx-auto w-full rounded-2xl sm:rounded-3xl overflow-hidden bg-[#1C221F] group">
          {hasVideo ? (
            <>
              <video
                ref={videoRef}
                src={cfg.video_url}
                poster={cfg.poster_url}
                playsInline
                muted
                loop
                preload="metadata"
                className="absolute inset-0 h-full w-full object-cover"
                data-testid="hero-testimonial-video"
                onClick={playing ? toggleMute : play}
              />
              {!playing && (
                <button
                  onClick={play}
                  data-testid="hero-testimonial-play"
                  className="absolute inset-0 flex items-center justify-center bg-[#1C221F]/30 hover:bg-[#1C221F]/40 transition"
                  aria-label="Play testimonial"
                >
                  <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-[#FAFAF7]/95 flex items-center justify-center group-hover:scale-110 transition">
                    <Play className="h-6 w-6 sm:h-7 sm:w-7 text-[#B25A45] ml-1" fill="currentColor" />
                  </div>
                </button>
              )}
              {playing && (
                <button
                  onClick={toggleMute}
                  data-testid="hero-testimonial-mute"
                  className="absolute bottom-4 right-4 h-10 w-10 rounded-full bg-[#1C221F]/70 backdrop-blur text-white flex items-center justify-center hover:bg-[#1C221F]/90"
                  aria-label={muted ? "Unmute" : "Mute"}
                >
                  {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </button>
              )}
            </>
          ) : (
            <>
              <img src={cfg.poster_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#1C221F]/85 via-[#1C221F]/20 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4 text-[#FAFAF7]">
                <div className="eyebrow !text-[#E5E6DF] !text-[10px]">{t("ht.coming")}</div>
                <div className="serif text-lg sm:text-xl mt-1 leading-tight">{t("ht.filmed")}</div>
              </div>
            </>
          )}
        </div>

        {/* Caption side */}
        <div className="lg:col-span-2">
          <Quote className="h-6 w-6 text-[#B25A45] mb-3" />
          <blockquote className="serif text-2xl sm:text-3xl leading-tight text-[#1C221F]" data-testid="hero-testimonial-quote">
            {cfg.headline}
          </blockquote>
          <div className="mt-6 pt-4 border-t border-[#E5E6DF] flex items-center gap-3">
            <div>
              <div className="text-sm font-semibold" data-testid="hero-testimonial-name">{cfg.name}</div>
              <div className="text-xs text-[#6B7269] mt-0.5" data-testid="hero-testimonial-role">{cfg.role}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
