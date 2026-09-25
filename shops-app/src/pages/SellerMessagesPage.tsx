"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Send, Loader, Search, Clock } from 'lucide-react';
import api from '@/services/api';

interface Conversation {
  other_user_id: number;
  other_user_name?: string;
  other_user_avatar?: string;
  last_message?: string;
  last_message_time?: string;
  unread_count?: number;
}

interface Message {
  id: number;
  sender_id: number;
  receiver_id?: number;
  content: string;
  created_at?: string;
  timestamp?: string;
}

export default function MessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [filteredConversations, setFilteredConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadConversations();
    const interval = setInterval(loadConversations, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const filtered = conversations.filter((conv) => {
      const name = (conv.other_user_name || 'Unknown').toLowerCase();
      const message = (conv.last_message || '').toLowerCase();
      const query = searchQuery.toLowerCase();
      return name.includes(query) || message.includes(query);
    });
    setFilteredConversations(filtered);
  }, [searchQuery, conversations]);

  const loadConversations = async () => {
    try {
      // The real buyer-seller chat system -- this used to call the
      // unrelated legacy /conversations endpoint (a different,
      // system-to-user messaging feature with no listing_id concept),
      // so sellers never actually saw real buyer messages here.
      const res = await api.get('/messages/conversations').catch((err) => {
        console.error('Error loading conversations:', err);
        if (err.response?.status === 500) {
          setError('Messaging service is temporarily unavailable. Please try again later.');
        }
        return null;
      });

      if (res?.data) {
        const convsList: Conversation[] = Array.isArray(res.data) ? res.data : [];
        setConversations(convsList);
        setError(null);

        if (!selectedConversation && convsList.length > 0) {
          setSelectedConversation(convsList[0]);
          loadMessages(convsList[0].other_user_id);
        }
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
      setError('Failed to load conversations');
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (otherUserId: number) => {
    try {
      const res = await api.get(`/messages/${otherUserId}`).catch(() => null);

      if (res?.data) {
        setMessages(Array.isArray(res.data) ? res.data : []);
        setTimeout(() => scrollToBottom(), 100);
      }

      setConversations((prev) => prev.map((c) =>
        c.other_user_id === otherUserId ? { ...c, unread_count: 0 } : c
      ));
      api.post(`/messages/${otherUserId}/read`).catch(() => {});
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSelectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    loadMessages(conversation.other_user_id);
  };

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedConversation) return;

    setSending(true);
    try {
      await api.post('/messages/', {
        receiver_id: selectedConversation.other_user_id,
        content: messageInput,
      });

      setMessageInput('');
      loadMessages(selectedConversation.other_user_id);
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <Loader className="w-8 h-8 animate-spin text-orange-600" />
          <p className="text-gray-500 text-sm">Loading messages...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Messages</h1>
          <p className="text-gray-600 dark:text-neutral-300">Chat with your customers</p>
        </div>
        <a href="/messages" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors text-sm">
          Open Full Messages →
        </a>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-[600px]">
        <div className="bg-white dark:bg-neutral-950 rounded-lg border border-gray-200 dark:border-neutral-800 overflow-hidden flex flex-col">
          <div className="border-b border-gray-200 dark:border-neutral-800 p-4 space-y-3">
            <h3 className="font-semibold text-gray-900 dark:text-white">Conversations ({filteredConversations.length})</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-950 text-gray-900 dark:text-white text-sm"
              />
            </div>
          </div>
          <div className="flex-1 divide-y divide-gray-200 dark:divide-neutral-800 overflow-y-auto">
            {filteredConversations.length === 0 ? (
              <div className="p-4 text-gray-500 text-sm text-center">
                {searchQuery ? 'No conversations match your search' : 'No conversations yet'}
              </div>
            ) : (
              filteredConversations.map((conv) => (
                <button
                  key={conv.other_user_id}
                  onClick={() => handleSelectConversation(conv)}
                  className={`w-full text-left p-4 hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors ${
                    selectedConversation?.other_user_id === conv.other_user_id ? 'bg-orange-50 dark:bg-orange-900/20' : ''
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <p className="font-semibold text-gray-900 dark:text-white text-sm truncate flex-1">{conv.other_user_name || `User ${conv.other_user_id}`}</p>
                    {(conv.unread_count ?? 0) > 0 && (
                      <span className="bg-orange-600 text-white text-xs rounded-full px-2 py-0.5 ml-2 flex-shrink-0">{conv.unread_count}</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 dark:text-neutral-300 truncate mb-1">{conv.last_message || 'No messages'}</p>
                  {conv.last_message_time && (
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <Clock className="w-3 h-3" />
                      {new Date(conv.last_message_time).toLocaleDateString()}
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        <div className="lg:col-span-2 bg-white dark:bg-neutral-950 rounded-lg border border-gray-200 dark:border-neutral-800 overflow-hidden flex flex-col">
          <div className="border-b border-gray-200 dark:border-neutral-800 p-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {selectedConversation?.other_user_name || 'Select a conversation'}
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {!selectedConversation ? (
              <div className="flex items-center justify-center h-full text-gray-500">
                Select a conversation to start messaging
              </div>
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-500">
                No messages yet. Start the conversation!
              </div>
            ) : (
              <>
                {messages.map((msg) => {
                  // Mirrors MessagesPage.tsx's logic: if the sender is the
                  // other person in this thread, align left; otherwise it's
                  // this seller's own message, align right.
                  const isFromOtherUser = msg.sender_id === selectedConversation.other_user_id;
                  return (
                    <div key={msg.id} className={`flex ${isFromOtherUser ? 'justify-start' : 'justify-end'}`}>
                      <div
                        className={`rounded-lg px-4 py-2 max-w-xs text-sm ${
                          isFromOtherUser
                            ? 'bg-gray-100 dark:bg-neutral-900 text-gray-900 dark:text-white'
                            : 'bg-orange-600 text-white'
                        }`}
                      >
                        <p>{msg.content}</p>
                        <p className="text-xs opacity-70 mt-1">
                          {new Date(msg.created_at || msg.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>
          {selectedConversation && (
            <div className="border-t border-gray-200 dark:border-neutral-800 p-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Type a message..."
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                  disabled={sending}
                  className="flex-1 px-4 py-2 border border-gray-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-950 text-gray-900 dark:text-white disabled:opacity-50"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={sending || !messageInput.trim()}
                  className="bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white p-2 rounded-lg transition-colors"
                >
                  {sending ? <Loader className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
