import { EventSourcePolyfill } from 'event-source-polyfill';
import { 
  type Message,
  type Conversation
} from '../actions/chatActions';

type MessageListener = (message: Message) => void;
type ConversationListener = (conversations: Conversation[]) => void;
type ConnectionStatusListener = (isConnected: boolean) => void;

/**
 * Client-side SSE handler for real-time chat
 * No user state is kept here - all user-specific operations
 * are handled by server actions directly
 */
class ChatService {
  private eventSource: EventSourcePolyfill | null = null;
  private messageListeners: Map<string, MessageListener[]> = new Map();
  private conversationListeners: ConversationListener[] = [];
  private connectionStatusListeners: ConnectionStatusListener[] = [];
  private isConnected = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectInterval = 2000; // Start with 2 seconds
  private autoReconnect = true;

  async connect(): Promise<void> {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
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
        this.notifyConnectionStatusListeners(true);
      };

      this.eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'message') {
            this.notifyMessageListeners(data.message);
          } else if (data.type === 'conversations') {
            this.notifyConversationListeners(data.conversations);
          } else if (data.type === 'heartbeat') {
            // Heartbeat received, connection is alive
            if (!this.isConnected) {
              this.isConnected = true;
              this.notifyConnectionStatusListeners(true);
            }
          }
        } catch (error) {
          console.error('Error processing message:', error);
        }
      };

      this.eventSource.onerror = (error) => {
        console.error('Chat connection error:', error);
        const wasConnected = this.isConnected;
        this.isConnected = false;
        
        if (wasConnected) {
          this.notifyConnectionStatusListeners(false);
        }
        
        if (this.autoReconnect) {
          this.handleDisconnect();
        }
      };
    } catch (error) {
      console.error('Failed to establish chat connection:', error);
      this.isConnected = false;
      this.notifyConnectionStatusListeners(false);
      
      if (this.autoReconnect) {
        this.handleDisconnect();
      }
    }
  }

  private handleDisconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      // Exponential backoff with max of 30 seconds
      const delay = Math.min(30000, this.reconnectInterval * Math.pow(1.5, this.reconnectAttempts - 1));
      
      this.clearReconnectTimer();
      this.reconnectTimer = setTimeout(() => {
        console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
        
        // Clear any existing event source
        if (this.eventSource) {
          this.eventSource.close();
          this.eventSource = null;
        }
        
        // Attempt to reconnect
        this.connect().catch(err => {
          console.error("Reconnection attempt failed:", err);
          this.handleDisconnect();
        });
      }, delay);
    } else {
      console.error("Max reconnection attempts reached. Chat connection lost.");
      // Reset reconnect attempts after a longer delay
      this.clearReconnectTimer();
      this.reconnectTimer = setTimeout(() => {
        this.reconnectAttempts = 0;
        this.handleDisconnect();
      }, 60000); // Try again after 1 minute
    }
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  disconnect(): void {
    this.autoReconnect = false;
    
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    
    this.isConnected = false;
    this.notifyConnectionStatusListeners(false);
    this.clearReconnectTimer();
    this.messageListeners.clear();
    this.conversationListeners = [];
    this.connectionStatusListeners = [];
  }

  private notifyMessageListeners(message: Message): void {
    // Message can be received from either the sender or receiver
    // Need to notify both conversation IDs (sender_id and receiver_id)
    const senderListeners = this.messageListeners.get(message.sender_id) || [];
    const receiverListeners = this.messageListeners.get(message.receiver_id) || [];
    
    // Notify listeners for both conversations
    senderListeners.forEach(listener => listener(message));
    receiverListeners.forEach(listener => listener(message));
  }

  private notifyConversationListeners(conversations: Conversation[]): void {
    this.conversationListeners.forEach(listener => listener(conversations));
  }
  
  private notifyConnectionStatusListeners(isConnected: boolean): void {
    this.connectionStatusListeners.forEach(listener => listener(isConnected));
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
  
  onConnectionStatus(listener: ConnectionStatusListener): () => void {
    this.connectionStatusListeners.push(listener);
    
    // Immediately notify of current status
    listener(this.isConnected);
    
    // Return unsubscribe function
    return () => {
      this.connectionStatusListeners = this.connectionStatusListeners.filter(l => l !== listener);
    };
  }
  
  getConnectionStatus(): boolean {
    return this.isConnected;
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