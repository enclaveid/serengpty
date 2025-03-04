import { NextRequest } from 'next/server';
import { getCurrentUser } from '../../../actions/getCurrentUser';

// Map of open connections by userId
const connectedClients = new Map<string, Set<ResponseSender>>();

// Typed interface for messages
export interface ChatMessage {
  type: string;
  message?: any;
  conversations?: any[];
  timestamp?: string;
}

export type ResponseSender = (data: string) => void;

export async function GET(request: NextRequest) {
  // Authentication
  const currentUser = await getCurrentUser();
  if (!currentUser?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const userId = currentUser.id;
  
  // Create a text/event-stream response
  const responseStream = new ReadableStream({
    start(controller) {
      // Register this connection
      if (!connectedClients.has(userId)) {
        connectedClients.set(userId, new Set());
      }
      
      // Create a function that will send messages to this client
      const sendMessage = (data: string) => {
        try {
          controller.enqueue(new TextEncoder().encode(`data: ${data}\n\n`));
        } catch (error) {
          console.error(`Failed to send message to client: ${error}`);
          // Remove this client as it's likely disconnected
          cleanupClient(userId, sendMessage);
        }
      };
      
      // Add this client to the map
      connectedClients.get(userId)?.add(sendMessage);
      
      // Send initial connection message
      sendMessage(JSON.stringify({ type: 'connected' }));
      
      // Set an interval to send a heartbeat to keep the connection alive
      const heartbeatInterval = setInterval(() => {
        try {
          sendMessage(JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() }));
        } catch (error) {
          // If heartbeat fails, clean up this client
          clearInterval(heartbeatInterval);
          cleanupClient(userId, sendMessage);
        }
      }, 30000);
      
      // Clean up when the connection is closed
      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeatInterval);
        cleanupClient(userId, sendMessage);
      });
    }
  });

  return new Response(responseStream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

// Helper function to clean up a client connection
function cleanupClient(userId: string, sendMessage: ResponseSender) {
  const userConnections = connectedClients.get(userId);
  if (userConnections) {
    userConnections.delete(sendMessage);
    
    // If no more connections for this user, remove the user
    if (userConnections.size === 0) {
      connectedClients.delete(userId);
    }
  }
}

// Function to send a message to a specific user
export async function sendMessageToUser(userId: string, message: ChatMessage): Promise<boolean> {
  const clients = connectedClients.get(userId);
  if (!clients || clients.size === 0) {
    return false;
  }
  
  const messageString = JSON.stringify(message);
  let successCount = 0;
  
  // Clone the set to avoid issues if the set is modified during iteration
  const clientsArray = Array.from(clients);
  
  for (const sendMessage of clientsArray) {
    try {
      sendMessage(messageString);
      successCount++;
    } catch (error) {
      console.error(`Failed to send message to client: ${error}`);
      // Remove this client as it's likely disconnected
      cleanupClient(userId, sendMessage);
    }
  }
  
  return successCount > 0;
}