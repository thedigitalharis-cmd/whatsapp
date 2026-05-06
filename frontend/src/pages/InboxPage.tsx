import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MagnifyingGlassIcon, PaperAirplaneIcon, PaperClipIcon,
  FaceSmileIcon, XMarkIcon, SparklesIcon, MicrophoneIcon,
  TagIcon, UserPlusIcon, EllipsisVerticalIcon, PhoneIcon,
  EnvelopeIcon, BuildingOfficeIcon, CurrencyDollarIcon,
  DocumentTextIcon, ArrowPathIcon, CheckCircleIcon,
  ChatBubbleLeftRightIcon, BoltIcon, ArrowRightIcon,
  InformationCircleIcon, BellIcon, UserGroupIcon,
  NoSymbolIcon, ArchiveBoxIcon, TrashIcon, FlagIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckSolid, XCircleIcon } from '@heroicons/react/24/solid';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import { conversationsApi, aiApi, usersApi, teamsApi, tagsApi, kbApi, api, contactsApi } from '../services/api';
import { useSocketStore } from '../store/socketStore';
import { format, formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

const statusColors: Record<string, string> = {
  OPEN: 'bg-green-100 text-green-700',
  PENDING: 'bg-yellow-100 text-yellow-700',
  RESOLVED: 'bg-gray-100 text-gray-600',
  SNOOZED: 'bg-blue-100 text-blue-700',
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
    <div className={`flex ${isOut ? 'justify-end' : 'justify-start'} mb-2 px-4`}>
      {!isOut && (
        <div className="w-7 h-7 bg-gradient-to-br from-whatsapp-green to-whatsapp-teal rounded-full flex items-center justify-center text-white text-xs font-bold mr-2 flex-shrink-0 self-end mb-1">
          C
        </div>
      )}
      <div className={`max-w-xs lg:max-w-md xl:max-w-lg ${isOut
        ? 'bg-whatsapp-light rounded-2xl rounded-tr-sm'
        : 'bg-white border border-gray-100 rounded-2xl rounded-tl-sm shadow-sm'
      } px-3.5 py-2`}>
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
            <div className="flex-1 h-1 bg-gray-300 rounded-full"><div className="h-1 bg-whatsapp-teal rounded-full w-1/2" /></div>
            <span className="text-xs text-gray-500">0:30</span>
          </div>
        )}
        {message.type === 'LOCATION' && message.location && (
          <a href={`https://maps.google.com/?q=${message.location.latitude},${message.location.longitude}`}
            target="_blank" rel="noreferrer"
            className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg mb-1 text-blue-600 text-xs">
            📍 View Location
          </a>
        )}
        {message.content && <p className="text-sm leading-relaxed whitespace-pre-wrap break-words text-gray-800">{message.content}</p>}
        {message.interactive?.action?.buttons && (
          <div className="mt-2 space-y-1">
            {message.interactive.action.buttons.map((btn: any, i: number) => (
              <div key={i} className="px-3 py-1.5 border border-blue-200 rounded-lg text-xs text-blue-600 text-center bg-white">{btn.reply?.title}</div>
            ))}
          </div>
        )}
        <div className={`flex items-center gap-1 mt-1 ${isOut ? 'justify-end' : 'justify-start'}`}>
          <span className="text-xs text-gray-400">{time}</span>
          {isOut && (
            message.status === 'READ' ? <span className="text-blue-500 text-xs">✓✓</span>
              : message.status === 'DELIVERED' ? <span className="text-gray-400 text-xs">✓✓</span>
                : message.status === 'FAILED' ? <XCircleIcon className="w-3 h-3 text-red-500" />
                  : <span className="text-gray-300 text-xs">✓</span>
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
  const [filter, setFilter] = useState({ channel: '' });
  const [showEmoji, setShowEmoji] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [showLabels, setShowLabels] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showDetails, setShowDetails] = useState(true);
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [showSaveContact, setShowSaveContact] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ amount: '', currency: 'AED', description: '' });
  const [followUpForm, setFollowUpForm] = useState({ title: '', message: '', scheduledAt: '', type: 'MANUAL', recurringDays: '' });
  const [contactForm, setContactForm] = useState({ firstName: '', lastName: '', email: '', company: '', jobTitle: '', gdprConsent: false });
  const [groupName, setGroupName] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const { socket } = useSocketStore();
  const qc = useQueryClient();

  const tabStatusMap: Record<string, string> = { all: '', open: 'OPEN', pending: 'PENDING', resolved: 'RESOLVED' };

  const { data: conversations, refetch: refetchConvList } = useQuery({
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
  const { data: contactGroups } = useQuery({ queryKey: ['contact-groups'], queryFn: () => api.get('/contacts/groups').then(r => r.data) });

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
    onSuccess: () => { refetchConv(); setShowAssign(false); toast.success('Assigned'); },
  });

  const labelMutation = useMutation({
    mutationFn: ({ tagId, action }: any) => action === 'add'
      ? api.post(`/conversations/${selectedConvId}/tags`, { tagId })
      : api.delete(`/conversations/${selectedConvId}/tags/${tagId}`),
    onSuccess: () => { refetchConv(); qc.invalidateQueries({ queryKey: ['conversations'] }); },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/conversations/${selectedConvId}`),
    onSuccess: () => {
      setSelectedConvId(null);
      setShowDeleteConfirm(false);
      qc.invalidateQueries({ queryKey: ['conversations'] });
      toast.success('Conversation deleted');
    },
    onError: () => toast.error('Could not delete'),
  });

  const archiveMutation = useMutation({
    mutationFn: () => conversationsApi.updateStatus(selectedConvId!, 'RESOLVED'),
    onSuccess: () => {
      setSelectedConvId(null);
      qc.invalidateQueries({ queryKey: ['conversations'] });
      toast.success('Conversation archived');
    },
  });

  const blockMutation = useMutation({
    mutationFn: () => api.put(`/contacts/${selectedConv?.contact?.id}`, { isBlocked: !selectedConv?.contact?.isBlocked }),
    onSuccess: () => {
      refetchConv();
      toast.success(selectedConv?.contact?.isBlocked ? 'Contact unblocked' : 'Contact blocked');
      setShowMoreMenu(false);
    },
  });

  const saveContactMutation = useMutation({
    mutationFn: (data: any) => api.post(`/conversations/${selectedConvId}/save-contact`, data),
    onSuccess: () => { refetchConv(); setShowSaveContact(false); toast.success('Contact saved!'); },
  });

  const followUpMutation = useMutation({
    mutationFn: (data: any) => api.post('/follow-ups', data),
    onSuccess: () => { setShowFollowUp(false); setFollowUpForm({ title: '', message: '', scheduledAt: '', type: 'MANUAL', recurringDays: '' }); toast.success('✅ Follow-up scheduled!'); },
  });

  const createGroupMutation = useMutation({
    mutationFn: () => api.post('/contacts/groups', { name: groupName }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contact-groups'] }); setShowGroupModal(false); setGroupName(''); toast.success('Group created'); },
  });

  // Close more menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) setShowMoreMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

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
      const url = URL.createObjectURL(file);
      const type = isImage ? 'IMAGE' : isAudio ? 'AUDIO' : isVideo ? 'VIDEO' : 'DOCUMENT';
      sendMutation.mutate({ type, mediaUrl: url, mediaType: file.type, caption: file.name, content: file.name });
      toast.success(`${file.name} sent`);
    } catch { toast.error('Upload failed'); }
    finally { setUploadingFile(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const handleAIReply = async () => {
    if (!selectedConvId || !messages?.length) return;
    setAiLoading(true);
    try {
      const lastMsg = messages.filter((m: any) => m.direction === 'INBOUND').slice(-1)[0]?.content || '';
      const { data } = await aiApi.generateReply(selectedConvId, lastMsg);
      setAiSuggestion(data.reply);
      setShowAI(true);
    } catch { toast.error('AI not available — add OpenAI key in Settings'); }
    finally { setAiLoading(false); }
  };

  const handleSendPaymentLink = () => {
    if (!paymentForm.amount) return;
    const link = `https://pay.betteraisender.com/?amount=${paymentForm.amount}&currency=${paymentForm.currency}&desc=${encodeURIComponent(paymentForm.description)}`;
    sendMutation.mutate({ type: 'TEXT', content: `💳 *Payment Request*\n\nAmount: ${paymentForm.currency} ${paymentForm.amount}\nDescription: ${paymentForm.description}\n\nPay here: ${link}` });
    setShowPayment(false);
    setPaymentForm({ amount: '', currency: 'AED', description: '' });
    toast.success('Payment link sent!');
  };

  const handleSendInvoice = () => {
    if (!paymentForm.amount) return;
    sendMutation.mutate({ type: 'TEXT', content: `🧾 *Invoice*\n\nAmount Due: ${paymentForm.currency} ${paymentForm.amount}\nDescription: ${paymentForm.description}\n\nPlease complete payment at your earliest convenience.\n\nThank you,\nHuco Digital Marketing Management` });
    setShowPayment(false);
    setPaymentForm({ amount: '', currency: 'AED', description: '' });
    toast.success('Invoice sent!');
  };

  const contact = selectedConv?.contact;
  const currentTags = selectedConv?.tags || [];
  const openCount = (conversations || []).filter((c: any) => c.status === 'OPEN').length;

  return (
    <div className="flex h-full overflow-hidden bg-white">

      {/* ── Modals ────────────────────────────────────────────────────────── */}

      {/* Delete Confirm */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 text-center">
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <TrashIcon className="w-7 h-7 text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Delete Conversation?</h3>
            <p className="text-sm text-gray-500 mb-5">All messages will be permanently deleted. This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}
                className="flex-1 py-2 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 disabled:opacity-50">
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Group Modal */}
      {showGroupModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-base font-semibold">Create Contact Group</h2>
              <button onClick={() => setShowGroupModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Group Name</label>
                <input className="input-field" placeholder="e.g. VIP Clients, UAE Leads..." value={groupName} onChange={e => setGroupName(e.target.value)} />
              </div>
              <div className="border border-gray-200 rounded-xl p-3">
                <p className="text-xs font-medium text-gray-600 mb-2">Existing Groups</p>
                {(contactGroups || []).length === 0
                  ? <p className="text-xs text-gray-400">No groups yet</p>
                  : (contactGroups || []).map((g: any) => (
                    <div key={g.id} className="flex items-center gap-2 py-1.5">
                      <UserGroupIcon className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-700">{g.name}</span>
                      <span className="ml-auto text-xs text-gray-400">{g._count?.contacts || 0} contacts</span>
                    </div>
                  ))
                }
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowGroupModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={() => createGroupMutation.mutate()} disabled={!groupName || createGroupMutation.isPending} className="btn-primary flex-1">
                  Create Group
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Follow-up Modal */}
      {showFollowUp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center gap-2">
              <BellIcon className="w-5 h-5 text-orange-500" />
              <h2 className="text-base font-semibold">Schedule Follow-up</h2>
              <button onClick={() => setShowFollowUp(false)} className="ml-auto text-gray-400">✕</button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Label</label>
                <input className="input-field text-sm" placeholder="e.g. Check if interested" value={followUpForm.title} onChange={e => setFollowUpForm({ ...followUpForm, title: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Message to Send *</label>
                <textarea className="input-field text-sm" rows={3} placeholder="Hi! Just following up..."
                  value={followUpForm.message} onChange={e => setFollowUpForm({ ...followUpForm, message: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Send Date & Time *</label>
                <input type="datetime-local" className="input-field text-sm" value={followUpForm.scheduledAt} onChange={e => setFollowUpForm({ ...followUpForm, scheduledAt: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
                <select className="input-field text-sm" value={followUpForm.type} onChange={e => setFollowUpForm({ ...followUpForm, type: e.target.value })}>
                  <option value="MANUAL">One-time</option>
                  <option value="RECURRING">Recurring</option>
                </select>
              </div>
              {followUpForm.type === 'RECURRING' && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Repeat every (days)</label>
                  <input type="number" min="1" className="input-field text-sm" placeholder="7" value={followUpForm.recurringDays} onChange={e => setFollowUpForm({ ...followUpForm, recurringDays: e.target.value })} />
                </div>
              )}
              <div className="flex gap-3 pt-1">
                <button onClick={() => setShowFollowUp(false)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={() => followUpMutation.mutate({ ...followUpForm, conversationId: selectedConvId, contactId: contact?.id, recurringDays: followUpForm.recurringDays ? Number(followUpForm.recurringDays) : undefined })}
                  disabled={!followUpForm.message || !followUpForm.scheduledAt || followUpMutation.isPending}
                  className="btn-primary flex-1">
                  {followUpMutation.isPending ? 'Scheduling...' : '📅 Schedule'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Save Contact Modal */}
      {showSaveContact && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-base font-semibold">Save Contact</h2>
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
                <input type="email" className="input-field text-sm" value={contactForm.email} onChange={e => setContactForm({ ...contactForm, email: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Company</label>
                <input className="input-field text-sm" value={contactForm.company} onChange={e => setContactForm({ ...contactForm, company: e.target.value })} />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={contactForm.gdprConsent} onChange={e => setContactForm({ ...contactForm, gdprConsent: e.target.checked })} className="rounded" />
                <span className="text-xs text-gray-700">GDPR Consent</span>
              </label>
              <div className="flex gap-3">
                <button onClick={() => setShowSaveContact(false)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={() => saveContactMutation.mutate(contactForm)} disabled={saveContactMutation.isPending} className="btn-primary flex-1">
                  {saveContactMutation.isPending ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Left: Conversation List ───────────────────────────────────────── */}
      <div className="w-80 flex-shrink-0 border-r border-gray-200 bg-white flex flex-col">

        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-bold text-gray-900">Inbox
              {openCount > 0 && (
                <span className="ml-2 text-xs bg-whatsapp-green text-white rounded-full px-2 py-0.5">{openCount}</span>
              )}
            </h1>
            <button onClick={() => setShowGroupModal(true)}
              className="flex items-center gap-1 text-xs text-whatsapp-teal hover:bg-whatsapp-green/10 px-2 py-1.5 rounded-lg transition-colors">
              <UserGroupIcon className="w-4 h-4" />
              Groups
            </button>
          </div>

          {/* Status Tabs */}
          <div className="flex bg-gray-100 rounded-xl p-1 mb-3">
            {[
              { key: 'all', label: 'All' },
              { key: 'open', label: 'Open' },
              { key: 'pending', label: 'Pending' },
              { key: 'resolved', label: 'Done' },
            ].map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
                className={`flex-1 text-xs py-1.5 rounded-lg font-medium transition-all ${activeTab === tab.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Search conversations..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-whatsapp-green/30 focus:border-whatsapp-green/50"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto">
          {(conversations || []).length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400">
              <ChatBubbleLeftRightIcon className="w-10 h-10 mb-2 opacity-40" />
              <p className="text-sm">No conversations</p>
            </div>
          ) : (
            (conversations || []).map((conv: any) => (
              <div key={conv.id}
                onClick={() => setSelectedConvId(conv.id)}
                className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-all hover:bg-gray-50 border-b border-gray-50
                  ${selectedConvId === conv.id ? 'bg-whatsapp-green/5 border-l-[3px] border-l-whatsapp-green' : 'border-l-[3px] border-l-transparent'}`}>

                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <div className="w-11 h-11 bg-gradient-to-br from-whatsapp-green to-whatsapp-teal rounded-full flex items-center justify-center text-white text-sm font-bold">
                    {conv.contact?.firstName?.[0]?.toUpperCase()}{conv.contact?.lastName?.[0]?.toUpperCase() || ''}
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 text-sm leading-none">{channelIcons[conv.channel] || '💬'}</span>
                  {conv.status === 'OPEN' && (
                    <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-green-400 border-2 border-white rounded-full"></span>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {conv.contact?.firstName} {conv.contact?.lastName}
                    </p>
                    <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                      {conv.lastMessageAt ? format(new Date(conv.lastMessageAt), 'HH:mm') : ''}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 truncate mb-1">
                    {conv.messages?.[0]?.content || 'No messages yet'}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${statusColors[conv.status]}`}>
                      {conv.status}
                    </span>
                    {conv.tags?.slice(0, 2).map((t: any) => (
                      <span key={t.id} className="text-xs px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: t.color, fontSize: '10px' }}>
                        {t.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Center: Chat ──────────────────────────────────────────────────── */}
      {selectedConvId && selectedConv ? (
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">

          {/* Chat Header */}
          <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 flex-shrink-0">
            <div className="w-9 h-9 bg-gradient-to-br from-whatsapp-green to-whatsapp-teal rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
              {contact?.firstName?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-gray-900 truncate">{contact?.firstName} {contact?.lastName}</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[selectedConv.status]}`}>
                  {selectedConv.status}
                </span>
                {contact?.isBlocked && <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">Blocked</span>}
              </div>
              <p className="text-xs text-gray-400">{contact?.phone} {selectedConv.agent ? `· ${selectedConv.agent.firstName}` : '· Unassigned'}</p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {/* Resolve/Reopen */}
              {selectedConv.status === 'OPEN' ? (
                <button onClick={() => statusMutation.mutate('RESOLVED')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 text-white text-xs font-semibold rounded-lg hover:bg-green-600">
                  <CheckSolid className="w-3.5 h-3.5" /> Resolve
                </button>
              ) : (
                <button onClick={() => statusMutation.mutate('OPEN')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-200">
                  <ArrowPathIcon className="w-3.5 h-3.5" /> Reopen
                </button>
              )}

              {/* Assign */}
              <div className="relative">
                <button onClick={() => { setShowAssign(!showAssign); setShowLabels(false); setShowMoreMenu(false); }}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100">
                  <UserPlusIcon className="w-3.5 h-3.5" /> Assign
                </button>
                {showAssign && (
                  <div className="absolute right-0 top-10 w-56 bg-white border border-gray-200 rounded-2xl shadow-2xl z-50 py-2 overflow-hidden">
                    <p className="text-xs font-semibold text-gray-400 uppercase px-3 pb-1.5">Agents</p>
                    {(users || []).map((u: any) => (
                      <button key={u.id} onClick={() => assignMutation.mutate({ agentId: u.id })}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2.5">
                        <div className="w-7 h-7 bg-whatsapp-green rounded-full flex items-center justify-center text-white text-xs font-bold">{u.firstName[0]}</div>
                        <div><p className="text-sm font-medium">{u.firstName} {u.lastName}</p><p className="text-xs text-gray-400">{u.role}</p></div>
                        {selectedConv.agentId === u.id && <CheckSolid className="w-4 h-4 text-green-500 ml-auto" />}
                      </button>
                    ))}
                    {(teams || []).length > 0 && <>
                      <div className="border-t border-gray-100 my-1" />
                      <p className="text-xs font-semibold text-gray-400 uppercase px-3 pb-1.5">Teams</p>
                      {(teams || []).map((t: any) => (
                        <button key={t.id} onClick={() => assignMutation.mutate({ teamId: t.id })}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2">
                          <UserGroupIcon className="w-4 h-4 text-gray-400" /> {t.name}
                        </button>
                      ))}
                    </>}
                  </div>
                )}
              </div>

              {/* Labels */}
              <div className="relative">
                <button onClick={() => { setShowLabels(!showLabels); setShowAssign(false); setShowMoreMenu(false); }}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100">
                  <TagIcon className="w-3.5 h-3.5" /> Labels
                </button>
                {showLabels && (
                  <div className="absolute right-0 top-10 w-48 bg-white border border-gray-200 rounded-2xl shadow-2xl z-50 py-2">
                    {(tags || []).map((tag: any) => {
                      const applied = currentTags.some((t: any) => t.id === tag.id);
                      return (
                        <button key={tag.id} onClick={() => labelMutation.mutate({ tagId: tag.id, action: applied ? 'remove' : 'add' })}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
                          {tag.name}
                          {applied && <CheckSolid className="w-4 h-4 text-green-500 ml-auto" />}
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

              {/* Follow-up */}
              <button onClick={() => setShowFollowUp(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-orange-700 bg-orange-50 rounded-lg hover:bg-orange-100">
                <BellIcon className="w-3.5 h-3.5" /> Follow-up
              </button>

              {/* More menu */}
              <div className="relative" ref={moreMenuRef}>
                <button onClick={() => { setShowMoreMenu(!showMoreMenu); setShowAssign(false); setShowLabels(false); }}
                  className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
                  <EllipsisVerticalIcon className="w-5 h-5" />
                </button>
                {showMoreMenu && (
                  <div className="absolute right-0 top-10 w-52 bg-white border border-gray-200 rounded-2xl shadow-2xl z-50 py-1.5 overflow-hidden">
                    <button onClick={() => { setContactForm({ firstName: contact?.firstName || '', lastName: contact?.lastName || '', email: contact?.email || '', company: contact?.company || '', jobTitle: contact?.jobTitle || '', gdprConsent: contact?.gdprConsent || false }); setShowSaveContact(true); setShowMoreMenu(false); }}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-3">
                      <UserPlusIcon className="w-4 h-4 text-gray-400" /> Save Contact
                    </button>
                    <button onClick={() => { setShowGroupModal(true); setShowMoreMenu(false); }}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-3">
                      <UserGroupIcon className="w-4 h-4 text-gray-400" /> Manage Groups
                    </button>
                    <div className="border-t border-gray-100 my-1" />
                    <button onClick={() => { archiveMutation.mutate(); setShowMoreMenu(false); }}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-amber-50 text-amber-700 flex items-center gap-3">
                      <ArchiveBoxIcon className="w-4 h-4" /> Archive Chat
                    </button>
                    <button onClick={() => blockMutation.mutate()}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-red-50 text-red-600 flex items-center gap-3">
                      <NoSymbolIcon className="w-4 h-4" /> {contact?.isBlocked ? 'Unblock Contact' : 'Block Contact'}
                    </button>
                    <button onClick={() => { setShowDeleteConfirm(true); setShowMoreMenu(false); }}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-red-50 text-red-600 flex items-center gap-3">
                      <TrashIcon className="w-4 h-4" /> Delete Chat
                    </button>
                  </div>
                )}
              </div>

              {/* Info toggle */}
              <button onClick={() => setShowDetails(!showDetails)}
                className={`p-1.5 rounded-lg transition-colors ${showDetails ? 'bg-gray-200 text-gray-700' : 'text-gray-400 hover:bg-gray-100'}`}>
                <InformationCircleIcon className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Applied Labels */}
          {currentTags.length > 0 && (
            <div className="bg-white border-b border-gray-100 px-4 py-2 flex items-center gap-2 flex-wrap">
              {currentTags.map((tag: any) => (
                <span key={tag.id} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs text-white font-medium" style={{ backgroundColor: tag.color }}>
                  {tag.name}
                  <button onClick={() => labelMutation.mutate({ tagId: tag.id, action: 'remove' })} className="hover:opacity-70 ml-0.5">×</button>
                </span>
              ))}
            </div>
          )}

          {/* Payment Panel */}
          {showPayment && (
            <div className="bg-emerald-50 border-b border-emerald-100 px-4 py-3 flex items-center gap-3 flex-wrap flex-shrink-0">
              <CurrencyDollarIcon className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <p className="text-xs font-semibold text-emerald-800">Send Payment / Invoice</p>
              <input className="input-field text-xs py-1.5 w-28" type="number" placeholder="Amount"
                value={paymentForm.amount} onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })} />
              <select className="input-field text-xs py-1.5 w-20" value={paymentForm.currency}
                onChange={e => setPaymentForm({ ...paymentForm, currency: e.target.value })}>
                {['AED', 'USD', 'EUR', 'GBP', 'INR', 'SAR'].map(c => <option key={c}>{c}</option>)}
              </select>
              <input className="input-field text-xs py-1.5 flex-1 min-w-32" placeholder="Description"
                value={paymentForm.description} onChange={e => setPaymentForm({ ...paymentForm, description: e.target.value })} />
              <button onClick={handleSendPaymentLink} className="px-3 py-1.5 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">Payment Link</button>
              <button onClick={handleSendInvoice} className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700">Invoice</button>
              <button onClick={() => setShowPayment(false)} className="p-1 text-gray-400 hover:text-gray-600"><XMarkIcon className="w-4 h-4" /></button>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto py-4 bg-gray-50" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'20\' height=\'20\' viewBox=\'0 0 20 20\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'%23e5e7eb\' fill-opacity=\'0.4\'%3E%3Cpolygon points=\'20 10 10 0 0 0 0 10\'/%3E%3C/g%3E%3C/svg%3E")' }}>
            {(messages || []).map((msg: any) => <MessageBubble key={msg.id} message={msg} />)}
            <div ref={messagesEndRef} />
          </div>

          {/* AI Suggestion */}
          {showAI && aiSuggestion && (
            <div className="bg-indigo-50 border-t border-indigo-100 px-4 py-3 flex items-start gap-3 flex-shrink-0">
              <SparklesIcon className="w-4 h-4 text-indigo-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-semibold text-indigo-700 mb-1">✨ AI Reply Suggestion</p>
                <p className="text-sm text-gray-700">{aiSuggestion}</p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => { setMessage(aiSuggestion); setShowAI(false); }} className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Use</button>
                <button onClick={() => setShowAI(false)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg"><XMarkIcon className="w-4 h-4" /></button>
              </div>
            </div>
          )}

          {/* Quick Replies */}
          {showQuickReplies && (
            <div className="bg-white border-t border-gray-100 max-h-48 overflow-y-auto flex-shrink-0">
              <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-700">⚡ Quick Replies</p>
                <button onClick={() => setShowQuickReplies(false)} className="text-gray-400"><XMarkIcon className="w-4 h-4" /></button>
              </div>
              {(quickReplies || []).length === 0
                ? <p className="text-xs text-gray-400 px-3 py-3">No quick replies. Add in Knowledge Base.</p>
                : (quickReplies || []).map((qr: any) => (
                  <button key={qr.id} onClick={() => { setMessage(qr.content); setShowQuickReplies(false); }}
                    className="w-full text-left px-3 py-2.5 hover:bg-gray-50 border-b border-gray-50">
                    <p className="text-xs font-semibold text-gray-800">{qr.title}</p>
                    <p className="text-xs text-gray-400 truncate">{qr.content}</p>
                  </button>
                ))
              }
            </div>
          )}

          {/* Emoji Picker */}
          {showEmoji && (
            <div className="flex-shrink-0 border-t border-gray-200">
              <EmojiPicker onEmojiClick={handleEmoji} width="100%" height={300} searchDisabled={false} skinTonesDisabled lazyLoadEmojis />
            </div>
          )}

          {/* Message Input */}
          <div className="bg-white border-t border-gray-200 px-4 py-3 flex-shrink-0">
            {/* Toolbar */}
            <div className="flex items-center gap-1 mb-2 pb-2 border-b border-gray-100">
              <button onClick={() => { setShowEmoji(!showEmoji); setShowQuickReplies(false); }}
                className={`p-1.5 rounded-lg transition-colors ${showEmoji ? 'bg-yellow-100 text-yellow-600' : 'text-gray-400 hover:text-yellow-500 hover:bg-yellow-50'}`} title="Emoji">
                <FaceSmileIcon className="w-4 h-4" />
              </button>
              <button onClick={() => fileInputRef.current?.click()} disabled={uploadingFile}
                className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg" title="Attach file">
                <PaperClipIcon className="w-4 h-4" />
              </button>
              <input ref={fileInputRef} type="file" className="hidden" accept="image/*,video/*,audio/*,.pdf,.doc,.docx" onChange={handleFileUpload} />
              <button onClick={() => { setShowQuickReplies(!showQuickReplies); setShowEmoji(false); }}
                className={`p-1.5 rounded-lg transition-colors ${showQuickReplies ? 'bg-purple-100 text-purple-600' : 'text-gray-400 hover:text-purple-500 hover:bg-purple-50'}`} title="Quick replies">
                <BoltIcon className="w-4 h-4" />
              </button>
              <div className="w-px h-4 bg-gray-200 mx-1" />
              <button onClick={handleAIReply} disabled={aiLoading}
                className="flex items-center gap-1 px-2 py-1 text-xs text-indigo-600 hover:bg-indigo-50 rounded-lg font-medium ml-auto">
                {aiLoading ? <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" /> : <SparklesIcon className="w-3.5 h-3.5" />}
                AI Reply
              </button>
            </div>
            {/* Input + Send */}
            <div className="flex gap-2 items-end">
              <textarea rows={2}
                placeholder="Type a message... (Enter to send)"
                className="flex-1 px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-whatsapp-green/30 focus:border-whatsapp-green/50 transition-all"
                value={message}
                onChange={e => setMessage(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              />
              <button onClick={handleSend} disabled={!message.trim() || sendMutation.isPending}
                className="w-10 h-10 bg-whatsapp-green text-white rounded-xl hover:bg-whatsapp-teal transition-colors flex items-center justify-center disabled:opacity-40 flex-shrink-0 shadow-sm">
                <PaperAirplaneIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-gray-50">
          <div className="text-center max-w-xs">
            <div className="w-20 h-20 bg-whatsapp-green/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <ChatBubbleLeftRightIcon className="w-10 h-10 text-whatsapp-teal" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Select a conversation</h3>
            <p className="text-gray-400 text-sm">Choose from the list to start chatting</p>
          </div>
        </div>
      )}

      {/* ── Right: Contact Details ─────────────────────────────────────────── */}
      {showDetails && selectedConv && (
        <div className="w-72 flex-shrink-0 border-l border-gray-200 bg-white overflow-y-auto">

          {/* Contact Header */}
          <div className="p-5 border-b border-gray-100 text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-whatsapp-green to-whatsapp-teal rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto mb-3">
              {contact?.firstName?.[0]?.toUpperCase()}
            </div>
            <h3 className="text-base font-bold text-gray-900">{contact?.firstName} {contact?.lastName}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{contact?.company || 'No company'}</p>
            {contact?.gdprConsent && <span className="inline-block mt-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">✓ GDPR</span>}
            {contact?.isBlocked && <span className="inline-block mt-1 text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded-full">🚫 Blocked</span>}
          </div>

          {/* Contact Info */}
          <div className="p-4 border-b border-gray-100 space-y-2.5">
            {contact?.phone && (
              <div className="flex items-center gap-2.5">
                <PhoneIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="text-sm text-gray-700">{contact.phone}</span>
              </div>
            )}
            {contact?.email && (
              <div className="flex items-center gap-2.5">
                <EnvelopeIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="text-sm text-gray-700 truncate">{contact.email}</span>
              </div>
            )}
            {contact?.company && (
              <div className="flex items-center gap-2.5">
                <BuildingOfficeIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="text-sm text-gray-700">{contact.company}</span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button onClick={() => { setContactForm({ firstName: contact?.firstName || '', lastName: contact?.lastName || '', email: contact?.email || '', company: contact?.company || '', jobTitle: contact?.jobTitle || '', gdprConsent: contact?.gdprConsent || false }); setShowSaveContact(true); }}
                className="flex items-center justify-center gap-1.5 py-2 text-xs text-whatsapp-teal bg-whatsapp-green/10 rounded-xl hover:bg-whatsapp-green/20 font-medium">
                <UserPlusIcon className="w-3.5 h-3.5" /> Edit
              </button>
              <button onClick={() => blockMutation.mutate()}
                className={`flex items-center justify-center gap-1.5 py-2 text-xs rounded-xl font-medium ${contact?.isBlocked ? 'text-green-700 bg-green-50 hover:bg-green-100' : 'text-red-600 bg-red-50 hover:bg-red-100'}`}>
                <NoSymbolIcon className="w-3.5 h-3.5" /> {contact?.isBlocked ? 'Unblock' : 'Block'}
              </button>
            </div>
          </div>

          {/* Conversation Info */}
          <div className="p-4 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Conversation</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Status</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[selectedConv.status]}`}>{selectedConv.status}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Channel</span>
                <span className="font-medium text-gray-700">{channelIcons[selectedConv.channel]} {selectedConv.channel}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Agent</span>
                <span className="font-medium text-gray-700 text-xs">{selectedConv.agent ? `${selectedConv.agent.firstName} ${selectedConv.agent.lastName}` : 'Unassigned'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Started</span>
                <span className="font-medium text-gray-700 text-xs">{format(new Date(selectedConv.createdAt), 'MMM d, HH:mm')}</span>
              </div>
            </div>
            {selectedConv.summary && (
              <div className="mt-3 p-2.5 bg-indigo-50 rounded-xl">
                <p className="text-xs font-semibold text-indigo-700 mb-1">AI Summary</p>
                <p className="text-xs text-gray-700 leading-relaxed">{selectedConv.summary}</p>
              </div>
            )}
          </div>

          {/* Labels */}
          {currentTags.length > 0 && (
            <div className="p-4 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Labels</p>
              <div className="flex flex-wrap gap-1.5">
                {currentTags.map((tag: any) => (
                  <span key={tag.id} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs text-white font-medium" style={{ backgroundColor: tag.color }}>
                    {tag.name}
                    <button onClick={() => labelMutation.mutate({ tagId: tag.id, action: 'remove' })} className="hover:opacity-70">×</button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Quick Actions</p>
            <div className="space-y-2">
              {[
                { icon: CurrencyDollarIcon, label: 'Send Payment Link', color: 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100', action: () => setShowPayment(true) },
                { icon: DocumentTextIcon, label: 'Send Invoice', color: 'text-blue-700 bg-blue-50 hover:bg-blue-100', action: () => setShowPayment(true) },
                { icon: BellIcon, label: 'Schedule Follow-up', color: 'text-orange-700 bg-orange-50 hover:bg-orange-100', action: () => setShowFollowUp(true) },
                { icon: SparklesIcon, label: 'AI Reply Suggestion', color: 'text-indigo-700 bg-indigo-50 hover:bg-indigo-100', action: handleAIReply },
                { icon: ArchiveBoxIcon, label: 'Archive Chat', color: 'text-amber-700 bg-amber-50 hover:bg-amber-100', action: () => archiveMutation.mutate() },
                { icon: TrashIcon, label: 'Delete Chat', color: 'text-red-600 bg-red-50 hover:bg-red-100', action: () => setShowDeleteConfirm(true) },
              ].map(item => (
                <button key={item.label} onClick={item.action}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-xs rounded-xl font-medium transition-colors ${item.color}`}>
                  <item.icon className="w-4 h-4 flex-shrink-0" />
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InboxPage;
