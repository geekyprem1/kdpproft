"use client";

import { useEffect, useRef } from "react";

/**
 * launchpadjv's widget script expects its own <script> tag to sit as a real
 * DOM sibling immediately after the forgeContainer div (it locates its target
 * relative to its own position, the way a raw copy-pasted snippet would sit).
 * next/script relocates the tag elsewhere in the document, which is why the
 * widget renders blank — so this creates both elements manually and appends
 * them in that exact order instead.
 */
export function ForgeEmbed({ offer, page, id }: { offer: string; page: string; id: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.innerHTML = "";

    const div = document.createElement("div");
    div.className = "forgeContainer";
    div.dataset.offer = offer;
    div.dataset.page = page;
    div.dataset.id = id;
    container.appendChild(div);

    const script = document.createElement("script");
    script.src = "https://launchpadjv.com/js/embed.js";
    script.async = true;
    container.appendChild(script);

    return () => {
      container.innerHTML = "";
    };
  }, [offer, page, id]);

  return <div ref={containerRef} />;
}
