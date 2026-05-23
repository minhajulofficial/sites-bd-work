"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { clsx } from "clsx";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronLeft, faChevronRight } from "@fortawesome/free-solid-svg-icons";

import dashboardContent from "@/content/contentConstants.json";

interface BannerItem {
  id: string;
  image_url: string;
  link_url: string | null;
  display_order: number;
}

interface BannersResponse {
  data?: BannerItem[];
}

/** Time between auto-rotations, in milliseconds. */
const ROTATE_MS = 5_000;

/**
 * Auto-rotating banner slider mounted at the top of `/dash`. Slides
 * are sourced from `GET /api/banners` (admin-controlled `banners`
 * table). If no active banners are configured the component falls
 * back to a static welcome panel from
 * `contentConstants.dashboard.welcomeBanner` so the page never has
 * an empty top section.
 *
 * Interaction model:
 *   - Auto-advances every 5 s.
 *   - Auto-rotation pauses while the user hovers or focuses the
 *     slider (accessibility — gives keyboard users time to read).
 *   - Manual prev/next arrow buttons and dot indicators are
 *     always available.
 *
 * `image_url`s come from arbitrary admin-supplied origins, so the
 * `<Image>` element is rendered with `unoptimized` to avoid having
 * to declare every possible remote host in `next.config.mjs`.
 */
export function BannerSlider() {
  const [banners, setBanners] = useState<BannerItem[] | null>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/banners", { cache: "no-store" });
        if (!res.ok) {
          if (!cancelled) setBanners([]);
          return;
        }
        const json = (await res.json()) as BannersResponse;
        if (!cancelled) setBanners(json.data ?? []);
      } catch {
        if (!cancelled) setBanners([]);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const slides = useMemo<BannerItem[]>(() => banners ?? [], [banners]);
  const total = slides.length;

  // Reset the index if the active set shrinks (e.g. admin deactivates a banner).
  useEffect(() => {
    if (total > 0 && index >= total) setIndex(0);
  }, [total, index]);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (total <= 1 || paused) return;
    intervalRef.current = setInterval(() => {
      setIndex((prev) => (prev + 1) % total);
    }, ROTATE_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [total, paused]);

  const goTo = useCallback(
    (next: number) => {
      if (total === 0) return;
      setIndex(((next % total) + total) % total);
    },
    [total],
  );

  const handlePrev = useCallback(() => goTo(index - 1), [goTo, index]);
  const handleNext = useCallback(() => goTo(index + 1), [goTo, index]);

  // Loading state — keep the same aspect-ratio frame so the page doesn't jump
  // once the data lands.
  if (banners === null) {
    return (
      <div
        className="relative w-full overflow-hidden rounded-2xl border border-gray-200 bg-gray-100 shadow-sm"
        style={{ aspectRatio: "16 / 5" }}
        aria-busy="true"
        aria-label="Loading banners"
      />
    );
  }

  if (total === 0) {
    return <WelcomeBanner />;
  }

  const active = slides[index];

  return (
    <section
      aria-label="Featured announcements"
      className="relative w-full overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div
        className="relative w-full"
        style={{ aspectRatio: "16 / 5" }}
        role="group"
        aria-roledescription="carousel"
        aria-label={`Slide ${index + 1} of ${total}`}
      >
        {slides.map((slide, i) => (
          <BannerSlide
            key={slide.id}
            slide={slide}
            visible={i === index}
            priority={i === 0}
          />
        ))}
      </div>

      {total > 1 && (
        <>
          <button
            type="button"
            onClick={handlePrev}
            aria-label="Previous banner"
            className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white shadow transition hover:bg-black/60 focus:outline-none focus:ring-2 focus:ring-white"
          >
            <FontAwesomeIcon icon={faChevronLeft} className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleNext}
            aria-label="Next banner"
            className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white shadow transition hover:bg-black/60 focus:outline-none focus:ring-2 focus:ring-white"
          >
            <FontAwesomeIcon icon={faChevronRight} className="h-4 w-4" />
          </button>

          <div
            className="absolute inset-x-0 bottom-3 z-10 flex justify-center gap-2"
            role="tablist"
            aria-label="Banner pagination"
          >
            {slides.map((slide, i) => (
              <button
                key={slide.id}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`Go to slide ${i + 1}`}
                onClick={() => goTo(i)}
                className={clsx(
                  "h-2 rounded-full transition-all",
                  i === index ? "w-6 bg-white" : "w-2 bg-white/60 hover:bg-white/80",
                )}
              />
            ))}
          </div>
        </>
      )}

      <span className="sr-only" aria-live="polite">
        {active.link_url
          ? `Slide ${index + 1} of ${total}, links to ${active.link_url}`
          : `Slide ${index + 1} of ${total}`}
      </span>
    </section>
  );
}

function BannerSlide({
  slide,
  visible,
  priority,
}: {
  slide: BannerItem;
  visible: boolean;
  priority: boolean;
}) {
  const image = (
    <Image
      src={slide.image_url}
      alt=""
      fill
      sizes="(min-width: 1024px) 1024px, 100vw"
      priority={priority}
      unoptimized
      className="object-cover"
    />
  );

  const wrapperClass = clsx(
    "absolute inset-0 transition-opacity duration-500",
    visible ? "opacity-100" : "pointer-events-none opacity-0",
  );

  if (slide.link_url) {
    return (
      <a
        href={slide.link_url}
        target="_blank"
        rel="noopener noreferrer"
        className={wrapperClass}
        aria-hidden={!visible}
        tabIndex={visible ? 0 : -1}
      >
        {image}
      </a>
    );
  }

  return (
    <div className={wrapperClass} aria-hidden={!visible}>
      {image}
    </div>
  );
}

function WelcomeBanner() {
  const welcome = dashboardContent.dashboard.welcomeBanner;
  return (
    <section
      aria-label="Welcome"
      className="relative w-full overflow-hidden rounded-2xl bg-primary-gradient text-white shadow-sm"
    >
      <div className="flex flex-col gap-2 px-6 py-10 sm:px-10 sm:py-14">
        <h2 className="text-2xl font-bold sm:text-3xl">{welcome.title}</h2>
        <p className="max-w-2xl text-sm text-white/90 sm:text-base">
          {welcome.subtitle}
        </p>
      </div>
    </section>
  );
}
