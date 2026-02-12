Done! Solana Wallet Plugin installed.                                                      
                                                                                             
  ✅ Plugin: solana-wallet v0.1.0                                                            
  ✅ Status: Enabled (restart required)                                                      
                                                                                             
  To activate, restart the OpenClaw gateway:                                                 
  # Kill existing gateway (if running)                                                       
  pkill -f "openclaw gateway" || true                                                        
                                                                                             
  # Start fresh                                                                              
  openclaw gateway                                                                           
                                                                                             
  Then you'll have these tools:                                                              
  - solana_wallet - Create wallet, check balance                                             
  - solana_swap - Jupiter token swaps                                                        
  - solana_scan - Find trading opportunities                                                 
                                                                                             
  Config needed in .env:                                                                     
  SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY                            
  SOLANA_WALLET_PATH=~/.openclaw/workspace/solana-wallet.json                                
                                                                  