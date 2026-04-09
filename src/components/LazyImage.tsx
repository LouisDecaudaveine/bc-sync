"use client";

import { useRef, useState, useEffect, useCallback } from "react";

type Status = "idle" | "loading" | "loaded" | "error";

export function LazyImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    setStatus("loading");
  }, [visible]);

  const onLoad = useCallback(() => setStatus("loaded"), []);
  const onError = useCallback(() => setStatus("error"), []);

  return (
    <div ref={containerRef} className={className}>
      {/* Skeleton pulse while idle or loading */}
      {(status === "idle" || status === "loading") && (
        <div className="absolute inset-0 bg-neutral-800 animate-pulse" />
      )}

      {/* Broken image state */}
      {status === "error" && (
        <div className="absolute inset-0 bg-neutral-800 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-neutral-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z"
            />
          </svg>
        </div>
      )}

      {/* Actual image — only rendered once in viewport */}
      {visible && status !== "error" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          onLoad={onLoad}
          onError={onError}
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            status === "loaded" ? "opacity-100" : "opacity-0"
          }`}
        />
      )}
    </div>
  );
}
