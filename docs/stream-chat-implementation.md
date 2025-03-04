# Custom Chat Implementation Documentation

This document provides a detailed overview of the custom chat implementation in the Serengpty application, replacing the previous Stream Chat integration with a self-hosted solution.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Core Components](#core-components)
3. [Authentication Flow](#authentication-flow)
4. [User Management](#user-management)
5. [Chat Interface](#chat-interface)
6. [State Management](#state-management)
7. [Notification System](#notification-system)
8. [Implementation Details](#implementation-details)
9. [Real-time Communication](#real-time-communication)
10. [Database Schema](#database-schema)

## Architecture Overview

The custom chat implementation uses a WebSocket-based architecture with a PostgreSQL database for persistence. The key components include:

- Real-time communication via Next.js Server-Sent Events (SSE) for message streaming
- PostgreSQL database for storing chat history, users, and channels
- Client-side React components for UI and user interactions
- Server-side API routes for message handling and chat operations
- Context providers for state management
- Custom hooks for streamlined functionality

The implementation follows a modular approach with each component focused on a specific responsibility, making it maintainable and extensible.

## Core Components

### 1. `chatService.ts`

The core service that initializes and manages the chat client connection:

- Establishes and maintains WebSocket connections
- Manages user connection/disconnection
- Handles message sending and receiving
- Provides real-time notification handling
- Exposes hooks for components to access chat functionality

### 2. `ChatUserContext.tsx`

Context provider that:

- Fetches the current user data
- Provides user data and authentication state to child components
- Manages loading and error states for the chat system
- Tracks unread message counts globally
- Serves as the central source of truth for user-related chat data

### 3. `ChatProvider.tsx`

Wrapper component that:

- Initializes the chat connection
- Handles loading and error states
- Provides the chat context to all child components
- Manages WebSocket connections and reconnection logic

### 4. `ChatInterface.tsx`

The main UI component for displaying chats:

- Shows channel list and active chat
- Provides message input functionality
- Handles empty states when no chats are active
- Implements custom avatar display with identicons
- Configures channel filtering based on user membership

### 5. `ChatButton.tsx`

Reusable button component for initiating chats:

- Starts a new conversation between two users
- Creates a channel if one doesn't exist
- Navigates to the chat interface with the active channel
- Handles error states and loading states

### 6. `useStartChat.ts`

Custom hook for initiating chat sessions:

- Creates or accesses existing channels between users
- Handles navigation to the chat interface
- Manages loading and error states
- Returns the created channel for further operations

## Authentication Flow

1. User logs in to the application through the main authentication system
2. The `ChatUserProvider` fetches the current user info via `getCurrentUser()`
3. The user ID is stored in the context and passed to the `ChatProvider`
4. The chat service establishes a connection with the user's authentication context
5. All subsequent chat operations include the user's authentication information

## User Management

- User identities are based on the application's authentication system
- User avatars are generated using identicons based on user IDs
- User presence and typing indicators are tracked via WebSocket events
- Online status is determined by active WebSocket connections

## Chat Interface

The chat interface consists of:

- A channel list sidebar showing all conversations
- A main chat area with message history
- Message input for sending new messages
- Custom styling integrated with the application's design system
- Loading and error states for better user experience

## State Management

State is managed at multiple levels:

1. **Global level**: The `ChatUserContext` provides user authentication state
2. **Chat level**: The custom chat client maintains channel and message state
3. **Component level**: Local state for UI interactions and loading states
4. **Notification level**: Global tracking of unread messages across all channels

## Notification System

The implementation includes a notification system that:

- Tracks unread message counts across all channels
- Updates automatically when new messages arrive
- Provides callbacks for UI components to display notification badges
- Updates when messages are read or channels are cleared

Implementation details:
- WebSocket event listeners track notification events
- A callback registry allows multiple components to subscribe to updates
- The system handles reconnection and state restoration

## Implementation Details

### Chat Client Initialization

```typescript
// Create a singleton instance of the ChatClient
let chatClient: ChatClient | undefined;

export function initializeChatClient() {
  if (!chatClient) {
    chatClient = new ChatClient();
  }
  return chatClient;
}
```

### User Connection

```typescript
async connectUser(userId: string) {
  try {
    // Establish WebSocket connection
    this.socket = new WebSocket(`${this.wsEndpoint}?userId=${userId}`);
    
    // Set up event handlers
    this.socket.onmessage = this.handleMessage.bind(this);
    this.socket.onclose = this.handleDisconnect.bind(this);
    
    // Store user ID
    this.userId = userId;
    
    // Notify listeners
    this.emit('connection.success', { userId });
  } catch (error) {
    this.emit('connection.error', error);
  }
}
```

### Channel Creation

```typescript
async createChannel(members: string[], name?: string) {
  try {
    const response = await fetch('/api/chat/channels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ members, name }),
    });

    if (!response.ok) throw new Error('Failed to create channel');
    
    const channel = await response.json();
    this.channels.set(channel.id, channel);
    
    return channel;
  } catch (error) {
    throw error;
  }
}
```

### Message Sending

```typescript
async sendMessage(channelId: string, text: string) {
  try {
    const message = {
      channel_id: channelId,
      user_id: this.userId,
      text,
      created_at: new Date().toISOString(),
    };
    
    // Optimistically add to local messages
    this.addMessageToChannel(channelId, message);
    
    // Send to server
    const response = await fetch('/api/chat/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });
    
    if (!response.ok) throw new Error('Failed to send message');
    
    const confirmedMessage = await response.json();
    // Update with server-confirmed message
    this.updateMessage(channelId, message.id, confirmedMessage);
    
    return confirmedMessage;
  } catch (error) {
    // Handle failed message
    this.markMessageAsFailed(channelId, message.id);
    throw error;
  }
}
```

## Real-time Communication

The real-time communication is implemented using a combination of WebSockets and Server-Sent Events (SSE):

### WebSocket Connection

- Used for bidirectional communication between client and server
- Handles user presence, typing indicators, and immediate notifications
- Manages channel subscriptions and user status

### Server-Sent Events (SSE)

- Used for efficient server-to-client streaming of messages
- Provides real-time updates without the overhead of WebSockets
- Handles automatic reconnection on connection loss

### Implementation Example

```typescript
// Client-side WebSocket connection
const socket = new WebSocket(`/api/chat/ws?userId=${userId}`);

// Server-side SSE endpoint for chat messages
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const channelId = searchParams.get('channelId');
  
  // Create SSE stream
  const stream = new ReadableStream({
    start(controller) {
      // Set up database listener for new messages
      db.listen(`channel:${channelId}:messages`, (message) => {
        controller.enqueue(`data: ${JSON.stringify(message)}\n\n`);
      });
    },
    cancel() {
      // Clean up listeners when client disconnects
      db.unlisten(`channel:${channelId}:messages`);
    }
  });
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

## Database Schema

The chat functionality is implemented using Prisma ORM with the following schema:

### User Model (Extended)

The existing User model is extended with chat-related fields:

```prisma
model User {
  // Existing fields...
  
  // Chat-related relations
  channelMembers      ChannelMember[]
  sentMessages        Message[]
  lastSeen            DateTime?
}
```

### ChatChannel Model

```prisma
model ChatChannel {
  id            String   @id @default(uuid())
  name          String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  lastMessageAt DateTime?

  // Relations
  members   ChannelMember[]
  messages  Message[]

  @@map("chat_channels")
}
```

### ChannelMember Model

```prisma
model ChannelMember {
  // Relationship between users and channels
  channelId    String
  userId       String
  joinedAt     DateTime @default(now())
  lastReadAt   DateTime?

  // Relations
  channel      ChatChannel @relation(fields: [channelId], references: [id], onDelete: Cascade)
  user         User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([channelId, userId])
  @@map("channel_members")
}
```

### Message Model

```prisma
model Message {
  id          String    @id @default(uuid())
  channelId   String
  userId      String
  text        String
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  deleted     Boolean   @default(false)
  readAt      DateTime? // Since chats are 1-1, we can track read status directly
  
  // Relations
  channel     ChatChannel @relation(fields: [channelId], references: [id], onDelete: Cascade)
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("messages")
}
```

## Example Prisma Queries

### Creating a New Channel

```typescript
const channel = await prisma.chatChannel.create({
  data: {
    members: {
      create: [
        { userId: currentUserId },
        { userId: otherUserId },
      ],
    },
    name: otherUserName,
  },
});
```

### Sending a Message

```typescript
const message = await prisma.message.create({
  data: {
    text: messageText,
    channel: { connect: { id: channelId } },
    user: { connect: { id: userId } },
  },
  include: {
    user: true,
  },
});

// Update the channel's lastMessageAt
await prisma.chatChannel.update({
  where: { id: channelId },
  data: { lastMessageAt: new Date() },
});
```

### Marking a Message as Read

```typescript
// Mark a message as read (for the recipient)
const updatedMessage = await prisma.message.update({
  where: { id: messageId },
  data: { readAt: new Date() },
});

// Update the channel member's last read timestamp
await prisma.channelMember.update({
  where: {
    channelId_userId: {
      channelId: message.channelId,
      userId: currentUserId,
    },
  },
  data: { lastReadAt: new Date() },
});
```

### Getting Channels for a User

```typescript
const channels = await prisma.chatChannel.findMany({
  where: {
    members: {
      some: {
        userId: currentUserId,
      },
    },
  },
  include: {
    members: {
      include: {
        user: true,
      },
    },
    messages: {
      orderBy: {
        createdAt: 'desc',
      },
      take: 1,
    },
  },
  orderBy: {
    lastMessageAt: 'desc',
  },
});
```

This architecture provides a complete custom chat solution that maintains all the functionality of the previous Stream Chat implementation while giving full control over the data, user experience, and scalability through Prisma ORM.
