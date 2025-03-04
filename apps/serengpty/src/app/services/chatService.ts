import { EventSourcePolyfill } from 'event-source-polyfill';
import { 
  getMessages as getMessagesAction, 
  sendMessage as sendMessageAction,
  markAsRead as markAsReadAction,
  getConversations as getConversationsAction,
  getCurrentUserId,
  type Message,
  type Conversation
} from '../actions/chatActions';

type MessageListener = (message: Message) => void;
type ConversationListener = (conversations: Conversation[]) => void;

class ChatService {
  private eventSource: EventSourcePolyfill | null = null;
  private messageListeners: Map<string, MessageListener[]> = new Map();
  private conversationListeners: ConversationListener[] = [];
  private conversations: Map<string, Message[]> = new Map();
  private isConnected = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectInterval = 2000; // Start with 2 seconds
  
  constructor() {
    // No longer storing user ID here
  }

  async connect(): Promise<void> {
    if (this.eventSource) {
      this.eventSource.close();
    }

    try {
      // Get current user ID from server
      const userId = await getCurrentUserId();
      if (!userId) {
        throw new Error('Not authenticated');
      }

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
            this.handleNewMessage(data.message);
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

      // Fetch initial conversations
      await this.fetchConversations();
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

  async fetchConversations(): Promise<Conversation[]> {
    try {
      const conversations = await getConversationsAction();
      this.notifyConversationListeners(conversations);
      return conversations;
    } catch (error) {
      console.error('Error fetching conversations:', error);
      return [];
    }
  }

  async getMessages(otherUserId: string): Promise<Message[]> {
    if (this.conversations.has(otherUserId)) {
      return this.conversations.get(otherUserId) || [];
    }

    try {
      const messages = await getMessagesAction(otherUserId);
      this.conversations.set(otherUserId, messages);
      return messages;
    } catch (error) {
      console.error('Error fetching messages:', error);
      return [];
    }
  }

  async sendMessage(receiverId: string, text: string): Promise<Message | null> {
    try {
      // Send to server using server action
      const confirmedMessage = await sendMessageAction(receiverId, text);
      
      // Once confirmed, add to local messages if the server didn't already send it via SSE
      if (confirmedMessage) {
        const existingMessages = this.conversations.get(receiverId) || [];
        const messageExists = existingMessages.some(
          msg => msg.id === confirmedMessage.id || 
                (msg.text === confirmedMessage.text && 
                 msg.sender_id === confirmedMessage.sender_id &&
                 msg.receiver_id === confirmedMessage.receiver_id)
        );
        
        if (!messageExists) {
          this.addMessageToConversation(receiverId, confirmedMessage);
        }
      }
      
      return confirmedMessage;
    } catch (error) {
      console.error('Error sending message:', error);
      return null;
    }
  }

  async markAsRead(otherUserId: string): Promise<void> {
    try {
      await markAsReadAction(otherUserId);
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  }

  private async handleNewMessage(message: Message): Promise<void> {
    try {
      // Get current user ID to determine conversation
      const userId = await getCurrentUserId();
      if (!userId) {
        return;
      }

      // Determine which conversation this belongs to
      const conversationId = message.sender_id === userId 
        ? message.receiver_id 
        : message.sender_id;

      // Add to local conversation
      this.addMessageToConversation(conversationId, message);
      
      // Notify listeners
      this.notifyMessageListeners(conversationId, message);
    } catch (error) {
      console.error('Error handling new message:', error);
    }
  }

  private addMessageToConversation(conversationId: string, message: Message): void {
    const currentMessages = this.conversations.get(conversationId) || [];
    this.conversations.set(conversationId, [...currentMessages, message]);
  }

  private notifyMessageListeners(conversationId: string, message: Message): void {
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