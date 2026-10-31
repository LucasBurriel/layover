# Design notes

The README says what Layover does. This file records why it is shaped the way it is,
so the next scenario, the voice layer or a contributor does not have to rediscover it.

## 1. The learner, and what "practice" means here

The target player is an upper-intermediate adult (B1/B2) who can read English fine but
freezes at a counter, says "I have 30 years" under pressure, and never gets corrected
because everyone understood them anyway. Classroom drills do not fix that; being put in
the situation and *then* told how a native would have said it does.

So the loop is: real situation → say what you would really say → get what you need (or
not) → see the native version in the margin → next scene, the same structures come back.

Three consequences shape everything:

1. **Immersion is the product.** If the character stops to correct you, it is a
   grammar app with a costume. The NPC never comments on your English.
2. **Correction must be specific and cheap to read.** A diff (`del → ins`) and one
   sentence, not a paragraph.
3. **Memory matters more than any single correction.** The thing that makes a tutor
   worth paying for is that they remember you got articles wrong last week.

## 2. Two calls, not one

Each player message triggers two model calls in parallel:

| Call | Who | Sees | Returns |
|---|---|---|---|
| `/api/npc` | the character | scene, personality, its knowledge, player level, weak patterns, full conversation | streamed text in character + a hidden completion tag |
| `/api/coach` | the coach | the NPC's last line and the player's message | structured JSON: corrections, native version, level estimate, praise |

Why not one call with a structured block? Three reasons. The NPC must start streaming
immediately; a structured response (or JSON with a `reply` field) cannot be rendered
token by token without partial-JSON parsing. The coach needs a different prompt and a
different effort level (NPC runs at `low`, coach at `medium`). And they fail
independently: if the coach times out the conversation goes on, and vice versa.

Both run on `claude-opus-5-5` with adaptive thinking; the model ids are env-configurable.

## 3. The completion tag

The scenario needs to know when an objective is done ("did the player actually get a
boarding pass?"). Options considered:

- A third call that judges the transcript: slow, doubles cost per turn.
- Structured output from the NPC: kills streaming (see above).
- Client-side keyword matching: brittle, scenario-specific code.

Chosen: the NPC appends `[[OBJECTIVE_COMPLETE]]` on its own line when the success
criteria (which it sees in its prompt) are met. A tiny streaming filter
(`shared/npcProtocol.ts`) holds back anything from a `[` until it knows whether it is
the tag, so the player never sees it even mid-stream. The reducer only honours the tag
if it comes from the NPC that owns the *current* objective, so a chatty passenger
cannot complete the check-in. Both the filter and the reducer are unit-tested.

## 4. Scenarios are data

A scenario is one JSON file with a setting, a player role, NPCs (personality,
knowledge list, location, greeting) and ordered objectives (what the player sees as a
hint, and the success criteria only the NPC sees). The server validates every file with
zod at startup and checks that objectives point at real NPCs. Nothing about the airport
lives in code; the hotel scenario was added without touching TypeScript.

The knowledge list is the NPC's whole world. "This is ALL you know" is in the prompt
because the alternative, a character who confidently invents gate numbers, breaks the
one thing the player came to practise: getting real information out of a stranger.

## 5. Error memory and adaptive level

Every correction carries a `pattern` label the coach is asked to keep stable across
messages ("articles", "word order in questions"). Labels are normalised (lowercase,
trailing punctuation stripped) and aggregated client-side. From them:

- **Review screen**: this run's patterns with examples, the all-time file, patterns
  that have gone quiet, and what the next scene will push.
- **Weak patterns → NPC prompt**: the top recurring patterns go into the NPC's system
  prompt with the instruction to create situations that call for them, without ever
  mentioning it. This is the "comes back next week" part.
- **Level**: the coach estimates a CEFR level per message. Single messages are noisy
  ("Yes." says nothing), so the player's level is the rounded mean of the last six
  estimates and moves one step at a time. The NPC prompt has a per-level paragraph on
  vocabulary, sentence length and pace.

The memory is `localStorage` today. It is behind a two-method `KeyValue` interface so a
server-side store is a swap, not a rewrite.

## 6. Providers

The backend talks to the model through a two-method `Provider` interface
(`stream`, `structured`). Three implementations:

- `anthropic`: the official SDK. Streaming for the NPC, `output_config.format` for
  the coach, prompt caching on the system block.
- `claude-code`: the Claude Agent SDK used as a plain one-turn model call with no tools
  and no project settings. It authenticates with the local Claude Code login, so the
  game runs without an API key on a developer machine. The conversation is rendered
  into the prompt because each `query()` is a fresh session.
- `mock`: scripted NPC, rule-based coach. For UI work and for the test suite.

`auto` picks the SDK when `ANTHROPIC_API_KEY` is set, otherwise the login.

## 7. Voice later

Nothing in the engine knows about keyboards. `ConversationEngine` reads from an
`InputChannel` (`next(): Promise<string>`) and writes to an `OutputChannel`
(`begin / delta / end`). The React layer implements both with text. Voice is a
`SpeechInputChannel` (Web Speech API or a `/stt` endpoint) and a `TtsOutputChannel`
that starts speaking on the first sentence while the rest streams. The NPC prompt
already asks for short, spoken-style replies with no stage directions, which is what
TTS needs.

## 8. What was deliberately left out of v0.1

- Server-side player accounts (the memory is per browser).
- A judge for the coach's own accuracy. The coach over-corrects occasionally
  ("the board said nothing" is fine English); the prompt caps it at three corrections
  per message and tells it to skip stylistic alternatives. An eval set of real learner
  messages with gold corrections is the right next step before touching the prompt
  further.
- Multiplayer, images, timers. The departures-board aesthetic is CSS and emoji on
  purpose: no assets with unclear licences, nothing to load.
