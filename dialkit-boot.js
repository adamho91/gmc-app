/**
 * DialKit mount for the vanilla GMC app.
 * DialKit expects a React root layout; we mount <DialRoot /> as a sibling to #app-shell.
 * Uses CDN ESM so the static Vercel deploy works without a bundler.
 */
import React from "https://esm.sh/react@19.2.8";
import { createRoot } from "https://esm.sh/react-dom@19.2.8/client";
import { DialRoot } from "https://esm.sh/dialkit@1.4.2?deps=react@19.2.8,react-dom@19.2.8,motion@12.42.2";

if (document.documentElement.classList.contains("gmc-embed")) {
  /* Live embeds stay clean — no floating dial panel. */
} else {
  const mount = document.getElementById("dialkit-mount") || (() => {
    const el = document.createElement("div");
    el.id = "dialkit-mount";
    document.body.appendChild(el);
    return el;
  })();

  createRoot(mount).render(
    React.createElement(DialRoot, {
      position: "top-right",
      theme: "light",
      defaultOpen: false,
      productionEnabled: true,
    })
  );
}
