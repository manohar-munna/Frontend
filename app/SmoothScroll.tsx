"use client";

import { useEffect } from "react";
import { publishScrollMotion, scrollStep, scrollTarget } from "./scroll-motion";

const ease = (value: number) => {
  const progress = Math.max(0, Math.min(1, value));
  return progress * progress * (3 - 2 * progress);
};

function keepsNativeScroll(target: EventTarget | null, delta: number) {
  if (!(target instanceof Element)) return false;
  if (target.closest('input, textarea, select, [contenteditable="true"], [data-native-scroll]')) return true;
  for (let element: Element | null = target; element && element !== document.body; element = element.parentElement) {
    if (element.scrollHeight <= element.clientHeight + 1) continue;
    const overflow = getComputedStyle(element).overflowY;
    if (!/auto|scroll/.test(overflow)) continue;
    if (delta < 0 ? element.scrollTop > 0 : element.scrollTop + element.clientHeight < element.scrollHeight - 1) return true;
  }
  return false;
}

export default function SmoothScroll() {
  useEffect(() => {
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
    const hero = document.querySelector<HTMLElement>(".color-hero");
    const finishes = document.querySelector<HTMLElement>(".finish-chapter");
    let target = window.scrollY;
    let written = target;
    let frame = 0;
    let lastTime = 0;
    let maximum = 0;
    let heroTop = 0;
    let heroDistance = 1;
    let finishTop = 0;
    let finishHeight = 0;
    let touch: { x: number; y: number; vertical: boolean } | null = null;

    const stop = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      lastTime = 0;
      target = written = window.scrollY;
    };
    const measure = () => {
      maximum = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      heroTop = hero ? hero.getBoundingClientRect().top + window.scrollY : 0;
      heroDistance = Math.max(1, (hero?.offsetHeight ?? 0) - window.innerHeight);
      finishTop = finishes ? finishes.getBoundingClientRect().top + window.scrollY : maximum;
      finishHeight = finishes?.offsetHeight ?? 0;
      stop();
    };
    const animate = (now: number) => {
      const current = window.scrollY;
      const elapsed = lastTime ? now - lastTime : 16;
      lastTime = now;
      const heroProgress = (current - heroTop) / heroDistance;
      // Allow deliberate fast browsing, while giving the iris/photo handoff
      // and the finish spread enough frames to stay legible in either direction.
      const optical = ease((heroProgress - 0.46) / 0.12) * (1 - ease((heroProgress - 0.87) / 0.1));
      const finish = current < finishTop + finishHeight ? ease((current - finishTop + window.innerHeight * 0.4) / (window.innerHeight * 0.4)) : 0;
      const speed = window.innerHeight * (2.4 - Math.max(optical * 1.45, finish * 1.15));
      written = scrollStep(current, target, elapsed, speed);
      window.scrollTo({ top: written, behavior: "instant" });
      written = window.scrollY;
      publishScrollMotion();
      if (Math.abs(target - written) <= 0.5) stop();
      else frame = requestAnimationFrame(animate);
    };
    const move = (delta: number) => {
      target = scrollTarget(window.scrollY, target, delta, window.innerHeight, maximum);
      if (!frame && Math.abs(target - window.scrollY) > 0.5) {
        lastTime = 0;
        frame = requestAnimationFrame(animate);
      }
    };
    const wheel = (event: WheelEvent) => {
      if (reducedMotion.matches || event.ctrlKey || event.metaKey || event.shiftKey || !event.cancelable || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1);
      if (!delta || keepsNativeScroll(event.target, delta)) return;
      event.preventDefault();
      move(delta);
    };
    const touchStart = (event: TouchEvent) => {
      stop();
      const point = event.touches[0];
      touch = event.touches.length === 1 ? { x: point.clientX, y: point.clientY, vertical: false } : null;
    };
    const touchMove = (event: TouchEvent) => {
      if (!touch || event.touches.length !== 1 || reducedMotion.matches || !event.cancelable) return;
      const point = event.touches[0];
      const delta = touch.y - point.clientY;
      if (!touch.vertical && Math.abs(delta) < Math.max(5, Math.abs(touch.x - point.clientX))) return;
      if (keepsNativeScroll(event.target, delta)) return;
      event.preventDefault();
      touch.vertical = true;
      touch.y = point.clientY;
      move(delta);
    };
    const touchEnd = () => { touch = null; };
    const keyboard = (event: KeyboardEvent) => {
      const direction = ["ArrowUp", "PageUp", "Home"].includes(event.key) || (event.key === " " && event.shiftKey) ? -1 : 1;
      if (reducedMotion.matches || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || keepsNativeScroll(event.target, direction)) return;
      if (event.target instanceof Element && event.target.closest('button, a, [role="button"]')) return;
      const delta = event.key === "ArrowDown" ? 60 : event.key === "ArrowUp" ? -60 : event.key === "PageDown" ? window.innerHeight * 0.85 : event.key === "PageUp" ? -window.innerHeight * 0.85 : event.key === " " ? window.innerHeight * (event.shiftKey ? -0.85 : 0.85) : 0;
      if (!delta) { if (event.key === "Home" || event.key === "End") stop(); return; }
      event.preventDefault();
      move(delta);
    };
    const externalScroll = () => {
      // Scrollbar dragging, anchors, history restoration and assistive tools
      // retain native control. Never pull the page back toward an old target.
      if (Math.abs(window.scrollY - written) > 2) stop();
    };
    const pointerDown = () => { stop(); };
    const observer = new ResizeObserver(measure);
    observer.observe(document.body);
    measure();
    document.documentElement.dataset.scrollMotion = "controlled";
    window.addEventListener("wheel", wheel, { passive: false });
    window.addEventListener("touchstart", touchStart, { passive: true });
    window.addEventListener("touchmove", touchMove, { passive: false });
    window.addEventListener("touchend", touchEnd, { passive: true });
    window.addEventListener("touchcancel", touchEnd, { passive: true });
    window.addEventListener("keydown", keyboard);
    window.addEventListener("scroll", externalScroll, { passive: true });
    window.addEventListener("pointerdown", pointerDown, { passive: true });
    window.addEventListener("resize", measure);
    window.addEventListener("blur", stop);
    reducedMotion.addEventListener("change", stop);
    return () => {
      stop();
      observer.disconnect();
      delete document.documentElement.dataset.scrollMotion;
      window.removeEventListener("wheel", wheel);
      window.removeEventListener("touchstart", touchStart);
      window.removeEventListener("touchmove", touchMove);
      window.removeEventListener("touchend", touchEnd);
      window.removeEventListener("touchcancel", touchEnd);
      window.removeEventListener("keydown", keyboard);
      window.removeEventListener("scroll", externalScroll);
      window.removeEventListener("pointerdown", pointerDown);
      window.removeEventListener("resize", measure);
      window.removeEventListener("blur", stop);
      reducedMotion.removeEventListener("change", stop);
    };
  }, []);

  return null;
}
