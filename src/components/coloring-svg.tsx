"use client";

import React from "react";
import type { ColoringPage } from "@/lib/coloring-pages";

interface Props {
  page: ColoringPage;
  /** shapeId -> color */
  fills?: Record<string, string>;
  className?: string;
  strokeWidth?: number;
  title?: string;
}

/**
 * Renders a coloring page as an SVG. Colorable shapes carry a
 * `data-region` attribute; the parent colors whatever shape is under the
 * child's finger while rubbing (hit-tested with elementFromPoint), so no
 * per-shape click handlers are needed. Decorations (eyes, whiskers, sun
 * rays…) are pointer-transparent and never block the rubbing finger.
 */
export function ColoringSvg({
  page,
  fills,
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
          ? (fills?.[s.id as string] ?? "#FFFFFF")
          : (s.fill ?? "none");
        const props: Record<string, unknown> = {
          ...s.attrs,
          fill: fillColor,
          stroke: s.noStroke ? "none" : (s.stroke ?? "#41403c"),
          strokeWidth: s.sw ?? strokeWidth,
          strokeLinejoin: "round",
          strokeLinecap: "round",
        };
        if (colorable) {
          props["data-region"] = s.id;
          props.style = { fill: fillColor, transition: "fill 260ms ease" };
        } else {
          // decorations must never block the rubbing finger
          props.style = { pointerEvents: "none" };
        }
        return React.createElement(s.el, { ...props, key });
      })}
    </svg>
  );
}
