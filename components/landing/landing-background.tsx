"use client";

import { useMemo, useSyncExternalStore } from "react";
import { COMPANY_LOGOS } from "@/components/landing/company-logos";

// Per-brand instance count. With 8 brands × 4 each = 32 drifting pairs across
// the viewport. Bumping this lifts density (and per-instance overhead).
const PER_BRAND = 4;

// Upper and lower bands the logos drift through. The gap between them is the
// dead-center region reserved for the sign-in card.
const BANDS = [
  { top: 3, height: 33 },
  { top: 62, height: 33 },
];

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
  const total = brandCount * PER_BRAND;

  // Pre-compute evenly spaced vertical lane slots across both bands, then
  // shuffle. Dealing one slot per instance guarantees no two instances share
  // a lane and means same-brand instances scatter across the whole vertical
  // range instead of clumping in one band.
  const lanesPerBand = Math.ceil(total / BANDS.length);
  const slotDeck: number[] = [];
  for (const band of BANDS) {
    for (let lane = 0; lane < lanesPerBand; lane++) {
      if (slotDeck.length >= total) break;
      const topPct =
        band.top +
        (lane / Math.max(1, lanesPerBand - 1)) * band.height +
        (Math.random() - 0.5) * 3; // small jitter so lanes don't look ruled
      slotDeck.push(topPct);
    }
  }
  const slots = shuffle(slotDeck);

  const instances: Instance[] = [];
  for (let i = 0; i < total; i++) {
    // Brands cycle every step so consecutive instances are always different.
    const logoIndex = i % brandCount;
    const instanceOfBrand = Math.floor(i / brandCount); // 0…PER_BRAND-1
    const duration = 36 + Math.random() * 14; // 36–50s
    // Same-brand instances get phases evenly distributed across the loop:
    // with 4 per brand they're 25%, 50%, 75% out of phase, so at any moment
    // they sit at four different horizontal positions — no temporal clumping.
    const phase =
      (instanceOfBrand / PER_BRAND) * duration + Math.random() * 4;

    instances.push({
      key: i,
      logoIndex,
      topPct: slots[i],
      size: 22 + Math.floor(Math.random() * 14),
      duration,
      delay: -phase,
      opacity: 0.28 + Math.random() * 0.14,
      direction: i % 2 === 0 ? "lr" : "rl",
    });
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
        // so we render them at ~2× the size and skip the separate label.
        const svgHeight = wordmarkOnly ? inst.size * 1.6 : inst.size;
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
