import React, { useEffect, useState } from 'react';
import {
  Bell, Briefcase, ChevronDown, FileText, Heart, HelpCircle, LayoutDashboard,
  LogOut, Mail, Pencil, PlusCircle, Search, Settings, Sparkles, User, Users, Wallet,
  Volume2, VolumeX, ShieldCheck
} from 'lucide-react';
import { PPH_CATEGORIES } from '../components/HeaderCategoriesNav';
import { slugify } from '../utils/slugify';
import type { Order, UserAccount } from '../types';
import { clearAuthToken, getAuthToken } from '../utils/authToken';
import { DEFAULT_AVATAR } from '../constants';

export interface HeaderProps {
  navigate: (to: string, e?: React.MouseEvent) => void;
  currentUser: UserAccount | null;
  orders: Order[];
  likedGigIds: string[];
  isGigsList: boolean;
  isGigDetail: boolean;
  isProjectsList: boolean;
  isProjectDetail: boolean;
  isCategoryRoute: boolean;
  loadUserSession: () => Promise<boolean>;
  updateCurrentUser: (u: UserAccount | null | ((prev: UserAccount | null) => UserAccount | null)) => void;
  setImpersonatedUser: (u: UserAccount | null) => void;
  setSelectedOrder: (o: Order | null) => void;
  setPath: (p: string) => void;
  fetchMessages: (orderId: string) => void | Promise<void>;
  onOpenLogin?: () => void;
  onOpenSignup?: () => void;
  onOpenSwitchUser?: () => void;
  searchQuery?: string;
  setSearchQuery?: (q: string) => void;
}

export const FIVERR_NAV_CATEGORIES = [
  { name: 'Graphics & Design', slug: 'design' },
  { name: 'Programming & Tech', slug: 'technology-programming' },
  { name: 'Digital Marketing', slug: 'digital-marketing' },
  { name: 'Video & Animation', slug: 'video-photo-image' },
  { name: 'Writing & Translation', slug: 'writing-translation' },
  { name: 'Music & Audio', slug: 'music-audio' },
  { name: 'Business', slug: 'business' },
  { name: 'AI Services', slug: 'ai-services' }
];

export function Header({
  navigate, currentUser, orders, likedGigIds,
  isGigsList, isGigDetail, isProjectsList, isProjectDetail, isCategoryRoute,
  loadUserSession, updateCurrentUser, setImpersonatedUser, setSelectedOrder, setPath, fetchMessages,
  onOpenLogin, onOpenSignup, onOpenSwitchUser,
  searchQuery, setSearchQuery
}: HeaderProps) {
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [isWorkstreamsDropdownOpen, setIsWorkstreamsDropdownOpen] = useState(false);
  const [isHeaderSearchDropdownOpen, setIsHeaderSearchDropdownOpen] = useState(false);
  const [isHeaderCategoriesDropdownOpen, setIsHeaderCategoriesDropdownOpen] = useState(false);
  const [isNotificationsDropdownOpen, setIsNotificationsDropdownOpen] = useState(false);
  
  const [searchInput, setSearchInput] = useState(searchQuery || '');
  useEffect(() => {
    if (searchQuery !== undefined) setSearchInput(searchQuery);
  }, [searchQuery]);

  const toggleAvailableNow = () => {
    if (!currentUser) return;
    const updated = { ...currentUser, isAvailableNow: !currentUser.isAvailableNow };
    updateCurrentUser(updated);
  };

  const [notifications, setNotifications] = useState<any[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(() => 
    typeof window !== 'undefined' ? localStorage.getItem('worksphere_notif_sound') !== 'false' : true
  );

  const playNotificationSound = () => {
    try {
      const soundOn = typeof window !== 'undefined' ? localStorage.getItem('worksphere_notif_sound') !== 'false' : true;
      if (!soundOn) return;
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') { ctx.resume(); }
      const now = ctx.currentTime;

      const compressor = ctx.createDynamicsCompressor();
      compressor.connect(ctx.destination);

      const playBeep = (freq: number, start: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(1.0, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
        osc.connect(gain);
        gain.connect(compressor);
        osc.start(start);
        osc.stop(start + duration);
      };

      playBeep(880, now, 0.18);
      playBeep(1175, now + 0.20, 0.18);
      playBeep(880, now + 0.40, 0.22);
    } catch {}
  };

  const toggleSound = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !soundEnabled;
    setSoundEnabled(next);
    if (typeof window !== 'undefined') localStorage.setItem('worksphere_notif_sound', String(next));
  };

  useEffect(() => {
    if (!currentUser?.id || typeof window === 'undefined') {
      setNotifications([]);
      return;
    }
    const fetchNotifs = async () => {
      try {
        const res = await fetch('/api/notifications', {
          headers: { 'Authorization': `Bearer ${getAuthToken() || ''}` }
        });
        if (res.ok) {
          const data = await res.json();
          setNotifications(prev => {
            const prevUnread = prev.filter(n => !n.read).length;
            const newUnread = (data as any[]).filter(n => !n.read).length;
            if (newUnread > prevUnread && prev.length > 0) {
              playNotificationSound();
            }
            return data;
          });
        }
      } catch {}
    };
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 30000);
    return () => clearInterval(interval);
  }, [currentUser?.id]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = async (id: string, link?: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await fetch(`/api/notifications/${id}/read`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${getAuthToken() || ''}` }
      });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch {}
    if (link) {
      setIsNotificationsDropdownOpen(false);
      navigate(link);
    }
  };

  const markAllAsRead = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`/api/notifications/read-all`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${getAuthToken() || ''}` }
      });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch {}
  };

  useEffect(() => {
    const handleOutsideClick = () => {
      if (isUserDropdownOpen) setIsUserDropdownOpen(false);
      if (isWorkstreamsDropdownOpen) setIsWorkstreamsDropdownOpen(false);
      if (isHeaderSearchDropdownOpen) setIsHeaderSearchDropdownOpen(false);
      if (isHeaderCategoriesDropdownOpen) setIsHeaderCategoriesDropdownOpen(false);
      if (isNotificationsDropdownOpen) setIsNotificationsDropdownOpen(false);
    };
    if (isUserDropdownOpen || isWorkstreamsDropdownOpen || isHeaderSearchDropdownOpen || isHeaderCategoriesDropdownOpen || isNotificationsDropdownOpen) {
      document.addEventListener('click', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('click', handleOutsideClick);
    };
  }, [isUserDropdownOpen, isWorkstreamsDropdownOpen, isHeaderSearchDropdownOpen, isHeaderCategoriesDropdownOpen, isNotificationsDropdownOpen]);

  useEffect(() => {
    if (!currentUser) {
      setIsWorkstreamsDropdownOpen(false);
      setIsUserDropdownOpen(false);
    }
  }, [currentUser]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (setSearchQuery) {
      setSearchQuery(searchInput);
    }
    navigate(`/gigs?q=${encodeURIComponent(searchInput)}`);
  };

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-[#E4E5E7] shadow-xs w-full">
      {/* TIER 1: TOP MAIN BAR */}
      <div className="h-20 max-w-[1400px] mx-auto px-4 sm:px-6 flex items-center justify-between gap-4">
        {/* Left: Brand Logo & Categories Toggle */}
        <div className="flex items-center gap-6 shrink-0">
          <a
            href="/"
            onClick={(e) => navigate('/', e)}
            className="flex items-center select-none group"
          >
            <span className="text-[28px] font-extrabold tracking-tight text-[#222325]">
              WorkPerHour<span className="text-[#1DBF73]">.</span>
            </span>
          </a>

          {/* Categories mega flyout trigger */}
          <div className="relative hidden xl:block">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsHeaderCategoriesDropdownOpen(!isHeaderCategoriesDropdownOpen);
              }}
              className="px-3 py-1.5 text-[14px] font-semibold text-[#404145] hover:text-[#1DBF73] flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>Explore Categories</span>
              <ChevronDown className={`w-3.5 h-3.5 text-[#74767E] transition-transform ${isHeaderCategoriesDropdownOpen ? 'rotate-180 text-[#1DBF73]' : ''}`} />
            </button>

            {isHeaderCategoriesDropdownOpen && (
              <div 
                className="absolute left-0 top-full mt-2 w-[720px] max-w-[calc(100vw-2rem)] z-[120] animate-in fade-in duration-150"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="bg-white rounded-xl shadow-2xl border border-[#E4E5E7] p-6 text-sm">
                  <div className="px-2 pb-3 mb-4 border-b border-[#E4E5E7] flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#74767E] flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#1DBF73]" />
                      Browse Services Directory
                    </span>
                    <a 
                      href="/gigs" 
                      onClick={(e) => { 
                        setIsHeaderCategoriesDropdownOpen(false); 
                        navigate('/gigs', e); 
                      }}
                      className="text-xs font-bold text-[#1DBF73] hover:underline flex items-center gap-1"
                    >
                      View All Gigs →
                    </a>
                  </div>

                  <div className="grid grid-cols-2 gap-4 max-h-[440px] overflow-y-auto p-1 scrollbar-none">
                    {PPH_CATEGORIES.map((cat) => (
                      <div key={cat.slug} className="p-3.5 rounded-lg hover:bg-[#F7F7F7] border border-[#E4E5E7] group transition">
                        <a 
                          href={`/categories/${cat.slug}`}
                          onClick={(e) => { 
                            setIsHeaderCategoriesDropdownOpen(false); 
                            navigate(`/categories/${cat.slug}`, e); 
                          }}
                          className="font-bold text-[#222325] group-hover:text-[#1DBF73] text-sm block mb-2 flex items-center justify-between"
                        >
                          <span>{cat.name}</span>
                          <span className="text-[#B5B6BA] group-hover:text-[#1DBF73] text-xs transition">→</span>
                        </a>
                        <div className="flex flex-wrap gap-x-2.5 gap-y-1 text-[12px] text-[#74767E]">
                          {cat.subcategories.slice(0, 5).map((sub) => (
                            <a
                              key={sub.slug}
                              href={`/categories/${sub.slug}`}
                              onClick={(e) => { 
                                setIsHeaderCategoriesDropdownOpen(false); 
                                navigate(`/categories/${sub.slug}`, e); 
                              }}
                              className="hover:text-[#1DBF73] hover:underline cursor-pointer"
                            >
                              {sub.name}
                            </a>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Center: Global Search Bar */}
        <form 
          onSubmit={handleSearchSubmit} 
          className="hidden md:flex flex-1 max-w-xl mx-4 items-center border border-[#E4E5E7] rounded-md overflow-hidden bg-white hover:border-[#74767E] focus-within:border-[#222325] transition"
        >
          <div className="pl-3.5 pr-1 text-[#74767E]">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder="What service are you looking for today?"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full px-2.5 py-2.5 text-[14px] text-[#222325] placeholder-[#74767E] focus:outline-none"
          />
          <button
            type="submit"
            className="px-5 py-2.5 bg-[#222325] hover:bg-[#1DBF73] text-white transition-colors flex items-center justify-center shrink-0 cursor-pointer font-semibold text-sm"
          >
            Search
          </button>
        </form>

        {/* Right Actions */}
        <div className="flex items-center gap-3 sm:gap-4 shrink-0">

          {/* Post a Project Button */}
          <a
            href="/post-project"
            onClick={(e) => navigate('/post-project', e)}
            className="hidden sm:inline-flex items-center px-4 py-2 border border-[#1DBF73] text-[#1DBF73] hover:bg-[#1DBF73] hover:text-white rounded-md text-[14px] font-bold transition-all cursor-pointer"
          >
            Post a Project
          </a>

          {/* Wishlist Icon */}
          <button
            type="button"
            onClick={(e) => navigate('/wishlist', e)}
            className="p-2 text-[#404145] hover:text-[#1DBF73] rounded-full hover:bg-[#F7F7F7] transition relative cursor-pointer"
            title="Wishlist / Saved Gigs"
          >
            <Heart className="w-5 h-5" />
            {likedGigIds.length > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center">
                {likedGigIds.length}
              </span>
            )}
          </button>

          {/* Notifications Bell */}
          <div className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsNotificationsDropdownOpen(!isNotificationsDropdownOpen);
                setIsUserDropdownOpen(false);
                setIsWorkstreamsDropdownOpen(false);
              }}
              className="p-2 text-[#404145] hover:text-[#1DBF73] rounded-full hover:bg-[#F7F7F7] transition relative cursor-pointer"
              title="Notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 px-1.5 py-0.5 bg-[#1DBF73] text-white font-bold text-[10px] rounded-full min-w-4 text-center leading-none">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {isNotificationsDropdownOpen && (
              <div 
                className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-2xl border border-[#E4E5E7] py-3 z-[150] text-left"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between px-4 pb-3 border-b border-[#E4E5E7]">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-[#222325]">Notifications</h3>
                    {unreadCount > 0 && (
                      <span className="px-2 py-0.5 bg-emerald-100 text-[#0A4226] text-[11px] font-bold rounded-full">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={toggleSound}
                      className="p-1.5 text-[#74767E] hover:text-[#1DBF73] hover:bg-[#F7F7F7] rounded-md transition"
                      title={soundEnabled ? 'Mute notification sound' : 'Enable notification sound'}
                    >
                      {soundEnabled ? <Volume2 className="w-4 h-4 text-[#1DBF73]" /> : <VolumeX className="w-4 h-4 text-[#B5B6BA]" />}
                    </button>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={markAllAsRead}
                        className="text-[11px] font-bold text-[#1DBF73] hover:underline cursor-pointer"
                      >
                        Mark all as read
                      </button>
                    )}
                  </div>
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-[#E4E5E7]">
                  {notifications.length === 0 ? (
                    <div className="py-8 text-center text-[#74767E] text-xs">
                      No notifications yet. You're all caught up!
                    </div>
                  ) : (
                    notifications.map(n => (
                      <div 
                        key={n.id} 
                        onClick={(e) => markAsRead(n.id, n.link, e)}
                        className={`p-3.5 hover:bg-[#F7F7F7] transition cursor-pointer flex gap-3 ${!n.read ? 'bg-[#F7F7F7]' : ''}`}
                      >
                        <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${!n.read ? 'bg-[#1DBF73]' : 'bg-transparent'}`}></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-[#222325] truncate">{n.title}</p>
                          <p className="text-[12px] text-[#404145] mt-0.5 line-clamp-2">{n.message}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Workstreams / Messages Mail Icon */}
          <div className="relative">
            <button
              type="button"
              onClick={async (e) => {
                e.stopPropagation();
                let hasUser = !!currentUser;
                if (!hasUser) {
                  const ok = await loadUserSession();
                  hasUser = ok;
                }
                if (!hasUser) {
                  setIsWorkstreamsDropdownOpen(false);
                  if (onOpenLogin) onOpenLogin();
                  else navigate('/login', e);
                  return;
                }
                setIsWorkstreamsDropdownOpen(!isWorkstreamsDropdownOpen);
                setIsUserDropdownOpen(false);
                setIsNotificationsDropdownOpen(false);
              }}
              className="p-2 text-[#404145] hover:text-[#1DBF73] rounded-full hover:bg-[#F7F7F7] transition relative cursor-pointer"
              title="Workstreams & Orders"
            >
              <Mail className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#1DBF73] rounded-full ring-2 ring-white"></span>
            </button>

            {currentUser && isWorkstreamsDropdownOpen && (
              <div 
                className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-[#E4E5E7] py-3 z-[150] text-sm"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-4 pb-3 mb-2 border-b border-[#E4E5E7] flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#74767E]">WorkStreams</span>
                  <span className="text-xs font-bold text-[#1DBF73]">{orders.length} Active</span>
                </div>

                {orders.length === 0 ? (
                  <div className="p-6 text-center text-[#74767E] space-y-3">
                    <Mail className="w-8 h-8 mx-auto text-[#B5B6BA]" />
                    <p className="text-xs font-bold text-[#222325]">No workstreams yet</p>
                    <p className="text-[11px] text-[#74767E]">Explore services or post a project to start an escrow workstream.</p>
                  </div>
                ) : (
                  <div className="max-h-80 overflow-y-auto divide-y divide-[#E4E5E7]">
                    {orders.slice(0, 5).map(ord => {
                      const activeUid = currentUser?.id;
                      const isBuyer = activeUid === ord.buyerId;
                      const partner = isBuyer ? (ord as any).seller : (ord as any).buyer;
                      const partnerName = partner?.name || (isBuyer ? ord.sellerUsername || 'Seller' : ord.buyerUsername || 'Buyer');
                      const previewText = (ord as any).lastMessage || ord.title;
                      return (
                        <div 
                          key={ord.id}
                          onClick={(e) => {
                            setSelectedOrder(ord);
                            fetchMessages(ord.id);
                            setIsWorkstreamsDropdownOpen(false);
                            navigate('/messages/' + ord.id, e);
                          }}
                          className="p-3 hover:bg-[#F7F7F7] transition cursor-pointer flex items-start gap-3"
                        >
                          <div className="w-8 h-8 rounded-full bg-[#E4E5E7] text-[#222325] flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                            {partnerName.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-0.5">
                              <span className="font-bold text-[#222325] truncate">{partnerName}</span>
                            </div>
                            <p className="text-[12px] text-[#74767E] truncate">{previewText}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="pt-2 px-3 border-t border-[#E4E5E7] mt-2 text-center">
                  <button 
                    onClick={(e) => {
                      setIsWorkstreamsDropdownOpen(false);
                      navigate('/messages', e);
                    }}
                    className="w-full py-2 bg-[#F7F7F7] hover:bg-[#E4E5E7] text-[#222325] font-bold text-[11px] uppercase tracking-wider rounded-md transition cursor-pointer"
                  >
                    View All Workstreams
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* User Account / Login State */}
          {!currentUser ? (
            <div className="flex items-center gap-2">
              <button 
                type="button"
                onClick={(e) => { 
                  if (onOpenSwitchUser) onOpenSwitchUser(); 
                  else navigate('/switch-user', e); 
                }} 
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-bold text-[#2E258E] bg-[#F7F7F7] hover:bg-[#E4E5E7] rounded-md transition"
                title="Switch demo account (client, freelancer, admin)"
              >
                <Users className="w-3.5 h-3.5" />
                <span>Switch Demo User</span>
              </button>
              <button 
                type="button"
                onClick={(e) => { if (onOpenLogin) onOpenLogin(); else navigate('/login', e); }} 
                className="px-3 py-2 text-[14px] font-bold text-[#222325] hover:text-[#1DBF73] cursor-pointer transition"
              >
                Sign In
              </button>
              <button 
                type="button"
                onClick={(e) => { if (onOpenSignup) onOpenSignup(); else navigate('/signup', e); }} 
                className="px-4 py-2 text-[14px] font-bold text-white bg-[#1DBF73] hover:bg-[#19A463] rounded-md cursor-pointer transition shadow-xs"
              >
                Join
              </button>
            </div>
          ) : (
            <div className="relative flex items-center gap-3">

              {/* Avatar trigger */}
              <button 
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsUserDropdownOpen(!isUserDropdownOpen);
                  setIsNotificationsDropdownOpen(false);
                  setIsWorkstreamsDropdownOpen(false);
                }}
                className="relative flex items-center gap-1.5 cursor-pointer p-0.5 rounded-full hover:ring-2 hover:ring-[#1DBF73] transition"
              >
                <div className="relative">
                  <img 
                    src={currentUser.avatar || DEFAULT_AVATAR} 
                    alt={currentUser.name} 
                    className="w-8 h-8 rounded-full object-cover border border-[#E4E5E7]" 
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = DEFAULT_AVATAR;
                    }}
                  />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#1DBF73] border-2 border-white absolute bottom-0 right-0 inline-block" />
                </div>
              </button>

              {/* User Dropdown Menu */}
              {isUserDropdownOpen && (
                <div 
                  className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-2xl border border-[#E4E5E7] p-3 z-[150] text-sm"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="px-3 py-2.5 border-b border-[#E4E5E7] mb-2 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-[#222325] block">{currentUser.name}</span>
                      <span className="text-xs text-[#74767E] uppercase">{currentUser.role}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-[#1DBF73] uppercase">Online</span>
                    </div>
                  </div>

                  <button 
                    onClick={(e) => { setIsUserDropdownOpen(false); navigate('/create-gig', e); }} 
                    className="w-full text-left px-3 py-2 rounded-md hover:bg-[#F7F7F7] text-[#222325] font-semibold flex items-center gap-2.5 transition cursor-pointer"
                  >
                    <PlusCircle className="w-4 h-4 text-[#1DBF73]" />
                    <span>Post a Gig</span>
                  </button>

                  <button 
                    onClick={(e) => { 
                      setIsUserDropdownOpen(false); 
                      if (onOpenSwitchUser) onOpenSwitchUser();
                      else navigate('/switch-user', e); 
                    }} 
                    className="w-full text-left px-3 py-2 rounded-md hover:bg-[#F7F7F7] text-[#2E258E] font-semibold flex items-center gap-2.5 transition cursor-pointer"
                  >
                    <Users className="w-4 h-4 text-[#2E258E]" />
                    <span>Switch User Account</span>
                  </button>

                  <button 
                    onClick={(e) => { setIsUserDropdownOpen(false); navigate('/orders', e); }} 
                    className="w-full text-left px-3 py-2 rounded-md hover:bg-[#F7F7F7] text-[#222325] font-semibold flex items-center gap-2.5 transition cursor-pointer"
                  >
                    <LayoutDashboard className="w-4 h-4 text-[#1DBF73]" />
                    <span>Dashboard & Orders</span>
                  </button>

                  <button 
                    onClick={(e) => { 
                      setIsUserDropdownOpen(false); 
                      const pUrl = `/${slugify(currentUser.name)}`;
                      navigate(pUrl, e); 
                    }} 
                    className="w-full text-left px-3 py-2 rounded-md hover:bg-[#F7F7F7] text-[#222325] font-semibold flex items-center gap-2.5 transition cursor-pointer"
                  >
                    <User className="w-4 h-4 text-[#1DBF73]" />
                    <span>My Profile</span>
                  </button>

                  <button 
                    onClick={(e) => { setIsUserDropdownOpen(false); navigate('/payments', e); }} 
                    className="w-full text-left px-3 py-2 rounded-md hover:bg-[#F7F7F7] text-[#222325] font-semibold flex items-center gap-2.5 transition cursor-pointer"
                  >
                    <Wallet className="w-4 h-4 text-[#1DBF73]" />
                    <span>Escrow Wallet & Payouts</span>
                  </button>

                  <button 
                    onClick={(e) => { setIsUserDropdownOpen(false); navigate('/settings', e); }} 
                    className="w-full text-left px-3 py-2 rounded-md hover:bg-[#F7F7F7] text-[#222325] font-semibold flex items-center gap-2.5 transition cursor-pointer"
                  >
                    <Settings className="w-4 h-4 text-[#74767E]" />
                    <span>Settings</span>
                  </button>

                  <div className="my-1 border-t border-[#E4E5E7]"></div>

                  <button 
                    onClick={() => {
                      setIsUserDropdownOpen(false);
                      setImpersonatedUser(null);
                      updateCurrentUser(null);
                      clearAuthToken();
                      localStorage.removeItem('user');
                      localStorage.removeItem('current_user');
                      setPath('/gigs');
                      window.history.pushState({}, '', '/gigs');
                    }} 
                    className="w-full text-left px-3 py-2 rounded-md hover:bg-rose-50 text-rose-600 font-semibold flex items-center gap-2.5 transition cursor-pointer"
                  >
                    <LogOut className="w-4 h-4 text-rose-500" />
                    <span>Log Out</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* TIER 2: SECONDARY CATEGORY BAR (Horizontal scrollable/flex, 14px, #62646A, hover border-b-2 #1DBF73) */}
      <div className="h-11 border-t border-[#E4E5E7] bg-white">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-full flex items-center gap-8 overflow-x-auto scrollbar-none text-[14px] text-[#62646A]">
          {FIVERR_NAV_CATEGORIES.map(cat => (
            <a
              key={cat.slug}
              href={`/categories/${cat.slug}`}
              onClick={(e) => navigate(`/categories/${cat.slug}`, e)}
              className="h-full flex items-center border-b-2 border-transparent hover:border-[#1DBF73] hover:text-[#1DBF73] font-medium whitespace-nowrap transition-colors cursor-pointer"
            >
              {cat.name}
            </a>
          ))}
        </div>
      </div>
    </header>
  );
}
