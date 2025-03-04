'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from './getCurrentUser';
import prisma from '../services/db/prisma';
import { sendMessageToUser, type ChatMessage } from '../api/chat/sse/route';

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
 * Gets conversations for the current user with optimized database queries
 */
export async function getConversations(): Promise<Conversation[]> {
  const currentUser = await getCurrentUser();

  if (!currentUser?.id) {
    throw new Error('Unauthorized');
  }

  const currentUserId = currentUser.id;

  // Get all messages where the current user is either the sender or receiver
  // along with user details in a single query
  const lastMessages = await prisma.$queryRaw<any[]>`
    WITH RankedMessages AS (
      SELECT 
        m.*,
        ROW_NUMBER() OVER (
          PARTITION BY 
            CASE 
              WHEN m."senderId" = ${currentUserId} THEN m."receiverId" 
              ELSE m."senderId" 
            END 
          ORDER BY m."createdAt" DESC
        ) as rn
      FROM "Message" m
      WHERE m."senderId" = ${currentUserId} OR m."receiverId" = ${currentUserId}
    )
    SELECT 
      rm.*,
      sender.id as "senderId",
      sender.name as "senderName",
      sender.image as "senderImage",
      receiver.id as "receiverId",
      receiver.name as "receiverName",
      receiver.image as "receiverImage",
      (
        SELECT COUNT(*) 
        FROM "Message" unread
        WHERE 
          unread."senderId" = CASE 
            WHEN rm."senderId" = ${currentUserId} THEN rm."receiverId" 
            ELSE rm."senderId" 
          END
          AND unread."receiverId" = ${currentUserId}
          AND unread."readAt" IS NULL
      ) as "unreadCount"
    FROM RankedMessages rm
    JOIN "User" sender ON rm."senderId" = sender.id
    JOIN "User" receiver ON rm."receiverId" = receiver.id
    WHERE rn = 1
    ORDER BY rm."createdAt" DESC
  `;

  // Format the conversations
  return lastMessages.map(msg => {
    const isUserSender = msg.senderId === currentUserId;
    const otherPersonId = isUserSender ? msg.receiverId : msg.senderId;
    const otherPersonName = isUserSender ? msg.receiverName : msg.senderName;
    const otherPersonImage = isUserSender ? msg.receiverImage : msg.senderImage;

    return {
      user: {
        id: otherPersonId,
        name: otherPersonName,
        image: otherPersonImage,
      },
      lastMessage: {
        id: msg.id,
        text: msg.text,
        sender_id: msg.senderId,
        receiver_id: msg.receiverId,
        created_at: msg.createdAt.toISOString(),
        read_at: msg.readAt?.toISOString(),
      },
      unreadCount: Number(msg.unreadCount),
    };
  });
}

/**
 * Gets messages between the current user and another user
 */
export async function getMessages(otherUserId: string): Promise<Message[]> {
  const currentUser = await getCurrentUser();

  if (!currentUser?.id) {
    throw new Error('Unauthorized');
  }

  const currentUserId = currentUser.id;

  // Get messages between the two users
  const messages = await prisma.message.findMany({
    where: {
      OR: [
        { senderId: currentUserId, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: currentUserId },
      ],
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  // Format messages for client
  return messages.map((message) => ({
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
export async function sendMessage(
  receiverId: string,
  text: string
): Promise<Message | null> {
  const currentUser = await getCurrentUser();

  if (!currentUser?.id) {
    throw new Error('Unauthorized');
  }

  const currentUserId = currentUser.id;

  // Create message
  const message = await prisma.message.create({
    data: {
      text,
      sender: {
        connect: {
          id: currentUserId,
        },
      },
      receiver: {
        connect: { id: receiverId },
      },
    },
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

  // Update conversations and notify users in a single transaction
  await prisma.$transaction(async (tx) => {
    // Load conversations for both users in parallel
    const [senderConvs, receiverConvs] = await Promise.all([
      updateConversationsForUserInternal(currentUserId, tx),
      updateConversationsForUserInternal(receiverId, tx)
    ]);

    // Notify both users
    const messagePayload: ChatMessage = {
      type: 'message',
      message: formattedMessage,
    };

    // Send messages in parallel
    await Promise.all([
      sendMessageToUser(currentUserId, messagePayload),
      sendMessageToUser(receiverId, messagePayload)
    ]);

    // Send updated conversations
    await Promise.all([
      sendMessageToUser(currentUserId, {
        type: 'conversations',
        conversations: senderConvs,
      }),
      sendMessageToUser(receiverId, {
        type: 'conversations',
        conversations: receiverConvs,
      })
    ]);
  });

  revalidatePath('/dashboard/chats');
  return formattedMessage;
}

/**
 * Marks messages from another user as read
 */
export async function markAsRead(otherUserId: string): Promise<boolean> {
  const currentUser = await getCurrentUser();

  if (!currentUser?.id) {
    throw new Error('Unauthorized');
  }

  const currentUserId = currentUser.id;

  // Mark all unread messages from other user as read
  const updateResult = await prisma.message.updateMany({
    where: {
      senderId: otherUserId,
      receiverId: currentUserId,
      readAt: null,
    },
    data: {
      readAt: new Date(),
    },
  });

  // If no messages were updated, return early
  if (updateResult.count === 0) {
    return false;
  }

  // Update user's lastSeen and get updated conversations in a transaction
  await prisma.$transaction(async (tx) => {
    // Update user's lastSeen
    await tx.user.update({
      where: { id: currentUserId },
      data: { lastSeen: new Date() },
    });

    // Load conversations for both users in parallel
    const [currentUserConvs, otherUserConvs] = await Promise.all([
      updateConversationsForUserInternal(currentUserId, tx),
      updateConversationsForUserInternal(otherUserId, tx)
    ]);

    // Send updated conversations
    await Promise.all([
      sendMessageToUser(currentUserId, {
        type: 'conversations',
        conversations: currentUserConvs,
      }),
      sendMessageToUser(otherUserId, {
        type: 'conversations',
        conversations: otherUserConvs,
      })
    ]);
  });

  revalidatePath('/dashboard/chats');
  return true;
}

/**
 * Updates conversations for a user - optimized internal version
 * Used within transactions
 */
async function updateConversationsForUserInternal(
  userId: string,
  prismaClient: any
): Promise<Conversation[]> {
  // Get all messages where the user is either the sender or receiver
  // along with user details in a single query
  const lastMessages = await prismaClient.$queryRaw<any[]>`
    WITH RankedMessages AS (
      SELECT 
        m.*,
        ROW_NUMBER() OVER (
          PARTITION BY 
            CASE 
              WHEN m."senderId" = ${userId} THEN m."receiverId" 
              ELSE m."senderId" 
            END 
          ORDER BY m."createdAt" DESC
        ) as rn
      FROM "Message" m
      WHERE m."senderId" = ${userId} OR m."receiverId" = ${userId}
    )
    SELECT 
      rm.*,
      sender.id as "senderId",
      sender.name as "senderName",
      sender.image as "senderImage",
      receiver.id as "receiverId",
      receiver.name as "receiverName",
      receiver.image as "receiverImage",
      (
        SELECT COUNT(*) 
        FROM "Message" unread
        WHERE 
          unread."senderId" = CASE 
            WHEN rm."senderId" = ${userId} THEN rm."receiverId" 
            ELSE rm."senderId" 
          END
          AND unread."receiverId" = ${userId}
          AND unread."readAt" IS NULL
      ) as "unreadCount"
    FROM RankedMessages rm
    JOIN "User" sender ON rm."senderId" = sender.id
    JOIN "User" receiver ON rm."receiverId" = receiver.id
    WHERE rn = 1
    ORDER BY rm."createdAt" DESC
  `;

  // Format the conversations
  return lastMessages.map(msg => {
    const isUserSender = msg.senderId === userId;
    const otherPersonId = isUserSender ? msg.receiverId : msg.senderId;
    const otherPersonName = isUserSender ? msg.receiverName : msg.senderName;
    const otherPersonImage = isUserSender ? msg.receiverImage : msg.senderImage;

    return {
      user: {
        id: otherPersonId,
        name: otherPersonName,
        image: otherPersonImage,
      },
      lastMessage: {
        id: msg.id,
        text: msg.text,
        sender_id: msg.senderId,
        receiver_id: msg.receiverId,
        created_at: msg.createdAt.toISOString(),
        read_at: msg.readAt?.toISOString(),
      },
      unreadCount: Number(msg.unreadCount),
    };
  });
}

/**
 * Updates the conversation list for a user
 * This is a public wrapper around the internal implementation
 */
export async function updateConversationsForUser(
  userId: string
): Promise<boolean> {
  try {
    const conversations = await updateConversationsForUserInternal(userId, prisma);
    
    await sendMessageToUser(userId, {
      type: 'conversations',
      conversations,
    });
    
    return true;
  } catch (error) {
    console.error('Error updating conversations for user:', error);
    return false;
  }
}

/**
 * Gets the current user's ID - safer than passing it client-side
 */
export async function getCurrentUserId(): Promise<string | null> {
  const currentUser = await getCurrentUser();
  return currentUser?.id || null;
}

/**
 * Get the current chat state for a user
 * Combines conversations and unread message counts
 */
export async function getChatState() {
  const currentUser = await getCurrentUser();
  
  if (!currentUser?.id) {
    throw new Error('Unauthorized');
  }
  
  // Get all conversations
  const conversations = await getConversations();
  
  // Calculate total unread count
  const totalUnreadCount = conversations.reduce((total, conv) => total + conv.unreadCount, 0);
  
  // Build unread counts by user
  const unreadCounts: { [userId: string]: number } = {};
  conversations.forEach(conversation => {
    unreadCounts[conversation.user.id] = conversation.unreadCount;
  });
  
  return {
    conversations,
    unreadCounts,
    totalUnreadCount,
    isLoading: false,
  };
}

/**
 * Get messages for a specific conversation
 */
export async function getChatMessages(otherUserId: string): Promise<Message[]> {
  const currentUser = await getCurrentUser();
  
  if (!currentUser?.id) {
    throw new Error('Unauthorized');
  }
  
  // Get messages without automatically marking as read
  // This prevents potential loops with markAsRead -> refreshChat -> getChatMessages
  return getMessages(otherUserId);
}
