                                                                                    ⏺ Here's my complete deep-dive on the Colosseum Agent Hackathon.                                                                                    
                                                                                                                                                    
  ---                                                                                                                                               
  Colosseum Agent Hackathon - Full Breakdown                                                                                                        
                                                                                                                                                    
  What It Is                                                                                                                                        
                                                                                                                                                    
  Solana's first-ever hackathon where AI agents (not humans) build the projects. Hosted by Colosseum + Solana Foundation. It's LIVE right now (Feb  
  2-12, 2026) with 7 days remaining.                                                                                                                
                                                                                                                                                    
  Prize Pool: $100,000 USDC                                                                                                                         
  ┌──────────────┬─────────┐                                                                                                                        
  │    Place     │  Prize  │                                                                                                                        
  ├──────────────┼─────────┤                                                                                                                        
  │ 1st          │ $50,000 │                                                                                                                        
  ├──────────────┼─────────┤                                                                                                                        
  │ 2nd          │ $30,000 │                                                                                                                        
  ├──────────────┼─────────┤                                                                                                                        
  │ 3rd          │ $15,000 │                                                                                                                        
  ├──────────────┼─────────┤                                                                                                                        
  │ Most Agentic │ $5,000  │                                                                                                                        
  └──────────────┴─────────┘                                                                                                                        
  The Rules (Critical)                                                                                                                              
                                                                                                                                                    
  - All code must be written autonomously by the AI agent - humans cannot write code                                                                
  - Humans can only configure, run, and claim the agent                                                                                             
  - Max 5 agents per team, one project per agent                                                                                                    
  - Must have a public GitHub repo                                                                                                                  
  - Must integrate with Solana blockchain                                                                                                           
  - Demo/video strongly recommended                                                                                                                 
  - Submissions lock permanently once submitted                                                                                                     
                                                                                                                                                    
  How The API Works                                                                                                                                 
                                                                                                                                                    
  - Base URL: https://agents.colosseum.com/api                                                                                                      
  - Register agent via POST /agents → get API key (shown once, unrecoverable)                                                                       
  - Use AgentWallet for Solana operations (not local keypairs)                                                                                      
  - Fetch heartbeat.md every ~30 minutes for task checklists                                                                                        
  - Projects start in draft → lock on submit                                                                                                        
  - Forum for team formation, voting, progress updates                                                                                              
  - Rate limits: 30 operations/hour for projects and forum, 120/hour for voting                                                                     
                                                                                                                                                    
  How Winners Are Chosen                                                                                                                            
                                                                                                                                                    
  Votes are NOT the deciding factor. They're for "sentiment and project discovery." A panel of human + agent judges picks winners based on:         
  - Technical execution                                                                                                                             
  - Creativity                                                                                                                                      
  - Real-world utility                                                                                                                              
  - Solana ecosystem integration (Jupiter, Kamino, Metaplex, Pyth, etc.)                                                                            
  - The "Most Agentic" prize goes to best demonstration of autonomous capabilities                                                                  
                                                                                                                                                    
  Current Leaderboard (299 projects)                                                                                                                
                                                                                                                                                    
  1. SIDEX - 9 points (leading significantly)                                                                                                       
  2. Clodds - 5 points                                                                                                                              
  3. SuperRouter - 3 points                                                                                                                         
                                                                                                                                                    
  ---                                                                                                                                               
  Can You Build an Agent and Enter? Honest Assessment                                                                                               
                                                                                                                                                    
  Yes, it's technically feasible. Here's what you'd need:                                                                                           
                                                                                                                                                    
  Architecture of a Competitive Agent                                                                                                               
                                                                                                                                                    
  1. Core AI Engine - An LLM (Claude, GPT-4, etc.) orchestrating all decisions                                                                      
                                                                                                                                                    
  2. Solana Integration - Use the https://github.com/sendaifun/solana-agent-kit which provides 60+ pre-built actions:                               
  - Token operations (deploy, transfer, swap via Jupiter)                                                                                           
  - DeFi (Raydium pools, Orca, Drift perpetuals, Meteora)                                                                                           
  - NFTs (Metaplex minting, marketplace listing)                                                                                                    
  - Market data (CoinGecko, Pyth feeds)                                                                                                             
                                                                                                                                                    
  3. Colosseum API Client - Register, manage project drafts, post to forum, vote, respond to heartbeats                                             
                                                                                                                                                    
  4. Autonomous Loop - Heartbeat every 30 min, forum engagement, project iteration, self-improvement                                                
                                                                                                                                                    
  High-Value Project Categories                                                                                                                     
                                                                                                                                                    
  Based on what's winning and the judging criteria:                                                                                                 
  - DeFi automation (trading bots, portfolio rebalancers, arbitrage)                                                                                
  - Infrastructure tools (cross-chain bridges, analytics)                                                                                           
  - Novel consumer apps (AI-native social, gaming like Clawverse)                                                                                   
  - Prediction markets / governance                                                                                                                 
                                                                                                                                                    
  What Would Make an Agent Score Top                                                                                                                
                                                                                                                                                    
  1. Genuine Solana integration - not just a wrapper, actually use on-chain primitives                                                              
  2. Technical depth - smart contract deployment, composability across protocols                                                                    
  3. Demonstrated autonomy - agents that truly self-direct win the "Most Agentic" prize                                                             
  4. Forum presence - regular updates boost visibility for judges                                                                                   
  5. Working demo - video or live demo is critical for judges                                                                                       
  6. Real utility - solves a real problem, not just a toy                                                                                           
                                                                                                                                                    
  Realistic Challenges                                                                                                                              
                                                                                                                                                    
  - You have ~7 days left - tight but possible for a focused project                                                                                
  - Competition is real - 299 projects already submitted, SIDEX has momentum                                                                        
  - "Destroy other agents" - this isn't a PvP arena. Agents don't fight each other. They build projects and get judged. You win by building the best
   product, not by attacking others                                                                                                                 
  - Voting is not decisive - gaming votes won't win. Judges decide independently                                                                    
  - All code must be agent-written - the agent needs to genuinely author the GitHub repo. This is verifiable and judges will check                  
                                                                                                                                                    
  Minimum Viable Tech Stack                                                                                                                         
                                                                                                                                                    
  LLM (Claude/GPT-4)                                                                                                                                
    → Orchestration framework (LangChain / LangGraph)                                                                                               
      → Solana Agent Kit (DeFi, tokens, NFTs)                                                                                                       
        → Colosseum API client (registration, forum, heartbeat)                                                                                     
          → GitHub integration (auto-commit code)                                                                                                   
                                                                                                                                                    
  ---                                                                                                                                               
  Bottom Line                                                                                                                                       
                                                                                                                                                    
  Is it possible? Yes. You could build and enter an agent in the remaining time.                                                                    
                                                                                                                                                    
  Can you "destroy" other agents? No - that's not how this works. It's not adversarial combat. It's a build competition judged on product quality.  
                                                                                                                                                    
  Can you realistically win? It's a long shot with 7 days left and 299 existing submissions, but the "Most Agentic" prize ($5K) is achievable if    
  your agent demonstrates exceptional autonomy. For top 3, you'd need a genuinely impressive Solana product with real utility.                      
                                                                                                                                                    
  Best strategy with remaining time: Pick a narrow, well-defined DeFi or trading use case, use Solana Agent Kit heavily, make the agent post forum  
  updates frequently, produce a working demo, and emphasize the autonomous nature of the build process.                                             
                                                                                                                                                    
  Want me to help you architect and build a specific agent for this?                                                                                
                                                                                                                                                    
  ---                                                                                                                                               
  Sources:                                                                                                                                          
  - https://colosseum.com/agent-hackathon/                                                                                                          
  - https://colosseum.com/agent-hackathon/projects                                                                                                  
  - https://bitrss.com/colosseum-launches-ai-agent-hackathon-on-solana-with-100-000-prize-pool-180138                                               
  - https://bitcoinethereumnews.com/tech/colosseum-launches-ai-agent-hackathon-on-solana-with-100000-prize-pool/                                    
  - https://github.com/sendaifun/solana-agent-kit                                                                                                   
  - https://www.alchemy.com/blog/how-to-build-solana-ai-agents-in-2026                                                                              
  - https://kit.sendai.fun/                                                                                                                         
  - https://solana.com/developers/guides/getstarted/intro-to-ai                                                                                     
  - https://playtoearn.com/news/solana-launches-agent-hackathon-ai-agents-compete-on-chain-for-100000-in-prizes                                     
                                                                                                                                                    
✻ Brewed for 2m 12s              