// Seeds a demo dataset. WARNING: clears the LikeMinds collections in MONGODB_DB first.
// Run with: npm run seed
import { MongoClient } from "mongodb";
import crypto from "crypto";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "likeminds";
if (!uri) {
  console.error("MONGODB_URI is missing. Create .env.local from .env.example first.");
  process.exit(1);
}

const PASSWORD = "likeminds123";
const hash = (pw) => {
  const salt = crypto.randomBytes(16).toString("hex");
  return `${salt}:${crypto.scryptSync(pw, salt, 64).toString("hex")}`;
};
const jitter = (v, amt = 0.04) => Math.round((v + (Math.random() - 0.5) * amt) * 10000) / 10000;
const pt = (lat, lng, amt) => ({ type: "Point", coordinates: [jitter(lng, amt), jitter(lat, amt)] });
const daysFromNow = (d, hour = 18) => {
  const x = new Date();
  x.setDate(x.getDate() + d);
  x.setHours(hour, 0, 0, 0);
  return x;
};
const hoursAgo = (h) => new Date(Date.now() - h * 3600 * 1000);

const CITIES = {
  nyc: [40.7128, -74.006],
  chicago: [41.8781, -87.6298],
  la: [34.0522, -118.2437],
  houston: [29.7604, -95.3698],
  atlanta: [33.749, -84.388],
  seattle: [47.6062, -122.3321],
  albuquerque: [35.0844, -106.6504],
  minneapolis: [44.9778, -93.265],
  toronto: [43.6532, -79.3832],
  rural: [40.39, -82.49],
};
const AREA = {
  nyc: "Brooklyn, NY", chicago: "Chicago, IL", la: "Los Angeles, CA", houston: "Houston, TX", atlanta: "Atlanta, GA",
  seattle: "Seattle, WA", albuquerque: "Albuquerque, NM", minneapolis: "Minneapolis, MN", toronto: "Toronto, ON", rural: "Mount Vernon, OH",
};

const client = new MongoClient(uri);
await client.connect();
const db = client.db(dbName);
for (const c of ["users", "thoughts", "replies", "connections", "messages", "groups", "events", "reports", "prompts", "mind_suggestions", "voice_sessions"]) {
  await db.collection(c).deleteMany({});
}

const privacy = (pub = false) => ({ profileVisibility: pub ? "public" : "private", allowMessageRequests: false, showNameOnThoughts: false, discoverable: true, mindSuggestions: true });
const mkUser = (o) => ({
  passwordHash: hash(PASSWORD),
  isMinor: o.age < 18,
  savedThoughts: [],
  organizer: { status: "none" },
  privacy: privacy(o.public),
  createdAt: hoursAgo(500),
  ...o,
  profile: { intro: "", values: "", aspirations: "", skills: [], interests: [], strengths: [], tags: [], ...o.profile },
  prefs: { region: "", languages: ["english"], availability: [], participation: "either", access: { freeOnly: false, transport: [], maxTravelMinutes: null, notes: "" }, ...o.prefs },
});

const users = [
  mkUser({ email: "admin@likeminds.test", fullName: "Avery Admin", displayName: "SteadyLantern11", age: 34, organizer: { status: "verified", orgName: "LikeMinds Team", orgType: "nonprofit", about: "Platform moderators" } }),
  mkUser({ email: "maria@likeminds.test", fullName: "Maria Lopez", displayName: "WarmHarbor42", age: 29, public: true,
    profile: { intro: "Nurse, new to Chicago, learning to knit.", interests: ["knitting", "cooking", "walking", "language"], skills: ["first aid", "spanish"], strengths: ["good listener"], tags: ["new-in-town"], values: "family, kindness, community", aspirations: "start a conversation group" },
    prefs: { region: "Chicago", languages: ["english", "spanish"], participation: "in-person", home: pt(...CITIES.chicago, 0.2), access: { freeOnly: true, transport: ["transit"], notes: "" } } }),
  mkUser({ email: "sam@likeminds.test", fullName: "Sam Okafor", displayName: "CuriousFinch27", age: 41, public: true,
    profile: { intro: "Dad of two, weekend cyclist, I fix bikes for fun.", interests: ["cycling", "cooking", "parenting", "outdoors"], skills: ["bike repair"], strengths: ["patient teacher"], tags: ["parent"], values: "family, honesty, community" },
    prefs: { region: "Chicago", languages: ["english"], participation: "either", home: pt(...CITIES.chicago, 0.2) } }),
  mkUser({ email: "lin@likeminds.test", fullName: "Lin Chen", displayName: "QuietMaple63", age: 67,
    profile: { intro: "Retired engineer. Caring for my husband.", interests: ["gardening", "chess", "caregiving"], skills: ["math tutoring"], tags: ["caregiving"], values: "patience, kindness, learning" },
    prefs: { region: "Seattle", languages: ["english", "chinese"], participation: "online", home: pt(...CITIES.seattle, 0.2), access: { freeOnly: true, transport: ["paratransit"], notes: "Step-free access" } } }),
  mkUser({ email: "jordan@likeminds.test", fullName: "Jordan Teen", displayName: "BrightComet15", age: 16,
    profile: { intro: "High school junior. Into drawing and soccer.", interests: ["art", "soccer", "music"], tags: ["students"] },
    prefs: { region: "Houston", home: pt(...CITIES.houston, 0.2) } }),
  mkUser({ email: "amara@likeminds.test", fullName: "Amara Diallo", displayName: "KindRiver48", age: 33,
    profile: { intro: "Mom of one, moved from Senegal, love to cook for a crowd.", interests: ["cooking", "parenting", "language", "music"], skills: ["french", "catering"], strengths: ["organizer"], tags: ["new-in-town", "parent"], values: "family, community, faith" },
    prefs: { region: "Atlanta", languages: ["english", "french"], home: pt(...CITIES.atlanta, 0.2) } }),
  mkUser({ email: "walt@likeminds.test", fullName: "Walt Berg", displayName: "PatientCedar19", age: 68,
    profile: { intro: "Retired carpenter. Like to keep my hands busy.", interests: ["woodworking", "gardening", "outdoors", "chess"], skills: ["carpentry", "bike repair"], strengths: ["patient teacher"], tags: ["retirement"], values: "patience, honesty, learning", aspirations: "teach a woodworking class" },
    prefs: { region: "Minneapolis", languages: ["english"], home: pt(...CITIES.minneapolis, 0.2) } }),
  mkUser({ email: "jiwoo@likeminds.test", fullName: "Ji-woo Park", displayName: "OpenFern27", age: 26,
    profile: { intro: "Grad student who just moved here. Love hiking and coffee.", interests: ["hiking", "music", "outdoors", "language"], skills: ["korean", "photography"], tags: ["new-in-town", "students"], values: "curiosity, kindness" },
    prefs: { region: "Seattle", languages: ["korean"], home: pt(...CITIES.seattle, 0.2) } }),
  mkUser({ email: "township@likeminds.test", fullName: "Pat Rivera", displayName: "OpenMeadow50", age: 52,
    organizer: { status: "verified", orgName: "Riverside Township Parks & Rec", orgType: "township", about: "Community programs in local parks." } }),
  mkUser({ email: "library@likeminds.test", fullName: "Dana Brooks", displayName: "GentleWillow31", age: 45,
    organizer: { status: "verified", orgName: "Eastside Public Library", orgType: "public agency", about: "Free classes, clubs, and conversation circles." } }),
  mkUser({ email: "cafe@likeminds.test", fullName: "Rosa Nguyen", displayName: "SunnyKite77", age: 38,
    organizer: { status: "pending", orgName: "Common Grounds Cafe", orgType: "small business", about: "Board game nights and open mic.", appliedAt: new Date() } }),
];
const ids = (await db.collection("users").insertMany(users)).insertedIds;
const U = Object.fromEntries(users.map((u, i) => [u.displayName, { ...u, _id: ids[i] }]));
const author = (name) => U[name] || U.WarmHarbor42;

// Community prompt from the township
const promptId = (await db.collection("prompts").insertOne({
  question: "What would make our parks feel more welcoming to you?",
  orgName: "Riverside Township Parks & Rec",
  createdBy: U.OpenMeadow50._id,
  active: true,
  createdAt: hoursAgo(120),
})).insertedId;

const T = (text, tags, city, who = "WarmHarbor42", extra = {}) => ({
  authorId: author(who)._id,
  authorName: who,
  showName: false,
  text,
  tags,
  audience: "everyone",
  allowReplies: true,
  allowConnections: true,
  location: city ? pt(...CITIES[city], 0.15) : null,
  precision: "town",
  areaName: city ? AREA[city] : "",
  language: "english",
  promptId: null,
  status: "published",
  moderation: { flags: [], support: false },
  reviewNote: "",
  reactions: { like: [], relate: [], support: [], insight: [] },
  replyCount: 0,
  reportCount: 0,
  createdAt: hoursAgo(Math.floor(Math.random() * 200) + 1),
  ...extra,
});

const thoughts = [
  T("Moved here three months ago and still eat lunch alone most days. Not sure how people make friends as adults.", ["new-in-town", "loneliness"], "chicago", "WarmHarbor42"),
  T("Is there anyone who'd want to do a Spanish–English conversation swap over coffee?", ["language", "new-in-town"], "chicago", "WarmHarbor42"),
  T("I fix bikes for fun. If your kid's bike is broken, I'm happy to teach you how to fix it.", ["cycling", "parenting"], "chicago", "CuriousFinch27"),
  T("Being a single dad on weekends is lonely in a way I didn't expect.", ["parenting", "loneliness"], "chicago", "CuriousFinch27"),
  T("Caring for my husband is a lot. Does anyone else feel invisible as a caregiver?", ["caregiving", "loneliness"], "seattle", "QuietMaple63"),
  T("Started a balcony tomato garden. Looking for tips from anyone with more experience.", ["gardening"], "seattle", "QuietMaple63"),
  T("Would love a chess partner who doesn't mind playing slowly.", ["chess"], "seattle", "QuietMaple63"),
  T("My art class got cancelled and now I don't know anyone else who draws.", ["art", "students"], "houston", "BrightComet15"),
  T("Anyone want to start a pickup soccer game on Saturdays?", ["sports", "students"], "houston", "BrightComet15"),
  T("I speak French at home and English at work and sometimes feel like I don't fully belong in either.", ["language", "belonging"], "atlanta", "KindRiver48"),
  T("The bus to the community center only runs twice a day. Hard to get to anything.", ["transit", "local-politics"], "rural"),
  T("Our town needs a place where teenagers can hang out that isn't a parking lot.", ["local-politics", "students"], "rural"),
  T("Retired last spring. The days are long. I have 40 years of carpentry skills and nothing to use them on.", ["retirement", "loneliness"], "minneapolis", "PatientCedar19"),
  T("Grief group at church helped me more than I expected. If you lost someone recently, you're not alone.", ["grief", "faith"], "atlanta"),
  T("Looking for other immigrant moms to swap recipes and babysitting.", ["parenting", "new-in-town", "cooking"], "atlanta", "KindRiver48"),
  T("I work nights so every meetup is during my sleep. Anyone else on a night schedule?", ["jobs", "loneliness"], "la"),
  T("Rent went up again. Thinking about moving and leaving the few friends I have.", ["housing"], "la"),
  T("Anyone into jazz? I play trumpet badly and would love to jam badly with others.", ["music"], "nyc"),
  T("Grew up here, but my neighborhood changed so much I feel like a stranger.", ["belonging", "local-politics"], "nyc"),
  T("Deaf and tired of events with no interpreter. Would love ASL-friendly meetups.", ["accessibility", "belonging"], "nyc"),
  T("Wheelchair user here. A lot of 'community' spots have a step at the door.", ["accessibility", "local-politics"], "albuquerque"),
  T("Hiking alone is fine but hiking with people would be better.", ["outdoors"], "minneapolis", "PatientCedar19"),
  T("Nouvelle à Toronto. Je cherche des gens pour pratiquer l'anglais.", ["language", "new-in-town"], "toronto", "WarmHarbor42", { language: "french" }),
  T("I want to volunteer but don't know where to start.", ["volunteering"], null),
  // Prompt responses
  T("More benches with shade. My knees can't do a full loop without resting.", ["accessibility", "parks"], "rural", "QuietMaple63", { promptId }),
  T("Signs in Spanish too, and a bulletin board for what's happening.", ["language", "parks"], "rural", "WarmHarbor42", { promptId }),
  T("Lights on the path at night. I don't feel safe walking after work.", ["safety", "parks"], "rural", "CuriousFinch27", { promptId }),
  T("A covered area so groups can meet when it rains.", ["parks"], "rural", "SteadyLantern11", { promptId }),
  T("Bathrooms that are actually open and step-free.", ["accessibility", "parks"], "rural", "GentleWillow31", { promptId }),
  T("A free weekly walk with a guide. I'd come if I knew someone would be there.", ["outdoors", "parks", "loneliness"], "rural", "OpenMeadow50", { promptId }),
];
// Spread some reactions
const allIds = Object.values(U).map((u) => String(u._id));
for (const t of thoughts) {
  t.reactions.like = allIds.filter(() => Math.random() < 0.45);
  t.reactions.relate = allIds.filter(() => Math.random() < 0.35);
  t.reactions.support = allIds.filter(() => Math.random() < 0.15);
}
const tIds = (await db.collection("thoughts").insertMany(thoughts)).insertedIds;

await db.collection("replies").insertMany([
  { thoughtId: tIds[0], authorId: U.CuriousFinch27._id, authorName: "CuriousFinch27", text: "Same boat a few years ago. Library clubs helped me.", status: "published", moderation: { flags: [] }, createdAt: hoursAgo(20) },
  { thoughtId: tIds[4], authorId: U.WarmHarbor42._id, authorName: "WarmHarbor42", text: "You're not invisible. What you're doing matters.", status: "published", moderation: { flags: [] }, createdAt: hoursAgo(10) },
]);
await db.collection("thoughts").updateMany({ _id: { $in: [tIds[0], tIds[4]] } }, { $set: { replyCount: 1 } });

// One accepted connection with a short chat, one pending request
const pair = (a, b) => [String(a), String(b)].sort().join(":");
const conn = await db.collection("connections").insertOne({
  pairKey: pair(U.WarmHarbor42._id, U.CuriousFinch27._id),
  fromId: U.CuriousFinch27._id, fromName: "CuriousFinch27", toId: U.WarmHarbor42._id, toName: "WarmHarbor42",
  note: "I also moved here not long ago.", context: "About a thought: “Moved here three months ago…”",
  status: "accepted", createdAt: hoursAgo(30), respondedAt: hoursAgo(28), lastMessageAt: hoursAgo(2),
});
await db.collection("messages").insertMany([
  { connectionId: conn.insertedId, senderId: U.CuriousFinch27._id, senderName: "CuriousFinch27", text: "Hi! The library has a cooking club on Thursdays, have you seen it?", createdAt: hoursAgo(3) },
  { connectionId: conn.insertedId, senderId: U.WarmHarbor42._id, senderName: "WarmHarbor42", text: "I hadn't! I'd go if you're going.", createdAt: hoursAgo(2) },
]);
await db.collection("connections").insertOne({
  pairKey: pair(U.QuietMaple63._id, U.WarmHarbor42._id),
  fromId: U.QuietMaple63._id, fromName: "QuietMaple63", toId: U.WarmHarbor42._id, toName: "WarmHarbor42",
  note: "Your reply meant a lot. Would you like to chat?", context: "Replied to your thought", status: "pending", createdAt: hoursAgo(5),
});

// Events
const E = (o) => ({
  verified: true, tags: [], mode: "in-person", timing: "live", locationName: "", location: null, onlineLink: "",
  cost: { free: true, amount: 0, notes: "" }, languages: ["english"],
  accessibility: { wheelchair: false, asl: false, captions: false, quietSpace: false, notes: "" },
  transport: { transit: false, parking: false, bike: false, notes: "" },
  ageRange: "all", capacity: null, attendees: [], feedback: [], status: "published", createdAt: hoursAgo(100), ...o,
});
const lib = { organizerId: U.GentleWillow31._id, organizerName: "Eastside Public Library", orgType: "public agency" };
const town = { organizerId: U.OpenMeadow50._id, organizerName: "Riverside Township Parks & Rec", orgType: "township" };
const events = [
  E({ ...lib, title: "Thursday cooking club", description: "Bring a recipe from home. We cook one dish together, eat, and swap stories. All skill levels welcome.", tags: ["cooking", "new-in-town"], startsAt: daysFromNow(3, 18), endsAt: daysFromNow(3, 20), locationName: "Eastside Library, Community Room", location: pt(...CITIES.chicago, 0.02), languages: ["english", "spanish"], accessibility: { wheelchair: true, asl: false, captions: false, quietSpace: true, notes: "Elevator at the north entrance." }, transport: { transit: true, parking: false, bike: true, notes: "Blue Line, Damen stop, 5 minute walk." }, capacity: 20 }),
  E({ ...lib, title: "Spanish–English conversation circle", description: "Practice either language with neighbors. Half the time in Spanish, half in English. Beginners especially welcome.", tags: ["language", "new-in-town"], startsAt: daysFromNow(5, 17), endsAt: daysFromNow(5, 18), mode: "hybrid", locationName: "Eastside Library, Room B", location: pt(...CITIES.chicago, 0.02), onlineLink: "https://meet.example.org/conversation", languages: ["english", "spanish"], accessibility: { wheelchair: true, asl: false, captions: true, quietSpace: false, notes: "" }, transport: { transit: true, parking: false, bike: true, notes: "" } }),
  E({ ...lib, title: "Caregivers' coffee hour (online)", description: "An hour for people caring for a family member. No agenda, no advice unless you ask for it. Cameras optional.", tags: ["caregiving", "loneliness"], startsAt: daysFromNow(2, 10), endsAt: daysFromNow(2, 11), mode: "online", onlineLink: "https://meet.example.org/caregivers", languages: ["english", "chinese"], accessibility: { wheelchair: false, asl: false, captions: true, quietSpace: false, notes: "Live captions on." } }),
  E({ ...town, title: "Guided park walk", description: "An easy, flat 2 km loop with a guide. Benches every 300 m. Stay for tea after. Come alone; you'll leave with people to walk with.", tags: ["outdoors", "walking", "parks"], startsAt: daysFromNow(4, 9), endsAt: daysFromNow(4, 10), locationName: "Riverside Park, main gate", location: pt(...CITIES.rural, 0.02), accessibility: { wheelchair: true, asl: false, captions: false, quietSpace: false, notes: "Paved path." }, transport: { transit: false, parking: true, bike: true, notes: "Free lot at the main gate." } }),
  E({ ...town, title: "Town hall listening session: parks", description: "Share what would make our parks more welcoming. We'll present themes from the LikeMinds community question and hear your ideas.", tags: ["local-politics", "parks"], startsAt: daysFromNow(10, 18), endsAt: daysFromNow(10, 19), mode: "hybrid", locationName: "Riverside Town Hall", location: pt(...CITIES.rural, 0.02), onlineLink: "https://meet.example.org/townhall", languages: ["english", "spanish"], accessibility: { wheelchair: true, asl: true, captions: true, quietSpace: false, notes: "" }, transport: { transit: false, parking: true, bike: false, notes: "" } }),
  E({ ...town, title: "Teen open studio: drawing and zines", description: "Supplies provided. Draw, make a zine, listen to music. Staff on site.", tags: ["art", "students", "music"], startsAt: daysFromNow(6, 16), endsAt: daysFromNow(6, 18), locationName: "Riverside Teen Center", location: pt(...CITIES.houston, 0.05), ageRange: "teens" }),
  E({ ...lib, title: "Slow chess afternoon", description: "Boards provided. Players of every level. Clocks optional.", tags: ["chess"], startsAt: daysFromNow(7, 14), endsAt: daysFromNow(7, 16), locationName: "Central Library, 3rd floor", location: pt(...CITIES.seattle, 0.02), languages: ["english", "chinese"], accessibility: { wheelchair: true, asl: false, captions: false, quietSpace: true, notes: "" }, transport: { transit: true, parking: false, bike: true, notes: "" } }),
  E({ ...lib, title: "Bike repair basics", description: "Learn to fix a flat and adjust brakes. Bring your bike if you can.", tags: ["cycling", "skills"], startsAt: daysFromNow(9, 11), endsAt: daysFromNow(9, 13), locationName: "Eastside Library parking lot", location: pt(...CITIES.chicago, 0.02), cost: { free: false, amount: 5, notes: "Covers parts; no one turned away" } }),
  E({ ...lib, title: "Self-paced: neighborhood photo walk", description: "Walk your block this week and post a photo of a place that matters to you. We'll share them at the library.", tags: ["art", "outdoors", "belonging"], startsAt: daysFromNow(-1, 9), endsAt: daysFromNow(6, 21), mode: "online", timing: "self-paced", onlineLink: "https://example.org/photowalk" }),
  // Past event with attendance for the feedback flow
  E({ ...lib, title: "Welcome night for newcomers", description: "Snacks, name tags, and a short tour of what the library offers.", tags: ["new-in-town"], startsAt: daysFromNow(-3, 18), endsAt: daysFromNow(-3, 20), locationName: "Eastside Library", location: pt(...CITIES.chicago, 0.02),
    attendees: [{ userId: U.WarmHarbor42._id, displayName: "WarmHarbor42", accessRequest: "", checkedIn: true, rsvpAt: hoursAgo(100) }, { userId: U.CuriousFinch27._id, displayName: "CuriousFinch27", accessRequest: "", checkedIn: true, rsvpAt: hoursAgo(90) }],
    feedback: [{ userId: U.CuriousFinch27._id, rating: 5, comment: "Met two neighbors. Thank you!", at: hoursAgo(60) }] }),
];
// One event held by the safety check, with the host's answers, so the Review page has an example.
events.push(E({ ...town, title: "Fall plant and seed swap", description: "Bring cuttings, seeds, or pots to trade. Extra plants are $2 each; pay with Venmo or cash at the table.", tags: ["gardening", "outdoors"],
  startsAt: daysFromNow(12, 10), endsAt: daysFromNow(12, 12), locationName: "Riverside Park pavilion", location: pt(...CITIES.rural, 0.02),
  status: "info_submitted",
  review: {
    decision: "needs_info",
    signals: [{ code: "offPlatformPayment", strength: "strong", label: "Mentions paying through an outside service" }],
    questions: ["How will attendees pay, and what do they get for it? If payment happens outside LikeMinds, tell us which service and why."],
    answers: [{ question: "How will attendees pay, and what do they get for it? If payment happens outside LikeMinds, tell us which service and why.", answer: "Extra plants from our greenhouse are $2. The township's Venmo account goes to the parks fund. Cash is fine too, and swapping is free." }],
    submittedAt: hoursAgo(3), aiNote: "Small plant sale by a township parks department; payment mention looks routine.", checkedAt: hoursAgo(4),
  } }));
const eIds = (await db.collection("events").insertMany(events)).insertedIds;

await db.collection("groups").insertMany([
  { name: "Chicago newcomers", description: "For anyone who moved here in the last couple of years. We try one new thing a month.", tags: ["new-in-town", "cooking"], visibility: "open", teenFriendly: false, ageGroup: "adult", createdBy: U.CuriousFinch27._id,
    members: [{ userId: U.CuriousFinch27._id, displayName: "CuriousFinch27", role: "host", joinedAt: hoursAgo(40) }, { userId: U.WarmHarbor42._id, displayName: "WarmHarbor42", role: "member", joinedAt: hoursAgo(20) }],
    invites: [], suggestedEvents: [{ eventId: eIds[0], suggestedBy: "CuriousFinch27", at: hoursAgo(10) }], status: "active", createdAt: hoursAgo(40) },
  { name: "Caregivers who get it", description: "Quiet support between people caring for someone they love.", tags: ["caregiving"], visibility: "open", teenFriendly: false, ageGroup: "adult", createdBy: U.QuietMaple63._id,
    members: [{ userId: U.QuietMaple63._id, displayName: "QuietMaple63", role: "host", joinedAt: hoursAgo(80) }], invites: [], suggestedEvents: [], status: "active", createdAt: hoursAgo(80) },
  { name: "Teen artists", description: "Share drawings, plan studio days.", tags: ["art", "students"], visibility: "open", teenFriendly: true, ageGroup: "teen", createdBy: U.BrightComet15._id,
    members: [{ userId: U.BrightComet15._id, displayName: "BrightComet15", role: "host", joinedAt: hoursAgo(30) }], invites: [], suggestedEvents: [], status: "active", createdAt: hoursAgo(30) },
]);

// One thought waiting for review, to demo the moderation queue
await db.collection("thoughts").insertOne(T("Text me at 555-201-8890 if you want to hang out", ["new-in-town"], "la", "CuriousFinch27", {
  status: "in_review", moderation: { flags: ["personal contact details"], support: false },
  reviewNote: "A person on our team will take a quick look before this appears to others.",
}));

console.log(`Seeded ${dbName}.`);
console.log(`Sign in with any of these (password: ${PASSWORD}):`);
for (const u of users) console.log(`  ${u.email.padEnd(26)} ${u.displayName}${u.organizer.status === "verified" ? " (verified host)" : ""}${u.age < 18 ? " (teen)" : ""}`);
await client.close();
