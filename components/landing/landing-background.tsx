"use client";

import { useMemo, useSyncExternalStore } from "react";
import { COMPANY_LOGOS } from "@/components/landing/company-logos";

// Two non-overlapping horizontal bands — upper drifts left→right, lower
// drifts right→left. Because the bands don't share vertical space, an
// instance in the upper band can never collide with one in the lower band.
const BANDS = [
  { top: 3, height: 36, direction: "lr" as const },
  { top: 61, height: 36, direction: "rl" as const },
];

// Lanes per band. Each band holds exactly LANES_PER_BAND instances, with each
// instance at a unique lane AND a unique evenly-spaced phase along the
// animation loop. That combination guarantees no two instances in the same
// band can occupy the same (x, y) at the same time.
const LANES_PER_BAND = 10;

// Single shared duration. Variable durations would cause phase drift between
// instances and re-introduce occasional clumping. Fixed duration is the only
// way to keep the cross-instance phase spacing exactly constant forever.
const DURATION_SEC = 45;

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
  const instances: Instance[] = [];
  let key = 0;

  for (const band of BANDS) {
    // Every brand appears at least once per band. When LANES_PER_BAND >
    // brandCount, fill the remaining slots with a random subset of brands
    // (no brand picked twice as an "extra"), then shuffle the full lane
    // assignment so the two rows aren't mirrors of each other.
    const base = shuffle(Array.from({ length: brandCount }, (_, n) => n));
    const extras = shuffle(
      Array.from({ length: brandCount }, (_, n) => n),
    ).slice(0, Math.max(0, LANES_PER_BAND - brandCount));
    const brandOrder = shuffle([...base, ...extras]);

    for (let lane = 0; lane < LANES_PER_BAND; lane++) {
      // Evenly-spaced vertical lane within the band. Tiny jitter so the
      // layout doesn't look ruler-perfect, kept small enough to never
      // close the gap to the neighboring lane.
      const topPct =
        band.top +
        (lane / (LANES_PER_BAND - 1)) * band.height +
        (Math.random() - 0.5) * 1.2;

      // Evenly-spaced phase along the animation loop. With 8 lanes and a
      // 45s cycle, each instance starts 5.625s ahead of the next — at any
      // frame they're at 8 distinct x positions across the viewport.
      const phase = (lane / LANES_PER_BAND) * DURATION_SEC;

      instances.push({
        key: key++,
        logoIndex: brandOrder[lane],
        topPct,
        size: 24 + Math.floor(Math.random() * 6), // 24–29 px (tighter so
        // even the widest wordmark fits inside one phase slot at desktop)
        duration: DURATION_SEC,
        delay: -phase,
        opacity: 0.3 + Math.random() * 0.12,
        direction: band.direction,
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
