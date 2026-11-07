"use client";

import React from "react";
import type { ColoringPage } from "@/lib/coloring-pages";

interface Props {
  page: ColoringPage;
  /** shapeId -> color (used by the gallery thumbnails) */
  fills?: Record<string, string>;
  /** render colorable shapes as hollow outlines — the crayon paint lives on a canvas below */
  outlineOnly?: boolean;
  className?: string;
  strokeWidth?: number;
  title?: string;
}

/**
 * Renders a coloring page as an SVG. In thumbnail mode (`fills`) colorable
 * shapes are painted solid. In coloring mode (`outlineOnly`) they stay hollow
 * (`fill="none"`) so the crayon strokes on the paint canvas underneath shine
 * through while the dark outlines stay crisply on top — like a real coloring
 * book. Decorations (eyes, whiskers, sun rays…) are pointer-transparent and
 * never block the rubbing finger.
 */
export function ColoringSvg({
  page,
  fills,
  outlineOnly = false,
  className,
  strokeWidth = 6,
  title,
}: Props) {
  return (
    <svg
      viewBox="0 0 400 400"
      className={className}
      role="img"
      aria-label={title ?? `Gambar ${page.name}`}
    >
      {page.shapes.map((s, i) => {
        const key = s.id ?? `fix-${i}`;
        const colorable = !!s.colorable && !!s.id;
        const fillColor = colorable
          ? outlineOnly
            ? "none"
            : (fills?.[s.id as string] ?? "#FFFFFF")
          : (s.fill ?? "none");
        const props: Record<string, unknown> = {
          ...s.attrs,
          fill: fillColor,
          stroke: s.noStroke ? "none" : (s.stroke ?? "#41403c"),
          strokeWidth: s.sw ?? strokeWidth,
          strokeLinejoin: "round",
          strokeLinecap: "round",
        };
        if (colorable && !outlineOnly) {
          props["data-region"] = s.id;
          props.style = { fill: fillColor, transition: "fill 260ms ease" };
        } else {
          // decorations (and hollow coloring outlines) must never block the finger
          props.style = { pointerEvents: "none" };
        }
        return React.createElement(s.el, { ...props, key });
      })}
    </svg>
  );
}
