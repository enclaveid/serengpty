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
    
    // Handle connection establishing
    const connectChat = async () => {
      try {
        await chatService.connect();
      } catch (error) {
        console.error("Failed to connect to chat service:", error);
      }
    };
    
    connectChat();
    
    // Monitor connection status
    const handleConnectionStatus = (isConnected: boolean) => {
      if (!isMounted) return;
      setState(prev => ({ ...prev, isConnected }));
    };
    
    // Set up conversations listener with stable reference 
    const handleConversationsUpdate = (newConversations: Conversation[]) => {
      if (!isMounted) return;
      
      // Update conversations
      setState(prev => {
        // Calculate total unread count
        const totalUnreadCount = newConversations.reduce(
          (total, conv) => total + conv.unreadCount, 0
        );
        
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
    };
    
    // Set up listeners
    const connectionStatusListener = chatService.onConnectionStatus(handleConnectionStatus);
    const conversationsListener = chatService.onConversationsUpdate(handleConversationsUpdate);
    
    // Clean up on unmount
    return () => {
      isMounted = false;
      connectionStatusListener();
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
    const conversationId = state.currentConversation; // Create stable reference
    
    // Stable message handler function
    const handleNewMessage = (newMessage: Message) => {
      setState(prev => {
        const conversationMessages = prev.messages.get(conversationId) || [];
        
        // More robust duplicate detection using message ID first
        // Then fallback to content + metadata comparison
        if (newMessage.id) {
          // If message has ID, check for exact ID match first
          const exactIdMatch = conversationMessages.some(msg => msg.id === newMessage.id);
          if (exactIdMatch) return prev;
        }
        
        // Check for same content with same metadata (likely a duplicate)
        const contentMatch = conversationMessages.some(msg => 
          msg.text === newMessage.text && 
          msg.sender_id === newMessage.sender_id &&
          msg.receiver_id === newMessage.receiver_id &&
          // Allow 10 second window for creating timestamp to consider as duplicate
          Math.abs(new Date(msg.created_at).getTime() - new Date(newMessage.created_at).getTime()) < 10000
        );
        
        if (contentMatch) {
          return prev;
        }
        
        // Not a duplicate, add to messages
        const newMessages = new Map(prev.messages);
        newMessages.set(conversationId, [...conversationMessages, newMessage]);
        
        return {
          ...prev,
          messages: newMessages,
        };
      });
    };
    
    const messageListener = chatService.onNewMessage(conversationId, handleNewMessage);
    
    return () => {
      messageListener();
    };
  }, [state.currentConversation]);
  
  // Set current conversation
  const setCurrentConversation = async (userId: string | null) => {
    setState(prev => ({ ...prev, currentConversation: userId }));
    
    if (userId) {
      // Load messages for the new conversation
      await loadMessages(userId);
      
      // Unread logic is now handled in the ChatInterface useEffect
      // This prevents infinite loops of refreshChat -> setState -> markAsRead -> refreshChat
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
      const result = await markAsReadAction(otherUserId);
      
      // Only refresh if messages were actually marked as read
      if (result) {
        // Update unread counts without triggering another markAsRead cycle
        setState(prev => {
          const updatedUnreadCounts = { ...prev.unreadCounts };
          updatedUnreadCounts[otherUserId] = 0;
          
          const updatedTotalUnreadCount = Object.values(updatedUnreadCounts).reduce((sum, count) => sum + count, 0);
          
          return {
            ...prev,
            unreadCounts: updatedUnreadCounts,
            totalUnreadCount: updatedTotalUnreadCount
          };
        });
      }
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