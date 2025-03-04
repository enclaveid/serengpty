/**
 * This file is retained for backward compatibility but is no longer used
 * All user state is now handled server-side through server actions
 */

'use client';

import React, { createContext, useContext } from 'react';
import { useChat } from './ChatProvider';

// Legacy context type - kept for backward compatibility
interface ChatUserContextType {
  isLoading: boolean;
  unreadCounts: { [userId: string]: number };
  totalUnreadCount: number;
  error: Error | null;
}

const defaultContextValue: ChatUserContextType = {
  isLoading: true,
  unreadCounts: {},
  totalUnreadCount: 0,
  error: null,
};

const ChatUserContext = createContext<ChatUserContextType>(defaultContextValue);

// Adapter to convert new ChatContext interface to the old ChatUserContext interface
export const useChatUser = () => {
  const chatState = useChat();
  
  return {
    isLoading: chatState.isLoading,
    unreadCounts: chatState.unreadCounts,
    totalUnreadCount: chatState.totalUnreadCount,
    error: null,
  };
};

export default ChatUserContext;