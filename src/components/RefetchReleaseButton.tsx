"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const FRAMES = [
  "/assets/logos/animated-bc-sync-logo/Frame 1.svg",
  "/assets/logos/animated-bc-sync-logo/Frame 2.svg",
  "/assets/logos/animated-bc-sync-logo/Frame 3.svg",
  "/assets/logos/animated-bc-sync-logo/Frame 4.svg",
];

const FRAME_DURATION = 150;

export function RefetchReleaseButton({ releaseId }: { releaseId: string }) {
  const queryClient = useQueryClient();
  const [frameIndex, setFrameIndex] = useState(0);

  const { mutate, status } = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/dev/refetch-release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ releaseId }),
      });
      if (!res.ok) throw new Error("Failed to refetch");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["releases"] });
    },
  });

  const isPending = status === "pending";
  const isSuccess = status === "success";
  const isError = status === "error";

  useEffect(() => {
    if (!isPending) {
      setFrameIndex(0);
      return;
    }
    const id = setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % FRAMES.length);
    }, FRAME_DURATION);
    return () => clearInterval(id);
  }, [isPending]);

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        mutate();
      }}
      title="Re-fetch release details from Bandcamp"
      className={`absolute top-1.5 right-1.5 z-10 w-7 h-7 rounded flex items-center justify-center cursor-pointer transition-all
        ${status === "idle" ? "opacity-0 group-hover:opacity-100 bg-black/70 hover:bg-black/90" : ""}
        ${isPending ? "opacity-100 bg-black/70" : ""}
        ${isSuccess ? "opacity-100" : ""}
        ${isError ? "opacity-100 bg-red-900/80 text-red-300" : ""}
      `}
      disabled={isPending}
    >
      {(status === "idle" || isPending) && (
        <Image
          src={isPending ? FRAMES[frameIndex] : "/assets/logos/bc-sync-logo.svg"}
          alt="Sync"
          width={18}
          height={18}
          unoptimized
        />
      )}
      {isSuccess && (
        <Image src="/assets/icons/tick.svg" alt="Done" width={24} height={24} unoptimized />
      )}
      {isError && "✗"}
    </button>
  );
}
