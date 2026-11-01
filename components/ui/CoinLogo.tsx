"use client";

import React, { useState } from "react";

export interface CoinLogoProps {
  symbol?: string | null;
  size?: number;
  className?: string;
}

const SUPPORTED_SVGS = new Set(["btc", "eth"]);

export function CoinLogo({ symbol, size = 20, className = "" }: CoinLogoProps) {
  const [imgError, setImgError] = useState(false);
  const normalized = (symbol || "").trim().toUpperCase();
  const lower = normalized.toLowerCase();

  // If we have a vendored SVG and no load error occurred, render <img>
  if (SUPPORTED_SVGS.has(lower) && !imgError) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/coins/${lower}.svg`}
        alt={`${normalized} logo`}
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        onError={() => setImgError(true)}
        className={`inline-block shrink-0 rounded-full ${className}`}
        style={{ width: `${size}px`, height: `${size}px` }}
      />
    );
  }

  // Fallback programmatic badge with brand-aligned background and ticker letter
  const getBadgeStyle = (sym: string) => {
    switch (sym) {
      case "SUI":
        return {
          bg: "bg-[#4da2ff]",
          text: "text-white font-bold",
          label: "SUI",
        };
      case "BTC":
        return {
          bg: "bg-[#f7931a]",
          text: "text-white font-bold",
          label: "BTC",
        };
      case "ETH":
        return {
          bg: "bg-[#627eea]",
          text: "text-white font-bold",
          label: "ETH",
        };
      default:
        return {
          bg: "bg-[var(--border)]",
          text: "text-[var(--text)] font-semibold",
          label: sym ? sym.slice(0, 3) : "COIN",
        };
    }
  };

  const badge = getBadgeStyle(normalized);
  const fontSize = Math.max(8, Math.floor(size * 0.42));

  return (
    <span
      role="img"
      aria-label={`${normalized || "Crypto"} logo`}
      className={`inline-flex items-center justify-center rounded-full shrink-0 select-none shadow-xs ${badge.bg} ${badge.text} ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        fontSize: `${fontSize}px`,
        lineHeight: 1,
      }}
    >
      {badge.label.length <= 3 ? badge.label : badge.label[0]}
    </span>
  );
}
