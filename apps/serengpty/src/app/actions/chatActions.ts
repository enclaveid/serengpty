'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '../services/auth';
import prisma from '../services/db/prisma';
import { ResponseSender } from '../api/chat/sse/route';

export interface Message {
  id?: string;
  sender_id: string;
  receiver_id: string;
  text: string;
  created_at: string;
  read_at?: string;
}

export interface Conversation {
  user: {
    id: string;
    name: string;
    image?: string;
  };
  lastMessage: Message;
  unreadCount: number;
}

/**
 * Gets conversations for the current user
 */
export async function getConversations(): Promise<Conversation[]> {
  const session = await auth();
  
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  const currentUserId = session.user.id;

  // Get all messages where the current user is either the sender or receiver
  const conversationMessages = await prisma.message.findMany({
    where: {
      OR: [
        { senderId: currentUserId },
        { receiverId: currentUserId }
      ]
    },
    orderBy: {
      createdAt: 'desc'
    },
    include: {
      sender: {
        select: {
          id: true,
          name: true,
          image: true,
        }
      },
      receiver: {
        select: {
          id: true,
          name: true,
          image: true,
        }
      }
    }
  });

  // Get unique conversations
  const uniqueConversations = new Map();
  
  for (const message of conversationMessages) {
    // Determine the other person in the conversation
    const otherPersonId = message.senderId === currentUserId 
      ? message.receiverId 
      : message.senderId;
    
    const otherPerson = message.senderId === currentUserId 
      ? message.receiver 
      : message.sender;
      
    if (!uniqueConversations.has(otherPersonId)) {
      // Count unread messages for this conversation
      const unreadCount = await prisma.message.count({
        where: {
          senderId: otherPersonId,
          receiverId: currentUserId,
          readAt: null,
        }
      });

      uniqueConversations.set(otherPersonId, {
        user: {
          id: otherPerson.id,
          name: otherPerson.name,
          image: otherPerson.image,
        },
        lastMessage: {
          id: message.id,
          text: message.text,
          sender_id: message.senderId,
          receiver_id: message.receiverId,
          created_at: message.createdAt.toISOString(),
          read_at: message.readAt?.toISOString(),
        },
        unreadCount,
      });
    }
  }

  return Array.from(uniqueConversations.values());
}

/**
 * Gets messages between the current user and another user
 */
export async function getMessages(otherUserId: string): Promise<Message[]> {
  const session = await auth();
  
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  const currentUserId = session.user.id;

  // Get messages between the two users
  const messages = await prisma.message.findMany({
    where: {
      OR: [
        { senderId: currentUserId, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: currentUserId }
      ]
    },
    orderBy: {
      createdAt: 'asc'
    }
  });

  // Format messages for client
  return messages.map(message => ({
    id: message.id,
    sender_id: message.senderId,
    receiver_id: message.receiverId,
    text: message.text,
    created_at: message.createdAt.toISOString(),
    read_at: message.readAt?.toISOString(),
  }));
}

/**
 * Sends a message from the current user to another user
 */
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
    // Import dynamically to avoid circular dependencies
    const { sendMessageToUser } = await import('../api/chat/sse/route');
    
    // Notify the sender
    sendMessageToUser(currentUserId, {
      type: 'message',
      message: formattedMessage
    });
    
    // Notify the receiver
    sendMessageToUser(receiverId, {
      type: 'message',
      message: formattedMessage
    });
    
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

/**
 * Marks messages from another user as read
 */
export async function markAsRead(otherUserId: string): Promise<boolean> {
  const session = await auth();
  
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  const currentUserId = session.user.id;

  // Mark all unread messages from other user as read
  await prisma.message.updateMany({
    where: {
      senderId: otherUserId,
      receiverId: currentUserId,
      readAt: null,
    },
    data: {
      readAt: new Date(),
    },
  });

  // Update user's lastSeen
  await prisma.user.update({
    where: {
      id: currentUserId,
    },
    data: {
      lastSeen: new Date(),
    },
  });

  // Update conversation lists
  try {
    const { sendMessageToUser } = await import('../api/chat/sse/route');
    setTimeout(async () => {
      await updateConversationsForUser(currentUserId);
      await updateConversationsForUser(otherUserId);
    }, 100);
  } catch (error) {
    console.error('Error updating conversations after read:', error);
  }

  revalidatePath('/dashboard/chats');
  return true;
}

/**
 * Updates the conversation list for a user
 */
export async function updateConversationsForUser(userId: string): Promise<boolean> {
  try {
    // Get all messages where the user is either the sender or receiver
    const conversationMessages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: userId },
          { receiverId: userId }
        ]
      },
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            image: true,
          }
        },
        receiver: {
          select: {
            id: true,
            name: true,
            image: true,
          }
        }
      }
    });

    // Get unique conversations
    const uniqueConversations = new Map();
    
    for (const message of conversationMessages) {
      // Determine the other person in the conversation
      const otherPersonId = message.senderId === userId 
        ? message.receiverId 
        : message.senderId;
      
      const otherPerson = message.senderId === userId 
        ? message.receiver 
        : message.sender;
        
      if (!uniqueConversations.has(otherPersonId)) {
        // Count unread messages for this conversation
        const unreadCount = await prisma.message.count({
          where: {
            senderId: otherPersonId,
            receiverId: userId,
            readAt: null,
          }
        });

        uniqueConversations.set(otherPersonId, {
          user: {
            id: otherPerson.id,
            name: otherPerson.name,
            image: otherPerson.image,
          },
          lastMessage: {
            id: message.id,
            text: message.text,
            sender_id: message.senderId,
            receiver_id: message.receiverId,
            created_at: message.createdAt.toISOString(),
            read_at: message.readAt?.toISOString(),
          },
          unreadCount,
        });
      }
    }

    // Import dynamically to avoid circular dependencies
    const { sendMessageToUser } = await import('../api/chat/sse/route');
    
    // Send updated conversations to the user
    sendMessageToUser(userId, {
      type: 'conversations',
      conversations: Array.from(uniqueConversations.values())
    });
    
    return true;
  } catch (error) {
    console.error('Error updating conversations for user:', error);
    return false;
  }
}