const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");
const { runInNewContext } = require("node:vm");
const { transformSync } = require("next/dist/build/swc");

const source = readFileSync(join(__dirname, "../app/scroll-motion.ts"), "utf8");
function loadMotion() {
  const exports = {};
  const events = new Map();
  const frames = new Map();
  let frameId = 0;
  const window = {
    scrollY: 0,
    addEventListener: (name, callback) => events.set(name, callback),
    removeEventListener: (name) => events.delete(name),
  };
  const { code } = transformSync(source, { filename: "scroll-motion.ts", jsc: { parser: { syntax: "typescript" } }, module: { type: "commonjs" } });
  runInNewContext(code, { exports, window, requestAnimationFrame: (callback) => { frames.set(++frameId, callback); return frameId; }, cancelAnimationFrame: (id) => frames.delete(id) });
  return { ...exports, window, events, frames };
}

test("a rapid wheel burst cannot queue more than one viewport of travel", () => {
  const { scrollTarget } = loadMotion();
  let target = 0;
  for (let index = 0; index < 100; index++) target = scrollTarget(0, target, 1000, 720, 10000);
  assert.equal(target, 720);
  assert.equal(scrollTarget(9950, 9950, 1000, 720, 10000), 10000);
  assert.equal(scrollTarget(40, 40, -1000, 720, 10000), 0);
});

test("reversing input immediately discards queued motion in the old direction", () => {
  const { scrollTarget, scrollStep } = loadMotion();
  const target = scrollTarget(300, 900, -120, 720, 10000);
  assert.equal(target, 180);
  assert.ok(scrollStep(300, target, 16, 1728) < 300);
});

test("a stalled frame cannot skip the iris to photo handoff", () => {
  const { scrollStep } = loadMotion();
  const next = scrollStep(2600, 3400, 500, 684);
  assert.ok(next - 2600 <= 684 * 0.032 + 0.001);
  assert.ok(next > 2600);
});

test("motion speed is consistent at 60 and 144 Hz", () => {
  const { scrollStep } = loadMotion();
  const simulate = (hz) => {
    let position = 0;
    for (let frame = 0; frame < hz / 2; frame++) position = scrollStep(position, 10000, 1000 / hz, 1728);
    return position;
  };
  assert.ok(Math.abs(simulate(60) - simulate(144)) < 1);
});

test("quantized browser positions settle without a permanent animation loop", () => {
  const { scrollStep } = loadMotion();
  let position = 0;
  let frames = 0;
  while (Math.abs(611.7 - position) > 0.5 && frames++ < 200) {
    position = Math.round(scrollStep(position, 611.7, 16, 684) * 1.25) / 1.25;
  }
  assert.ok(frames < 200);
  assert.ok(Math.abs(611.7 - position) <= 0.5);
});

test("both chapters receive one shared position and native jumps resync immediately", () => {
  const motion = loadMotion();
  const hero = [];
  const finish = [];
  const unhero = motion.subscribeScrollMotion(() => hero.push(motion.window.scrollY));
  const unfinish = motion.subscribeScrollMotion(() => finish.push(motion.window.scrollY));
  motion.window.scrollY = 120;
  motion.events.get("scroll")();
  motion.publishScrollMotion();
  assert.equal(motion.frames.size, 0);
  motion.publishScrollMotion();
  motion.window.scrollY = 3600;
  motion.publishScrollMotion();
  motion.window.scrollY = 0;
  motion.publishScrollMotion();
  assert.deepEqual(hero, [120, 3600, 0]);
  assert.deepEqual(hero, finish);
  unhero();
  unfinish();
  assert.equal(motion.events.size, 0);
});
