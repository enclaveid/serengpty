# Chat Architecture Documentation

This document provides a detailed overview of the direct messaging implementation in the Serengpty application.

## Architecture Overview

The chat implementation uses a modern Next.js architecture combining server actions and Server-Sent Events (SSE):

- **Server Actions** for data operations (fetching conversations, sending messages, marking as read)
- **Server-Sent Events (SSE)** for real-time updates and message streaming
- **PostgreSQL database** for message and conversation persistence
- **Client-side state management** using React context and hooks

## Core Components

### Server-Side Components

#### 1. `chatActions.ts`
- Contains server actions for all chat operations
- Handles data access through Prisma ORM
- Implements business logic for conversations and messages
- Provides type definitions used throughout the application
- Key actions:
  - `getConversations()` - Fetches user's conversations
  - `getMessages(otherUserId)` - Fetches messages with another user
  - `sendMessage(receiverId, text)` - Sends a new message
  - `markAsRead(otherUserId)` - Marks messages as read
  - `updateConversationsForUser(userId)` - Refreshes conversation lists

#### 2. `/api/chat/sse/route.ts`
- Establishes persistent SSE connections for real-time updates
- Maintains a registry of connected clients
- Provides functions for pushing updates to specific users
- Implements heartbeat mechanism to keep connections alive

### Client-Side Components

#### 1. `chatService.ts`
- Client-side service that interfaces with server actions
- Manages WebSocket connections and reconnection logic
- Maintains local message and conversation cache
- Provides event emitter pattern for real-time updates
- Optimistically updates UI before server confirmation

#### 2. `ChatUserContext.tsx`
- Fetches and provides current user data
- Manages authentication state for chat
- Tracks unread message counts
- Establishes chat service connection

#### 3. `ChatProvider.tsx`
- Initializes and manages chat state
- Provides context for all chat-related data
- Handles conversation selection and message display
- Maintains real-time subscription to updates

#### 4. `ChatInterface.tsx`
- Renders conversation list and active chat
- Provides message input and sending functionality
- Implements read receipt tracking
- Displays user avatars with identicons

#### 5. `ChatButton.tsx`
- Initiates new conversations between users
- Navigates to the chat interface with the active conversation

#### 6. `useStartChat.ts`
- Custom hook for starting conversations
- Creates new conversations if they don't exist
- Handles navigation to the chat interface

## Authentication Flow

1. User logs in through the main authentication system
2. The `ChatUserProvider` fetches current user info
3. The chat service establishes a connection with user's authentication

## Data Flow

### Message Sending Flow

1. User types a message and clicks send in the UI
2. `ChatInterface` calls `sendMessage` from the chat context
3. `ChatProvider` calls the `sendMessage` method from `chatService`
4. `chatService` optimistically adds the message to local state
5. `chatService` calls the `sendMessage` server action
6. Server action persists the message to the database
7. Server action triggers SSE notifications to both sender and receiver
8. Both users receive real-time updates via their SSE connections
9. UI updates to show the new message

### Real-time Update Flow

1. Database change occurs (new message, message read, etc.)
2. Server action calls `updateConversationsForUser` for affected users
3. `updateConversationsForUser` fetches latest conversation data
4. Function sends updated data via SSE to connected clients
5. Client SSE connection receives the update
6. `chatService` processes the update and notifies listeners
7. React components update to reflect the changes

## Database Schema

The chat functionality uses Prisma ORM with the following schema:

```prisma
model User {
  id           String    @id @default(cuid())
  // Existing fields...
  
  // Chat-related relations
  sentMessages     Message[]
  receivedMessages Message[] @relation("receivedMessages")
  lastSeen         DateTime?
}

model Message {
  id          String    @id @default(uuid())
  senderId    String
  receiverId  String
  text        String
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  readAt      DateTime?
  
  // Relations
  sender      User      @relation(fields: [senderId], references: [id], onDelete: Cascade)
  receiver    User      @relation("receivedMessages", fields: [receiverId], references: [id], onDelete: Cascade)

  @@map("messages")
  @@index([senderId, receiverId])
  @@index([receiverId, senderId])
}
```

## Type Definitions

The application uses consistent type definitions for chat data:

```typescript
interface Message {
  id?: string;
  sender_id: string;
  receiver_id: string;
  text: string;
  created_at: string;
  read_at?: string;
}

interface Conversation {
  user: {
    id: string;
    name: string;
    image?: string;
  };
  lastMessage: Message;
  unreadCount: number;
}
```

## Implementation Details

### Server Action Implementation

```typescript
// Example of a server action implementation
export async function sendMessage(receiverId: string, text: string): Promise<Message | null> {
  const session = await auth();
  
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  const currentUserId = session.user.id;
  
  // Create message
  const message = await prisma.message.create({
    data: {
      senderId: currentUserId,
      receiverId,
      text,
    }
  });

  // Format response
  const formattedMessage = {
    id: message.id,
    sender_id: message.senderId,
    receiver_id: message.receiverId,
    text: message.text,
    created_at: message.createdAt.toISOString(),
    read_at: message.readAt?.toISOString(),
  };

  // Notify both users about the new message via SSE
  try {
    const { sendMessageToUser } = await import('../api/chat/sse/route');
    
    // Notify the sender and receiver
    sendMessageToUser(currentUserId, { type: 'message', message: formattedMessage });
    sendMessageToUser(receiverId, { type: 'message', message: formattedMessage });
    
    // Update conversation lists
    setTimeout(async () => {
      await updateConversationsForUser(currentUserId);
      await updateConversationsForUser(receiverId);
    }, 100);
  } catch (error) {
    console.error('Error notifying users about new message:', error);
  }

  revalidatePath('/dashboard/chats');
  return formattedMessage;
}
```

### Client Service Implementation

```typescript
// Example of client-side service using server actions
async sendMessage(receiverId: string, text: string): Promise<Message | null> {
  try {
    const message = {
      sender_id: this.userId,
      receiver_id: receiverId,
      text,
      created_at: new Date().toISOString(),
    };
    
    // Optimistically add to local messages
    this.addMessageToConversation(receiverId, message);
    
    // Send to server using server action
    const confirmedMessage = await sendMessageAction(receiverId, text);
    return confirmedMessage;
  } catch (error) {
    console.error('Error sending message:', error);
    return null;
  }
}
```

## Performance Considerations

### Client-Side Optimizations
- Optimistic updates for immediate UI feedback
- Message caching to reduce server requests
- Efficient re-rendering using React context

### Server-Side Optimizations
- Server actions for reduced API overhead
- Efficient database queries with proper indexing
- Connection pooling for database access
- Stateless server design for scalability

### Real-Time Communication
- SSE instead of WebSockets for simpler, more efficient server-to-client streaming
- Heartbeat mechanism to keep connections alive
- Automatic reconnection with exponential backoff

## Security Considerations

1. Authentication checks on all server actions
2. User ID validation for all message operations
3. No exposure of sensitive user data in messaging APIs
4. Protection against message spoofing
5. Rate limiting (recommended for production)

## Future Enhancements

- Message typing indicators
- Message delivery status (sent, delivered, read)
- Media attachments and file sharing
- Message reactions and replies
- Group conversations
