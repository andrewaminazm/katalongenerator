import { useEffect, useRef } from "react";
import type { VideoTutorial } from "../../data/tutorials/videoCatalog";
import { hasPlayableVideo } from "../../data/tutorials/videoCatalog";

type Props = {
  video: VideoTutorial;
  title?: string;
  /** When true, restart playback after the source changes. */
  autoPlayOnChange?: boolean;
};

export function VideoEmbed({ video, title, autoPlayOnChange = true }: Props) {
  const label = title ?? video.title;
  const videoRef = useRef<HTMLVideoElement>(null);
  const src = video.videoUrl?.trim();

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !src) return;
    el.load();
    if (autoPlayOnChange) {
      void el.play().catch(() => {
        /* autoplay may be blocked until user interacts */
      });
    }
  }, [video.id, src, autoPlayOnChange]);

  if (video.youtubeId?.trim()) {
    const id = video.youtubeId.trim();
    return (
      <div className="vt-embed" key={`yt-${video.id}`}>
        <iframe
          title={label}
          src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    );
  }

  if (src) {
    const isWebm = src.endsWith(".webm");
    const srcWithId = `${src}${src.includes("?") ? "&" : "?"}feature=${encodeURIComponent(video.id)}`;
    return (
      <div className="vt-embed" key={`file-${video.id}`}>
        <video
          ref={videoRef}
          key={video.id}
          controls
          playsInline
          preload="auto"
          title={label}
        >
          <source src={srcWithId} type={isWebm ? "video/webm" : undefined} />
          Your browser does not support embedded video.
        </video>
      </div>
    );
  }

  return (
    <div className="vt-embed vt-embed--placeholder" key={`placeholder-${video.id}`} role="status">
      <div className="vt-placeholder-inner">
        <span className="vt-placeholder-icon" aria-hidden>
          ▶
        </span>
        <p className="vt-placeholder-title">Video coming soon</p>
        <p className="vt-placeholder-desc">
          Recording for <strong>{video.title}</strong> will be published here. Use the written guide or
          open Documentation while you wait.
        </p>
      </div>
    </div>
  );
}

export function VideoAvailabilityBadge({ video }: { video: VideoTutorial }) {
  return (
    <span className={`vt-badge${hasPlayableVideo(video) ? " vt-badge--live" : ""}`}>
      {hasPlayableVideo(video) ? "Watch" : "Coming soon"}
    </span>
  );
}
