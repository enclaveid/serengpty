'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useChatUser } from './ChatUserContext';
import { getChatService, resetChatService } from '../../services/chatService';
import type { Message, Conversation } from '../../actions/chatActions';

interface ChatContextType {
  isConnected: boolean;
  conversations: Conversation[];
  currentConversation: string | null;
  messages: Map<string, Message[]>;
  setCurrentConversation: (userId: string | null) => void;
  sendMessage: (receiverId: string, text: string) => Promise<Message | null>;
  markAsRead: (otherUserId: string) => Promise<void>;
}

const defaultContextValue: ChatContextType = {
  isConnected: false,
  conversations: [],
  currentConversation: null,
  messages: new Map(),
  setCurrentConversation: () => {},
  sendMessage: async () => null,
  markAsRead: async () => {},
};

const ChatContext = createContext<ChatContextType>(defaultContextValue);

export const useChat = () => useContext(ChatContext);

interface ChatProviderProps {
  children: React.ReactNode;
}

export const ChatProvider: React.FC<ChatProviderProps> = ({ children }) => {
  const { user } = useChatUser();
  const [isConnected, setIsConnected] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Map<string, Message[]>>(new Map());

  // Initialize chat when user changes
  useEffect(() => {
    if (!user) {
      resetChatService();
      setIsConnected(false);
      return;
    }

    const chatService = getChatService();
    
    // Connect to chat
    chatService.connect().then(() => {
      setIsConnected(true);
    });

    // Set up listeners
    const conversationsListener = chatService.onConversationsUpdate((newConversations) => {
      setConversations(newConversations);
    });

    // Cleanup
    return () => {
      conversationsListener();
    };
  }, [user]);

  // Load messages for current conversation
  useEffect(() => {
    if (!currentConversation || !user) return;

    const chatService = getChatService();
    
    // Load initial messages
    chatService.getMessages(currentConversation).then((conversationMessages) => {
      setMessages(prev => {
        const newMessages = new Map(prev);
        newMessages.set(currentConversation, conversationMessages);
        return newMessages;
      });
    });

    // Set up message listener
    const messageListener = chatService.onNewMessage(currentConversation, (newMessage) => {
      setMessages(prev => {
        const conversationMessages = prev.get(currentConversation) || [];
        const newMessages = new Map(prev);
        newMessages.set(currentConversation, [...conversationMessages, newMessage]);
        return newMessages;
      });
    });

    // Mark as read when conversation is opened
    chatService.markAsRead(currentConversation);

    return () => {
      messageListener();
    };
  }, [currentConversation, user]);

  const sendMessage = async (receiverId: string, text: string): Promise<Message | null> => {
    if (!user) return null;
    const chatService = getChatService();
    return chatService.sendMessage(receiverId, text);
  };

  const markAsRead = async (otherUserId: string): Promise<void> => {
    if (!user) return;
    const chatService = getChatService();
    return chatService.markAsRead(otherUserId);
  };

  return (
    <ChatContext.Provider
      value={{
        isConnected,
        conversations,
        currentConversation,
        messages,
        setCurrentConversation,
        sendMessage,
        markAsRead,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export default ChatContext;