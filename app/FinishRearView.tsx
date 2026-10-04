import Image from "next/image";
import type { CSSProperties } from "react";

// Crop the existing rear photographs to their phone bounds. The glow and
// rectangular photograph background stay outside the rounded viewport.
const rearArtwork: Record<string, { image: string; bounds: readonly number[] }> = {
  Burgundy: { image: "/assets/iphone-rear-burgundy-v2.png", bounds: [207, 129, 816, 1404] },
  Pearl: { image: "/assets/iphone-rear-pearl-v2.png", bounds: [204, 94, 824, 1430] },
  Graphite: { image: "/assets/iphone-rear-graphite-v2.png", bounds: [207, 129, 816, 1404] },
  Sage: { image: "/assets/iphone-rear-sage-v2.png", bounds: [207, 127, 818, 1406] },
  Midnight: { image: "/assets/iphone-rear-midnight-v2.png", bounds: [206, 128, 817, 1405] },
};

export default function FinishRearView({ name }: { name: string }) {
  const artwork = rearArtwork[name] ?? rearArtwork.Burgundy;
  const [left, top, right, bottom] = artwork.bounds;
  const width = right - left;
  const height = bottom - top;
  return (
    <div className="finish-rear-view" style={{ "--rear-aspect": width / height } as CSSProperties}>
      <Image src={artwork.image} alt="" width={1024} height={1536} sizes="(max-width: 700px) 45vw, 30vw"
        style={{ position: "absolute", maxWidth: "none", width: `${1024 / width * 100}%`, height: `${1536 / height * 100}%`, left: `${-left / width * 100}%`, top: `${-top / height * 100}%` }}
        onLoad={(event) => { event.currentTarget.parentElement!.dataset.loaded = "true"; }} />
    </div>
  );
}
