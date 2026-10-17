"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useGeocoder } from "./useGeocoder";

/** Accessible place search (combobox). onSelect receives { lat, lng, label, name }. */
export default function PlaceSearch({ label = "Search a place", placeholder = "Search an address, park, or town", onSelect, bias, hideLabel = false }) {
  const { search } = useGeocoder();
  const [q, setQ] = useState("");
  const [options, setOptions] = useState([]);
  const [active, setActive] = useState(-1);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState("");
  const listId = useId();
  const skip = useRef(false);

  useEffect(() => {
    if (skip.current) {
      skip.current = false;
      return;
    }
    if (q.trim().length < 3) {
      setOptions([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        setOptions(await search(q, bias));
        setOpen(true);
        setActive(-1);
        setErr("");
      } catch (e) {
        setErr("Place search is unavailable right now. Click the map instead.");
      }
    }, 600); // Nominatim allows about one search per second
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, search]);

  async function choose(o) {
    setOpen(false);
    skip.current = true;
    setQ(o.label);
    try {
      onSelect?.(await o.resolve());
    } catch {
      setErr("Couldn't load that place. Try another result.");
    }
  }

  function onKey(e) {
    if (!open || !options.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(options.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      choose(options[active]);
    } else if (e.key === "Escape") setOpen(false);
  }

  return (
    <div className="place-search">
      <label htmlFor={listId + "-input"} className={hideLabel ? "sr-only" : undefined}>{label}</label>
      <input
        id={listId + "-input"}
        type="search"
        role="combobox"
        aria-expanded={open && options.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        value={q}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={onKey}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onFocus={() => options.length && setOpen(true)}
      />
      {open && options.length > 0 && (
        <ul id={listId} role="listbox" className="place-options">
          {options.map((o, i) => (
            <li key={o.id} id={`${listId}-${i}`} role="option" aria-selected={i === active} onMouseDown={(e) => { e.preventDefault(); choose(o); }}>
              {o.label}
            </li>
          ))}
        </ul>
      )}
      {err && <span className="hint" style={{ color: "var(--danger)" }}>{err}</span>}
      <span className="hint">Search by OpenStreetMap</span>
    </div>
  );
}
