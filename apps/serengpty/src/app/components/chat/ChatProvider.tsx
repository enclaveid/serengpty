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
      setConversations([]);
      setMessages(new Map());
      return;
    }

    const chatService = getChatService();
    
    // Connect to chat
    let isMounted = true;
    chatService.connect()
      .then(() => {
        if (isMounted) {
          setIsConnected(true);
        }
      })
      .catch(error => {
        console.error("Failed to connect to chat service:", error);
        if (isMounted) {
          setIsConnected(false);
        }
      });

    // Set up listeners
    const conversationsListener = chatService.onConversationsUpdate((newConversations) => {
      if (isMounted) {
        setConversations(prev => {
          // Check if they're actually different to avoid unnecessary rerenders
          if (JSON.stringify(prev) === JSON.stringify(newConversations)) {
            return prev;
          }
          return newConversations;
        });
      }
    });

    // Cleanup
    return () => {
      isMounted = false;
      conversationsListener();
    };
  }, [user]);

  // Load messages for current conversation
  useEffect(() => {
    if (!currentConversation || !user) return;

    const chatService = getChatService();
    let isMounted = true;
    
    // Show loading state
    const loadingState: Message[] = [];
    setMessages(prev => {
      const newMessages = new Map(prev);
      newMessages.set(currentConversation, loadingState);
      return newMessages;
    });
    
    // Load initial messages
    chatService.getMessages(currentConversation)
      .then((conversationMessages) => {
        if (isMounted) {
          setMessages(prev => {
            const newMessages = new Map(prev);
            newMessages.set(currentConversation, conversationMessages);
            return newMessages;
          });
        }
      })
      .catch(error => {
        console.error("Error loading messages:", error);
        if (isMounted) {
          // Keep previous messages if there are any, or show empty
          setMessages(prev => {
            const existing = prev.get(currentConversation);
            if (existing && existing !== loadingState) {
              return prev;
            }
            const newMessages = new Map(prev);
            newMessages.set(currentConversation, []);
            return newMessages;
          });
        }
      });

    // Set up message listener
    const messageListener = chatService.onNewMessage(currentConversation, (newMessage) => {
      if (isMounted) {
        setMessages(prev => {
          const conversationMessages = prev.get(currentConversation) || [];
          // Prevent duplicate messages
          const isDuplicate = conversationMessages.some(
            msg => msg.id === newMessage.id || 
                 (msg.text === newMessage.text && 
                  msg.sender_id === newMessage.sender_id &&
                  msg.receiver_id === newMessage.receiver_id)
          );
          
          if (isDuplicate) {
            return prev;
          }
          
          const newMessages = new Map(prev);
          newMessages.set(currentConversation, [...conversationMessages, newMessage]);
          return newMessages;
        });
      }
    });

    // Mark as read when conversation is opened
    chatService.markAsRead(currentConversation).catch(error => {
      console.error("Error marking messages as read:", error);
    });

    return () => {
      isMounted = false;
      messageListener();
    };
  }, [currentConversation, user]);

  const sendMessage = async (receiverId: string, text: string): Promise<Message | null> => {
    if (!user) return null;
    const chatService = getChatService();
    const result = await chatService.sendMessage(receiverId, text);
    if (!result) {
      throw new Error("Failed to send message");
    }
    return result;
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