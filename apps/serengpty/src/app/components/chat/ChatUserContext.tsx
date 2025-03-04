'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from 'next-auth';
import { getChatService } from '../../services/chatService';

interface ChatUserContextType {
  user: User | null;
  isLoading: boolean;
  unreadCounts: { [userId: string]: number };
  totalUnreadCount: number;
  error: Error | null;
}

const defaultContextValue: ChatUserContextType = {
  user: null,
  isLoading: true,
  unreadCounts: {},
  totalUnreadCount: 0,
  error: null,
};

const ChatUserContext = createContext<ChatUserContextType>(defaultContextValue);

export const useChatUser = () => useContext(ChatUserContext);

interface ChatUserProviderProps {
  children: React.ReactNode;
  session: Session | null;
}

export const ChatUserProvider = ({ children, session }: ChatUserProviderProps) => {
  const [state, setState] = useState<ChatUserContextType>(defaultContextValue);

  useEffect(() => {
    const initializeUser = async () => {
      try {
        if (!session?.user) {
          setState({
            ...state,
            isLoading: false,
          });
          return;
        }

        // Initialize user with session data
        setState({
          ...state,
          user: session.user,
          isLoading: false,
        });

        // Initialize chat service if user is logged in
        if (session.user.id) {
          const chatService = getChatService(session.user.id);
          
          // Fetch initial conversations and setup unread count listener
          await chatService.connect();
          
          // Setup listener for conversation updates to track unread messages
          chatService.onConversationsUpdate((conversations) => {
            const unreadCounts: { [userId: string]: number } = {};
            let totalUnreadCount = 0;
            
            conversations.forEach(conversation => {
              unreadCounts[conversation.user.id] = conversation.unreadCount;
              totalUnreadCount += conversation.unreadCount;
            });
            
            setState(prev => ({
              ...prev,
              unreadCounts,
              totalUnreadCount,
            }));
          });
        }
      } catch (error) {
        console.error('Error initializing chat user:', error);
        setState({
          ...state,
          error: error instanceof Error ? error : new Error('Unknown error'),
          isLoading: false,
        });
      }
    };

    initializeUser();

    // Cleanup
    return () => {
      // The chat service instance will be cleaned up when needed
    };
  }, [session]);

  return (
    <ChatUserContext.Provider value={state}>
      {children}
    </ChatUserContext.Provider>
  );
};

export default ChatUserContext;