'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useChat } from './ChatProvider';
import { Avatar } from '@enclaveid/ui/avatar';
import { Input } from '@enclaveid/ui/input';
import { Button } from '@enclaveid/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { getIdenticon } from '../../utils/getIdenticon';
import { getCurrentUserId } from '../../actions/chatActions';

interface ChatInterfaceProps {
  initialConversationId?: string;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ initialConversationId }) => {
  const { 
    conversations, 
    currentConversation, 
    setCurrentConversation,
    messages,
    sendMessage,
    markAsRead
  } = useChat();
  
  const [messageText, setMessageText] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Load current user ID from server
  useEffect(() => {
    getCurrentUserId().then(userId => {
      setCurrentUserId(userId);
    });
  }, []);
  
  // Set initial conversation if provided
  useEffect(() => {
    if (initialConversationId) {
      setCurrentConversation(initialConversationId);
    }
  }, [initialConversationId, setCurrentConversation]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentConversation]);

  // Mark messages as read when conversation changes
  useEffect(() => {
    if (currentConversation) {
      markAsRead(currentConversation);
    }
  }, [currentConversation, markAsRead]);

  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!messageText.trim() || !currentConversation || isSending) return;
    
    try {
      setIsSending(true);
      setSendError(null);
      const result = await sendMessage(currentConversation, messageText);
      if (!result) {
        throw new Error("Failed to send message");
      }
      setMessageText('');
    } catch (error) {
      setSendError(error instanceof Error ? error.message : "Failed to send message");
      console.error("Error sending message:", error);
    } finally {
      setIsSending(false);
    }
  };

  const currentMessages = currentConversation ? (messages.get(currentConversation) || []) : [];
  const currentConversationData = conversations.find(
    conv => conv.user.id === currentConversation
  );

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-gray-50 dark:bg-gray-900">
      {/* Conversation list sidebar */}
      <div className="w-1/4 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
        <div className="p-4">
          <h2 className="text-xl font-bold mb-4">Conversations</h2>
          {conversations.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">No conversations yet</p>
          ) : (
            <div className="space-y-2">
              {conversations.map((conversation) => (
                <div
                  key={conversation.user.id}
                  className={`p-3 rounded-lg cursor-pointer ${
                    currentConversation === conversation.user.id
                      ? 'bg-gray-200 dark:bg-gray-700'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                  onClick={() => setCurrentConversation(conversation.user.id)}
                >
                  <div className="flex items-center">
                    <Avatar className="h-10 w-10 mr-3">
                      <img
                        src={conversation.user.image || getIdenticon(conversation.user.id)}
                        alt={conversation.user.name}
                      />
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center">
                        <span className="font-medium truncate">{conversation.user.name}</span>
                        {conversation.unreadCount > 0 && (
                          <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
                            {conversation.unreadCount}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                        {conversation.lastMessage.text}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Chat main area */}
      <div className="flex-1 flex flex-col">
        {currentConversation ? (
          <>
            {/* Chat header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center">
              <Avatar className="h-10 w-10 mr-3">
                <img
                  src={currentConversationData?.user.image || getIdenticon(currentConversation)}
                  alt={currentConversationData?.user.name || 'User'}
                />
              </Avatar>
              <div>
                <h2 className="font-bold">{currentConversationData?.user.name || 'User'}</h2>
              </div>
            </div>

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-4">
                {currentMessages.map((message, i) => (
                  <div key={message.id || i} className="flex flex-col">
                    <div 
                      className={`flex items-start ${
                        message.sender_id === currentUserId ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      {message.sender_id !== currentUserId && (
                        <Avatar className="h-8 w-8 mr-2">
                          <img
                            src={currentConversationData?.user.image || getIdenticon(message.sender_id)}
                            alt={currentConversationData?.user.name || 'User'}
                          />
                        </Avatar>
                      )}
                      <div
                        className={`max-w-[70%] p-3 rounded-lg ${
                          message.sender_id === currentUserId
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-200 dark:bg-gray-700'
                        }`}
                      >
                        <div className="whitespace-pre-wrap break-words">
                          {message.text}
                        </div>
                        <div 
                          className={`text-xs mt-1 ${
                            message.sender_id === currentUserId
                              ? 'text-blue-100'
                              : 'text-gray-500 dark:text-gray-400'
                          }`}
                        >
                          {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Message input */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              <form onSubmit={handleSendMessage} className="flex flex-col space-y-2">
                <div className="flex space-x-2">
                  <Input
                    type="text"
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1"
                    disabled={isSending}
                  />
                  <Button type="submit" disabled={!messageText.trim() || isSending}>
                    {isSending ? 'Sending...' : 'Send'}
                  </Button>
                </div>
                {sendError && (
                  <div className="text-red-500 text-sm">{sendError} - Tap to retry</div>
                )}
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
            <h3 className="text-xl font-medium mb-2">Select a conversation</h3>
            <p className="text-gray-500 dark:text-gray-400">
              Choose a conversation from the sidebar to start chatting
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatInterface;