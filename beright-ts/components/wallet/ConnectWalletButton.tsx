'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { useWallet } from './WalletContext';
import { truncateAddress } from '@/lib/ui-utils';

export function ConnectWalletButton() {
  const { address, isConnected, isConnecting, isReady, login, logout, user } = useWallet();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Loading state while Privy initializes
  if (!isReady) {
    return (
      <Button size="sm" disabled className="opacity-50">
        <span className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin mr-2" />
        Loading...
      </Button>
    );
  }

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="success" size="sm">Connected</Badge>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 rounded-lg text-sm text-white hover:bg-gray-700 transition-colors"
        >
          <span className="font-mono">{truncateAddress(address, 4)}</span>
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Wallet"
          size="sm"
        >
          <div className="space-y-4">
            {/* User info */}
            {user?.email && (
              <div className="p-3 bg-gray-900 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Signed in as</p>
                <p className="text-sm text-white">{user.email.address}</p>
              </div>
            )}

            {/* Wallet address */}
            <div className="p-3 bg-gray-900 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Wallet Address</p>
              <p className="font-mono text-sm text-white break-all">{address}</p>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigator.clipboard.writeText(address)}
                className="flex-1"
              >
                Copy Address
              </Button>
              <a
                href={`https://solscan.io/account/${address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1"
              >
                <Button variant="ghost" size="sm" className="w-full">
                  View on Solscan
                </Button>
              </a>
            </div>

            <Button
              variant="danger"
              onClick={async () => {
                await logout();
                setIsModalOpen(false);
              }}
              className="w-full"
            >
              Disconnect
            </Button>
          </div>
        </Modal>
      </div>
    );
  }

  return (
    <Button
      size="sm"
      onClick={login}
      disabled={isConnecting}
    >
      {isConnecting ? (
        <>
          <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
          Connecting...
        </>
      ) : (
        'Connect Wallet'
      )}
    </Button>
  );
}
