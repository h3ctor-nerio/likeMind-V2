// Transparent, explainable matching. Every suggestion carries a plain-language reason.
import { distanceKm } from "./geo";

const STOP = new Set(
  "about after again also always among another around because been before being between both cannot could does doing down during each else even every from further have having here into itself just like made make many more most much must myself never only other ought over really same should since some such than that their them then there these they thing things think this those though through today together very want what when where which while will with would your yours just feel feeling felt still".split(" ")
);

export function words(text) {
  return (String(text || "").toLowerCase().match(/[\p{L}]{4,}/gu) || []).filter((w) => !STOP.has(w));
}

function overlap(a, b) {
  const setB = new Set(b);
  return [...new Set(a)].filter((x) => setB.has(x));
}

/** Rank candidate thoughts by how much they share with `thought`. */
export function similarThoughts(thought, candidates, limit = 5) {
  const baseWords = words(thought.text);
  const baseTags = thought.tags || [];
  return candidates
    .filter((c) => String(c._id) !== String(thought._id))
    .map((c) => {
      const tags = overlap(baseTags, c.tags || []);
      const shared = overlap(baseWords, words(c.text));
      const union = new Set([...baseWords, ...words(c.text)]).size || 1;
      const score = tags.length * 2 + (shared.length / union) * 6 + shared.length * 0.3;
      let reason = "";
      if (tags.length) reason = `Also tagged ${tags.slice(0, 3).map((t) => "#" + t).join(", ")}`;
      else if (shared.length) reason = `Mentions ${shared.slice(0, 3).join(", ")}`;
      return { item: c, score, reason };
    })
    .filter((r) => r.score > 0.6)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function userTerms(user) {
  const p = user?.profile || {};
  return [
    ...(p.interests || []),
    ...(p.skills || []),
    ...(p.strengths || []),
    ...(p.tags || []),
    ...words(p.aspirations),
    ...words(p.values),
  ].map((s) => String(s).toLowerCase());
}

/** Score events against the profile and access needs the user chose to share. */
export function recommendEvents(user, events, limit = 4) {
  if (!user) return [];
  const terms = userTerms(user);
  const prefs = user.prefs || {};
  const langs = (prefs.languages || []).map((l) => l.toLowerCase());
  const home = prefs.home || null;
  return events
    .map((e) => {
      const reasons = [];
      let score = 0;
      const eventTerms = [...(e.tags || []), ...words(e.title), ...words(e.description)];
      const shared = overlap(terms, eventTerms);
      if (shared.length) {
        score += shared.length * 2;
        reasons.push(`Matches your interest in ${shared.slice(0, 2).join(" and ")}`);
      }
      if (langs.length && (e.languages || []).some((l) => langs.includes(l.toLowerCase()))) {
        score += 1;
        reasons.push("In a language you speak");
      }
      if (prefs.access?.freeOnly && e.cost?.free) {
        score += 1.5;
        reasons.push("Free to attend");
      }
      if (prefs.participation === "online" && e.mode !== "in-person") score += 1.5;
      if (prefs.participation === "in-person" && e.mode !== "online") score += 1;
      if (prefs.access?.freeOnly && !e.cost?.free) score -= 3;
      if (prefs.participation === "online" && e.mode === "in-person") score -= 3;
      if (home && e.location && e.mode !== "online") {
        const km = distanceKm(home, e.location);
        if (km != null && km < 25) {
          score += 1.5;
          reasons.push("Close to your area");
        } else if (km != null && km > 150) score -= 2;
      }
      return { item: e, score, reasons };
    })
    .filter((r) => r.score >= 2 && r.reasons.length)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function recommendGroups(user, groups, limit = 4) {
  if (!user) return [];
  const terms = userTerms(user);
  return groups
    .map((g) => {
      const shared = overlap(terms, [...(g.tags || []), ...words(g.name), ...words(g.description)]);
      return { item: g, score: shared.length, reasons: shared.length ? [`Shares your interest in ${shared.slice(0, 2).join(" and ")}`] : [] };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

const uniq = (arr) => [...new Set(arr)];

/**
 * Shortlist people for Mind. Only uses what both people chose to share:
 * profile interests, skills, strengths, values, aspirations, tags, languages, region, and post tags.
 */
export function recommendPeople(viewer, myPosts, candidates, postsByUser, limit = 10) {
  const p = viewer.profile || {};
  const myInterests = new Set([...(p.interests || []), ...(p.tags || []), ...myPosts.flatMap((t) => t.tags || [])]);
  const mySkills = new Set(p.skills || []);
  const myStrengths = new Set(p.strengths || []);
  const myValues = new Set(words(p.values));
  const myGoals = words(p.aspirations);
  const myLangs = (viewer.prefs?.languages || []).map((l) => l.toLowerCase());
  const home = viewer.prefs?.home;

  return candidates
    .map((u) => {
      const q = u.profile || {};
      const posts = postsByUser[String(u._id)] || [];
      const theirInterests = uniq([...(q.interests || []), ...(q.tags || []), ...posts.flatMap((t) => t.tags || [])]);
      const sharedInterests = theirInterests.filter((x) => myInterests.has(x));
      const sharedSkills = (q.skills || []).filter((x) => mySkills.has(x));
      const canHelp = (q.skills || []).filter((x) => !mySkills.has(x) && (myInterests.has(x) || myGoals.some((w) => x.includes(w))));
      const sharedValues = uniq(words(q.values).filter((w) => myValues.has(w)));
      const sharedStrengths = (q.strengths || []).filter((x) => myStrengths.has(x));
      const sharedLangs = (u.prefs?.languages || []).map((l) => l.toLowerCase()).filter((l) => l !== "english" && myLangs.includes(l));
      const km = home && u.prefs?.home ? distanceKm(home, u.prefs.home) : null;

      const score =
        sharedInterests.length * 2 + sharedSkills.length * 1.5 + canHelp.length * 1.5 + sharedValues.length * 1.5 +
        sharedStrengths.length + sharedLangs.length + (km != null && km < 50 ? 1 : 0) + (posts.length ? 1 : 0);

      const reasons = [];
      if (sharedInterests.length) reasons.push(`You're both into ${sharedInterests.slice(0, 2).join(" and ")}`);
      if (canHelp.length) reasons.push(`They can help with ${canHelp[0]}`);
      if (sharedValues.length) reasons.push(`You both value ${sharedValues.slice(0, 2).join(" and ")}`);
      if (sharedSkills.length) reasons.push(`You share skills in ${sharedSkills[0]}`);
      if (sharedLangs.length) reasons.push(`You both speak ${sharedLangs[0][0].toUpperCase() + sharedLangs[0].slice(1)}`);
      if (km != null && km < 50) reasons.push("They're in your area");

      return {
        user: u,
        posts,
        score,
        shared: uniq([...sharedInterests, ...sharedSkills, ...canHelp, ...sharedValues, ...sharedStrengths]).slice(0, 5),
        reason: reasons.slice(0, 2).join(". ") + (reasons.length ? "." : ""),
      };
    })
    .filter((r) => r.score >= 2 && r.shared.length)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
