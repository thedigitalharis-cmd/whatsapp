import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MagnifyingGlassIcon, PaperAirplaneIcon, PaperClipIcon,
  FaceSmileIcon, XMarkIcon, SparklesIcon, MicrophoneIcon,
  TagIcon, UserPlusIcon, EllipsisVerticalIcon, PhoneIcon,
  EnvelopeIcon, BuildingOfficeIcon, CurrencyDollarIcon,
  DocumentTextIcon, ArrowPathIcon, ChatBubbleLeftRightIcon,
  BoltIcon, BellIcon, UserGroupIcon, NoSymbolIcon,
  ArchiveBoxIcon, TrashIcon, InformationCircleIcon,
  CheckCircleIcon, PhotoIcon, AdjustmentsHorizontalIcon,
  ChevronLeftIcon, VideoCameraIcon, FunnelIcon, StopIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckSolid, XCircleIcon } from '@heroicons/react/24/solid';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import { conversationsApi, aiApi, usersApi, teamsApi, tagsApi, kbApi, api } from '../services/api';
import { useSocketStore } from '../store/socketStore';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

// ─── WhatsApp Web Chat Backgrounds ────────────────────────────────────────────
const BG_OPTIONS = [
  { id: 'default', label: 'Default', value: '#eae6df', pattern: true },
  { id: 'dark', label: 'Dark', value: '#0d1117', pattern: false },
  { id: 'light', label: 'Light', value: '#f0f2f5', pattern: false },
  { id: 'green', label: 'Nature', value: '#d4e6c3', pattern: false },
  { id: 'blue', label: 'Ocean', value: '#dbeafe', pattern: false },
  { id: 'purple', label: 'Lavender', value: '#ede9fe', pattern: false },
  { id: 'pink', label: 'Rose', value: '#fce7f3', pattern: false },
  { id: 'custom', label: 'Custom', value: '', pattern: false },
];

const WA_PATTERN = `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z' fill='%23b2a99a' fill-opacity='0.15' fill-rule='evenodd'/%3E%3C/svg%3E")`;

const statusColors: Record<string, { bg: string; text: string }> = {
  OPEN:     { bg: '#dcfce7', text: '#15803d' },
  PENDING:  { bg: '#fef9c3', text: '#854d0e' },
  RESOLVED: { bg: '#f1f5f9', text: '#475569' },
  SNOOZED:  { bg: '#dbeafe', text: '#1d4ed8' },
};

const channelIcons: Record<string, string> = {
  WHATSAPP: '📱', INSTAGRAM: '📸', MESSENGER: '💬',
  TELEGRAM: '✈️', EMAIL: '📧', SMS: '💬',
};

// ─── Message Bubble ──────────────────────────────────────────────────────────
const MessageBubble: React.FC<{ message: any; bgDark?: boolean }> = ({ message, bgDark }) => {
  const isOut = message.direction === 'OUTBOUND';
  const time = format(new Date(message.createdAt), 'HH:mm');
  const mediaUrl = message.mediaUrl || '';
  const appBaseUrl = (process.env.REACT_APP_API_URL || '').replace(/\/api$/, '');
  const isRawMetaMediaId = mediaUrl && !mediaUrl.startsWith('http') && !mediaUrl.startsWith('blob:');
  const playableAudioUrl = isRawMetaMediaId
    ? `${appBaseUrl}/media/whatsapp/${mediaUrl}`
    : mediaUrl;

  return (
    <div className={`flex ${isOut ? 'justify-end' : 'justify-start'} mb-1 px-4`}>
      <div className={`relative max-w-xs lg:max-w-sm xl:max-w-md rounded-2xl px-3 pt-2 pb-1 shadow-sm
        ${isOut
          ? 'bg-[#d9fdd3] rounded-tr-none'
          : bgDark ? 'bg-[#202c33] rounded-tl-none' : 'bg-white rounded-tl-none'
        }`}
        style={{ minWidth: '80px' }}>

        {/* Tail */}
        {isOut && (
          <div className="absolute -right-[6px] top-0 w-3 h-3 overflow-hidden">
            <div className="bg-[#d9fdd3] w-4 h-4 rounded-bl-2xl" style={{ marginLeft: '-4px' }} />
          </div>
        )}
        {!isOut && (
          <div className="absolute -left-[6px] top-0 w-3 h-3 overflow-hidden">
            <div className={`${bgDark ? 'bg-[#202c33]' : 'bg-white'} w-4 h-4 rounded-br-2xl`} style={{ marginRight: '-4px' }} />
          </div>
        )}

        {/* Media */}
        {message.type === 'IMAGE' && message.mediaUrl && (
          <img src={message.mediaUrl} alt="" className="rounded-xl mb-1 max-w-full" onError={e => (e.currentTarget.style.display = 'none')} />
        )}
        {message.type === 'DOCUMENT' && (
          <div className={`flex items-center gap-2 p-2 rounded-xl mb-1 ${bgDark && !isOut ? 'bg-[#2a3942]' : 'bg-gray-100'}`}>
            <PaperClipIcon className="w-4 h-4 text-gray-500 flex-shrink-0" />
            <span className={`text-xs truncate ${bgDark && !isOut ? 'text-gray-200' : 'text-gray-700'}`}>{message.caption || 'Document'}</span>
          </div>
        )}
        {(message.type === 'AUDIO' || message.type === 'VOICE') && (
          <div className="mb-1 min-w-[200px]">
            <div className={`flex items-center gap-2 p-2 rounded-xl mb-1 ${isOut ? 'bg-[#c8f7c5]' : bgDark ? 'bg-[#2a3942]' : 'bg-gray-100'}`}>
              <MicrophoneIcon className="w-5 h-5 flex-shrink-0" style={{ color: '#25d366' }} />
              {playableAudioUrl ? (
                <audio
                  controls
                  preload="metadata"
                  src={playableAudioUrl}
                  style={{ height: '32px', flex: 1, minWidth: '140px', maxWidth: '200px' }}
                />
              ) : (
                <div className="flex flex-1 items-center gap-0.5">
                  {[3,5,4,7,4,6,3,5,4,6,3,5].map((h, i) => (
                    <div key={i} className="w-0.5 rounded-full bg-green-400" style={{ height: `${h * 3}px` }} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        {message.type === 'LOCATION' && message.location && (
          <a href={`https://maps.google.com/?q=${message.location.latitude},${message.location.longitude}`}
            target="_blank" rel="noreferrer"
            className="flex items-center gap-2 p-2 bg-blue-50 rounded-xl mb-1 text-blue-600 text-xs">
            📍 View Location
          </a>
        )}

        {/* Text */}
        {message.content && (
          <p className={`text-sm leading-relaxed whitespace-pre-wrap break-words ${isOut ? 'text-[#111b21]' : bgDark ? 'text-[#e9edef]' : 'text-[#111b21]'}`}>
            {message.content}
          </p>
        )}

        {isOut && message.status === 'FAILED' && message.errorMessage && (
          <p className="text-[10px] text-red-600 mt-1 leading-snug break-words max-w-[220px]">{message.errorMessage}</p>
        )}

        {/* Interactive buttons */}
        {message.interactive?.action?.buttons && (
          <div className="mt-2 space-y-1 border-t border-gray-200 pt-2">
            {message.interactive.action.buttons.map((btn: any, i: number) => (
              <div key={i} className="text-center text-xs text-blue-500 py-1 font-medium">{btn.reply?.title}</div>
            ))}
          </div>
        )}

        {/* Time + Status */}
        <div className={`flex items-center justify-end gap-1 mt-0.5`}>
          <span className={`text-xs ${isOut ? 'text-[#667781]' : bgDark ? 'text-[#8696a0]' : 'text-[#667781]'}`} style={{ fontSize: '11px' }}>
            {time}
          </span>
          {isOut && (
            message.status === 'READ' ? <span className="text-blue-400" style={{ fontSize: '13px' }}>✓✓</span>
              : message.status === 'DELIVERED' ? <span className="text-[#8696a0]" style={{ fontSize: '13px' }}>✓✓</span>
                : message.status === 'FAILED' ? <XCircleIcon className="w-3 h-3 text-red-400" />
                  : <span className="text-[#8696a0]" style={{ fontSize: '13px' }}>✓</span>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Date Separator ───────────────────────────────────────────────────────────
const DateSeparator: React.FC<{ date: string; bgDark?: boolean }> = ({ date, bgDark }) => (
  <div className="flex items-center justify-center my-3">
    <span className={`text-xs px-3 py-1 rounded-full shadow-sm ${bgDark ? 'bg-[#182229] text-[#8696a0]' : 'bg-[#ffffffcc] text-[#54656f]'}`}>{date}</span>
  </div>
);

// ─── Main InboxPage ───────────────────────────────────────────────────────────
const InboxPage: React.FC = () => {
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'open' | 'pending' | 'resolved' | 'archived'>('all');
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
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const recordingTimerRef = useRef<any>(null);
  const [showSaveContact, setShowSaveContact] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showBgPicker, setShowBgPicker] = useState(false);
  const [chatBg, setChatBg] = useState(() => localStorage.getItem('chatBg') || 'default');
  const [customBgColor, setCustomBgColor] = useState(() => localStorage.getItem('customBgColor') || '#eae6df');
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

  const selectedBgOption = BG_OPTIONS.find(b => b.id === chatBg) || BG_OPTIONS[0];
  const bgColor = chatBg === 'custom' ? customBgColor : (selectedBgOption.value || '#eae6df');
  const bgStyle: React.CSSProperties = selectedBgOption.pattern
    ? { backgroundColor: bgColor, backgroundImage: WA_PATTERN }
    : { backgroundColor: bgColor };
  const isDarkBg = chatBg === 'dark';

  const saveBg = (id: string, customColor?: string) => {
    setChatBg(id);
    localStorage.setItem('chatBg', id);
    if (customColor) { setCustomBgColor(customColor); localStorage.setItem('customBgColor', customColor); }
    setShowBgPicker(false);
  };

  const tabStatusMap: Record<string, string> = { all: '', open: 'OPEN', pending: 'PENDING', resolved: 'RESOLVED', archived: '' };

  const { data: conversations } = useQuery({
    queryKey: ['conversations', search, filter, activeTab],
    queryFn: () => conversationsApi.list({
      search,
      ...filter,
      status: tabStatusMap[activeTab],
      archived: activeTab === 'archived' ? 'true' : 'false',
      limit: 200,
    }).then(r => r.data.data),
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
    mutationFn: (data: any) => conversationsApi.sendMessage(selectedConvId!, data).then(r => r.data),
    onSuccess: (data: any) => {
      setMessage('');
      refetchMessages();
      qc.invalidateQueries({ queryKey: ['conversations'] });
      if (data?.warning) toast.error(String(data.warning));
      else if (data?.status === 'FAILED' && data?.errorMessage) toast.error(data.errorMessage);
    },
    onError: (e: any) => toast.error(e.response?.data?.error || e.response?.data?.warning || 'Failed to send'),
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
    onSuccess: () => { setSelectedConvId(null); setShowDeleteConfirm(false); qc.invalidateQueries({ queryKey: ['conversations'] }); toast.success('Deleted'); },
    onError: () => { conversationsApi.updateStatus(selectedConvId!, 'RESOLVED').then(() => { setSelectedConvId(null); setShowDeleteConfirm(false); qc.invalidateQueries({ queryKey: ['conversations'] }); toast.success('Archived'); }); },
  });
  const archiveMutation = useMutation({
    mutationFn: () => api.patch(`/conversations/${selectedConvId}/archive`),
    onSuccess: () => { setSelectedConvId(null); qc.invalidateQueries({ queryKey: ['conversations'] }); toast.success('Chat archived'); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Archive failed'),
  });

  const unarchiveMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/conversations/${id}/unarchive`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['conversations'] }); toast.success('Chat restored'); },
  });
  const blockMutation = useMutation({
    mutationFn: () => api.put(`/contacts/${selectedConv?.contact?.id}`, { isBlocked: !selectedConv?.contact?.isBlocked }),
    onSuccess: () => { refetchConv(); toast.success(selectedConv?.contact?.isBlocked ? 'Unblocked' : 'Contact blocked'); setShowMoreMenu(false); },
  });
  const saveContactMutation = useMutation({
    mutationFn: (data: any) => api.post(`/conversations/${selectedConvId}/save-contact`, data),
    onSuccess: () => { refetchConv(); setShowSaveContact(false); toast.success('Contact saved!'); },
  });
  const followUpMutation = useMutation({
    mutationFn: (data: any) => api.post('/follow-ups', data),
    onSuccess: () => { setShowFollowUp(false); toast.success('✅ Follow-up scheduled!'); },
  });
  const createGroupMutation = useMutation({
    mutationFn: () => api.post('/contacts/groups', { name: groupName }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contact-groups'] }); setShowGroupModal(false); setGroupName(''); toast.success('Group created'); },
  });

  // Convert contact to lead
  const createLeadMutation = useMutation({
    mutationFn: () => api.post('/leads', {
      title: `${contact?.firstName} ${contact?.lastName || ''} — WhatsApp Lead`.trim(),
      source: 'WHATSAPP',
      contactId: contact?.id,
      status: 'NEW',
    }),
    onSuccess: () => toast.success('✅ Lead created! View in Leads section.'),
    onError: () => toast.error('Failed to create lead'),
  });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) setShowMoreMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Always listen for inbound messages while on Inbox (listener was only attached when a chat was open)
  useEffect(() => {
    if (!socket) return;
    const handler = (payload: any) => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
      const convId = payload?.conversationId ?? payload?.message?.conversationId;
      if (selectedConvId && convId === selectedConvId) {
        refetchMessages();
      }
    };
    socket.on('message:new', handler);
    return () => { socket.off('message:new', handler); };
  }, [socket, selectedConvId, qc, refetchMessages]);

  useEffect(() => {
    if (socket && selectedConvId) {
      socket.emit('join:conversation', selectedConvId);
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
      const type = file.type.startsWith('image/') ? 'IMAGE' : file.type.startsWith('audio/') ? 'AUDIO' : file.type.startsWith('video/') ? 'VIDEO' : 'DOCUMENT';
      sendMutation.mutate({ type, mediaUrl: URL.createObjectURL(file), mediaType: file.type, caption: file.name, content: file.name });
    } catch { toast.error('Upload failed'); }
    finally { setUploadingFile(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const startRecording = async () => {
    if (isRecording) { stopRecording(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg' });
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = async () => {
        const mimeType = recorder.mimeType || 'audio/webm';
        const blob = new Blob(chunks, { type: mimeType });
        if (blob.size < 500) { toast.error('Recording too short — try again'); stream.getTracks().forEach(t => t.stop()); setRecordingTime(0); return; }
        const duration = recordingTime > 0 ? recordingTime : 1;

        // Upload to server → get public URL → send link to WhatsApp
        try {
          toast('📤 Uploading voice message...', { duration: 4000 });
          const formData = new FormData();
          // Save as .ogg for better WhatsApp compatibility
          formData.append('audio', blob, `voice_${Date.now()}.ogg`);

          const token = localStorage.getItem('token');
          const uploadRes = await fetch(`${process.env.REACT_APP_API_URL}/upload/audio`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
          });

          if (!uploadRes.ok) {
            const err = await uploadRes.json().catch(() => ({}));
            throw new Error(err.error || `Upload failed (${uploadRes.status})`);
          }

          const { url: publicUrl, mimeType } = await uploadRes.json();
          // Send to WhatsApp via public URL — WhatsApp fetches audio from our server
          sendMutation.mutate({
            type: 'AUDIO',
            mediaUrl: publicUrl,
            mediaType: mimeType || 'audio/ogg',
            content: `🎙️ Voice message (${duration}s)`,
          });
        } catch (err: any) {
          toast.error(`Voice failed: ${err.message}`);
        }
        stream.getTracks().forEach(t => t.stop());
        setRecordingTime(0);
      };
      recorder.start(100); // collect data every 100ms
      setMediaRecorder(recorder);
      setIsRecording(true);
      toast('🎙️ Recording... Click mic again to stop', { duration: 2000 });
      let secs = 0;
      recordingTimerRef.current = setInterval(() => {
        secs++;
        setRecordingTime(secs);
        if (secs >= 120) stopRecording();
      }, 1000);
    } catch (err) {
      toast.error('Microphone access denied. Please allow microphone in browser.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      setMediaRecorder(null);
    }
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    setIsRecording(false);
  };

  const sendGoogleMeetLink = () => {
    const meetId = Math.random().toString(36).substring(2, 12);
    const link = `https://meet.google.com/${meetId.slice(0,3)}-${meetId.slice(3,7)}-${meetId.slice(7,10)}`;
    sendMutation.mutate({
      type: 'TEXT',
      content: `📹 *Google Meet Invitation*\n\nJoin the meeting here:\n${link}\n\nClick the link to join the video call.`,
    });
    toast.success('Google Meet link sent!');
  };

  const handleAIReply = async () => {
    if (!selectedConvId) return;
    setAiLoading(true);
    try {
      const lastMsg = (messages || []).filter((m: any) => m.direction === 'INBOUND').slice(-1)[0]?.content || '';
      const { data } = await aiApi.generateReply(selectedConvId, lastMsg);
      setAiSuggestion(data.reply);
      setShowAI(true);
    } catch { toast.error('AI not available'); }
    finally { setAiLoading(false); }
  };

  const contact = selectedConv?.contact;
  const currentTags = selectedConv?.tags || [];
  const openCount = (conversations || []).filter((c: any) => c.status === 'OPEN').length;

  // Group messages by date
  const groupedMessages = (messages || []).reduce((acc: any, msg: any) => {
    const date = format(new Date(msg.createdAt), 'MMM d, yyyy');
    if (!acc[date]) acc[date] = [];
    acc[date].push(msg);
    return acc;
  }, {});

  return (
    <div className="flex h-full overflow-hidden" style={{ backgroundColor: '#111b21' }}>

      {/* ─── Modals ──────────────────────────────────────────────────────── */}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 text-center">
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <TrashIcon className="w-7 h-7 text-red-600" />
            </div>
            <h3 className="text-lg font-bold mb-1">Delete Chat?</h3>
            <p className="text-sm text-gray-500 mb-5">This will archive the conversation. Cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}
                className="flex-1 py-2 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700">
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showGroupModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <h2 className="font-semibold">Contact Groups</h2>
              <button onClick={() => setShowGroupModal(false)} className="text-gray-400">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">New Group Name</label>
                <div className="flex gap-2">
                  <input className="input-field flex-1" placeholder="e.g. VIP Clients" value={groupName} onChange={e => setGroupName(e.target.value)} />
                  <button onClick={() => createGroupMutation.mutate()} disabled={!groupName} className="btn-primary px-3">Create</button>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Existing Groups</p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {(contactGroups || []).length === 0
                    ? <p className="text-xs text-gray-400 text-center py-3">No groups yet</p>
                    : (contactGroups || []).map((g: any) => (
                      <div key={g.id} className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-xl">
                        <UserGroupIcon className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-medium">{g.name}</span>
                      </div>
                    ))
                  }
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showFollowUp && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="px-5 py-4 border-b flex items-center gap-2">
              <BellIcon className="w-5 h-5 text-orange-500" />
              <h2 className="font-semibold">Schedule Follow-up</h2>
              <button onClick={() => setShowFollowUp(false)} className="ml-auto text-gray-400">✕</button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Message *</label>
                <textarea className="input-field text-sm" rows={3} placeholder="Hi! Just following up..." value={followUpForm.message} onChange={e => setFollowUpForm({ ...followUpForm, message: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Date & Time *</label>
                <input type="datetime-local" className="input-field text-sm" value={followUpForm.scheduledAt} onChange={e => setFollowUpForm({ ...followUpForm, scheduledAt: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
                  <select className="input-field text-sm" value={followUpForm.type} onChange={e => setFollowUpForm({ ...followUpForm, type: e.target.value })}>
                    <option value="MANUAL">One-time</option>
                    <option value="RECURRING">Recurring</option>
                  </select>
                </div>
                {followUpForm.type === 'RECURRING' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Every (days)</label>
                    <input type="number" min="1" className="input-field text-sm" placeholder="7" value={followUpForm.recurringDays} onChange={e => setFollowUpForm({ ...followUpForm, recurringDays: e.target.value })} />
                  </div>
                )}
              </div>
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

      {showSaveContact && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <h2 className="font-semibold">Save Contact</h2>
              <button onClick={() => setShowSaveContact(false)} className="text-gray-400">✕</button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-gray-700 mb-1">First Name</label><input className="input-field text-sm" value={contactForm.firstName} onChange={e => setContactForm({ ...contactForm, firstName: e.target.value })} /></div>
                <div><label className="block text-xs font-medium text-gray-700 mb-1">Last Name</label><input className="input-field text-sm" value={contactForm.lastName} onChange={e => setContactForm({ ...contactForm, lastName: e.target.value })} /></div>
              </div>
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Email</label><input type="email" className="input-field text-sm" value={contactForm.email} onChange={e => setContactForm({ ...contactForm, email: e.target.value })} /></div>
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Company</label><input className="input-field text-sm" value={contactForm.company} onChange={e => setContactForm({ ...contactForm, company: e.target.value })} /></div>
              <label className="flex items-center gap-2"><input type="checkbox" checked={contactForm.gdprConsent} onChange={e => setContactForm({ ...contactForm, gdprConsent: e.target.checked })} className="rounded" /><span className="text-xs">GDPR Consent</span></label>
              <div className="flex gap-3"><button onClick={() => setShowSaveContact(false)} className="btn-secondary flex-1">Cancel</button><button onClick={() => saveContactMutation.mutate(contactForm)} disabled={saveContactMutation.isPending} className="btn-primary flex-1">Save</button></div>
            </div>
          </div>
        </div>
      )}

      {showPayment && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="px-5 py-4 border-b flex items-center gap-2">
              <CurrencyDollarIcon className="w-5 h-5 text-emerald-500" />
              <h2 className="font-semibold">Send Payment / Invoice</h2>
              <button onClick={() => setShowPayment(false)} className="ml-auto text-gray-400">✕</button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-gray-700 mb-1">Amount *</label><input type="number" className="input-field" placeholder="0.00" value={paymentForm.amount} onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })} /></div>
                <div><label className="block text-xs font-medium text-gray-700 mb-1">Currency</label>
                  <select className="input-field" value={paymentForm.currency} onChange={e => setPaymentForm({ ...paymentForm, currency: e.target.value })}>
                    {['AED', 'USD', 'EUR', 'GBP', 'INR', 'SAR'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Description</label><input className="input-field" placeholder="Service description..." value={paymentForm.description} onChange={e => setPaymentForm({ ...paymentForm, description: e.target.value })} /></div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => { if (!paymentForm.amount) return; const link = `https://betteraisender.com/pay?amount=${paymentForm.amount}&currency=${paymentForm.currency}&desc=${encodeURIComponent(paymentForm.description)}`; sendMutation.mutate({ type: 'TEXT', content: `💳 *Payment Request*\n\nAmount: ${paymentForm.currency} ${paymentForm.amount}\n${paymentForm.description}\n\nPay here: ${link}` }); setShowPayment(false); toast.success('Payment link sent!'); }}
                  className="flex-1 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700">
                  💳 Send Payment Link
                </button>
                <button onClick={() => { if (!paymentForm.amount) return; sendMutation.mutate({ type: 'TEXT', content: `🧾 *Invoice*\n\nAmount Due: ${paymentForm.currency} ${paymentForm.amount}\n${paymentForm.description}\n\nPlease complete payment at your earliest.\n\nHuco Digital Marketing Management` }); setShowPayment(false); toast.success('Invoice sent!'); }}
                  className="flex-1 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700">
                  🧾 Send Invoice
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── LEFT PANEL (WhatsApp Web style) ──────────────────────────── */}
      <div className="w-[360px] flex-shrink-0 flex flex-col" style={{ backgroundColor: '#111b21', borderRight: '1px solid #2a3942' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3" style={{ backgroundColor: '#202c33' }}>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-whatsapp-green rounded-full flex items-center justify-center text-white text-sm font-bold">
              {openCount > 0 ? openCount : '✓'}
            </div>
            <span className="text-white font-semibold text-base">Chats</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setShowGroupModal(true)} className="p-2 rounded-full hover:bg-white/10 transition-colors" title="New group">
              <UserGroupIcon className="w-5 h-5 text-[#aebac1]" />
            </button>
            <button onClick={() => setShowBgPicker(!showBgPicker)} className="p-2 rounded-full hover:bg-white/10 transition-colors" title="Change background">
              <PhotoIcon className="w-5 h-5 text-[#aebac1]" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex px-2 pt-2 gap-0.5" style={{ backgroundColor: '#111b21' }}>
          {[
            { key: 'all', label: 'All' },
            { key: 'open', label: 'Open' },
            { key: 'pending', label: 'Pending' },
            { key: 'resolved', label: 'Done' },
            { key: 'archived', label: '📦' },
          ].map(tab => (
            <button key={tab.key} onClick={() => { setActiveTab(tab.key as any); setSelectedConvId(null); }}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${activeTab === tab.key
                ? 'bg-whatsapp-teal text-white'
                : 'text-[#8696a0] hover:text-white hover:bg-white/5'}`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="px-3 py-2" style={{ backgroundColor: '#111b21' }}>
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8696a0]" />
            <input type="text" placeholder="Search or start new chat"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg focus:outline-none"
              style={{ backgroundColor: '#202c33', color: '#e9edef', border: 'none' }}
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto" style={{ backgroundColor: '#111b21' }}>
          {(conversations || []).length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-[#8696a0]">
              <ChatBubbleLeftRightIcon className="w-10 h-10 mb-2 opacity-30" />
              <p className="text-sm">No conversations</p>
            </div>
          ) : (
            (conversations || []).map((conv: any) => (
              <div key={conv.id}
                onClick={() => setSelectedConvId(conv.id)}
                className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-white/5"
                style={{ backgroundColor: selectedConvId === conv.id ? '#2a3942' : 'transparent', borderBottom: '1px solid #1f2c33' }}>

                <div className="relative flex-shrink-0">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-white text-base font-bold"
                    style={{ background: 'linear-gradient(135deg, #25D366, #128C7E)' }}>
                    {conv.contact?.firstName?.[0]?.toUpperCase()}{conv.contact?.lastName?.[0]?.toUpperCase() || ''}
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 text-sm">{channelIcons[conv.channel] || '💬'}</span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="text-sm font-semibold truncate" style={{ color: '#e9edef' }}>
                      {conv.contact?.firstName} {conv.contact?.lastName}
                    </p>
                    <span className="text-xs flex-shrink-0 ml-2" style={{ color: conv.status === 'OPEN' ? '#25d366' : '#8696a0' }}>
                      {conv.lastMessageAt ? format(new Date(conv.lastMessageAt), 'HH:mm') : ''}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm truncate" style={{ color: '#8696a0' }}>
                      {conv.messages?.[0]?.content || 'No messages yet'}
                    </p>
                    {conv.status === 'OPEN' && (
                      <span className="flex-shrink-0 ml-2 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: '#25d366' }}>
                        {1}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ─── CENTER: Chat Area ─────────────────────────────────────────── */}
      {selectedConvId && selectedConv ? (
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">

          {/* ── Chat Header ─────────────────────────────────────────────── */}
          <div className="flex-shrink-0" style={{ backgroundColor: '#202c33', borderBottom: '1px solid #2a3942' }}>
            {/* Row 1: Contact info + status + info toggle */}
            <div className="flex items-center gap-3 px-4 py-2.5">
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #25D366, #128C7E)' }}>
                {contact?.firstName?.[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setShowDetails(!showDetails)}>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold truncate" style={{ color: '#e9edef' }}>
                    {contact?.firstName} {contact?.lastName}
                  </p>
                  {contact?.isBlocked && <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400">🚫 Blocked</span>}
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                    style={{ backgroundColor: selectedConv.status === 'OPEN' ? '#25d36625' : '#ffffff15', color: statusColors[selectedConv.status]?.text || '#8696a0' }}>
                    {selectedConv.status}
                  </span>
                </div>
                <p className="text-xs truncate" style={{ color: '#8696a0' }}>
                  {contact?.phone} {selectedConv.agent ? `· 👤 ${selectedConv.agent.firstName}` : '· Unassigned'}
                </p>
              </div>

              {/* Right: Resolve + Info */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {selectedConv.status === 'OPEN' ? (
                  <button onClick={() => statusMutation.mutate('RESOLVED')}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-white"
                    style={{ backgroundColor: '#25d366' }}>
                    <CheckSolid className="w-3.5 h-3.5" /> Resolve
                  </button>
                ) : (
                  <button onClick={() => statusMutation.mutate('OPEN')}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg"
                    style={{ backgroundColor: '#2a3942', color: '#e9edef' }}>
                    <ArrowPathIcon className="w-3.5 h-3.5" /> Reopen
                  </button>
                )}
                <button onClick={() => setShowDetails(!showDetails)}
                  className={`p-2 rounded-full transition-colors ${showDetails ? 'bg-white/15' : 'hover:bg-white/10'}`}
                  title="Contact Info">
                  <InformationCircleIcon className="w-5 h-5" style={{ color: '#aebac1' }} />
                </button>
              </div>
            </div>

            {/* Row 2: Icon-only action bar */}
            <div className="flex items-center px-3 pb-2.5 gap-1">

              {/* Assign */}
              <div className="relative">
                <button onClick={() => { setShowAssign(!showAssign); setShowLabels(false); setShowMoreMenu(false); }}
                  className={`group flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all ${showAssign ? 'bg-white/15' : 'hover:bg-white/10'}`}
                  title="Assign agent">
                  <UserPlusIcon className="w-5 h-5" style={{ color: showAssign ? '#25d366' : '#aebac1' }} />
                  <span className="text-xs" style={{ color: '#8696a0', fontSize: '10px' }}>Assign</span>
                </button>
                {showAssign && (
                  <div className="absolute left-0 top-14 w-56 rounded-2xl shadow-2xl z-50 py-2 overflow-hidden" style={{ backgroundColor: '#233138', border: '1px solid #2a3942' }}>
                    <p className="text-xs font-semibold px-3 pb-1.5 uppercase" style={{ color: '#8696a0' }}>Agents</p>
                    {(users || []).map((u: any) => (
                      <button key={u.id} onClick={() => assignMutation.mutate({ agentId: u.id })}
                        className="w-full text-left px-3 py-2 text-sm flex items-center gap-2.5 hover:bg-white/5" style={{ color: '#e9edef' }}>
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: '#25d366' }}>{u.firstName[0]}</div>
                        <div className="min-w-0"><p className="text-sm truncate">{u.firstName} {u.lastName}</p><p className="text-xs" style={{ color: '#8696a0' }}>{u.role}</p></div>
                        {selectedConv.agentId === u.id && <CheckSolid className="w-4 h-4 text-green-400 ml-auto flex-shrink-0" />}
                      </button>
                    ))}
                    {(teams || []).length > 0 && <>
                      <div className="border-t my-1" style={{ borderColor: '#2a3942' }} />
                      {(teams || []).map((t: any) => (
                        <button key={t.id} onClick={() => assignMutation.mutate({ teamId: t.id })}
                          className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-white/5" style={{ color: '#e9edef' }}>
                          <UserGroupIcon className="w-4 h-4" style={{ color: '#8696a0' }} /> {t.name}
                        </button>
                      ))}
                    </>}
                  </div>
                )}
              </div>

              {/* Labels */}
              <div className="relative">
                <button onClick={() => { setShowLabels(!showLabels); setShowAssign(false); setShowMoreMenu(false); }}
                  className={`relative flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all ${showLabels ? 'bg-white/15' : 'hover:bg-white/10'}`}
                  title="Labels">
                  <TagIcon className="w-5 h-5" style={{ color: showLabels ? '#25d366' : '#aebac1' }} />
                  <span className="text-xs" style={{ color: '#8696a0', fontSize: '10px' }}>Labels</span>
                  {currentTags.length > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center text-white font-bold"
                      style={{ backgroundColor: '#25d366', fontSize: '9px' }}>{currentTags.length}</span>
                  )}
                </button>
                {showLabels && (
                  <div className="absolute left-0 top-14 w-52 rounded-2xl shadow-2xl z-50 py-2 overflow-hidden" style={{ backgroundColor: '#233138', border: '1px solid #2a3942' }}>
                    <p className="text-xs font-semibold px-3 pb-1.5 uppercase" style={{ color: '#8696a0' }}>Apply Labels</p>
                    {(tags || []).map((tag: any) => {
                      const applied = currentTags.some((t: any) => t.id === tag.id);
                      return (
                        <button key={tag.id} onClick={() => labelMutation.mutate({ tagId: tag.id, action: applied ? 'remove' : 'add' })}
                          className="w-full text-left px-3 py-2 text-sm flex items-center gap-2.5 hover:bg-white/5" style={{ color: '#e9edef' }}>
                          <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
                          <span className="flex-1 truncate">{tag.name}</span>
                          {applied && <CheckSolid className="w-4 h-4 text-green-400 flex-shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Payment */}
              <button onClick={() => setShowPayment(true)}
                className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl hover:bg-white/10 transition-all" title="Payment / Invoice">
                <CurrencyDollarIcon className="w-5 h-5" style={{ color: '#aebac1' }} />
                <span className="text-xs" style={{ color: '#8696a0', fontSize: '10px' }}>Payment</span>
              </button>

              {/* Follow-up */}
              <button onClick={() => setShowFollowUp(true)}
                className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl hover:bg-white/10 transition-all" title="Schedule follow-up">
                <BellIcon className="w-5 h-5" style={{ color: '#aebac1' }} />
                <span className="text-xs" style={{ color: '#8696a0', fontSize: '10px' }}>Follow-up</span>
              </button>

              {/* Google Meet */}
              <button onClick={sendGoogleMeetLink}
                className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl hover:bg-white/10 transition-all" title="Send Google Meet link">
                <VideoCameraIcon className="w-5 h-5" style={{ color: '#aebac1' }} />
                <span className="text-xs" style={{ color: '#8696a0', fontSize: '10px' }}>Meet</span>
              </button>

              {/* Add to Leads */}
              <button onClick={() => createLeadMutation.mutate()} disabled={createLeadMutation.isPending}
                className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl hover:bg-white/10 transition-all" title="Add to Leads">
                <FunnelIcon className="w-5 h-5" style={{ color: '#aebac1' }} />
                <span className="text-xs" style={{ color: '#8696a0', fontSize: '10px' }}>Leads</span>
              </button>

              {/* Spacer */}
              <div className="flex-1" />

              {/* More ⋮ */}
              <div className="relative" ref={moreMenuRef}>
                <button onClick={() => { setShowMoreMenu(!showMoreMenu); setShowAssign(false); setShowLabels(false); }}
                  className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all ${showMoreMenu ? 'bg-white/15' : 'hover:bg-white/10'}`}>
                  <EllipsisVerticalIcon className="w-5 h-5" style={{ color: '#aebac1' }} />
                  <span className="text-xs" style={{ color: '#8696a0', fontSize: '10px' }}>More</span>
                </button>
                {showMoreMenu && (
                  <div className="absolute right-0 top-14 w-56 rounded-2xl shadow-2xl z-50 py-1.5 overflow-hidden" style={{ backgroundColor: '#233138', border: '1px solid #2a3942' }}>
                    {[
                      { icon: UserPlusIcon, label: 'Save / Edit Contact', action: () => { setContactForm({ firstName: contact?.firstName || '', lastName: contact?.lastName || '', email: contact?.email || '', company: contact?.company || '', jobTitle: '', gdprConsent: contact?.gdprConsent || false }); setShowSaveContact(true); setShowMoreMenu(false); } },
                      { icon: UserGroupIcon, label: 'Manage Groups', action: () => { setShowGroupModal(true); setShowMoreMenu(false); } },
                      selectedConv?.isArchived
                        ? { icon: ArchiveBoxIcon, label: 'Unarchive Chat', action: () => { unarchiveMutation.mutate(selectedConvId!); setShowMoreMenu(false); }, color: '#25d366' }
                        : { icon: ArchiveBoxIcon, label: 'Archive Chat', action: () => { archiveMutation.mutate(); setShowMoreMenu(false); }, color: '#f59e0b' },
                      { icon: NoSymbolIcon, label: contact?.isBlocked ? 'Unblock Contact' : 'Block Contact', action: () => { blockMutation.mutate(); setShowMoreMenu(false); }, color: '#ef4444' },
                      { icon: TrashIcon, label: 'Delete Chat', action: () => { setShowDeleteConfirm(true); setShowMoreMenu(false); }, color: '#ef4444' },
                    ].map(item => (
                      <button key={item.label} onClick={item.action}
                        className="w-full text-left px-4 py-2.5 text-sm flex items-center gap-3 hover:bg-white/5"
                        style={{ color: item.color || '#e9edef' }}>
                        <item.icon className="w-4 h-4 flex-shrink-0" />
                        {item.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Applied Labels row */}
            {currentTags.length > 0 && (
              <div className="flex items-center gap-1.5 px-4 pb-2 flex-wrap">
                {currentTags.map((tag: any) => (
                  <span key={tag.id} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs text-white font-medium"
                    style={{ backgroundColor: tag.color }}>
                    {tag.name}
                    <button onClick={() => labelMutation.mutate({ tagId: tag.id, action: 'remove' })} className="hover:opacity-70 ml-0.5 leading-none">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto py-4" style={bgStyle}>
            {Object.entries(groupedMessages).map(([date, msgs]: [string, any]) => (
              <div key={date}>
                <DateSeparator date={date} bgDark={isDarkBg} />
                {msgs.map((msg: any) => <MessageBubble key={msg.id} message={msg} bgDark={isDarkBg} />)}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* AI Suggestion */}
          {showAI && aiSuggestion && (
            <div className="flex items-start gap-3 px-4 py-3 flex-shrink-0" style={{ backgroundColor: '#233138', borderTop: '1px solid #2a3942' }}>
              <SparklesIcon className="w-4 h-4 text-indigo-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-semibold text-indigo-400 mb-1">✨ AI Reply</p>
                <p className="text-sm" style={{ color: '#e9edef' }}>{aiSuggestion}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setMessage(aiSuggestion); setShowAI(false); }} className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Use</button>
                <button onClick={() => setShowAI(false)} className="p-1.5 rounded-lg hover:bg-white/10" style={{ color: '#8696a0' }}><XMarkIcon className="w-4 h-4" /></button>
              </div>
            </div>
          )}

          {/* Quick Replies */}
          {showQuickReplies && (
            <div className="max-h-48 overflow-y-auto flex-shrink-0" style={{ backgroundColor: '#233138', borderTop: '1px solid #2a3942' }}>
              <div className="px-3 py-2 flex items-center justify-between">
                <p className="text-xs font-semibold text-[#8696a0]">⚡ Quick Replies</p>
                <button onClick={() => setShowQuickReplies(false)} style={{ color: '#8696a0' }}><XMarkIcon className="w-4 h-4" /></button>
              </div>
              {(quickReplies || []).map((qr: any) => (
                <button key={qr.id} onClick={() => { setMessage(qr.content); setShowQuickReplies(false); }}
                  className="w-full text-left px-3 py-2.5 hover:bg-white/5" style={{ borderBottom: '1px solid #2a3942' }}>
                  <p className="text-xs font-semibold" style={{ color: '#e9edef' }}>{qr.title}</p>
                  <p className="text-xs truncate" style={{ color: '#8696a0' }}>{qr.content}</p>
                </button>
              ))}
            </div>
          )}

          {/* Emoji */}
          {showEmoji && (
            <div className="flex-shrink-0" style={{ borderTop: '1px solid #2a3942' }}>
              <EmojiPicker onEmojiClick={handleEmoji} width="100%" height={280} lazyLoadEmojis skinTonesDisabled />
            </div>
          )}

          {/* Input Bar */}
          <div className="flex-shrink-0 px-3 py-3" style={{ backgroundColor: '#202c33' }}>
            <div className="flex items-center gap-2">
              <button onClick={() => { setShowEmoji(!showEmoji); setShowQuickReplies(false); }}
                className="p-2.5 rounded-full hover:bg-white/10 flex-shrink-0" title="Emoji">
                <FaceSmileIcon className="w-5 h-5" style={{ color: '#aebac1' }} />
              </button>
              <button onClick={() => fileInputRef.current?.click()} disabled={uploadingFile}
                className="p-2.5 rounded-full hover:bg-white/10 flex-shrink-0" title="Attach">
                <PaperClipIcon className="w-5 h-5" style={{ color: '#aebac1' }} />
              </button>
              <input ref={fileInputRef} type="file" className="hidden" accept="image/*,video/*,audio/*,.pdf,.doc,.docx" onChange={handleFileUpload} />
              <button onClick={() => { setShowQuickReplies(!showQuickReplies); setShowEmoji(false); }}
                className="p-2.5 rounded-full hover:bg-white/10 flex-shrink-0" title="Quick replies">
                <BoltIcon className="w-5 h-5" style={{ color: '#aebac1' }} />
              </button>

              {/* Text input */}
              <textarea rows={1}
                placeholder="Type a message"
                className="flex-1 px-4 py-2.5 text-sm rounded-2xl resize-none focus:outline-none min-h-[42px] max-h-32"
                style={{ backgroundColor: '#2a3942', color: '#e9edef', border: 'none' }}
                value={message}
                onChange={e => {
                  setMessage(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px';
                }}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              />

              {/* AI button */}
              <button onClick={handleAIReply} disabled={aiLoading}
                className="p-2.5 rounded-full hover:bg-white/10 flex-shrink-0" title="AI Reply">
                {aiLoading
                  ? <ArrowPathIcon className="w-5 h-5 animate-spin" style={{ color: '#aebac1' }} />
                  : <SparklesIcon className="w-5 h-5" style={{ color: '#aebac1' }} />
                }
              </button>

              {/* Send / Mic */}
              {isRecording ? (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="flex items-center gap-1.5 px-3 py-2 rounded-full" style={{ backgroundColor: '#2a3942' }}>
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-sm font-mono text-red-400">{recordingTime}s</span>
                  </div>
                  <button onClick={stopRecording}
                    className="w-11 h-11 rounded-full flex items-center justify-center shadow-lg"
                    style={{ backgroundColor: '#ef4444' }}
                    title="Stop and send">
                    <StopIcon className="w-5 h-5 text-white" />
                  </button>
                </div>
              ) : message.trim() ? (
                <button onClick={handleSend} disabled={sendMutation.isPending}
                  className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 disabled:opacity-50 shadow-lg"
                  style={{ backgroundColor: '#25d366' }}>
                  <PaperAirplaneIcon className="w-5 h-5 text-white" />
                </button>
              ) : (
                <button onClick={startRecording}
                  className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg"
                  style={{ backgroundColor: '#25d366' }}
                  title="Click to start recording voice message">
                  <MicrophoneIcon className="w-5 h-5 text-white" />
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center" style={{ backgroundColor: '#222e35' }}>
          <div className="w-24 h-24 rounded-full flex items-center justify-center mb-6" style={{ backgroundColor: '#374045' }}>
            <ChatBubbleLeftRightIcon className="w-12 h-12" style={{ color: '#aebac1' }} />
          </div>
          <h2 className="text-3xl font-light mb-3" style={{ color: '#e9edef' }}>WhatsApp CRM</h2>
          <p className="text-sm text-center max-w-xs" style={{ color: '#8696a0' }}>
            Select a conversation to start chatting.<br />All your WhatsApp messages in one place.
          </p>
          <div className="flex items-center gap-2 mt-6 px-4 py-2 rounded-full" style={{ backgroundColor: '#374045' }}>
            <div className="w-2 h-2 rounded-full bg-[#25d366] animate-pulse" />
            <span className="text-xs" style={{ color: '#8696a0' }}>End-to-end encrypted</span>
          </div>
        </div>
      )}

      {/* ─── RIGHT: Contact Details ───────────────────────────────────── */}
      {showDetails && selectedConv && (
        <div className="w-72 flex-shrink-0 overflow-y-auto flex flex-col" style={{ backgroundColor: '#111b21', borderLeft: '1px solid #2a3942' }}>

          {/* Contact header */}
          <div className="flex flex-col items-center py-8 px-4" style={{ backgroundColor: '#202c33' }}>
            <div className="w-20 h-20 rounded-full flex items-center justify-center text-white text-3xl font-bold mb-3"
              style={{ background: 'linear-gradient(135deg, #25D366, #128C7E)' }}>
              {contact?.firstName?.[0]?.toUpperCase()}
            </div>
            <h3 className="text-lg font-semibold" style={{ color: '#e9edef' }}>{contact?.firstName} {contact?.lastName}</h3>
            <p className="text-sm mt-0.5" style={{ color: '#8696a0' }}>{contact?.phone}</p>
            <div className="flex gap-3 mt-4">
              <button onClick={() => { setContactForm({ firstName: contact?.firstName || '', lastName: contact?.lastName || '', email: contact?.email || '', company: contact?.company || '', jobTitle: '', gdprConsent: contact?.gdprConsent || false }); setShowSaveContact(true); }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium" style={{ backgroundColor: '#2a3942', color: '#25d366' }}>
                <UserPlusIcon className="w-4 h-4" /> Edit
              </button>
              <button onClick={() => blockMutation.mutate()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium" style={{ backgroundColor: '#2a3942', color: contact?.isBlocked ? '#25d366' : '#ef4444' }}>
                <NoSymbolIcon className="w-4 h-4" /> {contact?.isBlocked ? 'Unblock' : 'Block'}
              </button>
            </div>
          </div>

          {/* Info sections */}
          {[
            contact?.email && { icon: EnvelopeIcon, value: contact.email },
            contact?.company && { icon: BuildingOfficeIcon, value: contact.company },
          ].filter(Boolean).map((item: any, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3.5" style={{ borderBottom: '1px solid #2a3942' }}>
              <item.icon className="w-5 h-5 flex-shrink-0" style={{ color: '#8696a0' }} />
              <span className="text-sm" style={{ color: '#e9edef' }}>{item.value}</span>
            </div>
          ))}

          {/* Conversation info */}
          <div className="p-4" style={{ borderBottom: '1px solid #2a3942' }}>
            <p className="text-xs font-semibold uppercase mb-3" style={{ color: '#8696a0' }}>Conversation</p>
            <div className="space-y-2.5 text-sm">
              {[
                { label: 'Status', value: selectedConv.status, color: statusColors[selectedConv.status]?.text },
                { label: 'Channel', value: `${channelIcons[selectedConv.channel]} ${selectedConv.channel}` },
                { label: 'Agent', value: selectedConv.agent ? `${selectedConv.agent.firstName} ${selectedConv.agent.lastName}` : 'Unassigned' },
                { label: 'Started', value: format(new Date(selectedConv.createdAt), 'MMM d, HH:mm') },
              ].map(item => (
                <div key={item.label} className="flex justify-between items-center">
                  <span style={{ color: '#8696a0' }}>{item.label}</span>
                  <span className="font-medium text-xs" style={{ color: item.color || '#e9edef' }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Labels */}
          {currentTags.length > 0 && (
            <div className="p-4" style={{ borderBottom: '1px solid #2a3942' }}>
              <p className="text-xs font-semibold uppercase mb-2.5" style={{ color: '#8696a0' }}>Labels</p>
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
            <p className="text-xs font-semibold uppercase mb-3" style={{ color: '#8696a0' }}>Quick Actions</p>
            <div className="space-y-2">
              {[
                { label: '💳 Payment Link', action: () => setShowPayment(true), color: '#25d366' },
                { label: '🧾 Send Invoice', action: () => setShowPayment(true), color: '#3b82f6' },
                { label: '🔔 Schedule Follow-up', action: () => setShowFollowUp(true), color: '#f59e0b' },
                { label: '📹 Send Google Meet Link', action: sendGoogleMeetLink, color: '#06b6d4' },
                { label: '🎙️ Record Voice Message', action: isRecording ? stopRecording : startRecording, color: isRecording ? '#ef4444' : '#8b5cf6' },
                { label: '🎯 Add to Leads', action: () => createLeadMutation.mutate(), color: '#f97316' },
                { label: '✨ AI Reply', action: handleAIReply, color: '#8b5cf6' },
                { label: '👥 Manage Groups', action: () => setShowGroupModal(true), color: '#aebac1' },
                { label: '🚫 Block Contact', action: () => blockMutation.mutate(), color: contact?.isBlocked ? '#25d366' : '#ef4444' },
                { label: '📦 Archive Chat', action: () => archiveMutation.mutate(), color: '#6b7280' },
                { label: '🗑️ Delete Chat', action: () => setShowDeleteConfirm(true), color: '#ef4444' },
              ].map(item => (
                <button key={item.label} onClick={item.action}
                  className="w-full text-left px-3 py-2.5 text-xs rounded-xl transition-colors hover:opacity-90 font-medium"
                  style={{ backgroundColor: '#2a3942', color: item.color }}>
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── Background Picker ─────────────────────────────────────────── */}
      {showBgPicker && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="rounded-2xl shadow-2xl w-full max-w-sm" style={{ backgroundColor: '#233138' }}>
            <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid #2a3942' }}>
              <AdjustmentsHorizontalIcon className="w-5 h-5" style={{ color: '#25d366' }} />
              <h2 className="font-semibold" style={{ color: '#e9edef' }}>Chat Background</h2>
              <button onClick={() => setShowBgPicker(false)} className="ml-auto" style={{ color: '#8696a0' }}>✕</button>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-4 gap-3 mb-4">
                {BG_OPTIONS.filter(b => b.id !== 'custom').map(bg => (
                  <button key={bg.id} onClick={() => saveBg(bg.id)}
                    className="flex flex-col items-center gap-1.5">
                    <div className={`w-12 h-12 rounded-xl border-2 transition-all ${chatBg === bg.id ? 'border-[#25d366]' : 'border-transparent'}`}
                      style={{ backgroundColor: bg.value, backgroundImage: bg.pattern ? WA_PATTERN : 'none' }} />
                    <span className="text-xs" style={{ color: '#aebac1' }}>{bg.label}</span>
                  </button>
                ))}
              </div>
              <div>
                <p className="text-xs mb-2" style={{ color: '#8696a0' }}>Custom Color</p>
                <div className="flex items-center gap-3">
                  <input type="color" value={customBgColor}
                    onChange={e => setCustomBgColor(e.target.value)}
                    className="w-12 h-10 rounded-lg cursor-pointer border-0"
                    style={{ backgroundColor: 'transparent' }} />
                  <button onClick={() => saveBg('custom', customBgColor)}
                    className="flex-1 py-2 rounded-xl text-sm font-medium text-white"
                    style={{ backgroundColor: '#25d366' }}>
                    Apply Custom
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InboxPage;
