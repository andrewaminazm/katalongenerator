import type { VideoTutorial } from "../../data/tutorials/videoCatalog";
import { VIDEO_TUTORIAL_CATEGORIES } from "../../data/tutorials/videoCatalog";
import { VideoAvailabilityBadge } from "./VideoEmbed";

type Props = {
  video: VideoTutorial;
  active: boolean;
  onSelect: () => void;
};

function categoryLabel(category: VideoTutorial["category"]): string {
  return VIDEO_TUTORIAL_CATEGORIES.find((c) => c.id === category)?.label ?? category;
}

export function VideoTutorialCard({ video, active, onSelect }: Props) {
  return (
    <button
      type="button"
      className={`vt-card${active ? " vt-card--active" : ""}`}
      onClick={onSelect}
      aria-current={active ? "true" : undefined}
    >
      <div className="vt-card-top">
        <VideoAvailabilityBadge video={video} />
        {video.durationLabel && <span className="vt-duration">{video.durationLabel}</span>}
      </div>
      <h3 className="vt-card-title">{video.title}</h3>
      <p className="vt-card-desc">{video.description}</p>
      <p className="vt-card-meta">{categoryLabel(video.category)}</p>
    </button>
  );
}
