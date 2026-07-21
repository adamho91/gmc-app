/**
 * DialKit mount for the vanilla GMC app.
 * DialKit only renders once a panel is registered, so this bridges the app's
 * existing DOM sliders into a "GMC" panel via useDialKitController.
 * Two-way sync: DialKit edits dispatch `input` events on the original inputs;
 * a poll picks up preset loads / programmatic changes back into DialKit.
 * CDN ESM keeps the static Vercel deploy bundler-free.
 */
import React from "https://esm.sh/react@19.2.8";
import { createRoot } from "https://esm.sh/react-dom@19.2.8/client";
import {
  DialRoot,
  useDialKitController,
} from "https://esm.sh/dialkit@1.4.2?deps=react@19.2.8,react-dom@19.2.8,motion@12.42.2";

/** folder -> param -> input element id (range sliders unless noted) */
const GROUPS = {
  motion: {
    spinSpeed: "speed",
  },
  sphereLens: {
    fontSize: "font-size",
    horizontalArc: "arc-h",
    verticalArc: "arc-v",
    focal: "focal",
    tiltX: "tilt",
    tiltY: "tilt-y",
  },
  depth: {
    camera: "cam",
    typeRadial: "type-radial",
    typeDepthZ: "type-zoff",
    fieldRadial: "field-radial",
    fieldGrain: "field-el-scale",
  },
  echo: {
    layers: "echo-n",
    separation: "echo-step",
    opacity: "echo-a",
  },
  displacement: {
    amount: "displacement",
    scaleDetail: "displacement-scale",
    timeDrift: "displacement-anim",
    driftSpeed: "displacement-speed",
  },
  glass: {
    enabled: "glass-enabled",
    blur: "glass-blur",
    frost: "glass-frost",
    shine: "glass-shine",
  },
};

function forEachParam(fn) {
  for (const [folder, params] of Object.entries(GROUPS)) {
    for (const [key, id] of Object.entries(params)) {
      const el = document.getElementById(id);
      if (!el) continue;
      fn(`${folder}.${key}`, el, el.type === "checkbox" ? "checkbox" : "range");
    }
  }
}

function buildConfig() {
  const config = {};
  for (const [folder, params] of Object.entries(GROUPS)) {
    const section = {};
    for (const [key, id] of Object.entries(params)) {
      const el = document.getElementById(id);
      if (!el) continue;
      if (el.type === "checkbox") {
        section[key] = el.checked;
      } else {
        const min = Number(el.min);
        const max = Number(el.max);
        const step = Number(el.step) || 1;
        const value = Number(el.value);
        section[key] = [value, min, max, step];
      }
    }
    if (Object.keys(section).length) config[folder] = section;
  }
  return config;
}

function getAtPath(obj, path) {
  return path.split(".").reduce((acc, k) => (acc == null ? acc : acc[k]), obj);
}

function GMCDialBridge() {
  const [config] = React.useState(buildConfig);
  const dial = useDialKitController("GMC", config);
  const applyingFromDial = React.useRef(false);

  /* DialKit -> DOM: write values and fire input so existing bindings react. */
  React.useEffect(() => {
    applyingFromDial.current = true;
    forEachParam((path, el, type) => {
      const v = getAtPath(dial.values, path);
      if (v == null) return;
      if (type === "checkbox") {
        if (el.checked !== v) {
          el.checked = !!v;
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }
      } else if (Number(el.value) !== v) {
        el.value = String(v);
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
    applyingFromDial.current = false;
  }, [dial.values]);

  /* DOM -> DialKit: immediate on user input, polled for preset loads. */
  React.useEffect(() => {
    const syncFromDom = () => {
      if (applyingFromDial.current) return;
      const current = dial.getValues();
      forEachParam((path, el, type) => {
        const domVal = type === "checkbox" ? el.checked : Number(el.value);
        if (getAtPath(current, path) !== domVal) dial.setValue(path, domVal);
      });
    };
    const listeners = [];
    forEachParam((path, el) => {
      const onInput = () => {
        if (applyingFromDial.current) return;
        syncFromDom();
      };
      el.addEventListener("input", onInput);
      listeners.push([el, onInput]);
    });
    const pollId = setInterval(syncFromDom, 1000);
    return () => {
      clearInterval(pollId);
      listeners.forEach(([el, fn]) => el.removeEventListener("input", fn));
    };
  }, []);

  return null;
}

if (!document.documentElement.classList.contains("gmc-embed")) {
  const mount =
    document.getElementById("dialkit-mount") ||
    (() => {
      const el = document.createElement("div");
      el.id = "dialkit-mount";
      document.body.appendChild(el);
      return el;
    })();

  const boot = () => {
    createRoot(mount).render(
      React.createElement(
        React.Fragment,
        null,
        React.createElement(GMCDialBridge),
        React.createElement(DialRoot, {
          position: "top-right",
          theme: "light",
          defaultOpen: false,
          productionEnabled: true,
        })
      )
    );
  };

  /* Wait for spinner.js load-time preset restore so slider defaults are settled. */
  if (document.readyState === "complete") {
    setTimeout(boot, 400);
  } else {
    window.addEventListener("load", () => setTimeout(boot, 400), { once: true });
  }
}
