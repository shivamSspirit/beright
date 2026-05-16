/**
 * DFlow WebSocket Client
 *
 * Real-time market updates for auto-resolution and price tracking
 */

import WebSocket from 'ws';
import { EventEmitter } from 'events';

const DFLOW_WS_URL = 'wss://dev-prediction-markets-api.dflow.net/ws';

export interface DFlowPriceUpdate {
  channel: 'prices';
  type: 'ticker';
  market_ticker: string;
  yes_bid: string;
  yes_ask: string;
  no_bid: string;
  no_ask: string;
}

export interface DFlowTradeUpdate {
  channel: 'trades';
  type: 'trade';
  market_ticker: string;
  price: number;
  side: 'yes' | 'no';
  size: number;
  timestamp: number;
}

export interface DFlowMarketStatus {
  ticker: string;
  status: 'initialized' | 'active' | 'inactive' | 'closed' | 'determined' | 'finalized';
  result?: 'yes' | 'no' | '';
}

type DFlowMessage = DFlowPriceUpdate | DFlowTradeUpdate | { type: string; [key: string]: unknown };

export class DFlowWebSocket extends EventEmitter {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private pingInterval: NodeJS.Timeout | null = null;
  private subscribedTickers: Set<string> = new Set();
  private isConnected = false;
  private apiKey?: string;

  constructor(apiKey?: string) {
    super();
    this.apiKey = apiKey || process.env.DFLOW_API_KEY;
  }

  /**
   * Connect to DFlow WebSocket
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const headers: Record<string, string> = {};
        if (this.apiKey) {
          headers['x-api-key'] = this.apiKey;
        }

        this.ws = new WebSocket(DFLOW_WS_URL, { headers });

        this.ws.on('open', () => {
          console.log('[DFlow WS] Connected');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.startPingInterval();

          // Resubscribe to previous tickers
          if (this.subscribedTickers.size > 0) {
            this.subscribeToPrices([...this.subscribedTickers]);
          }

          this.emit('connected');
          resolve();
        });

        this.ws.on('message', (data: WebSocket.Data) => {
          try {
            const message = JSON.parse(data.toString()) as DFlowMessage;
            this.handleMessage(message);
          } catch (err) {
            console.error('[DFlow WS] Failed to parse message:', err);
          }
        });

        this.ws.on('error', (error) => {
          console.error('[DFlow WS] Error:', error.message);
          this.emit('error', error);
          if (!this.isConnected) {
            reject(error);
          }
        });

        this.ws.on('close', (code, reason) => {
          console.log(`[DFlow WS] Disconnected: ${code} - ${reason}`);
          this.isConnected = false;
          this.stopPingInterval();
          this.emit('disconnected', { code, reason: reason.toString() });
          this.attemptReconnect();
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(message: DFlowMessage): void {
    switch (message.type) {
      case 'ticker':
        this.emit('price', message as DFlowPriceUpdate);
        break;
      case 'trade':
        this.emit('trade', message as DFlowTradeUpdate);
        break;
      case 'subscribed':
        console.log('[DFlow WS] Subscribed:', message);
        break;
      case 'pong':
        // Heartbeat response
        break;
      default:
        this.emit('message', message);
    }
  }

  /**
   * Subscribe to price updates for specific tickers
   */
  subscribeToPrices(tickers: string[]): void {
    if (!this.ws || !this.isConnected) {
      console.warn('[DFlow WS] Not connected, queuing subscription');
      tickers.forEach(t => this.subscribedTickers.add(t));
      return;
    }

    tickers.forEach(t => this.subscribedTickers.add(t));

    this.ws.send(JSON.stringify({
      type: 'subscribe',
      channel: 'prices',
      tickers,
    }));
  }

  /**
   * Subscribe to all price updates
   */
  subscribeToAllPrices(): void {
    if (!this.ws || !this.isConnected) {
      console.warn('[DFlow WS] Not connected');
      return;
    }

    this.ws.send(JSON.stringify({
      type: 'subscribe',
      channel: 'prices',
      all: true,
    }));
  }

  /**
   * Subscribe to trade updates
   */
  subscribeToTrades(tickers: string[]): void {
    if (!this.ws || !this.isConnected) {
      console.warn('[DFlow WS] Not connected');
      return;
    }

    this.ws.send(JSON.stringify({
      type: 'subscribe',
      channel: 'trades',
      tickers,
    }));
  }

  /**
   * Subscribe to orderbook updates
   */
  subscribeToOrderbook(tickers: string[]): void {
    if (!this.ws || !this.isConnected) {
      console.warn('[DFlow WS] Not connected');
      return;
    }

    this.ws.send(JSON.stringify({
      type: 'subscribe',
      channel: 'orderbook',
      tickers,
    }));
  }

  /**
   * Unsubscribe from a channel
   */
  unsubscribe(channel: 'prices' | 'trades' | 'orderbook', tickers?: string[]): void {
    if (!this.ws || !this.isConnected) return;

    if (channel === 'prices' && tickers) {
      tickers.forEach(t => this.subscribedTickers.delete(t));
    }

    this.ws.send(JSON.stringify({
      type: 'unsubscribe',
      channel,
      tickers,
    }));
  }

  /**
   * Start ping interval to keep connection alive
   */
  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      if (this.ws && this.isConnected) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000); // Ping every 30 seconds
  }

  /**
   * Stop ping interval
   */
  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Attempt to reconnect after disconnection
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[DFlow WS] Max reconnection attempts reached');
      this.emit('maxReconnectAttempts');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`[DFlow WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      this.connect().catch(err => {
        console.error('[DFlow WS] Reconnection failed:', err.message);
      });
    }, delay);
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    this.stopPingInterval();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.subscribedTickers.clear();
  }

  /**
   * Check if connected
   */
  get connected(): boolean {
    return this.isConnected;
  }
}

// Singleton instance
let wsInstance: DFlowWebSocket | null = null;

export function getDFlowWebSocket(): DFlowWebSocket {
  if (!wsInstance) {
    wsInstance = new DFlowWebSocket();
  }
  return wsInstance;
}

// CLI test
if (require.main === module) {
  const ws = new DFlowWebSocket();

  ws.on('connected', () => {
    console.log('Connected! Subscribing to all prices...');
    ws.subscribeToAllPrices();
  });

  ws.on('price', (update: DFlowPriceUpdate) => {
    console.log(`[PRICE] ${update.market_ticker}: YES ${update.yes_bid}/${update.yes_ask}`);
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err);
  });

  ws.connect().catch(console.error);

  // Keep running
  process.on('SIGINT', () => {
    console.log('Disconnecting...');
    ws.disconnect();
    process.exit(0);
  });
}
