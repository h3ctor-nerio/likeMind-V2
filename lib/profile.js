import { list, str } from "./http";
import { approximate } from "./geo";
import { byCode } from "./languages";

export function cleanProfile(p) {
  return {
    intro: str(p.intro, 400),
    values: str(p.values, 300),
    aspirations: str(p.aspirations, 300),
    skills: list(p.skills),
    interests: list(p.interests),
    strengths: list(p.strengths),
    tags: list(p.tags),
  };
}

const PARTICIPATION = ["online", "in-person", "either"];
const TRANSPORT = ["walk", "bike", "transit", "car", "rideshare", "paratransit"];

export function cleanPrefs(p) {
  const access = p.access || {};
  const out = {
    region: str(p.region, 80),
    languages: list(p.languages, 8, 30),
    availability: list(p.availability, 6, 20),
    participation: PARTICIPATION.includes(p.participation) ? p.participation : "either",
    access: {
      freeOnly: Boolean(access.freeOnly),
      transport: list(access.transport, 6, 20).filter((t) => TRANSPORT.includes(t)),
      maxTravelMinutes: Math.max(0, Math.min(240, Number(access.maxTravelMinutes) || 0)) || null,
      notes: str(access.notes, 300),
    },
  };
  if (byCode(p.uiLanguage)) out.uiLanguage = p.uiLanguage;
  if (p.home && Number.isFinite(Number(p.home.lat))) out.home = approximate(p.home.lat, p.home.lng, "region");
  return out;
}

export function defaultPrivacy() {
  // Private by default: people opt in to being visible or receiving direct requests.
  // discoverable: whether Mind may suggest this person (with up to 2 recent posts) to others. Off until they opt in.
  return { profileVisibility: "private", allowMessageRequests: false, showNameOnThoughts: false, discoverable: false, mindSuggestions: true };
}

export function cleanPrivacy(p) {
  return {
    profileVisibility: p.profileVisibility === "public" ? "public" : "private",
    allowMessageRequests: Boolean(p.allowMessageRequests),
    showNameOnThoughts: Boolean(p.showNameOnThoughts),
    discoverable: Boolean(p.discoverable),
    mindSuggestions: p.mindSuggestions !== false,
  };
}
