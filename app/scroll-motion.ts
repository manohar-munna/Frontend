type ScrollListener = () => void;

const listeners = new Set<ScrollListener>();
let frame = 0;
let lastY = Number.NaN;

// Both chapters read the same real page position, before the next paint.
export function publishScrollMotion() {
  if (frame) cancelAnimationFrame(frame);
  frame = 0;
  if (window.scrollY === lastY) return;
  lastY = window.scrollY;
  listeners.forEach((listener) => listener());
}

function scheduleScrollMotion() {
  if (!frame) frame = requestAnimationFrame(publishScrollMotion);
}

export function subscribeScrollMotion(listener: ScrollListener) {
  if (!listeners.size) window.addEventListener("scroll", scheduleScrollMotion, { passive: true });
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      window.removeEventListener("scroll", scheduleScrollMotion);
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      lastY = Number.NaN;
    }
  };
}

export function scrollStep(current: number, target: number, elapsedMs: number, maxSpeed: number) {
  // A long frame must not jump across an entire optical transition.
  const elapsed = Math.max(0, Math.min(elapsedMs, 32));
  const distance = target - current;
  if (Math.abs(distance) <= 0.5) return target;
  const eased = Math.abs(distance) * (1 - Math.exp(-elapsed / 110));
  // Browsers quantize scroll positions. Keep the final steps large enough
  // to reach the target instead of running an idle subpixel loop forever.
  return current + Math.sign(distance) * Math.min(Math.abs(distance), Math.max(1, eased), maxSpeed * elapsed / 1000);
}

export function scrollTarget(current: number, target: number, delta: number, viewport: number, maximum: number) {
  // Throw away stale travel when the user reverses; cap queued travel so a
  // wheel burst cannot leave the page coasting for several seconds.
  const base = (target - current) * delta < 0 ? current : target;
  const next = Math.max(current - viewport, Math.min(current + viewport, base + delta));
  return Math.max(0, Math.min(maximum, next));
}
