'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { getChatService, resetChatService } from '../../services/chatService';
import { 
  sendMessage as sendMessageAction, 
  markAsRead as markAsReadAction,
  getChatMessages,
  getChatState,
  type Message, 
  type Conversation 
} from '../../actions/chatActions';

interface ChatContextType {
  isConnected: boolean;
  conversations: Conversation[];
  currentConversation: string | null;
  messages: Map<string, Message[]>;
  unreadCounts: { [userId: string]: number };
  totalUnreadCount: number;
  isLoading: boolean;
  setCurrentConversation: (userId: string | null) => void;
  sendMessage: (receiverId: string, text: string) => Promise<Message | null>;
  markAsRead: (otherUserId: string) => Promise<void>;
  refreshChat: () => Promise<void>;
}

const defaultContextValue: ChatContextType = {
  isConnected: false,
  conversations: [],
  currentConversation: null,
  messages: new Map(),
  unreadCounts: {},
  totalUnreadCount: 0,
  isLoading: true,
  setCurrentConversation: () => {},
  sendMessage: async () => null,
  markAsRead: async () => {},
  refreshChat: async () => {},
};

const ChatContext = createContext<ChatContextType>(defaultContextValue);

export const useChat = () => useContext(ChatContext);

interface ChatProviderProps {
  children: React.ReactNode;
}

export const ChatProvider: React.FC<ChatProviderProps> = ({ children }) => {
  const [state, setState] = useState<Omit<ChatContextType, 'setCurrentConversation' | 'sendMessage' | 'markAsRead' | 'refreshChat'>>({
    isConnected: false,
    conversations: [],
    currentConversation: null,
    messages: new Map(),
    unreadCounts: {},
    totalUnreadCount: 0,
    isLoading: true,
  });

  // Load initial chat state from server
  const loadChatState = async () => {
    try {
      const chatState = await getChatState();
      setState(prev => ({
        ...prev,
        ...chatState,
      }));
    } catch (error) {
      console.error("Error loading chat state:", error);
      setState(prev => ({
        ...prev,
        isLoading: false,
      }));
    }
  };

  // Refresh chat state - called after actions
  const refreshChat = async () => {
    await loadChatState();
    if (state.currentConversation) {
      await loadMessages(state.currentConversation);
    }
  };

  // Load messages for a conversation
  const loadMessages = async (userId: string) => {
    if (!userId) return;
    
    try {
      // Show loading state
      setState(prev => {
        const newMessages = new Map(prev.messages);
        newMessages.set(userId, []);
        return { ...prev, messages: newMessages };
      });
      
      // Get messages from server
      const messages = await getChatMessages(userId);
      
      setState(prev => {
        const newMessages = new Map(prev.messages);
        newMessages.set(userId, messages);
        return { ...prev, messages: newMessages };
      });
    } catch (error) {
      console.error("Error loading messages:", error);
    }
  };

  // Initialize chat service
  useEffect(() => {
    // Load initial state
    loadChatState();
    
    // Connect to chat service
    const chatService = getChatService();
    let isMounted = true;
    
    chatService.connect()
      .then(() => {
        if (isMounted) {
          setState(prev => ({ ...prev, isConnected: true }));
        }
      })
      .catch(error => {
        console.error("Failed to connect to chat service:", error);
      });
    
    // Set up listeners
    const conversationsListener = chatService.onConversationsUpdate((newConversations) => {
      if (isMounted) {
        // Update conversations
        setState(prev => {
          // Calculate total unread count
          const totalUnreadCount = newConversations.reduce((total, conv) => total + conv.unreadCount, 0);
          
          // Build unread counts by user
          const unreadCounts: { [userId: string]: number } = {};
          newConversations.forEach(conversation => {
            unreadCounts[conversation.user.id] = conversation.unreadCount;
          });
          
          return {
            ...prev,
            conversations: newConversations,
            unreadCounts,
            totalUnreadCount,
          };
        });
      }
    });
    
    // Clean up on unmount
    return () => {
      isMounted = false;
      conversationsListener();
      resetChatService();
    };
  }, []);
  
  // Load messages when current conversation changes
  useEffect(() => {
    if (!state.currentConversation) return;
    
    // Load messages for current conversation
    loadMessages(state.currentConversation);
    
    // Set up message listener for current conversation
    const chatService = getChatService();
    const messageListener = chatService.onNewMessage(state.currentConversation, (newMessage) => {
      setState(prev => {
        const conversationMessages = prev.messages.get(state.currentConversation!) || [];
        
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
        
        const newMessages = new Map(prev.messages);
        newMessages.set(state.currentConversation!, [...conversationMessages, newMessage]);
        
        return {
          ...prev,
          messages: newMessages,
        };
      });
    });
    
    return () => {
      messageListener();
    };
  }, [state.currentConversation]);
  
  // Set current conversation
  const setCurrentConversation = async (userId: string | null) => {
    setState(prev => ({ ...prev, currentConversation: userId }));
    
    if (userId) {
      // Mark as read when opening a conversation
      try {
        await markAsReadAction(userId);
        await refreshChat();
      } catch (error) {
        console.error("Error marking messages as read:", error);
      }
    }
  };
  
  // Send message
  const sendMessage = async (receiverId: string, text: string): Promise<Message | null> => {
    try {
      return await sendMessageAction(receiverId, text);
    } catch (error) {
      console.error("Error sending message:", error);
      return null;
    }
  };
  
  // Mark as read
  const markAsRead = async (otherUserId: string): Promise<void> => {
    try {
      await markAsReadAction(otherUserId);
      await refreshChat();
    } catch (error) {
      console.error("Error marking messages as read:", error);
    }
  };

  return (
    <ChatContext.Provider
      value={{
        ...state,
        setCurrentConversation,
        sendMessage,
        markAsRead,
        refreshChat,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export default ChatContext;