import { EventSourcePolyfill } from 'event-source-polyfill';
import { 
  type Message,
  type Conversation
} from '../actions/chatActions';

type MessageListener = (message: Message) => void;
type ConversationListener = (conversations: Conversation[]) => void;

/**
 * Client-side SSE handler for real-time chat
 * No user state is kept here - all user-specific operations
 * are handled by server actions directly
 */
class ChatService {
  private eventSource: EventSourcePolyfill | null = null;
  private messageListeners: Map<string, MessageListener[]> = new Map();
  private conversationListeners: ConversationListener[] = [];
  private isConnected = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectInterval = 2000; // Start with 2 seconds

  async connect(): Promise<void> {
    if (this.eventSource) {
      this.eventSource.close();
    }

    try {
      // Create SSE connection
      this.eventSource = new EventSourcePolyfill(`/api/chat/sse`, {
        withCredentials: true,
        heartbeatTimeout: 60000,
      });

      this.eventSource.onopen = () => {
        console.log('Chat connection established');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.clearReconnectTimer();
      };

      this.eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'message') {
            this.notifyMessageListeners(data.message);
          } else if (data.type === 'conversations') {
            this.notifyConversationListeners(data.conversations);
          }
        } catch (error) {
          console.error('Error processing message:', error);
        }
      };

      this.eventSource.onerror = (error) => {
        console.error('Chat connection error:', error);
        this.isConnected = false;
        this.handleDisconnect();
      };
    } catch (error) {
      console.error('Failed to establish chat connection:', error);
      this.handleDisconnect();
    }
  }

  private handleDisconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(30000, this.reconnectInterval * Math.pow(1.5, this.reconnectAttempts - 1));
      
      this.clearReconnectTimer();
      this.reconnectTimer = setTimeout(() => {
        console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
        
        // Clear any existing event source
        if (this.eventSource) {
          this.eventSource.close();
          this.eventSource = null;
        }
        
        // Reset state to avoid stale data
        this.isConnected = false;
        
        // Attempt to reconnect
        this.connect().catch(err => {
          console.error("Reconnection attempt failed:", err);
          this.handleDisconnect();
        });
      }, delay);
    } else {
      console.error("Max reconnection attempts reached. Chat connection lost.");
    }
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.isConnected = false;
    this.clearReconnectTimer();
    this.messageListeners.clear();
    this.conversationListeners = [];
  }

  private notifyMessageListeners(message: Message): void {
    // Determine conversation ID from the message
    const conversationId = message.sender_id;
    
    // Notify listeners for this conversation
    const listeners = this.messageListeners.get(conversationId) || [];
    listeners.forEach(listener => listener(message));
  }

  private notifyConversationListeners(conversations: Conversation[]): void {
    this.conversationListeners.forEach(listener => listener(conversations));
  }

  onNewMessage(conversationId: string, listener: MessageListener): () => void {
    const listeners = this.messageListeners.get(conversationId) || [];
    listeners.push(listener);
    this.messageListeners.set(conversationId, listeners);
    
    // Return unsubscribe function
    return () => {
      const updatedListeners = this.messageListeners.get(conversationId) || [];
      this.messageListeners.set(
        conversationId,
        updatedListeners.filter(l => l !== listener)
      );
    };
  }

  onConversationsUpdate(listener: ConversationListener): () => void {
    this.conversationListeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      this.conversationListeners = this.conversationListeners.filter(l => l !== listener);
    };
  }
}

// Service instance cache
let chatServiceInstance: ChatService | null = null;

export const getChatService = (): ChatService => {
  if (!chatServiceInstance) {
    chatServiceInstance = new ChatService();
  }
  return chatServiceInstance;
};

export const resetChatService = (): void => {
  if (chatServiceInstance) {
    chatServiceInstance.disconnect();
    chatServiceInstance = null;
  }
};