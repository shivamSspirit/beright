'use client';

import { useState, useEffect } from 'react';
import { useConversationStore, Conversation } from '@/stores/conversationStore';
import styles from '../beright.module.css';

interface ConversationSidebarProps {
  walletAddress: string | null;
  onConversationSelect?: (id: string) => void;
}

/**
 * ConversationSidebar - Shows chat history for the connected wallet
 * Allows switching between conversations and creating new ones
 */
export default function ConversationSidebar({
  walletAddress,
  onConversationSelect,
}: ConversationSidebarProps) {
  const {
    conversations,
    conversationsLoaded,
    activeConversationId,
    loadConversations,
    createConversation,
    setActiveConversation,
    updateConversation,
    deleteConversation,
    setWallet,
  } = useConversationStore();

  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  // Initialize store with wallet
  useEffect(() => {
    if (walletAddress) {
      setWallet(walletAddress);
      if (!conversationsLoaded) {
        loadConversations();
      }
    }
  }, [walletAddress, setWallet, loadConversations, conversationsLoaded]);

  // Create new conversation
  const handleNewConversation = async () => {
    if (!walletAddress) return;
    setIsCreating(true);
    try {
      const id = await createConversation();
      onConversationSelect?.(id);
    } catch (error) {
      console.error('Failed to create conversation:', error);
    } finally {
      setIsCreating(false);
    }
  };

  // Select conversation
  const handleSelect = (id: string) => {
    setActiveConversation(id);
    onConversationSelect?.(id);
  };

  // Toggle bookmark
  const handleToggleBookmark = async (e: React.MouseEvent, conv: Conversation) => {
    e.stopPropagation();
    await updateConversation(conv.id, { bookmarked: !conv.bookmarked });
  };

  // Start editing title
  const handleStartEdit = (e: React.MouseEvent, conv: Conversation) => {
    e.stopPropagation();
    setEditingId(conv.id);
    setEditTitle(conv.title || '');
  };

  // Save title
  const handleSaveTitle = async (id: string) => {
    if (editTitle.trim()) {
      await updateConversation(id, { title: editTitle.trim() });
    }
    setEditingId(null);
    setEditTitle('');
  };

  // Delete conversation
  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Delete this conversation?')) {
      await deleteConversation(id);
    }
  };

  // Format relative time
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Sort: pinned first, then bookmarked, then by date
  const sortedConversations = [...conversations].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (a.bookmarked !== b.bookmarked) return a.bookmarked ? -1 : 1;
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });

  if (!walletAddress) {
    return (
      <div className={styles.conversationSidebar}>
        <div className={styles.conversationEmpty}>
          Connect wallet to view history
        </div>
      </div>
    );
  }

  return (
    <div className={styles.conversationSidebar}>
      {/* Header */}
      <div className={styles.conversationHeader}>
        <span className={styles.conversationHeaderTitle}>CONVERSATIONS</span>
        <button
          className={styles.conversationNewBtn}
          onClick={handleNewConversation}
          disabled={isCreating}
          title="New conversation"
        >
          {isCreating ? '...' : '+'}
        </button>
      </div>

      {/* Conversation List */}
      <div className={styles.conversationList}>
        {!conversationsLoaded ? (
          <div className={styles.conversationEmpty}>Loading...</div>
        ) : sortedConversations.length === 0 ? (
          <div className={styles.conversationEmpty}>
            No conversations yet.
            <br />
            Start chatting to create one.
          </div>
        ) : (
          sortedConversations.map((conv) => (
            <div
              key={conv.id}
              className={`${styles.conversationItem} ${
                conv.id === activeConversationId ? styles.conversationItemActive : ''
              }`}
              onClick={() => handleSelect(conv.id)}
            >
              {/* Icons */}
              <div className={styles.conversationIcons}>
                {conv.pinned && <span title="Pinned">📌</span>}
                {conv.bookmarked && <span title="Bookmarked">⭐</span>}
              </div>

              {/* Title */}
              <div className={styles.conversationContent}>
                {editingId === conv.id ? (
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onBlur={() => handleSaveTitle(conv.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveTitle(conv.id);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    className={styles.conversationTitleInput}
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className={styles.conversationTitle}>
                    {conv.title || 'New conversation'}
                  </span>
                )}
                <span className={styles.conversationMeta}>
                  {conv.message_count} msgs · {formatTime(conv.updated_at)}
                </span>
              </div>

              {/* Actions */}
              <div className={styles.conversationActions}>
                <button
                  onClick={(e) => handleToggleBookmark(e, conv)}
                  className={styles.conversationActionBtn}
                  title={conv.bookmarked ? 'Remove bookmark' : 'Bookmark'}
                >
                  {conv.bookmarked ? '★' : '☆'}
                </button>
                <button
                  onClick={(e) => handleStartEdit(e, conv)}
                  className={styles.conversationActionBtn}
                  title="Rename"
                >
                  ✎
                </button>
                <button
                  onClick={(e) => handleDelete(e, conv.id)}
                  className={styles.conversationActionBtn}
                  title="Delete"
                >
                  ×
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
