---
name: filmmaking-pitch
description: Convert a business, product, pitch deck, or founder narrative into a cinematic pitch film plan. Use when the user says "filmmaking skill", "video pitch deck", "turn my pitch deck into a film", "cinematic product story", "founder film", "business film", "product trailer", or asks how to represent a business/product pitch through filmmaking.
metadata:
  category: creative-strategy
  tags: pitch-deck,filmmaking,product-video,storyboard,founder-story
---

# Filmmaking Pitch

Turn a business or product pitch into a short film that can be used for investors, launches, demo day, social clips, or a website hero.

This skill owns the narrative layer: what story to tell, what proof to show, how scenes map to deck sections, and what assets are needed. If the user asks to actually produce the video, hand off to `marketing-video`; if they ask for frame polish, use `video-craft`.

## First Moves

1. Read existing context before asking questions:
   - `.superstack/idea-context.md` for product, audience, differentiation, validation
   - `.superstack/build-context.md` for implementation status
   - Any existing pitch deck, screenshots, demo recordings, brand files, or landing page copy the user points to
2. Identify the intended viewer:
   - investor
   - customer
   - hackathon/demo judge
   - recruiting candidate
   - social media audience
3. Choose the film format:
   - `60-90s pitch film` for investors and demo day
   - `30-45s product trailer` for landing pages and launches
   - `15-25s social cut` for X/TikTok/LinkedIn
   - `3-5m founder walkthrough` for deeper fundraising or sales

Ask only for missing facts that change the film. Do not ask about animation settings, camera gear, or software until the story is clear.

## Story Rules

- Lead with the user's pain or market tension, not the product name.
- Show proof before polish: screenshots, real metrics, user behavior, scored results, or a working demo beat.
- Keep one claim per scene.
- Do not invent traction, partnerships, revenue, users, or regulatory safety.
- For crypto, DeFi, prediction markets, or financial products, avoid language that implies guaranteed returns, managed investment advice, or risk-free yield unless the source material explicitly supports it.
- If the product is technical, translate the mechanism into a user-visible consequence.
- Make the "aha moment" visual, not just verbal.

## Deck-To-Film Map

Use this map when adapting a pitch deck:

| Deck section | Film scene |
| --- | --- |
| Problem | Cold open: show the painful status quo |
| Market/timing | Why now: external shift or urgent behavior change |
| Product | First reveal: product in action |
| Differentiation | Contrast: old way vs new way |
| Traction/proof | Evidence beat: metric, demo, users, leaderboard, transaction, or case |
| Business model | Value capture: who pays and why |
| Team/founder fit | Human beat: why this team can win |
| Ask/CTA | Single next action |

If a deck section has no visual proof, turn it into voiceover or cut it.

## Output Contract

Return a concise production brief:

```text
Film format:
Viewer:
Single action:
Core promise:
Emotional tone:

Scene list:
1. [scene name] - [duration] - [visual] - [spoken/text claim] - [proof asset]
2. ...

Assets needed:
- Product screenshots/demo:
- Founder/team footage:
- Data/proof:
- Brand:

Production route:
- Fast: AI-generated concept film
- Controlled: Remotion/product-demo film
- Premium: hybrid live-action + product motion

Risks:
- Unsupported claims:
- Missing proof:
- Compliance-sensitive language:
```

## BeRight Defaults

When working in this repository, default the pitch to BeRight's current product shape:

- AI-native prediction market intelligence
- Cross-platform forecaster reputation
- Solana-linked forecast verification
- Leaderboard and calibration proof
- No retired vault, staking pool, delegation, or managed-capital pitch unless the user explicitly asks to revive it

Useful BeRight film angle:

```text
Prediction markets are noisy. BeRight turns scattered forecasters into a scored, verifiable reputation layer so users can see who is calibrated, who is active, and whose forecasts are worth following.
```

## Handoff

Use `marketing-video` after the brief if the user wants:

- a Remotion project
- an actual rendered video
- platform-specific cuts
- voiceover, music, or production execution

Use `video-craft` when the brief already exists and the task is to improve frames, screenshots, device mockups, scene composition, or CTA/end-card quality.
