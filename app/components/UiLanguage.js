"use client";
// AI interface translation.
// - The languages a person lists in their profile decide the site language.
//   One language: the site switches to it. Two or more: a floating menu lets them choose.
// - Only the interface is translated (buttons, labels, messages). What people write is marked
//   translate="no" and stays as written; each post still has its own Translate button.
// - Each interface string is translated once per language by AI and cached on the server
//   (MongoDB) and in this browser, so later page loads cost nothing.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/client";
import { byCode, uiOptions } from "@/lib/languages";
import { useAuth } from "./AuthProvider";

const Ctx = createContext({ lang: "en", options: [], available: false, busy: false, setLang: () => {} });
export const useUiLanguage = () => useContext(Ctx);

export function UiLanguageProvider({ children }) {
  const { me, aiEnabled } = useAuth();
  const options = useMemo(() => (me ? uiOptions(me.prefs?.languages || []) : []), [me]);
  const [choice, setChoice] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => setChoice(null), [me?.id]);

  let lang = "en";
  if (me && aiEnabled && options.length === 1) lang = options[0].code;
  else if (me && aiEnabled && options.length > 1) {
    const wanted = choice || me.prefs?.uiLanguage;
    lang = wanted === "en" || options.some((o) => o.code === wanted) ? wanted : options[0].code;
  }

  const setLang = useCallback(async (code) => {
    setChoice(code);
    try {
      await api("/api/profile/ui-language", { method: "POST", body: { code } });
    } catch {}
  }, []);

  const value = { lang, options, available: Boolean(me && aiEnabled && options.length > 1), busy, setLang };
  return (
    <Ctx.Provider value={value}>
      {children}
      <DomTranslator lang={lang} setBusy={setBusy} />
    </Ctx.Provider>
  );
}

/* ---------------- Floating language menu ---------------- */

export function LanguageWidget() {
  const { lang, options, available, busy, setLang } = useUiLanguage();
  const [open, setOpen] = useState(false);
  const [top, setTop] = useState(76);
  const ref = useRef(null);

  // Float just below the navigation bar, even when it wraps onto two lines.
  useEffect(() => {
    const nav = document.querySelector(".nav");
    if (!nav) return;
    const place = () => setTop(Math.round(nav.getBoundingClientRect().height) + 12);
    place();
    const ro = new ResizeObserver(place);
    ro.observe(nav);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!available) return null;
  const list = options.some((o) => o.code === "en") ? options : [...options, byCode("en")];
  const current = byCode(lang) || byCode("en");

  return (
    <div className="lang-widget" ref={ref} style={{ top }}>
      <button className="lang-btn" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="true" aria-label="Site language">
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z" />
        </svg>
        <span translate="no">{current.label}</span>
        {busy && <span className="lang-busy" aria-hidden="true" />}
      </button>
      {open && (
        <div className="lang-menu">
          <p className="small muted" style={{ margin: "0 0 6px" }}>Site language</p>
          {list.map((o) => (
            <button
              key={o.code}
              className={`lang-option ${o.code === lang ? "on" : ""}`}
              aria-pressed={o.code === lang}
              lang={o.code}
              translate="no"
              onClick={() => {
                setLang(o.code);
                setOpen(false);
              }}
            >
              {o.label}
            </button>
          ))}
          <p className="small muted" style={{ margin: "8px 0 0" }}>Translated by AI. Posts and messages stay as written.</p>
        </div>
      )}
    </div>
  );
}

/* ---------------- Page translator ---------------- */

const SKIP = 'script, style, noscript, code, pre, textarea, svg, nextjs-portal, [translate="no"], [contenteditable="true"]';
const ATTRS = ["placeholder", "aria-label", "title", "alt"];
const textState = new WeakMap(); // Text node -> { orig, shown }
const attrState = new WeakMap(); // Element -> { [attr]: { orig, shown } }
const caches = {};
const pending = new Set();
const failed = new Set();

function cacheFor(lang) {
  if (!caches[lang]) {
    const m = new Map();
    try {
      const raw = localStorage.getItem(`lm-ui-${lang}`);
      if (raw) for (const [k, v] of Object.entries(JSON.parse(raw))) m.set(k, v);
    } catch {}
    caches[lang] = m;
  }
  return caches[lang];
}
function saveCache(lang) {
  try {
    localStorage.setItem(`lm-ui-${lang}`, JSON.stringify(Object.fromEntries([...caches[lang]].slice(-5000))));
  } catch {}
}

// Numbers become {0}, {1} so "12 likes" and "13 likes" share one translation.
function split(text) {
  const m = text.match(/^(\s*)([\s\S]*?)(\s*)$/);
  const nums = [];
  const tpl = m[2].replace(/\d+(?:[.,:]\d+)*/g, (d) => {
    nums.push(d);
    return `{${nums.length - 1}}`;
  });
  return { lead: m[1], tpl, nums, trail: m[3] };
}
const fill = (t, nums) => t.replace(/\{(\d+)\}/g, (all, i) => nums[Number(i)] ?? all);
const worth = (tpl) => tpl && tpl.length <= 1000 && /\p{L}/u.test(tpl);

function translateValue(value, state, lang, cache, missing) {
  // `state` is what we last wrote; if the page changed the value since, that's the new original.
  const orig = state && value === state.shown ? state.orig : value;
  if (lang === "en") return { orig, shown: orig };
  const { lead, tpl, nums, trail } = split(orig);
  if (!worth(tpl)) return { orig, shown: orig };
  const t = cache.get(tpl);
  if (t === undefined) {
    missing.add(tpl);
    return { orig, shown: orig };
  }
  return { orig, shown: lead + fill(t, nums) + trail };
}

function applyAll(lang, missing) {
  const cache = lang === "en" ? null : cacheFor(lang);
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const parent = node.parentElement;
    if (!parent || parent.closest(SKIP)) continue;
    const prev = textState.get(node);
    if (lang === "en" && !prev) continue;
    const next = translateValue(node.nodeValue, prev, lang, cache, missing);
    textState.set(node, next);
    // Only ever change the text value; never replace nodes, so React keeps working.
    if (node.nodeValue !== next.shown) node.nodeValue = next.shown;
  }
  for (const el of document.body.querySelectorAll(ATTRS.map((a) => `[${a}]`).join(","))) {
    if (el.closest(SKIP)) continue;
    const st = attrState.get(el) || {};
    for (const a of ATTRS) {
      const v = el.getAttribute(a);
      if (v == null || (lang === "en" && !st[a])) continue;
      st[a] = translateValue(v, st[a], lang, cache, missing);
      if (v !== st[a].shown) el.setAttribute(a, st[a].shown);
    }
    attrState.set(el, st);
  }
}

function DomTranslator({ lang, setBusy }) {
  const langRef = useRef(lang);
  const timer = useRef(null);

  const fetchMissing = useCallback(
    async (target, missing) => {
      const todo = [...missing].filter((s) => !pending.has(`${target}|${s}`) && !failed.has(`${target}|${s}`));
      if (!todo.length) return;
      todo.forEach((s) => pending.add(`${target}|${s}`));
      setBusy(true);
      const cache = cacheFor(target);
      for (let i = 0; i < todo.length; i += 60) {
        const chunk = todo.slice(i, i + 60);
        try {
          const r = await api("/api/ui-translate", { method: "POST", body: { lang: target, strings: chunk } });
          for (const s of chunk) {
            if (r.translations?.[s]) cache.set(s, r.translations[s]);
            else failed.add(`${target}|${s}`); // keep English rather than asking again and again
          }
        } catch {
          chunk.forEach((s) => failed.add(`${target}|${s}`));
        }
        chunk.forEach((s) => pending.delete(`${target}|${s}`));
        saveCache(target);
        if (langRef.current === target) applyAll(target, new Set());
      }
      if (![...pending].some((k) => k.startsWith(`${target}|`))) setBusy(false);
    },
    [setBusy]
  );

  const run = useCallback(() => {
    const target = langRef.current;
    const missing = new Set();
    applyAll(target, missing);
    if (target !== "en" && missing.size) fetchMissing(target, missing);
  }, [fetchMissing]);

  useEffect(() => {
    langRef.current = lang;
    const info = byCode(lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = info?.rtl ? "rtl" : "ltr";
    run();
    if (lang === "en") {
      setBusy(false);
      return;
    }
    // Translate whatever the page shows next (new pages, new messages, opened menus).
    const observer = new MutationObserver(() => {
      clearTimeout(timer.current);
      timer.current = setTimeout(run, 150);
    });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    return () => {
      observer.disconnect();
      clearTimeout(timer.current);
    };
  }, [lang, run, setBusy]);

  return null;
}
