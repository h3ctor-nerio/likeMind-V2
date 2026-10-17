# LikeMinds

Team 10 prototype for 2026 UAlbany AI in Society Inaugural Competition: a welcoming path from anonymous self-expression to voluntary, meaningful connection.

People share anonymous thoughts as bubbles on a map, discover others who feel the same, connect only when both agree, form groups, and meet at events from verified hosts that spell out cost, language, transit, and accessibility.

Built with **Next.js (App Router)**, **MongoDB**, and **OpenStreetMap** (Leaflet map, Nominatim place search; no map key needed). Runs on desktop and mobile browsers.

## Run it

You need Node.js 20.6 or newer and a MongoDB database (local `mongod`, Docker, or a free MongoDB Atlas cluster).

```bash
npm install
cp .env.example .env.local      # then edit the values
npm run seed                    # optional: loads demo data (clears LikeMinds collections first)
npm run dev
```

Open http://localhost:3000.

Quick local MongoDB with Docker: `docker run -d -p 27017:27017 --name likeminds-db mongo:7`

For Atlas, paste your `mongodb+srv://…` string into `MONGODB_URI` and allow your IP in Network Access.

### Demo accounts (after `npm run seed`)

All use the password `likeminds123`.

| Email | Who | Try |
| --- | --- | --- |
| maria@likeminds.test | Newcomer in Chicago (EN/ES) | Pending connection request, chat, group, event feedback |
| sam@likeminds.test | Parent, bike fixer | Chat with Maria, group host |
| lin@likeminds.test | Retired caregiver, prefers online | Personalized event picks |
| jordan@likeminds.test | 16-year-old | Teen-safe experience |
| library@likeminds.test | Verified host (public library) | Host an event, Insights |
| township@likeminds.test | Verified host (township) | Community question + Insights |
| admin@likeminds.test | Moderator | Review queue, approve the pending café host |

## How the design doc maps to the app

| Journey step (from the doc) | Where |
| --- | --- |
| 1. Welcome and explore, no profile required | `/`, `/explore`, `/events` work signed out |
| 2. Sign up: private email, account | `/signup` step 1 (email, full name, age are never shown) |
| 3. Create profile: display name, optional interests, strengths, skills | `/signup` step 2, random anonymous display name |
| 4. Preferences: region, language, availability, access needs | `/signup` step 3, `/profile` |
| 5. Explore map or list, approximate locations | `/explore`: OpenStreetMap with rotating bubbles, layer tabs (Everything / Thoughts / Events), filters, place search, "Near me" |
| 6. Share a thought: tags, audience, reply and contact permissions, content check | Share panel on `/explore` |
| 7. Open a bubble: read, reply, like / unlike, react, save | Map preview card, list cards, `/thoughts/[id]`; liked thoughts under Profile → Liked |
| 8–9. Request a connection; private chat only if both agree | `/connections`, `/chat/[id]` |
| 10. Create or join a group; each member consents | `/groups`, `/groups/[id]` (invites must be accepted) |
| 11. Explore events: organizer, cost, location, language, accessibility | `/events` with filters and "Picked for you" |
| 12. Register individually, optionally share access requests | `/events/[id]` |
| 13. Attend online or in person, optional check-in | `/events/[id]` |
| 14. Reflect: feedback, update preferences, keep connecting | `/events/[id]` after the event |
| Organizer journey | `/events/new` (apply → verified → publish), `/insights` |
| Governance: prompts that inform organizers and policy makers | Community questions on `/explore`, aggregated themes on `/insights` |

## Data model (MongoDB collections)

- **users**: email, fullName, passwordHash, age, isMinor, displayName (public), profile {intro, values, aspirations, skills, interests, strengths, tags}, prefs {region, home (blurred point), languages, availability, participation, access {freeOnly, transport, maxTravelMinutes, notes}}, privacy {profileVisibility, allowMessageRequests, showNameOnThoughts}, organizer {status, orgName, orgType}, savedThoughts
- **thoughts**: authorId, text, tags, audience, allowReplies, allowConnections, showName, location (GeoJSON, approximate), precision (neighborhood / town / region), areaName (e.g. "Wicker Park, Chicago"), promptId, status, moderation, reactions {like, relate, support, insight}, replyCount
- **replies**, **reports**
- **connections**: fromId, toId, status (pending / accepted / declined / ended), pairKey
- **messages**: connectionId (1:1 chat) or groupId (group chat)
- **groups**: members with roles, invites, suggestedEvents
- **events**: organizer, mode (in-person / online / hybrid), timing (live / self-paced), cost, languages, accessibility, transport, ageRange, capacity, attendees (with check-in and optional access request), feedback
- **prompts**: community questions from verified hosts

## Maps and location

- **Explore** is the map hub. Tabs switch between everything, thoughts only, or events only. Each layer has its own filters: thoughts by keyword, tag, time posted, and "liked by me"; events by date, format, language, cost, step-free access, and transit. A place search, "Near me", and distance limit apply to both.
- **Sharing a thought**: choose the spot by searching a place, using your device's GPS, or clicking the map, then choose how exact to be (neighborhood, town, or region). The app shows what others will see ("around Wicker Park, Chicago") before you post. The server always moves the pin slightly, so it never marks an exact address.
- **Events** use exact locations: hosts search for the venue, fine-tune the pin, and attendees get an OpenStreetMap directions link.
- **Your area** (Profile → Preferences) powers "My area" on the map and nearby event suggestions. It's stored blurred to your region.

## Mind (AI people suggestions) and live map

- **Live bubbles.** On the Explore map, thoughts refresh every 15 seconds. At most 20 bubbles show at once; when there are more, a new set rotates in each cycle. Your own thoughts, ones you liked, the one you opened, and Mind's picks always stay visible. A **Pause updates** button stops the motion, and the List view shows everything.
- **Mind** is a pop-up in the corner of the map. Every 10 minutes it suggests 3 people with similar interests, skills, and values, shows 2 of each person's recent thoughts (also outlined in teal on the map), and offers **Ask to connect** or **Not for me**.
- **How it picks:** code scores everyone who opted in by shared interests, skills (including skills that match what you want to learn), values, strengths, languages, and area. With an AI key, the top 10 go to the AI, which picks 3 and writes a one-line note on what you have in common. Without a key, Mind uses the rule-based notes.
- **Privacy:** only people who turn on **Let Mind suggest me** (Profile → Privacy, or at sign-up) can be suggested, because showing someone's recent thoughts next to their display name links those thoughts to them. It's off by default for new accounts. Teens are only matched with teens. Batches are stored in `mind_suggestions`, one per user per 10 minutes, so refreshing the page doesn't call the AI again.
- **Demo:** after `npm run seed`, sign in as maria@likeminds.test. All demo adults have opted in.

## Wording checks (threats and offensive language)

Everything people write is checked the moment they submit it, on the server, before anyone else can see it: profiles (display name, intro, values, interests, skills, strengths, tags), events (every field), groups, thoughts, replies, and messages. Rules catch threats, harassment, crisis language, and contact details; with `OPENAI_API_KEY`, OpenAI's moderation model also catches hate, harassment, violence, and sexual content in many languages.

| Where | What happens when wording is threatening or offensive |
| --- | --- |
| Profile, sign-up, event, group | Not saved. The person is told exactly which part to rephrase. |
| Thought or reply | Saved but hidden; a moderator publishes or removes it. |
| Chat or group message | Not sent; the person is asked to rephrase. |

Blocked attempts are logged (`moderation_log`). Two in a week start a quiet moderator check; four start an account check. Moderators can also **Scan profiles, events, and posts** on the Review page to re-check older content: anything flagged is hidden and listed for review, never deleted. Set `EVENT_APPROVAL=all` to require a moderator's approval for every event.

## Safety checks for events and members

Goal: catch risky events and behavior without scaring off new hosts. Nobody is told they're "suspicious". When a check needs more, the person sees a short, direct list of questions and a note that it's a routine check, not a judgment.

- **Signals are behaviors only** (`lib/trust.js`). Events: paying through outside services, asking for personal or financial details, teens at a private home or late at night, asking attendees to make contact privately, income promises, shortened links, a missing map pin, many events in one day. Members: 15+ connection requests in a day, most requests declined, reports from several different people. Account age, organization size, language, spelling, and names are never used.
- **Thresholds:** one strong signal or two medium ones means asking for information; anything less means a quiet check only moderators see.
- **AI's role is limited:** it gives moderators a neutral note and can soften a medium-only flag into a quiet check, or add a quiet check. It can never cause a request on its own, and it's told to ignore who the person is.
- **What people experience:** an event waits for answers before it goes live (the host sees the questions on the event page). A member sees a banner and an Account check page; until a moderator reviews their answers, only new connection requests and invitations pause. Browsing, posting, and existing chats keep working.
- **Moderators** see the signals, the AI note, and the answers on the Review page, and approve, decline, clear, or keep requests paused, with a one-sentence reason sent to the person. A cleared member gets 30 days before automatic checks run again.
- **Fairness tracking:** the Review page shows how many flagged events were approved. If most are, the rules are too strict.

## Site language (AI interface translation)

The languages people list in Profile → Preferences decide the language of the interface:

- **One language** (for example only Korean): the whole site switches to it automatically.
- **Two or more** (for example English and Spanish): a small language button floats at the top right. Its menu lists those languages plus English; the choice is saved to the profile (`prefs.uiLanguage`). The same choice is in Preferences as **Site language**.
- **What's translated:** buttons, labels, menus, hints, and messages. **What isn't:** anything people wrote (thoughts, replies, chats, names, event and group details), which is marked `translate="no"` and keeps its own Translate button. The admin Review page stays in the original wording.
- **How:** `app/components/UiLanguage.js` reads the page's text, replaces numbers with placeholders ("{0} likes"), and sends strings it hasn't seen to `/api/ui-translate`. The AI translates each string once per language; results are stored in `ui_translations` and in the browser, so after the first visit pages switch instantly at no cost. Arabic switches the layout right-to-left.
- Needs `OPENAI_API_KEY` (or `ANTHROPIC_API_KEY`). Without one, the site stays in English and the menu is hidden.
- **Demo:** maria@likeminds.test (English and Spanish) sees the menu; jiwoo@likeminds.test (Korean only) gets a Korean interface.

## OpenAI setup (AI features and voice posting)

1. Create a key at platform.openai.com/api-keys and add a payment method under Billing. Set a monthly spending limit while you're there.
2. Add it to `.env.local` (and Vercel's Environment Variables) as `OPENAI_API_KEY`, then restart or redeploy.
3. Optional: change `OPENAI_MODEL` (text features) or `OPENAI_TRANSCRIBE_MODEL` (voice) if your account uses different models.

**Voice posting** uses OpenAI's Realtime API. When someone taps **Speak instead** in the share form, the server creates a 2-minute client secret (`/api/voice/session`), and the browser streams the microphone straight to OpenAI over WebRTC. Words appear in the text box as they speak; they can edit before posting, and the usual content check still runs. Audio never passes through or is stored by LikeMinds, and each person is limited to 20 voice sessions an hour. Voice needs https (or localhost) and microphone permission.

## AI and trust

AI is optional. Without `OPENAI_API_KEY` (or `ANTHROPIC_API_KEY`) everything still works with rule-based checks, and the voice button is hidden.

- **Moderation** (`lib/moderation.js`): rules catch harassment, crisis language, contact details, and links. With an OpenAI key, OpenAI's moderation model adds a second check (Claude does this if only an Anthropic key is set). Nothing is silently deleted: flagged posts go to a human review queue, and the writer is told why. Posts that suggest someone is in crisis show support resources (988 in the US) right away.
- **Matching** (`lib/matching.js`): similar thoughts and event/group picks use transparent tag and keyword overlap. Every suggestion shows a plain-language reason. Only information users chose to share is used.
- **Translation**: one tap to translate a thought, reply, or message into your preferred language (needs a key).
- **Community insights**: hosts see aggregated themes only when at least 3 posts share them. AI summaries unlock at 5 responses and are instructed never to quote or identify anyone.
- **Privacy by default**: profiles start private; thoughts are anonymous unless the writer opts in; locations are blurred to a town or region; access needs are shared with hosts only if the attendee ticks a box.
- **Teen safety**: users 13–17 see only "everyone" posts, can't connect with adults, and get teen-only groups and events.
- **Verified hosts**: only people approved by a moderator can publish events.

## Project structure

```
app/            pages (App Router) and app/api/* route handlers
app/components  shared UI (map, share form, nav, etc.)
lib/            database, auth, moderation, matching, view shaping
scripts/seed.mjs demo data
```

## Before a real launch

This is a hackathon prototype. Still needed: email verification, a paid or self-hosted tile and geocoding provider if traffic grows past OpenStreetMap's fair-use limits and password reset, rate limiting on sign-in, real-time chat (WebSockets instead of polling), image uploads for events, a geocoder for typed addresses, a fuller moderator toolset with audit logs, and an accessibility audit with real users.
# likeMind-V2
