"use client";

import React, { useState } from "react";
import { validateLogoUrl } from "@/lib/espn";

export interface TeamLogoProps {
  logo?: string | null;
  name: string;
  abbr?: string;
  size?: number;
  className?: string;
}

export function TeamLogo({
  logo,
  name,
  abbr,
  size = 20,
  className = "",
}: TeamLogoProps) {
  const [loadFailed, setLoadFailed] = useState(false);
  const validatedUrl = validateLogoUrl(logo);

  const initials = (abbr || name || "?")
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(0, 3)
    .toUpperCase();

  // If logo URL is valid according to whitelist and hasn't failed loading
  if (validatedUrl && !loadFailed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={validatedUrl}
        alt={`${name} logo`}
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setLoadFailed(true)}
        className={`inline-block shrink-0 object-contain ${className}`}
        style={{ width: `${size}px`, height: `${size}px` }}
      />
    );
  }

  // Fallback initial badge
  const fontSize = Math.max(8, Math.floor(size * 0.45));

  return (
    <span
      role="img"
      aria-label={`${name} logo badge`}
      className={`inline-flex items-center justify-center rounded-full shrink-0 select-none bg-[var(--border)] text-[var(--text)] font-semibold text-center ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        fontSize: `${fontSize}px`,
        lineHeight: 1,
      }}
    >
      {initials}
    </span>
  );
}
