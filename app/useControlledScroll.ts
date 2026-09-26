"use client";

import { useEffect, type RefObject } from "react";

/** Smooth the document itself so the sticky scene never trails its scroll position. */
export function useControlledScroll(heroRef: RefObject<HTMLElement | null>, onProgress: (value: number) => void) {
  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let target = scrollY;
    let expected = scrollY;
    let lastTime = 0;
    let start = 0;
    let distance = 1;
    let pageEnd = 0;
    let viewport = innerHeight;
    const publish = () => onProgress(Math.max(0, Math.min(1, (scrollY - start) / distance)));
    const cancel = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      lastTime = 0;
      target = expected = scrollY;
    };
    const measure = () => {
      cancel();
      viewport = innerHeight;
      start = hero.getBoundingClientRect().top + scrollY;
      distance = Math.max(1, hero.offsetHeight - viewport);
      pageEnd = Math.max(0, document.documentElement.scrollHeight - viewport);
      publish();
    };
    const animate = (now: number) => {
      const elapsed = Math.min(32, lastTime ? now - lastTime : 16.67);
      lastTime = now;
      const gap = target - scrollY;
      const intent = Math.min(1, Math.abs(gap) / (viewport * 0.75));
      const limit = viewport * (1.8 + 2.7 * intent) * elapsed / 1000;
      const step = Math.sign(gap) * Math.min(Math.abs(gap), limit, Math.abs(gap) * (1 - Math.exp(-elapsed / 85)));
      const next = Math.abs(gap) < 1.5 ? target : scrollY + step;
      window.scrollTo({ top: next, behavior: "instant" });
      expected = scrollY;
      publish();
      if (Math.abs(target - scrollY) > 1) frame = requestAnimationFrame(animate);
      else cancel();
    };
    const wheel = (event: WheelEvent) => {
      if (motion.matches || !event.cancelable || event.ctrlKey || event.metaKey || event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      if (scrollY < start - 1 || scrollY > start + distance + 1) return;
      // Preserve wheel interaction in any nested scrollable control.
      for (let node = event.target instanceof Element ? event.target : null; node && node !== document.body; node = node.parentElement) {
        if (node.scrollHeight > node.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(node).overflowY)) return;
      }
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport : 1;
      const delta = event.deltaY * unit;
      if (!delta || (scrollY <= 0 && delta < 0) || (scrollY >= pageEnd - 1 && delta > 0)) return;
      event.preventDefault();
      // A reversal cancels outstanding travel immediately. Large bursts may
      // speed up the move but can never queue seconds of catch-up animation.
      if (!frame || Math.sign(delta) !== Math.sign(target - scrollY)) target = scrollY;
      const input = Math.sign(delta) * Math.min(Math.abs(delta), viewport * 0.65);
      target = Math.max(0, Math.min(pageEnd, Math.max(scrollY - viewport * 0.9, Math.min(scrollY + viewport * 0.9, target + input))));
      if (!frame) frame = requestAnimationFrame(animate);
    };
    const nativeScroll = () => {
      if (frame && Math.abs(scrollY - expected) <= 1) return;
      cancel();
      publish();
    };
    const key = (event: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(event.key)) cancel();
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(hero);
    window.addEventListener("wheel", wheel, { passive: false });
    window.addEventListener("scroll", nativeScroll, { passive: true });
    window.addEventListener("resize", measure);
    window.addEventListener("pointerdown", cancel, { passive: true });
    window.addEventListener("touchstart", cancel, { passive: true });
    window.addEventListener("keydown", key);
    motion.addEventListener("change", measure);
    return () => {
      cancel();
      observer.disconnect();
      window.removeEventListener("wheel", wheel);
      window.removeEventListener("scroll", nativeScroll);
      window.removeEventListener("resize", measure);
      window.removeEventListener("pointerdown", cancel);
      window.removeEventListener("touchstart", cancel);
      window.removeEventListener("keydown", key);
      motion.removeEventListener("change", measure);
    };
  }, [heroRef, onProgress]);
}
