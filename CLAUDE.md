# BeRight Protocol - Claude Code Instructions

## Project Overview
BeRight is a prediction market intelligence platform with Telegram bot integration, arbitrage monitoring, and forecasting tools.

---

## OpenClaw Agent Technology (CRITICAL)

BeRight runs on OpenClaw's AI agent architecture. These principles guide all agent behavior.

### Core Files (The Agent's "Brain")

| File | Purpose |
|------|---------|
| `SOUL.md` | Agent personality, values, voice, boundaries |
| `IDENTITY.md` | Who the agent is, capabilities, architecture |
| `HEARTBEAT.md` | Dynamic status, pending signals, goals (auto-updated) |
| `MEMORY.md` | Synced lessons, episodic memory |
| `AGENTS.md` | Multi-agent roster and routing |
| `TOOLS.md` | Skills execution reference |

### Two-Tier Pattern (ALWAYS FOLLOW)

```
Tier 1: DETERMINISTIC (fast, free)
├── Fetch market data from APIs
├── Aggregate news/social signals
├── Calculate spreads/arbitrage
└── Return raw structured data

Tier 2: LLM REASONING (when needed)
├── Synthesize all Tier 1 data
├── Apply superforecaster methodology
├── Generate probability estimates
└── Identify trading edge
```

**Rule**: Always do Tier 1 first. Only call LLM (Tier 2) when synthesis/reasoning is needed.

### Agent Persona Principles

**Authenticity over performance**: Skip "Great question!" and "I'd be happy to help!" — just help.

**Personality as asset**: Hold perspectives, disagree when warranted, display preferences. Avoid being a "search engine with extra steps."

**Proactive problem-solving**: Try to figure it out. Read the file. Check the context. Search for it. Resourcefulness precedes requests for clarification.

**Competence builds trust**: Careful with external actions, bold with internal reasoning.

**Concise when needed, thorough when it matters**: Match depth to complexity.

### Cognitive Loop (Heartbeat)

Every 30 minutes, the agent runs:
```
PERCEIVE → UPDATE BELIEFS → DELIBERATE → ACT → REFLECT
```

1. **Perceive**: Gather signals from markets, news, whales
2. **Update Beliefs**: Integrate new observations
3. **Deliberate**: Decide what to pursue (goals)
4. **Act**: Execute skills
5. **Reflect**: Learn from outcomes, update calibration

### Memory System

- **Episodic Memory**: `memory/episodes.json` - Past actions and outcomes
- **Daily Logs**: `memory/daily/YYYY-MM-DD.md` - Timestamped activity
- **Lessons Learned**: Synced to `MEMORY.md` for persistence

**After significant actions**: Call `recordEpisode()` and `syncToOpenClawMemory()`.

### Multi-Agent Coordination

| Agent | Role | When to Use |
|-------|------|-------------|
| **Scout** | Fast scanning, arb detection | Quick market checks, trends |
| **Analyst** | Deep research, probability | Complex questions, synthesis |
| **Trader** | Execution, risk management | Trade quotes, position sizing |

**Routing Rule**: Match task complexity to agent. Scout for speed, Analyst for depth.

### Fixing Common Issues

**Bot doesn't understand context**:
→ Check `lib/intentClassifier.ts` patterns
→ Add regex for missing phrases
→ Test with `classifyIntent()` directly

**Research returns raw data without synthesis**:
→ Ensure `synthesizeResearch()` is called (Tier 2)
→ Check Groq API key is set
→ Verify `lib/synthesis/researchSynthesis.ts` integration

**Tavily API limit errors**:
→ `deepResearch()` uses premium Tavily Research API
→ Add try-catch fallback to `research()` (we did this)
→ Check Tavily credit allocation

**Agent persona feels robotic**:
→ Update SOUL.md with more personality
→ Check telegramHandler response formatting
→ Add conversational patterns to intent classifier

---

## Viral Product Strategy (MUST READ BEFORE BUILDING)

**Source:** [Nikita Bier's Thread](https://x.com/nikitabier/status/1481118406749220868) - Creator of TBH (acquired by Facebook) & Gas (acquired by Discord)

> "After 10 years of building consumer social apps, I've decided to start exploring new areas. Building these products is an unforgiving grind—but I learned a lot along the way."

### ALWAYS APPLY THESE PRINCIPLES WHEN BUILDING:

#### Testing & Process
- **A reproducible testing process > any one idea.** A team with more shots at bat wins against a team with an audacious vision.
- **Most product ideas are Dead On Arrival** because conditions to derive value are impossible to orchestrate.
- **Getting 7 adult friends to install an app on a reproducible basis is a bigger idea than your original concept.**
- If it's been 6 months without testing on an external audience, you're in for a rude awakening.
- **Fix your testing tactics first** — inconclusive tests slow teams down more than anything.

#### Audience & Distribution
- **Don't be embarrassed to have a narrow target audience.** All big things grow from small wedges in the market.
- If you need to launch nationwide to test, it's not a good test — you'll exhaust your audience's attention prematurely.
- **If your product works in one community, it should work in all of them.**
- **Audiences with obsessive behavior (gamers, teens, hobbyists, TRADERS) are the best beachhead** for new products.
- Social products rarely take off among older audiences. Our habits become immutable as we exit formative years.

#### Growth & Virality
- **People and content on an app always trump slick design.** Focus on network effects and solving the "cold start" problem first.
- **Filter product ideas by:** (1) Do you have a distribution channel? (2) Can they grow?
- **Habit formation requires recurring organic exposure on other networks.** After install, users need to see your content elsewhere to be reminded (TikTok videos on Instagram, etc.)
- **Positive feedback loops are necessary for escape velocity.** Aim for each session to trigger 7 new people to open your app.
- **Be unapologetic about marketing to your first users** — it's the only way to push through App Store noise.

#### Product Direction
- **People download apps to solve core human needs:**
  1. Finding love
  2. Making or saving money (← BeRight fits here!)
  3. Play
- **Never build an app to "meetup with friends."**
- **Target a specific life inflection point** when urgency to solve a problem is most acute:
  - Facebook → starting at a school
  - LinkedIn → getting your 1st job
  - Slack → starting a company
  - **BeRight → wanting to make money from predictions/markets**
- **If your product offends someone, it's probably one version away from something special.**
- If your product requires a "partnership", run.
- **If you can't use your app from the toilet or while distracted, users will have few opportunities to form a habit.**

#### Competition & Reality
- **Don't worry about incumbents** — incumbent advantage is frequently overstated. Well-crafted products with unique distribution channels can take the world by storm in days.
- Every blockbuster product is an outlier that may have been luck or timing.
- **Get to know your user better than anyone else and trust your instincts.**

---

### HOW TO APPLY TO BERIGHT:

When building ANY new feature, ask yourself:

| Question | Action |
|----------|--------|
| Can this be tested in one community first? | Start with one Telegram group, not everyone |
| Does this help users make/save money? | If not, deprioritize it |
| Can users use this from the toilet? | Keep it simple, mobile-first |
| Does this create a feedback loop? | Each action should trigger more engagement |
| Will users see BeRight content on other platforms? | Build shareable outputs (screenshots, alerts) |
| Does this solve a problem at a life inflection point? | Target new traders, people entering prediction markets |

---

## Skills

### /pitch - Pitch Deck Creator

You are an expert pitch deck creator. When asked to create a pitch deck, follow this proven 12-slide structure. For each slide, generate compelling content and apply the associated tips.

**IMPORTANT:** Always ask for project details first before generating the deck. Required info:
- Project/Company name
- One-liner description
- Problem being solved
- Target market
- Business model
- Current traction (if any)
- Team background

#### PITCH DECK STRUCTURE

**Slide 1: INTRO/HOOK**
- Content: Project name, logo, your name/photo/role. One-liner describing "What we do." Bold opening to intrigue.
- Tips: Set emotional tone (relaxed, confident). Use branding. Create a 15-second hook. Surprise with data.

**Slide 2: PROBLEM**
- Content: Clear, relatable pain point. Impact on users/market. Back with data.
- Tips: Focus on "before you existed." Make it urgent/mission-driven. Use images to evoke feeling.

**Slide 3: SOLUTION/VALUE PROP**
- Content: Transition with "That's why we built [project]." One sentence on what it offers. 2-3 key features.
- Tips: Natural flow from problem. Emphasize uniqueness.

**Slide 4-5: FEATURES/UX**
- Content: Dive into 2-3 features. Quick product tour (embed mini-demo).
- Tips: Show screenshots in mockups. Highlight user flow.

**Slide 6: TECHNOLOGY**
- Content: Architecture, integrations, backend setup. Key challenges solved.
- Tips: Keep accessible—balance tech depth with audience knowledge.

**Slide 7: MARKET**
- Content: Specific target users. Compare to famous apps.
- Tips: Avoid vague billions; be niche and credible. Imply growth potential.

**Slide 8: BUSINESS MODEL**
- Content: Simple explanation of how you make money (fees, ads, subscriptions).
- Tips: Clear, not complex. Show sustainability.

**Slide 9: TRACTION/GROWTH**
- Content: Metrics (users, transactions—show upward graphs). Testimonials, waitlists, partnerships. 3 clear acquisition channels.
- Tips: Quantitative (numbers up) + Qualitative (social proof). Build in parallel to pitching.

**Slide 10: ROADMAP**
- Content: Future milestones with real dates/timeline.
- Tips: Use future tense here only. Show certainty in growth.

**Slide 11: TEAM**
- Content: Members, key achievements. Advisors/partners.
- Tips: Highlight why you're equipped to deliver.

**Slide 12: CALL TO ACTION**
- Content: Link to demo, site, or next steps. Contact info.
- Tips: Tease more—invite deeper engagement.

#### OUTPUT FORMAT
When creating a pitch deck, output each slide with:
1. **Slide number and title**
2. **Suggested headline text**
3. **Bullet points / key content**
4. **Speaker notes** (what to say when presenting)
5. **Visual suggestions** (images, charts, mockups to include)

Make content punchy, investor-ready, and emotionally compelling.
