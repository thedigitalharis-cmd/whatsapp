import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MagnifyingGlassIcon, PaperAirplaneIcon, PaperClipIcon,
  FaceSmileIcon, XMarkIcon, SparklesIcon, DocumentDuplicateIcon,
  MicrophoneIcon, TagIcon, UserPlusIcon, EllipsisVerticalIcon,
  PhoneIcon, EnvelopeIcon, BuildingOfficeIcon, ChevronRightIcon,
  CurrencyDollarIcon, DocumentTextIcon, ArrowPathIcon,
  CheckCircleIcon, ClockIcon, ChatBubbleLeftRightIcon,
  BoltIcon, ArrowRightIcon, InformationCircleIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckSolid, XCircleIcon } from '@heroicons/react/24/solid';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import { conversationsApi, aiApi, usersApi, teamsApi, tagsApi, kbApi, api } from '../services/api';
import { useSocketStore } from '../store/socketStore';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const statusColors: Record<string, string> = {
  OPEN: 'badge-green', PENDING: 'badge-yellow',
  RESOLVED: 'badge-gray', SNOOZED: 'badge-blue',
};
const channelIcons: Record<string, string> = {
  WHATSAPP: '📱', INSTAGRAM: '📸', MESSENGER: '💬',
  TELEGRAM: '✈️', EMAIL: '📧', SMS: '💬',
};

// ─── Message Bubble ──────────────────────────────────────────────────────────
const MessageBubble: React.FC<{ message: any }> = ({ message }) => {
  const isOut = message.direction === 'OUTBOUND';
  const time = format(new Date(message.createdAt), 'HH:mm');

  return (
    <div className={`flex ${isOut ? 'justify-end' : 'justify-start'} mb-2 group`}>
      <div className={`max-w-xs lg:max-w-md xl:max-w-lg ${isOut
        ? 'bg-whatsapp-light rounded-2xl rounded-tr-sm'
        : 'bg-white border border-gray-200 rounded-2xl rounded-tl-sm'
        } px-4 py-2 shadow-sm`}>

        {/* Media */}
        {message.type === 'IMAGE' && message.mediaUrl && (
          <img src={message.mediaUrl} alt="" className="rounded-xl mb-1 max-w-full" onError={e => (e.currentTarget.style.display = 'none')} />
        )}
        {message.type === 'DOCUMENT' && (
          <div className="flex items-center gap-2 p-2 bg-gray-100 rounded-lg mb-1">
            <PaperClipIcon className="w-4 h-4 text-gray-500 flex-shrink-0" />
            <span className="text-xs text-gray-700 truncate">{message.caption || 'Document'}</span>
          </div>
        )}
        {message.type === 'AUDIO' && (
          <div className="flex items-center gap-2 p-2 bg-gray-100 rounded-lg mb-1">
            <MicrophoneIcon className="w-4 h-4 text-gray-500" />
            <span className="text-xs text-gray-600">Voice message</span>
          </div>
        )}
        {message.type === 'LOCATION' && message.location && (
          <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg mb-1">
            <span className="text-lg">📍</span>
            <a href={`https://maps.google.com/?q=${message.location.latitude},${message.location.longitude}`}
              target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline">
              View Location
            </a>
          </div>
        )}
        {message.type === 'REACTION' && (
          <p className="text-2xl">{message.reaction}</p>
        )}

        {/* Text content */}
        {message.content && (
          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{message.content}</p>
        )}

        {/* Interactive buttons */}
        {message.interactive?.action?.buttons && (
          <div className="mt-2 space-y-1">
            {message.interactive.action.buttons.map((btn: any, i: number) => (
              <div key={i} className="px-3 py-1.5 bg-white border border-blue-200 rounded-lg text-xs text-blue-600 text-center">
                {btn.reply?.title || btn.title}
              </div>
            ))}
          </div>
        )}

        {/* Timestamp + status */}
        <div className={`flex items-center gap-1 mt-1 ${isOut ? 'justify-end' : 'justify-start'}`}>
          <span className="text-xs text-gray-400">{time}</span>
          {isOut && (
            <span className="text-xs leading-none">
              {message.status === 'READ' ? <span className="text-blue-500">✓✓</span>
                : message.status === 'DELIVERED' ? <span className="text-gray-500">✓✓</span>
                : message.status === 'FAILED' ? <XCircleIcon className="w-3 h-3 text-red-500 inline" />
                : <span className="text-gray-300">✓</span>}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Main InboxPage ───────────────────────────────────────────────────────────
const InboxPage: React.FC = () => {
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'open' | 'pending' | 'resolved'>('all');
  const [filter, setFilter] = useState({ status: '', channel: '' });
  const [showSaveContact, setShowSaveContact] = useState(false);
  const [contactForm, setContactForm] = useState({ firstName: '', lastName: '', email: '', company: '', jobTitle: '', gdprConsent: false });
  const [showEmoji, setShowEmoji] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [showLabels, setShowLabels] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showDetails, setShowDetails] = useState(true);
  const [paymentForm, setPaymentForm] = useState({ amount: '', currency: 'AED', description: '' });
  const [uploadingFile, setUploadingFile] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { socket } = useSocketStore();
  const qc = useQueryClient();

  // ── Data queries ─────────────────────────────────────────────────────────
  const tabStatusMap: Record<string, string> = { all: '', open: 'OPEN', pending: 'PENDING', resolved: 'RESOLVED' };

  const { data: conversations } = useQuery({
    queryKey: ['conversations', search, filter, activeTab],
    queryFn: () => conversationsApi.list({ search, ...filter, status: tabStatusMap[activeTab], limit: 200 }).then(r => r.data.data),
    refetchInterval: 5000,
  });

  const { data: selectedConv, refetch: refetchConv } = useQuery({
    queryKey: ['conversation', selectedConvId],
    queryFn: () => selectedConvId ? conversationsApi.get(selectedConvId).then(r => r.data) : null,
    enabled: !!selectedConvId,
  });

  const { data: messages, refetch: refetchMessages } = useQuery({
    queryKey: ['messages', selectedConvId],
    queryFn: () => selectedConvId ? conversationsApi.messages(selectedConvId, { limit: 100 }).then(r => r.data.data) : [],
    enabled: !!selectedConvId,
    refetchInterval: 4000,
  });

  const { data: users } = useQuery({ queryKey: ['users'], queryFn: () => usersApi.list().then(r => r.data) });
  const { data: teams } = useQuery({ queryKey: ['teams'], queryFn: () => teamsApi.list().then(r => r.data) });
  const { data: tags } = useQuery({ queryKey: ['tags'], queryFn: () => tagsApi.list().then(r => r.data) });
  const { data: quickReplies } = useQuery({ queryKey: ['kb'], queryFn: () => kbApi.list().then(r => r.data) });

  // ── Mutations ─────────────────────────────────────────────────────────────
  const sendMutation = useMutation({
    mutationFn: (data: any) => conversationsApi.sendMessage(selectedConvId!, data),
    onSuccess: () => { setMessage(''); refetchMessages(); qc.invalidateQueries({ queryKey: ['conversations'] }); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to send'),
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) => conversationsApi.updateStatus(selectedConvId!, status),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['conversations'] }); refetchConv(); },
  });

  const assignMutation = useMutation({
    mutationFn: (data: any) => conversationsApi.assign(selectedConvId!, data),
    onSuccess: () => { refetchConv(); setShowAssign(false); toast.success('Conversation assigned'); },
  });

  const labelMutation = useMutation({
    mutationFn: ({ tagId, action }: any) => action === 'add'
      ? api.post(`/conversations/${selectedConvId}/tags`, { tagId })
      : api.delete(`/conversations/${selectedConvId}/tags/${tagId}`),
    onSuccess: () => { refetchConv(); qc.invalidateQueries({ queryKey: ['conversations'] }); },
  });

  const saveContactMutation = useMutation({
    mutationFn: (data: any) => api.post(`/conversations/${selectedConvId}/save-contact`, data),
    onSuccess: () => { refetchConv(); setShowSaveContact(false); toast.success('Contact saved!'); qc.invalidateQueries({ queryKey: ['contacts'] }); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to save contact'),
  });

  // ── Socket ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (socket && selectedConvId) {
      socket.emit('join:conversation', selectedConvId);
      const handler = (msg: any) => {
        if (msg.conversationId === selectedConvId || msg.id) {
          refetchMessages();
          qc.invalidateQueries({ queryKey: ['conversations'] });
        }
      };
      socket.on('message:new', handler);
      return () => { socket.off('message:new', handler); };
    }
  }, [socket, selectedConvId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSend = () => {
    if (!message.trim()) return;
    sendMutation.mutate({ type: 'TEXT', content: message });
  };

  const handleEmoji = (emojiData: EmojiClickData) => {
    setMessage(prev => prev + emojiData.emoji);
    setShowEmoji(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFile(true);
    try {
      const isImage = file.type.startsWith('image/');
      const isAudio = file.type.startsWith('audio/');
      const isVideo = file.type.startsWith('video/');

      // Create object URL for preview/send
      const url = URL.createObjectURL(file);
      const type = isImage ? 'IMAGE' : isAudio ? 'AUDIO' : isVideo ? 'VIDEO' : 'DOCUMENT';

      sendMutation.mutate({
        type,
        mediaUrl: url,
        mediaType: file.type,
        caption: file.name,
        content: file.name,
      });
      toast.success(`${type.toLowerCase()} sent`);
    } catch {
      toast.error('File upload failed');
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAIReply = async () => {
    if (!selectedConvId || !messages?.length) return;
    setAiLoading(true);
    try {
      const lastMsg = messages.filter((m: any) => m.direction === 'INBOUND').slice(-1)[0]?.content || '';
      const { data } = await aiApi.generateReply(selectedConvId, lastMsg);
      setAiSuggestion(data.reply);
      setShowAI(true);
    } catch {
      toast.error('AI not available. Add OpenAI key in settings.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleSendPaymentLink = () => {
    if (!paymentForm.amount) return;
    const link = `https://pay.huco.ae/?amount=${paymentForm.amount}&currency=${paymentForm.currency}&desc=${encodeURIComponent(paymentForm.description)}`;
    const msg = `💳 *Payment Request*\n\nAmount: ${paymentForm.currency} ${paymentForm.amount}\nDescription: ${paymentForm.description}\n\nPay securely here: ${link}`;
    sendMutation.mutate({ type: 'TEXT', content: msg });
    setShowPayment(false);
    setPaymentForm({ amount: '', currency: 'AED', description: '' });
    toast.success('Payment link sent!');
  };

  const handleSendInvoice = () => {
    if (!paymentForm.amount) return;
    const msg = `🧾 *Invoice*\n\nAmount Due: ${paymentForm.currency} ${paymentForm.amount}\nDescription: ${paymentForm.description}\n\nPlease complete payment at your earliest convenience.\n\nThank you,\nHuco Digital Marketing Management`;
    sendMutation.mutate({ type: 'TEXT', content: msg });
    setShowPayment(false);
    setPaymentForm({ amount: '', currency: 'AED', description: '' });
    toast.success('Invoice sent!');
  };

  const contact = selectedConv?.contact;
  const currentTags = selectedConv?.tags || [];

  return (
    <div className="flex h-full overflow-hidden bg-gray-50">

      {/* ── Conversation List ─────────────────────────────────────────── */}
      <div className="w-72 flex-shrink-0 border-r border-gray-200 bg-white flex flex-col">
        <div className="p-3 border-b border-gray-200">
          <h2 className="text-base font-bold text-gray-900 mb-2">
            Inbox
            <span className="ml-2 text-xs bg-whatsapp-green text-white rounded-full px-1.5 py-0.5">
              {(conversations || []).filter((c: any) => c.status === 'OPEN').length}
            </span>
          </h2>

          {/* Tabs */}
          <div className="flex gap-0.5 bg-gray-100 rounded-lg p-0.5 mb-2">
            {[
              { key: 'all', label: 'All' },
              { key: 'open', label: 'Open' },
              { key: 'pending', label: 'Pending' },
              { key: 'resolved', label: 'Done' },
            ].map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
                className={`flex-1 text-xs py-1 rounded-md font-medium transition-colors ${activeTab === tab.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative mb-2">
            <MagnifyingGlassIcon className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400" />
            <input type="text" placeholder="Search..." className="w-full pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-whatsapp-green"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white" value={filter.channel} onChange={e => setFilter({ ...filter, channel: e.target.value })}>
            <option value="">All Channels</option>
            <option value="WHATSAPP">📱 WhatsApp</option>
            <option value="INSTAGRAM">📸 Instagram</option>
            <option value="EMAIL">📧 Email</option>
          </select>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
          {(conversations || []).map((conv: any) => (
            <div key={conv.id} onClick={() => setSelectedConvId(conv.id)}
              className={`p-3 cursor-pointer hover:bg-gray-50 transition-colors ${selectedConvId === conv.id ? 'bg-whatsapp-green/5 border-l-2 border-whatsapp-green' : ''}`}>
              <div className="flex items-center gap-2.5">
                <div className="relative flex-shrink-0">
                  <div className="w-9 h-9 bg-gradient-to-br from-whatsapp-green to-whatsapp-teal rounded-full flex items-center justify-center text-white text-xs font-bold">
                    {conv.contact?.firstName?.[0]}{conv.contact?.lastName?.[0] || ''}
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 text-xs">{channelIcons[conv.channel] || '💬'}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="text-xs font-semibold text-gray-900 truncate">{conv.contact?.firstName} {conv.contact?.lastName}</p>
                    <span className="text-xs text-gray-400 flex-shrink-0 ml-1">
                      {conv.lastMessageAt ? format(new Date(conv.lastMessageAt), 'HH:mm') : ''}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-xs text-gray-400 truncate">{conv.messages?.[0]?.content || '...'}</p>
                    <span className={`badge text-xs flex-shrink-0 ${statusColors[conv.status] || 'badge-gray'}`} style={{ fontSize: '9px', padding: '1px 5px' }}>
                      {conv.status}
                    </span>
                  </div>
                  {conv.tags?.length > 0 && (
                    <div className="flex gap-1 mt-1">
                      {conv.tags.slice(0, 2).map((t: any) => (
                        <span key={t.id} className="text-xs px-1.5 py-0 rounded-full text-white" style={{ backgroundColor: t.color, fontSize: '9px' }}>{t.name}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          {(!conversations || conversations.length === 0) && (
            <div className="p-8 text-center text-gray-400">
              <ChatBubbleLeftRightIcon className="w-8 h-8 mx-auto mb-2" />
              <p className="text-xs">No conversations yet</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Chat Area ─────────────────────────────────────────────────── */}
      {selectedConvId && selectedConv ? (
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 flex flex-col overflow-hidden">

            {/* Chat Header */}
            <div className="bg-white border-b border-gray-200 px-4 py-2.5 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-whatsapp-green to-whatsapp-teal rounded-full flex items-center justify-center text-white text-xs font-bold">
                  {contact?.firstName?.[0]}{contact?.lastName?.[0] || ''}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">{contact?.firstName} {contact?.lastName}</h3>
                  <p className="text-xs text-gray-400">{contact?.phone}</p>
                </div>
                <span className={`badge text-xs ${statusColors[selectedConv.status]}`}>{selectedConv.status}</span>
                {selectedConv.agent && (
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <UserPlusIcon className="w-3 h-3" />
                    {selectedConv.agent.firstName}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                {/* Resolve / Reopen */}
                {selectedConv.status === 'OPEN' && (
                  <button onClick={() => statusMutation.mutate('RESOLVED')}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-green-500 rounded-lg hover:bg-green-600">
                    <CheckSolid className="w-3.5 h-3.5" /> Resolve
                  </button>
                )}
                {selectedConv.status === 'RESOLVED' && (
                  <button onClick={() => statusMutation.mutate('OPEN')}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                    <ArrowPathIcon className="w-3.5 h-3.5" /> Reopen
                  </button>
                )}

                {/* Assign */}
                <div className="relative">
                  <button onClick={() => setShowAssign(!showAssign)}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100">
                    <UserPlusIcon className="w-3.5 h-3.5" /> Assign
                  </button>
                  {showAssign && (
                    <div className="absolute right-0 top-9 w-56 bg-white border border-gray-200 rounded-xl shadow-xl z-50 py-1">
                      <p className="text-xs font-semibold text-gray-500 uppercase px-3 py-2">Agents</p>
                      {(users || []).map((u: any) => (
                        <button key={u.id} onClick={() => assignMutation.mutate({ agentId: u.id })}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex items-center gap-2">
                          <div className="w-6 h-6 bg-whatsapp-green rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {u.firstName[0]}
                          </div>
                          {u.firstName} {u.lastName}
                          <span className="ml-auto text-gray-400">{u.role}</span>
                        </button>
                      ))}
                      <p className="text-xs font-semibold text-gray-500 uppercase px-3 py-2 border-t mt-1">Teams</p>
                      {(teams || []).map((t: any) => (
                        <button key={t.id} onClick={() => assignMutation.mutate({ teamId: t.id })}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50">
                          👥 {t.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Labels */}
                <div className="relative">
                  <button onClick={() => setShowLabels(!showLabels)}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100">
                    <TagIcon className="w-3.5 h-3.5" /> Labels
                  </button>
                  {showLabels && (
                    <div className="absolute right-0 top-9 w-48 bg-white border border-gray-200 rounded-xl shadow-xl z-50 py-2">
                      <p className="text-xs font-semibold text-gray-500 uppercase px-3 pb-2">Add Label</p>
                      {(tags || []).map((tag: any) => {
                        const isApplied = currentTags.some((t: any) => t.id === tag.id);
                        return (
                          <button key={tag.id}
                            onClick={() => labelMutation.mutate({ tagId: tag.id, action: isApplied ? 'remove' : 'add' })}
                            className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
                            {tag.name}
                            {isApplied && <CheckSolid className="w-3 h-3 text-green-500 ml-auto" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Payment */}
                <button onClick={() => setShowPayment(!showPayment)}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100">
                  <CurrencyDollarIcon className="w-3.5 h-3.5" /> Payment
                </button>

                {/* Toggle customer details */}
                <button onClick={() => setShowDetails(!showDetails)}
                  className={`p-1.5 rounded-lg text-xs ${showDetails ? 'bg-gray-200 text-gray-700' : 'text-gray-400 hover:bg-gray-100'}`}
                  title="Customer details">
                  <InformationCircleIcon className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Applied labels bar */}
            {currentTags.length > 0 && (
              <div className="bg-white border-b border-gray-100 px-4 py-1.5 flex items-center gap-2 flex-shrink-0">
                <TagIcon className="w-3.5 h-3.5 text-gray-400" />
                {currentTags.map((tag: any) => (
                  <span key={tag.id} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs text-white" style={{ backgroundColor: tag.color }}>
                    {tag.name}
                    <button onClick={() => labelMutation.mutate({ tagId: tag.id, action: 'remove' })} className="hover:opacity-70">✕</button>
                  </span>
                ))}
              </div>
            )}

            {/* Payment Modal */}
            {showPayment && (
              <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-3 flex-shrink-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <p className="text-xs font-semibold text-emerald-800">💳 Send Payment / Invoice</p>
                  <div className="flex gap-2 flex-1 flex-wrap">
                    <input className="input-field text-xs py-1.5 w-28" type="number" placeholder="Amount"
                      value={paymentForm.amount} onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })} />
                    <select className="input-field text-xs py-1.5 w-20" value={paymentForm.currency}
                      onChange={e => setPaymentForm({ ...paymentForm, currency: e.target.value })}>
                      {['AED', 'USD', 'EUR', 'GBP', 'INR', 'SAR'].map(c => <option key={c}>{c}</option>)}
                    </select>
                    <input className="input-field text-xs py-1.5 flex-1 min-w-32" placeholder="Description / Service"
                      value={paymentForm.description} onChange={e => setPaymentForm({ ...paymentForm, description: e.target.value })} />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleSendPaymentLink}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
                      <CurrencyDollarIcon className="w-3.5 h-3.5" /> Payment Link
                    </button>
                    <button onClick={handleSendInvoice}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                      <DocumentTextIcon className="w-3.5 h-3.5" /> Send Invoice
                    </button>
                    <button onClick={() => setShowPayment(false)} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg">
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
              {(messages || []).map((msg: any) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* AI Suggestion */}
            {showAI && aiSuggestion && (
              <div className="bg-indigo-50 border-t border-indigo-200 px-4 py-3 flex-shrink-0">
                <div className="flex items-start gap-2">
                  <SparklesIcon className="w-4 h-4 text-indigo-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-indigo-700 mb-1">✨ AI Suggested Reply</p>
                    <p className="text-sm text-gray-700">{aiSuggestion}</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => { setMessage(aiSuggestion); setShowAI(false); }}
                      className="text-xs px-2.5 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Use</button>
                    <button onClick={() => setShowAI(false)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg">
                      <XMarkIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Replies Panel */}
            {showQuickReplies && (
              <div className="bg-white border-t border-gray-200 flex-shrink-0 max-h-48 overflow-y-auto">
                <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-700">⚡ Quick Replies</p>
                  <button onClick={() => setShowQuickReplies(false)} className="text-gray-400 hover:text-gray-600">
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                </div>
                {(quickReplies || []).length === 0 ? (
                  <p className="text-xs text-gray-400 px-3 py-3">No quick replies. Add articles in Knowledge Base.</p>
                ) : (
                  (quickReplies || []).map((qr: any) => (
                    <button key={qr.id} onClick={() => { setMessage(qr.content); setShowQuickReplies(false); }}
                      className="w-full text-left px-3 py-2.5 hover:bg-gray-50 border-b border-gray-50">
                      <p className="text-xs font-semibold text-gray-800">{qr.title}</p>
                      <p className="text-xs text-gray-400 truncate mt-0.5">{qr.content}</p>
                    </button>
                  ))
                )}
              </div>
            )}

            {/* Emoji Picker */}
            {showEmoji && (
              <div className="flex-shrink-0 border-t border-gray-200">
                <EmojiPicker onEmojiClick={handleEmoji} width="100%" height={320}
                  searchDisabled={false} skinTonesDisabled lazyLoadEmojis />
              </div>
            )}

            {/* Message Input */}
            <div className="bg-white border-t border-gray-200 p-3 flex-shrink-0">
              {/* Toolbar */}
              <div className="flex items-center gap-1 mb-2">
                <button onClick={() => { setShowEmoji(!showEmoji); setShowQuickReplies(false); }}
                  className={`p-1.5 rounded-lg transition-colors ${showEmoji ? 'bg-yellow-100 text-yellow-600' : 'text-gray-400 hover:text-yellow-500 hover:bg-yellow-50'}`}
                  title="Emoji">
                  <FaceSmileIcon className="w-4 h-4" />
                </button>

                <button onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingFile}
                  className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Attach file">
                  <PaperClipIcon className="w-4 h-4" />
                </button>
                <input ref={fileInputRef} type="file" className="hidden"
                  accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx"
                  onChange={handleFileUpload} />

                <button onClick={() => { setShowQuickReplies(!showQuickReplies); setShowEmoji(false); }}
                  className={`p-1.5 rounded-lg transition-colors ${showQuickReplies ? 'bg-purple-100 text-purple-600' : 'text-gray-400 hover:text-purple-500 hover:bg-purple-50'}`}
                  title="Quick replies">
                  <BoltIcon className="w-4 h-4" />
                </button>

                <button onClick={handleAIReply} disabled={aiLoading}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors ml-auto
                    ${aiLoading ? 'text-gray-400' : 'text-indigo-600 hover:bg-indigo-50'}`}
                  title="AI Reply">
                  {aiLoading
                    ? <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />
                    : <SparklesIcon className="w-3.5 h-3.5" />}
                  <span>AI Reply</span>
                </button>
              </div>

              {/* Text area + send */}
              <div className="flex gap-2">
                <textarea rows={3}
                  placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-whatsapp-green/40 transition-all"
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
                  }}
                />
                <button onClick={handleSend}
                  disabled={!message.trim() || sendMutation.isPending}
                  className="w-11 h-11 self-end bg-whatsapp-green text-white rounded-xl hover:bg-whatsapp-teal transition-colors flex items-center justify-center disabled:opacity-50 flex-shrink-0 shadow-sm">
                  <PaperAirplaneIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* ── Customer Details Sidebar ──────────────────────────────── */}
          {showDetails && (
            <div className="w-72 flex-shrink-0 border-l border-gray-200 bg-white overflow-y-auto">
              {/* Save Contact Modal */}
              {showSaveContact && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                  <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
                    <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
                      <h2 className="text-base font-semibold">Save / Update Contact</h2>
                      <button onClick={() => setShowSaveContact(false)} className="text-gray-400">✕</button>
                    </div>
                    <div className="p-5 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">First Name</label>
                          <input className="input-field text-sm" value={contactForm.firstName} onChange={e => setContactForm({ ...contactForm, firstName: e.target.value })} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Last Name</label>
                          <input className="input-field text-sm" value={contactForm.lastName} onChange={e => setContactForm({ ...contactForm, lastName: e.target.value })} />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                        <input type="email" className="input-field text-sm" placeholder="email@example.com" value={contactForm.email} onChange={e => setContactForm({ ...contactForm, email: e.target.value })} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Company</label>
                        <input className="input-field text-sm" value={contactForm.company} onChange={e => setContactForm({ ...contactForm, company: e.target.value })} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Job Title</label>
                        <input className="input-field text-sm" value={contactForm.jobTitle} onChange={e => setContactForm({ ...contactForm, jobTitle: e.target.value })} />
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={contactForm.gdprConsent} onChange={e => setContactForm({ ...contactForm, gdprConsent: e.target.checked })} className="rounded" />
                        <span className="text-xs text-gray-700">GDPR Consent obtained</span>
                      </label>
                      <div className="flex gap-3 pt-2">
                        <button onClick={() => setShowSaveContact(false)} className="btn-secondary flex-1">Cancel</button>
                        <button onClick={() => saveContactMutation.mutate(contactForm)} disabled={saveContactMutation.isPending} className="btn-primary flex-1">
                          {saveContactMutation.isPending ? 'Saving...' : 'Save Contact'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Contact info */}
              <div className="p-4 border-b border-gray-100">
                <div className="text-center mb-3">
                  <div className="w-14 h-14 bg-gradient-to-br from-whatsapp-green to-whatsapp-teal rounded-full flex items-center justify-center text-white text-xl font-bold mx-auto mb-2">
                    {contact?.firstName?.[0]}{contact?.lastName?.[0] || ''}
                  </div>
                  <h3 className="text-sm font-bold text-gray-900">{contact?.firstName} {contact?.lastName}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">{contact?.company || 'No company'}</p>
                  {contact?.gdprConsent && <span className="badge badge-green text-xs mt-1">✓ GDPR Consent</span>}
                </div>

                <div className="space-y-2">
                  {contact?.phone && (
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <PhoneIcon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <a href={`tel:${contact.phone}`} className="hover:text-whatsapp-teal">{contact.phone}</a>
                    </div>
                  )}
                  {contact?.email && (
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <EnvelopeIcon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <a href={`mailto:${contact.email}`} className="hover:text-whatsapp-teal truncate">{contact.email}</a>
                    </div>
                  )}
                  {contact?.company && (
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <BuildingOfficeIcon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span>{contact.company}</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-1.5 mt-3">
                  <a href={`tel:${contact?.phone}`}
                    className="flex items-center justify-center gap-1 py-1.5 text-xs text-whatsapp-teal bg-whatsapp-green/10 rounded-lg hover:bg-whatsapp-green/20">
                    <PhoneIcon className="w-3 h-3" /> Call
                  </a>
                  <a href={`https://wa.me/${contact?.phone?.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
                    className="flex items-center justify-center gap-1 py-1.5 text-xs text-whatsapp-teal bg-whatsapp-green/10 rounded-lg hover:bg-whatsapp-green/20">
                    <ChatBubbleLeftRightIcon className="w-3 h-3" /> WA
                  </a>
                  <button onClick={() => {
                    setContactForm({ firstName: contact?.firstName || '', lastName: contact?.lastName || '', email: contact?.email || '', company: contact?.company || '', jobTitle: contact?.jobTitle || '', gdprConsent: contact?.gdprConsent || false });
                    setShowSaveContact(true);
                  }}
                    className="flex items-center justify-center gap-1 py-1.5 text-xs text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100">
                    ✏️ Edit
                  </button>
                </div>
              </div>

              {/* Conversation info */}
              <div className="p-3 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Conversation</p>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Status</span>
                    <span className={`badge ${statusColors[selectedConv.status]}`}>{selectedConv.status}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Channel</span>
                    <span className="font-medium">{channelIcons[selectedConv.channel]} {selectedConv.channel}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Assigned</span>
                    <span className="font-medium text-gray-700">
                      {selectedConv.agent ? `${selectedConv.agent.firstName} ${selectedConv.agent.lastName}` : 'Unassigned'}
                    </span>
                  </div>
                  {selectedConv.team && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Team</span>
                      <span className="font-medium">{selectedConv.team.name}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-500">Started</span>
                    <span className="font-medium">{format(new Date(selectedConv.createdAt), 'MMM d, HH:mm')}</span>
                  </div>
                  {selectedConv.summary && (
                    <div className="mt-2 p-2 bg-indigo-50 rounded-lg">
                      <p className="text-xs text-indigo-700 font-semibold mb-1">AI Summary</p>
                      <p className="text-xs text-gray-700">{selectedConv.summary}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Labels */}
              {currentTags.length > 0 && (
                <div className="p-3 border-b border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Labels</p>
                  <div className="flex flex-wrap gap-1.5">
                    {currentTags.map((tag: any) => (
                      <span key={tag.id} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs text-white" style={{ backgroundColor: tag.color }}>
                        {tag.name}
                        <button onClick={() => labelMutation.mutate({ tagId: tag.id, action: 'remove' })} className="hover:opacity-70 text-xs">✕</button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Previous conversations */}
              <div className="p-3 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Contact History</p>
                <div className="space-y-1">
                  {contact?.leads?.length > 0 && (
                    <div className="flex items-center justify-between text-xs py-1">
                      <span className="text-gray-500 flex items-center gap-1"><ArrowRightIcon className="w-3 h-3" /> Leads</span>
                      <span className="badge badge-blue">{contact.leads.length}</span>
                    </div>
                  )}
                  {contact?.deals?.length > 0 && (
                    <div className="flex items-center justify-between text-xs py-1">
                      <span className="text-gray-500 flex items-center gap-1"><ArrowRightIcon className="w-3 h-3" /> Deals</span>
                      <span className="badge badge-green">{contact.deals.length}</span>
                    </div>
                  )}
                  {contact?.tickets?.length > 0 && (
                    <div className="flex items-center justify-between text-xs py-1">
                      <span className="text-gray-500 flex items-center gap-1"><ArrowRightIcon className="w-3 h-3" /> Tickets</span>
                      <span className="badge badge-yellow">{contact.tickets.length}</span>
                    </div>
                  )}
                  {contact?.orders?.length > 0 && (
                    <div className="flex items-center justify-between text-xs py-1">
                      <span className="text-gray-500 flex items-center gap-1"><ArrowRightIcon className="w-3 h-3" /> Orders</span>
                      <span className="badge badge-purple">{contact.orders.length}</span>
                    </div>
                  )}
                  {!contact?.leads?.length && !contact?.deals?.length && !contact?.tickets?.length && (
                    <p className="text-xs text-gray-400">No history yet</p>
                  )}
                </div>
              </div>

              {/* Quick actions */}
              <div className="p-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Quick Actions</p>
                <div className="space-y-1.5">
                  <button onClick={() => setShowPayment(true)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100">
                    <CurrencyDollarIcon className="w-3.5 h-3.5" /> Send Payment Link
                  </button>
                  <button onClick={() => setShowPayment(true)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100">
                    <DocumentTextIcon className="w-3.5 h-3.5" /> Send Invoice
                  </button>
                  <button onClick={handleAIReply}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100">
                    <SparklesIcon className="w-3.5 h-3.5" /> AI Reply Suggestion
                  </button>
                  <button onClick={() => {
                    setContactForm({ firstName: contact?.firstName || '', lastName: contact?.lastName || '', email: contact?.email || '', company: contact?.company || '', jobTitle: contact?.jobTitle || '', gdprConsent: contact?.gdprConsent || false });
                    setShowSaveContact(true);
                  }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100">
                    <UserPlusIcon className="w-3.5 h-3.5" /> Save / Update Contact
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="w-20 h-20 bg-whatsapp-green/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <ChatBubbleLeftRightIcon className="w-10 h-10 text-whatsapp-teal" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Select a conversation</h3>
            <p className="text-gray-400 text-sm mt-1">Choose from the list to start chatting</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default InboxPage;
