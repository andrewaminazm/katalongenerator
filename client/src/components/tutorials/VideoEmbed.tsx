import type { VideoTutorial } from "../../data/tutorials/videoCatalog";
import { hasPlayableVideo } from "../../data/tutorials/videoCatalog";

type Props = {
  video: VideoTutorial;
  title?: string;
};

export function VideoEmbed({ video, title }: Props) {
  const label = title ?? video.title;

  if (video.youtubeId?.trim()) {
    const id = video.youtubeId.trim();
    return (
      <div className="vt-embed">
        <iframe
          title={label}
          src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    );
  }

  if (video.videoUrl?.trim()) {
    const src = video.videoUrl.trim();
    const isWebm = src.endsWith(".webm");
    return (
      <div className="vt-embed">
        <video controls playsInline preload="metadata" title={label}>
          <source src={src} type={isWebm ? "video/webm" : undefined} />
          Your browser does not support embedded video.
        </video>
      </div>
    );
  }

  return (
    <div className="vt-embed vt-embed--placeholder" role="status">
      <div className="vt-placeholder-inner">
        <span className="vt-placeholder-icon" aria-hidden>
          ▶
        </span>
        <p className="vt-placeholder-title">Video coming soon</p>
        <p className="vt-placeholder-desc">
          Recording for <strong>{video.title}</strong> will be published here. Use the written guide below
          or open Documentation while you wait.
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
