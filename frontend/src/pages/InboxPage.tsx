import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MagnifyingGlassIcon, PaperAirplaneIcon, PaperClipIcon,
  FaceSmileIcon, ArrowPathIcon, TagIcon, UserPlusIcon,
  EllipsisVerticalIcon, CheckIcon, ClockIcon, XMarkIcon,
  SparklesIcon, DocumentDuplicateIcon, MicrophoneIcon,
} from '@heroicons/react/24/outline';
import { CheckIcon as CheckSolid } from '@heroicons/react/24/solid';
import { conversationsApi, aiApi } from '../services/api';
import { useSocketStore } from '../store/socketStore';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const statusColors: Record<string, string> = {
  OPEN: 'badge-green',
  PENDING: 'badge-yellow',
  RESOLVED: 'badge-gray',
  SNOOZED: 'badge-blue',
};

const channelIcons: Record<string, string> = {
  WHATSAPP: '📱',
  INSTAGRAM: '📸',
  MESSENGER: '💬',
  TELEGRAM: '✈️',
  EMAIL: '📧',
  SMS: '💬',
};

const MessageBubble: React.FC<{ message: any }> = ({ message }) => {
  const isOut = message.direction === 'OUTBOUND';
  const time = format(new Date(message.createdAt), 'HH:mm');

  return (
    <div className={`flex ${isOut ? 'justify-end' : 'justify-start'} mb-3`}>
      <div className={`max-w-xs lg:max-w-sm ${isOut ? 'message-bubble-out' : 'message-bubble-in'}`}>
        {message.type === 'IMAGE' && message.mediaUrl && (
          <img src={message.mediaUrl} alt="media" className="rounded-lg mb-1 max-w-full" />
        )}
        {message.type === 'DOCUMENT' && (
          <div className="flex items-center gap-2 p-2 bg-gray-100 rounded-lg mb-1">
            <PaperClipIcon className="w-4 h-4 text-gray-500" />
            <span className="text-xs text-gray-700">Document</span>
          </div>
        )}
        {message.content && <p className="text-sm leading-relaxed">{message.content}</p>}
        {message.interactive && (
          <div className="mt-2 space-y-1">
            {message.interactive?.action?.buttons?.map((btn: any, i: number) => (
              <div key={i} className="px-3 py-1.5 bg-white border border-blue-200 rounded-lg text-xs text-blue-600 text-center">
                {btn.reply?.title}
              </div>
            ))}
          </div>
        )}
        <div className={`flex items-center gap-1 mt-1 ${isOut ? 'justify-end' : 'justify-start'}`}>
          <span className="text-xs text-gray-400">{time}</span>
          {isOut && (
            <span className="text-xs">
              {message.status === 'READ' ? (
                <span className="text-blue-500">✓✓</span>
              ) : message.status === 'DELIVERED' ? (
                <span className="text-gray-400">✓✓</span>
              ) : (
                <span className="text-gray-300">✓</span>
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

const InboxPage: React.FC = () => {
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState({ status: '', channel: '' });
  const [aiSuggestion, setAiSuggestion] = useState('');
  const [showAI, setShowAI] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { socket } = useSocketStore();
  const qc = useQueryClient();

  const { data: conversations } = useQuery({
    queryKey: ['conversations', search, filter],
    queryFn: () => conversationsApi.list({ search, ...filter }).then(r => r.data.data),
    refetchInterval: 10000,
  });

  const { data: selectedConv } = useQuery({
    queryKey: ['conversation', selectedConvId],
    queryFn: () => selectedConvId ? conversationsApi.get(selectedConvId).then(r => r.data) : null,
    enabled: !!selectedConvId,
  });

  const { data: messages, refetch: refetchMessages } = useQuery({
    queryKey: ['messages', selectedConvId],
    queryFn: () => selectedConvId ? conversationsApi.messages(selectedConvId).then(r => r.data.data) : [],
    enabled: !!selectedConvId,
    refetchInterval: 5000,
  });

  const sendMutation = useMutation({
    mutationFn: (data: any) => conversationsApi.sendMessage(selectedConvId!, data),
    onSuccess: () => {
      setMessage('');
      refetchMessages();
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: () => toast.error('Failed to send message'),
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) => conversationsApi.updateStatus(selectedConvId!, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
      qc.invalidateQueries({ queryKey: ['conversation', selectedConvId] });
      toast.success('Status updated');
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (socket && selectedConvId) {
      socket.emit('join:conversation', selectedConvId);
      socket.on('message:new', (msg: any) => {
        if (msg.conversationId === selectedConvId) {
          qc.invalidateQueries({ queryKey: ['messages', selectedConvId] });
          qc.invalidateQueries({ queryKey: ['conversations'] });
        }
      });
      return () => { socket.off('message:new'); };
    }
  }, [socket, selectedConvId]);

  const handleSend = () => {
    if (!message.trim()) return;
    sendMutation.mutate({ type: 'TEXT', content: message });
  };

  const handleAIReply = async () => {
    if (!selectedConvId) return;
    try {
      const lastMsg = messages?.[messages.length - 1]?.content || '';
      const { data } = await aiApi.generateReply(selectedConvId, lastMsg);
      setAiSuggestion(data.reply);
      setShowAI(true);
    } catch {
      toast.error('AI not available');
    }
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Conversation List */}
      <div className="w-80 flex-shrink-0 border-r border-gray-200 bg-white flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Inbox</h2>
          <div className="relative mb-3">
            <MagnifyingGlassIcon className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search conversations..."
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-whatsapp-green/50"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <select
              className="flex-1 text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-whatsapp-green"
              value={filter.status}
              onChange={e => setFilter({ ...filter, status: e.target.value })}
            >
              <option value="">All Status</option>
              <option value="OPEN">Open</option>
              <option value="PENDING">Pending</option>
              <option value="RESOLVED">Resolved</option>
            </select>
            <select
              className="flex-1 text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-whatsapp-green"
              value={filter.channel}
              onChange={e => setFilter({ ...filter, channel: e.target.value })}
            >
              <option value="">All Channels</option>
              <option value="WHATSAPP">WhatsApp</option>
              <option value="INSTAGRAM">Instagram</option>
              <option value="EMAIL">Email</option>
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
          {(conversations || []).map((conv: any) => (
            <div
              key={conv.id}
              onClick={() => setSelectedConvId(conv.id)}
              className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${selectedConvId === conv.id ? 'bg-whatsapp-green/5 border-l-2 border-whatsapp-green' : ''}`}
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 bg-whatsapp-teal rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                    {conv.contact?.firstName?.[0]}{conv.contact?.lastName?.[0]}
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 text-xs">
                    {channelIcons[conv.channel] || '💬'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {conv.contact?.firstName} {conv.contact?.lastName}
                    </p>
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {conv.lastMessageAt ? format(new Date(conv.lastMessageAt), 'HH:mm') : ''}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500 truncate">
                      {conv.messages?.[0]?.content || 'No messages yet'}
                    </p>
                    <span className={`badge text-xs ml-2 flex-shrink-0 ${statusColors[conv.status] || 'badge-gray'}`}>
                      {conv.status}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {(!conversations || conversations.length === 0) && (
            <div className="p-8 text-center text-gray-400">
              <ChatBubbleLeftIcon className="w-8 h-8 mx-auto mb-2" />
              <p className="text-sm">No conversations yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      {selectedConvId && selectedConv ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Chat Header */}
          <div className="bg-white border-b border-gray-200 px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-whatsapp-teal rounded-full flex items-center justify-center text-white text-sm font-bold">
                {selectedConv.contact?.firstName?.[0]}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">
                  {selectedConv.contact?.firstName} {selectedConv.contact?.lastName}
                </h3>
                <p className="text-xs text-gray-500">{selectedConv.contact?.phone}</p>
              </div>
              <span className={`badge ${statusColors[selectedConv.status]}`}>{selectedConv.status}</span>
            </div>
            <div className="flex items-center gap-2">
              {selectedConv.status === 'OPEN' && (
                <button
                  onClick={() => statusMutation.mutate('RESOLVED')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-green-500 rounded-lg hover:bg-green-600"
                >
                  <CheckSolid className="w-3.5 h-3.5" />
                  Resolve
                </button>
              )}
              {selectedConv.status === 'RESOLVED' && (
                <button
                  onClick={() => statusMutation.mutate('OPEN')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  <ArrowPathIcon className="w-3.5 h-3.5" />
                  Reopen
                </button>
              )}
              <button className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
                <EllipsisVerticalIcon className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-5 bg-gray-50">
            {(messages || []).map((msg: any) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* AI Suggestion */}
          {showAI && aiSuggestion && (
            <div className="bg-indigo-50 border-t border-indigo-200 px-5 py-3">
              <div className="flex items-start gap-2">
                <SparklesIcon className="w-4 h-4 text-indigo-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-xs font-medium text-indigo-700 mb-1">AI Suggestion</p>
                  <p className="text-sm text-gray-700">{aiSuggestion}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setMessage(aiSuggestion); setShowAI(false); }}
                    className="text-xs px-2 py-1 bg-indigo-500 text-white rounded-md hover:bg-indigo-600"
                  >
                    Use
                  </button>
                  <button onClick={() => setShowAI(false)} className="text-xs px-2 py-1 bg-white text-gray-500 rounded-md border hover:bg-gray-50">
                    <XMarkIcon className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Message Input */}
          <div className="bg-white border-t border-gray-200 p-4">
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <textarea
                  rows={3}
                  placeholder="Type a message..."
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-whatsapp-green/50"
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                />
                <div className="flex items-center gap-3 mt-2 px-1">
                  <button className="text-gray-400 hover:text-gray-600">
                    <PaperClipIcon className="w-4 h-4" />
                  </button>
                  <button className="text-gray-400 hover:text-gray-600">
                    <FaceSmileIcon className="w-4 h-4" />
                  </button>
                  <button className="text-gray-400 hover:text-gray-600">
                    <MicrophoneIcon className="w-4 h-4" />
                  </button>
                  <button className="text-gray-400 hover:text-gray-600">
                    <DocumentDuplicateIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleAIReply}
                    className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 ml-auto"
                  >
                    <SparklesIcon className="w-3.5 h-3.5" />
                    AI Reply
                  </button>
                </div>
              </div>
              <button
                onClick={handleSend}
                disabled={!message.trim() || sendMutation.isPending}
                className="w-10 h-10 bg-whatsapp-green text-white rounded-xl hover:bg-whatsapp-teal transition-colors flex items-center justify-center disabled:opacity-50 flex-shrink-0"
              >
                <PaperAirplaneIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="w-20 h-20 bg-whatsapp-green/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <MagnifyingGlassIcon className="w-10 h-10 text-whatsapp-teal" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">Select a conversation</h3>
            <p className="text-gray-500 text-sm mt-1">Choose a conversation from the list to start chatting</p>
          </div>
        </div>
      )}
    </div>
  );
};

// Fallback icon
const ChatBubbleLeftIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.068.157 2.148.279 3.238.364.466.037.893.281 1.153.671L12 21l2.652-3.978c.26-.39.687-.634 1.153-.67 1.09-.086 2.17-.208 3.238-.365 1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
  </svg>
);

export default InboxPage;
