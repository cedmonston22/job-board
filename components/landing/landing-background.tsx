"use client";

import { useMemo, useSyncExternalStore } from "react";
import { COMPANY_LOGOS } from "@/components/landing/company-logos";

// Ten horizontal lanes, alternating direction (lane 0 →, lane 1 ←, …).
// Lanes are split across an upper band (lanes 0–4) and a lower band
// (lanes 5–9); the gap between them is reserved for the sign-in card.
const LANE_COUNT = 10;

// Per-lane vertical positions (top %). Hand-picked rather than computed so
// the band geometry is easy to read and tweak. Upper band sits in 3–31%,
// lower band in 65–97% — the 31–65% middle is left clear for the card.
const LANE_TOPS = [3, 10, 17, 24, 31, 65, 72, 79, 86, 93];

// Each lane carries two logo instances at evenly-spaced phases (0 and
// duration/2), so within a lane the two logos sit half a screen apart at
// any moment and can never collide. Total instances = 20.
const PER_LANE = 2;

// Per-lane animation duration range. Each lane rolls its own random value
// in this range, so different lanes drift at noticeably different speeds.
// Logos inside the same lane share the lane's duration (variable durations
// within a lane would let the two logos slowly drift into each other).
const MIN_DURATION = 30;
const MAX_DURATION = 65;

type Instance = {
  key: number;
  logoIndex: number;
  topPct: number;
  size: number;
  duration: number;
  delay: number;
  opacity: number;
  direction: "lr" | "rl";
};

function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function buildInstances(): Instance[] {
  const brandCount = COMPANY_LOGOS.length;
  const totalSlots = LANE_COUNT * PER_LANE; // 20

  // Build the brand assignment pool: each brand appears as evenly as
  // possible. With 8 brands and 20 slots, every brand appears at least
  // twice (16) and 4 brands picked at random appear a third time. The
  // final shuffle distributes them across lanes without a predictable
  // order.
  const fullCycles = Math.floor(totalSlots / brandCount); // 2
  const extras = totalSlots - fullCycles * brandCount; // 4
  const pool: number[] = [];
  for (let c = 0; c < fullCycles; c++) {
    pool.push(...Array.from({ length: brandCount }, (_, n) => n));
  }
  pool.push(
    ...shuffle(Array.from({ length: brandCount }, (_, n) => n)).slice(
      0,
      extras,
    ),
  );
  const brandSlots = shuffle(pool);

  const instances: Instance[] = [];
  let slotIdx = 0;

  for (let lane = 0; lane < LANE_COUNT; lane++) {
    const duration = MIN_DURATION + Math.random() * (MAX_DURATION - MIN_DURATION);
    const direction: "lr" | "rl" = lane % 2 === 0 ? "lr" : "rl";
    const topPct = LANE_TOPS[lane] + (Math.random() - 0.5) * 0.8;

    for (let p = 0; p < PER_LANE; p++) {
      // Phases 0 and duration/2 → the two logos on a lane are always
      // half a screen apart, so they never overlap one another.
      const phase = (p / PER_LANE) * duration;

      instances.push({
        key: instances.length,
        logoIndex: brandSlots[slotIdx++],
        topPct,
        size: 24 + Math.floor(Math.random() * 6),
        duration,
        delay: -phase,
        opacity: 0.3 + Math.random() * 0.12,
        direction,
      });
    }
  }

  return instances;
}

const noopSubscribe = () => () => {};

// `useSyncExternalStore` returns the server snapshot during SSR and the
// client snapshot after hydration. Using it instead of `useEffect`+`useState`
// avoids React 19's `set-state-in-effect` rule while still keeping SSR and
// first-client-render markup identical.
function useIsClient() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

function useReducedMotion() {
  return useSyncExternalStore(
    (callback) => {
      const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
      mql.addEventListener("change", callback);
      return () => mql.removeEventListener("change", callback);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

export function LandingBackground() {
  const isClient = useIsClient();
  const reducedMotion = useReducedMotion();
  // Randomize once per mount. Recomputing on every render would re-roll
  // positions on each re-render and look chaotic.
  const instances = useMemo(
    () => (isClient ? buildInstances() : null),
    [isClient],
  );

  if (!instances) {
    return (
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0"
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
    >
      {instances.map((inst) => {
        const { name, Svg, brandColor, wordmarkOnly } =
          COMPANY_LOGOS[inst.logoIndex];
        // Wordmark SVGs already include the name as part of the artwork,
        // so we skip the separate label. Scale ~1.2× the icon size so
        // even the widest wordmark (ZipRecruiter, ~4.5:1 aspect) fits
        // inside one phase-slot of horizontal space (≈13vw at 10 lanes)
        // and never overlaps the next instance in its lane.
        const svgHeight = wordmarkOnly ? inst.size * 1.2 : inst.size;
        const fontSize = Math.round(inst.size * 0.55);

        const content = (
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            {/* Only height is set — width is derived from the SVG's viewBox,
                so wide wordmarks keep their natural aspect ratio. */}
            <Svg height={svgHeight} />
            {!wordmarkOnly && (
              <span
                style={{
                  fontSize: `${fontSize}px`,
                  color: brandColor,
                }}
                className="font-semibold tracking-tight"
              >
                {name}
              </span>
            )}
          </div>
        );

        if (reducedMotion) {
          const leftPct = (inst.key * 37) % 100;
          return (
            <div
              key={inst.key}
              className="absolute"
              style={{
                top: `${inst.topPct}%`,
                left: `${leftPct}%`,
                opacity: inst.opacity,
              }}
            >
              {content}
            </div>
          );
        }

        return (
          <div
            key={inst.key}
            className="absolute will-change-transform"
            style={{
              top: `${inst.topPct}%`,
              left: 0,
              opacity: inst.opacity,
              animationName: inst.direction === "lr" ? "drift-lr" : "drift-rl",
              animationDuration: `${inst.duration}s`,
              animationDelay: `${inst.delay}s`,
              animationTimingFunction: "linear",
              animationIterationCount: "infinite",
            }}
          >
            {content}
          </div>
        );
      })}
    </div>
  );
}
