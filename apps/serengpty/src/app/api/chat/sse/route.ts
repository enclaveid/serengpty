import { NextRequest } from 'next/server';
import { getCurrentUser } from '../../../actions/getCurrentUser';
import { Readable } from 'stream';

// Map of open connections by userId
const connectedClients = new Map<string, Set<ResponseSender>>();

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
        controller.enqueue(new TextEncoder().encode(`data: ${data}\n\n`));
      };
      
      // Add this client to the map
      connectedClients.get(userId)?.add(sendMessage);
      
      // Send initial connection message
      sendMessage(JSON.stringify({ type: 'connected' }));
      
      // Set an interval to send a heartbeat to keep the connection alive
      const heartbeatInterval = setInterval(() => {
        sendMessage(JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() }));
      }, 30000);
      
      // Clean up when the connection is closed
      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeatInterval);
        connectedClients.get(userId)?.delete(sendMessage);
        
        // If no more connections for this user, remove the user
        if (connectedClients.get(userId)?.size === 0) {
          connectedClients.delete(userId);
        }
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

// Function to send a message to a specific user
export async function sendMessageToUser(userId: string, message: any) {
  const clients = connectedClients.get(userId);
  if (!clients || clients.size === 0) {
    return false;
  }
  
  const messageString = JSON.stringify(message);
  for (const sendMessage of clients) {
    sendMessage(messageString);
  }
  
  return true;
}