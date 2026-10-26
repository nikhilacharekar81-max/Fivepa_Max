/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  ShieldCheck, 
  Search, 
  Briefcase, 
  DollarSign, 
  User as UserIcon, 
  Settings, 
  MessageSquare, 
  CheckCircle2, 
  Lock, 
  Zap, 
  SlidersHorizontal,
  LogOut,
  Bell,
  Star,
  ExternalLink,
  PlusCircle,
  HelpCircle,
  ArrowRight,
  Clock,
  Check
} from 'lucide-react';
import { useAppData } from './hooks/useAppData';
import { useWorkstream } from './hooks/workstream/useWorkstream';
import { Header } from './layout/Header';
import { Footer } from './layout/Footer';
import { MarketplaceGigsView } from './components/marketplace/MarketplaceGigsView';
import {
  WorkstreamWorkspace,
  WorkstreamSidebar,
  WorkstreamList,
  StartWorkstreamModal,
  type WorkstreamFilter
} from './components/workstream';
import { AdminPage } from './pages/AdminPage';
import { SettingsPage } from './pages/SettingsPage';
import { UserWalletsLedgerModule } from './components/UserWalletsLedgerModule';
import { PaymentsModule } from './components/PaymentsModule';
import { LoginModal, SignupModal, VerifyModal, UserSwitchModal, ForgotPasswordModal, WishlistModal, SupportModal } from './components/modals';
import { slugify, getGigUrl } from './utils/slugify';
import { PPH_CATEGORIES } from './components/HeaderCategoriesNav';
import { ProjectDetailView } from './components/marketplace/ProjectDetailView';
import { ProjectSearchView } from './components/marketplace/ProjectSearchView';
import { FreelancerSearchView } from './components/marketplace/FreelancerSearchView';
import { BuyerActivityView } from './components/marketplace/BuyerActivityView';
import { FreelancerActivityView } from './components/marketplace/FreelancerActivityView';
import { CreateGigView } from './components/gigs/CreateGigView';
import { GigDetailView } from './components/gigs/GigDetailView';
import { EditProfilePage } from './components/profile/EditProfilePage';
import { FreelancerProfileView } from './components/profile/FreelancerProfileView';
import { getAuthToken, setAuthToken, clearAuthToken, requestDemoSession, installAuthFetch } from './utils/authToken';
import { getDeviceId } from './utils/deviceId';

declare global {
  interface Window {
    __INITIAL_DATA__?: any;
  }
}

export default function App({ initialPath = '/', initialData }: { initialPath?: string; initialData?: any } = {}) {
  const resolvedInitialData = initialData || (typeof window !== 'undefined' ? window.__INITIAL_DATA__ : undefined);
  const [path, setPath] = useState(initialPath || (typeof window !== 'undefined' ? window.location.pathname : '/'));
  const appData = useAppData(resolvedInitialData);
  const { users, gigs, projects, orders, proposals, messages, setMessages, setReviews, setOrders, refresh } = appData;

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [impersonatedUser, setImpersonatedUser] = useState<any>(null);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [likedGigIds, setLikedGigIds] = useState<string[]>([]);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isSignupOpen, setIsSignupOpen] = useState(false);
  const [isSwitchUserOpen, setIsSwitchUserOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentCategory, setCurrentCategory] = useState('All');
  const [gigViewMode, setGigViewMode] = useState<'grid' | 'list'>('grid');
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [serviceOptionFilter, setServiceOptionFilter] = useState('all');
  const [sellerLevelFilter, setSellerLevelFilter] = useState('all');
  const [budgetFilter, setBudgetFilter] = useState('all');
  const [deliveryTimeFilter, setDeliveryTimeFilter] = useState<number | null>(null);
  const [onlineNowOnly, setOnlineNowOnly] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Workstream filter & modal state
  const [workstreamTab, setWorkstreamTab] = useState<WorkstreamFilter>('all');
  const [starredWorkstreams, setStarredWorkstreams] = useState<string[]>([]);
  const [selectedPersonFilter, setSelectedPersonFilter] = useState<string | null>(null);
  const [peopleSearch, setPeopleSearch] = useState('');
  const [projectFilterSearch, setProjectFilterSearch] = useState('');
  const [workstreamSearch, setWorkstreamSearch] = useState('');
  const [isStartWorkstreamModalOpen, setIsStartWorkstreamModalOpen] = useState(false);

  // Login form state for LoginModal
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginCode, setLoginCode] = useState('');
  const [loginRequiresCode, setLoginRequiresCode] = useState(false);
  const [loginVerificationMessage, setLoginVerificationMessage] = useState('');
  const [mockEmailCodeDisplay, setMockEmailCodeDisplay] = useState<string | null>(null);

  // Signup form state for SignupModal
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupMobile, setSignupMobile] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');

  // Verify modal state
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [verifyEmail, setVerifyEmail] = useState('');
  const [verifyMobile, setVerifyMobile] = useState('');
  const [verificationMode, setVerificationMode] = useState<'email' | 'sms'>('email');
  const [emailCodeInput, setEmailCodeInput] = useState('');
  const [smsCodeInput, setSmsCodeInput] = useState('');
  const [mockSmsCodeDisplay, setMockSmsCodeDisplay] = useState<string | null>(null);

  // Forgot Password & Support modal state
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState<'request' | 'verify' | 'reset'>('request');
  const [forgotQuery, setForgotQuery] = useState('');
  const [forgotCode, setForgotCode] = useState('');
  const [mockForgotCodeDisplay, setMockForgotCodeDisplay] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  // Wishlist and Support modal state
  const [isWishlistOpen, setIsWishlistOpen] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [supportSubject, setSupportSubject] = useState('');
  const [supportMessage, setSupportMessage] = useState('');

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  }, []);

  const handleForgotRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/auth/forgot-password/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: forgotQuery })
      });
      const data = await res.json();
      if (res.ok) {
        if (data.mockCode) setMockForgotCodeDisplay(data.mockCode);
        setForgotStep('verify');
        showToast('Recovery code sent successfully!');
      } else {
        showToast(data.error || 'User not found');
      }
    } catch {
      showToast('Failed to send recovery code');
    }
  };

  const handleForgotVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/auth/forgot-password/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: forgotQuery, code: forgotCode })
      });
      const data = await res.json();
      if (res.ok) {
        setForgotStep('reset');
        showToast('Code verified. Set new password.');
      } else {
        showToast(data.error || 'Invalid recovery code');
      }
    } catch {
      showToast('Failed to verify code');
    }
  };

  const handleForgotReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      showToast('Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      showToast('Passwords do not match');
      return;
    }
    try {
      const res = await fetch('/api/auth/forgot-password/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: forgotQuery, code: forgotCode, newPassword })
      });
      const data = await res.json();
      if (res.ok) {
        setIsForgotPasswordOpen(false);
        setForgotStep('request');
        setForgotCode('');
        setNewPassword('');
        setConfirmNewPassword('');
        showToast('Password reset successfully. Please log in.');
        setIsLoginOpen(true);
      } else {
        showToast(data.error || 'Failed to reset password');
      }
    } catch {
      showToast('Failed to reset password');
    }
  };

  const handleSubmitSupportTicket = async (e: React.FormEvent, isAppeal?: boolean) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/support-tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken() || ''}`
        },
        body: JSON.stringify({
          subject: supportSubject,
          text: supportMessage,
          isAppeal
        })
      });
      const data = await res.json();
      if (res.ok) {
        setIsSupportOpen(false);
        setSupportSubject('');
        setSupportMessage('');
        showToast('Support ticket submitted successfully!');
      } else {
        showToast(data.error || 'Failed to submit support ticket.');
      }
    } catch {
      showToast('Failed to submit support ticket.');
    }
  };

  const handleVerifyEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailCodeInput.trim()) {
      showToast('Please enter your 6-digit verification code.');
      return;
    }
    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: verifyEmail, code: emailCodeInput.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        setIsVerifyModalOpen(false);
        setEmailCodeInput('');
        if (data.token && data.user) {
          setAuthToken(data.token);
          setCurrentUser(data.user);
          setImpersonatedUser(null);
          await refresh(data.user.id);
          showToast(`Email verified successfully! Welcome, ${data.user.name}.`);
        } else {
          showToast('Email verified successfully! You can now log in.');
          setIsLoginOpen(true);
          setLoginEmail(verifyEmail);
        }
      } else {
        showToast(data.error || 'Invalid verification code.');
      }
    } catch {
      showToast('Failed to verify code.');
    }
  };

  const handleResendEmailCode = async () => {
    if (!verifyEmail) return;
    try {
      const res = await fetch('/api/auth/resend-email-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: verifyEmail })
      });
      const data = await res.json();
      if (res.ok) {
        if (data.mockCode) setMockEmailCodeDisplay(data.mockCode);
        showToast('A new verification code has been dispatched.');
      } else {
        showToast(data.error || 'Failed to resend code.');
      }
    } catch {
      showToast('Failed to resend verification code.');
    }
  };

  const handleVerifySmsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!smsCodeInput.trim()) {
      showToast('Please enter your 6-digit SMS code.');
      return;
    }
    try {
      const res = await fetch('/api/auth/verify-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: verifyMobile, code: smsCodeInput.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Mobile number verified successfully!');
      } else {
        showToast(data.error || 'Invalid SMS code.');
      }
    } catch {
      showToast('Failed to verify SMS code.');
    }
  };

  const handleResendSmsCode = async () => {
    showToast('SMS verification code dispatched.');
  };

  const loadUserSession = useCallback(async () => {
    if (typeof window !== 'undefined') {
      installAuthFetch();
    }
    const token = getAuthToken();
    if (!token) {
      const loggedOut = typeof window !== 'undefined' && localStorage.getItem('workperhour_logged_out') === 'true';
      if (!loggedOut) {
        const demo = await requestDemoSession('u2');
        if (demo?.token && demo?.user) {
          setAuthToken(demo.token);
          setCurrentUser(demo.user);
          await refresh(demo.user.id);
          return true;
        }
      }
      setCurrentUser(null);
      return false;
    }
    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}`, 'x-device-id': getDeviceId() }
      });
      if (res.ok) {
        const u = await res.json();
        setCurrentUser(u);
        await refresh(u.id);
        return true;
      } else {
        clearAuthToken();
        const loggedOut = typeof window !== 'undefined' && localStorage.getItem('workperhour_logged_out') === 'true';
        if (!loggedOut) {
          const demo = await requestDemoSession('u2');
          if (demo?.token && demo?.user) {
            setAuthToken(demo.token);
            setCurrentUser(demo.user);
            await refresh(demo.user.id);
            return true;
          }
        }
        setCurrentUser(null);
        return false;
      }
    } catch {
      return false;
    }
  }, [refresh]);

  useEffect(() => {
    loadUserSession();
    refresh();
  }, [loadUserSession, refresh]);

  useEffect(() => {
    const handleNotify = (e: any) => {
      if (e.detail) {
        showToast(String(e.detail));
      }
    };
    window.addEventListener('app:notify' as any, handleNotify);
    return () => window.removeEventListener('app:notify' as any, handleNotify);
  }, [showToast]);

  useEffect(() => {
    const onPopState = () => {
      setPath(window.location.pathname);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((to: string, e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    if (to === '/login') {
      setIsLoginOpen(true);
      return;
    }
    if (to === '/signup') {
      setIsSignupOpen(true);
      return;
    }
    if (to === '/switch-user') {
      setIsSwitchUserOpen(true);
      return;
    }
    if (to === '/support') {
      setIsSupportOpen(true);
      return;
    }
    if (to === '/wishlist') {
      setIsWishlistOpen(true);
      return;
    }
    if (to === '/post-project' || to === '/create-project') {
      if (typeof window !== 'undefined') {
        window.history.pushState({}, '', '/buyer-activity');
      }
      setPath('/buyer-activity');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', to);
    }
    const isTargetWorkstreamSubroute = /^\/(?:workstream|workstreams|messages|orders)\/[^/?#]+/.test(to);
    if (!isTargetWorkstreamSubroute) {
      setSelectedOrder(null);
    }
    setPath(to);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleToggleLike = (gigId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setLikedGigIds(prev => prev.includes(gigId) ? prev.filter(id => id !== gigId) : [...prev, gigId]);
  };

  const effectiveUser = impersonatedUser || currentUser;

  const workstream = useWorkstream({
    currentUser,
    impersonatedUser,
    orders,
    setOrders,
    usersList: users,
    gigs,
    projects,
    messages,
    setMessages,
    setReviews,
    selectedOrder,
    setSelectedOrder,
    workstreamTab,
    starredWorkstreams,
    selectedPersonFilter,
    projectFilterSearch,
    workstreamSearch,
    setIsStartWorkstreamModalOpen,
    navigate,
    refresh
  });

  // Synchronize URL routes (/workstream/:id, /workstreams/:id, /messages/:id, /orders/:id) with selectedOrder
  useEffect(() => {
    const match = path.match(/^\/(?:workstream|workstreams|messages|orders)\/([^/?#]+)/);
    if (!match) return;
    const targetOrderId = decodeURIComponent(match[1]);
    if (!targetOrderId) return;

    if (selectedOrder?.id === targetOrderId) {
      return;
    }

    const existing = orders.find(o => o.id === targetOrderId);
    if (existing) {
      setSelectedOrder(existing);
      workstream.fetchMessages(targetOrderId);
      return;
    }

    const token = getAuthToken();
    if (!token) return;
    fetch(`/api/orders/${encodeURIComponent(targetOrderId)}`, {
      headers: { 'Authorization': `Bearer ${token}`, 'x-device-id': getDeviceId() }
    })
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (data && data.id) {
          setSelectedOrder(data);
          if (Array.isArray(data.messages)) {
            setMessages(prev => {
              const other = prev.filter(m => m.orderId !== data.id);
              return [...other, ...data.messages];
            });
          } else {
            workstream.fetchMessages(data.id);
          }
        }
      })
      .catch(() => {});
  }, [path, orders, selectedOrder?.id, setMessages, workstream]);

  const isWorkstreamRoute =
    path === '/workstreams' ||
    path.startsWith('/workstreams/') ||
    path.startsWith('/workstream/') ||
    path === '/messages' ||
    path.startsWith('/messages/') ||
    path === '/orders' ||
    path.startsWith('/orders/');

  const canViewGig = (g: any) => {
    if (!g) return false;
    if (g.status === 'active' || g.status === 'paused') return true;
    if (!effectiveUser) return false;
    return g.freelancerId === effectiveUser.id || effectiveUser.role === 'admin' || effectiveUser.role === 'super_admin';
  };

  const filteredGigs = gigs.filter(g => {
    if (g.status === 'moderation' || g.status === 'deleted') return false;
    if (currentCategory !== 'All' && g.category !== currentCategory) return false;
    if (searchQuery.trim() && !g.title.toLowerCase().includes(searchQuery.toLowerCase()) && !g.description.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

  const selectedPersonObj = selectedPersonFilter
    ? users.find(u => u.id === selectedPersonFilter)
    : null;

  const activeWorkstreamOrder = workstream.selectedOrder || selectedOrder;
  const activeOrderMessages = activeWorkstreamOrder
    ? messages.filter(m => m.orderId === activeWorkstreamOrder.id)
    : [];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-slate-800 animate-bounce">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <Header 
        navigate={navigate}
        currentUser={effectiveUser}
        orders={orders}
        likedGigIds={likedGigIds}
        isGigsList={path === '/' || path === '/gigs'}
        isGigDetail={path.startsWith('/gig/')}
        isProjectsList={path === '/projects'}
        isProjectDetail={path.startsWith('/project/')}
        isCategoryRoute={false}
        loadUserSession={loadUserSession}
        updateCurrentUser={setCurrentUser}
        setImpersonatedUser={setImpersonatedUser}
        setSelectedOrder={setSelectedOrder}
        setPath={setPath}
        fetchMessages={workstream.fetchMessages}
        onOpenLogin={() => setIsLoginOpen(true)}
        onOpenSignup={() => setIsSignupOpen(true)}
        onOpenSwitchUser={() => setIsSwitchUserOpen(true)}
      />

      {/* Main Content Router */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {path.startsWith('/admin') ? (
          <AdminPage 
            currentUser={effectiveUser}
            impersonatedUser={impersonatedUser}
            updateCurrentUser={setCurrentUser}
            setImpersonatedUser={setImpersonatedUser}
            usersList={users}
            setUsersList={() => {}}
            projects={projects}
            gigs={gigs}
            orders={orders}
            proposals={proposals}
            navigate={navigate}
            refresh={async () => { await refresh(); }}
          />
        ) : isWorkstreamRoute ? (
          activeWorkstreamOrder ? (
            <WorkstreamWorkspace 
              order={activeWorkstreamOrder}
              currentUser={effectiveUser}
              messages={activeOrderMessages}
              files={workstream.activeSharedFiles}
              onBack={() => {
                setSelectedOrder(null);
                navigate('/messages');
              }}
              onSendMessage={(text: string) => {
                workstream.sendMessage(text, 'text', undefined, activeWorkstreamOrder.id);
              }}
              onRetryMessage={(msg) => {
                workstream.retryMessage(msg as any);
              }}
              onAttachFile={(file) => {
                workstream.sendMessage(`Shared file: ${file.name}`, 'file', file, activeWorkstreamOrder.id);
              }}
              sendEvent={workstream.sendEvent}
              onDeliverWork={workstream.handleDeliverWork}
              onReleaseEscrow={workstream.handleReleaseEscrow}
              onRequestRevision={workstream.handleRequestRevision}
              isReviewModalOpen={workstream.isReviewModalOpen}
              setIsReviewModalOpen={workstream.setIsReviewModalOpen}
              handleSubmitReview={workstream.handleSubmitReview}
              reviewError={workstream.reviewError}
              isSubmittingReview={workstream.isSubmittingReview}
              escrowError={workstream.escrowError}
              onOrderChanged={(updated: any, followOnOrder?: any) => {
                if (followOnOrder && followOnOrder.id) {
                  setOrders(prev => [followOnOrder, ...prev.filter(o => o.id !== followOnOrder.id)]);
                  setSelectedOrder(followOnOrder);
                  workstream.fetchMessages(followOnOrder.id);
                  navigate(`/messages/${followOnOrder.id}`);
                } else if (updated && updated.id) {
                  setSelectedOrder((prev: any) => (prev && prev.id === updated.id ? { ...prev, ...updated } : updated));
                  setOrders(prev => prev.map(o => (o.id === updated.id ? { ...o, ...updated } : o)));
                }
                refresh();
              }}
              usersList={users}
            />
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Workstreams & Collaboration</h1>
                  <p className="text-xs text-slate-500 mt-1">
                    Manage active escrow orders, real-time messaging, deliverables, invoices, and project milestones.
                  </p>
                </div>
                <button
                  onClick={() => setIsStartWorkstreamModalOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer self-start sm:self-auto"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Start New Workstream</span>
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-4 xl:col-span-3">
                  <WorkstreamSidebar
                    currentTab={workstreamTab}
                    onTabChange={setWorkstreamTab}
                    orders={workstream.hydratedWorkstreamItems}
                    starredCount={starredWorkstreams.length}
                    projects={projects}
                    usersList={users}
                    currentUser={effectiveUser}
                    selectedPersonFilter={selectedPersonFilter}
                    onSelectPersonFilter={setSelectedPersonFilter}
                    peopleSearch={peopleSearch}
                    onPeopleSearchChange={setPeopleSearch}
                    projectSearch={projectFilterSearch}
                    onProjectSelect={(title) => setProjectFilterSearch(prev => (prev === title ? '' : title))}
                  />
                </div>
                <div className="lg:col-span-8 xl:col-span-9">
                  <WorkstreamList
                    workstreams={workstream.filteredWorkstreamItems}
                    selectedOrderId={(activeWorkstreamOrder as any)?.id}
                    onSelectOrder={(orderId: string) => {
                      const found = workstream.hydratedWorkstreamItems.find(o => o.id === orderId) || orders.find(o => o.id === orderId);
                      if (found) {
                        setSelectedOrder(found);
                      }
                      workstream.fetchMessages(orderId);
                      navigate(`/messages/${orderId}`);
                    }}
                    starredIds={starredWorkstreams}
                    onToggleStar={(orderId: string) => {
                      setStarredWorkstreams(prev =>
                        prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId]
                      );
                    }}
                    searchQuery={workstreamSearch}
                    onSearchChange={setWorkstreamSearch}
                    onStartNewWorkstream={() => setIsStartWorkstreamModalOpen(true)}
                    activeTab={workstreamTab}
                    selectedPersonName={selectedPersonObj?.name || null}
                    selectedProjectTitle={projectFilterSearch || null}
                    onClearTab={() => setWorkstreamTab('all')}
                    onClearPersonFilter={() => setSelectedPersonFilter(null)}
                    onClearProjectFilter={() => setProjectFilterSearch('')}
                    onClearAllFilters={() => {
                      setWorkstreamTab('all');
                      setSelectedPersonFilter(null);
                      setProjectFilterSearch('');
                      setWorkstreamSearch('');
                    }}
                  />
                </div>
              </div>

              <StartWorkstreamModal
                isOpen={isStartWorkstreamModalOpen}
                onClose={() => setIsStartWorkstreamModalOpen(false)}
                onSubmit={workstream.handleStartWorkstreamModalSubmit}
                usersList={users}
                currentUser={effectiveUser}
              />
            </div>
          )
        ) : path === '/wallet' || path.startsWith('/wallet') || path.startsWith('/wallets') ? (
          <UserWalletsLedgerModule currentUser={effectiveUser} />
        ) : path.startsWith('/payments') ? (
          <PaymentsModule currentUser={effectiveUser} />
        ) : path.startsWith('/settings') ? (
          <SettingsPage 
            currentUser={effectiveUser}
            updateCurrentUser={setCurrentUser}
            navigate={navigate}
          />
        ) : path === '/projects' || path.startsWith('/projects?') ? (
          <ProjectSearchView 
            projects={projects} 
            navigate={navigate} 
            currentUser={effectiveUser} 
            query={path.includes('?') ? path.substring(path.indexOf('?')) : ''} 
          />
        ) : path.startsWith('/projects/') || path.startsWith('/project/') ? (
          (() => {
            const projId = path.split('/')[2];
            const targetProject = projects.find(p => p.id === projId || p.slug === projId || slugify(p.title) === projId);
            if (targetProject) {
              return (
                <ProjectDetailView 
                  project={targetProject}
                  currentUser={effectiveUser}
                  navigate={navigate}
                  allProjects={projects}
                  proposals={proposals}
                  orders={orders}
                  onRefresh={refresh}
                />
              );
            }
            return <ProjectSearchView projects={projects} navigate={navigate} currentUser={effectiveUser} />;
          })()
        ) : path === '/freelancers' || path.startsWith('/freelancers?') ? (
          <FreelancerSearchView 
            usersList={users} 
            gigs={gigs} 
            navigate={navigate} 
            currentUser={effectiveUser} 
            setIsSignupModalOpen={setIsSignupOpen} 
            slugify={slugify} 
            query={path.includes('?') ? path.substring(path.indexOf('?')) : ''} 
          />
        ) : path === '/freelance-activity' ? (
          <FreelancerActivityView
            currentUser={effectiveUser}
            orders={orders}
            allGigs={gigs}
            categories={appData.categories}
            navigate={navigate}
            onRefresh={refresh}
          />
        ) : path === '/buyer-activity' || path === '/activity' ? (
          <BuyerActivityView 
            projects={projects} 
            orders={orders} 
            offers={[]} 
            currentUser={effectiveUser} 
            navigate={navigate} 
          />
        ) : path === '/create-gig' ? (
          <CreateGigView 
            newGigTitle="" 
            setNewGigTitle={() => {}} 
            newGigCat="technology-programming" 
            setNewGigCat={() => {}} 
            newGigDesc="" 
            setNewGigDesc={() => {}} 
            newGigPrice={50} 
            setNewGigPrice={() => {}} 
            newGigDays={3} 
            setNewGigDays={() => {}} 
            isOptimizingGig={false} 
            handleOptimizeGigWithAI={() => {}} 
            newGigExtras={[]} 
            extraTitleInput="" 
            setExtraTitleInput={() => {}} 
            extraPriceInput={10} 
            setExtraPriceInput={() => {}} 
            handleAddGigExtra={() => {}} 
            handleRemoveGigExtra={() => {}} 
            handlePublishGig={(e) => { e.preventDefault(); navigate('/gigs'); }} 
          />
        ) : path === '/edit-profile' ? (
          <EditProfilePage 
            currentUser={effectiveUser} 
            updateCurrentUser={setCurrentUser} 
            navigate={navigate} 
          />
        ) : path.startsWith('/profile/') ? (
          (() => {
            const uname = path.split('/')[2];
            const targetUser = users.find(u => u.username === uname || slugify(u.name) === uname || u.id === uname);
            if (targetUser) {
              return <FreelancerProfileView profileUser={targetUser} currentUser={effectiveUser} gigs={gigs} reviews={appData.reviews} onNavigate={navigate} />;
            }
            return (
              <MarketplaceGigsView 
                filteredGigs={filteredGigs}
                projects={projects}
                currentCategory={currentCategory}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                activeDropdown={activeDropdown}
                setActiveDropdown={setActiveDropdown}
                serviceOptionFilter={serviceOptionFilter}
                setServiceOptionFilter={setServiceOptionFilter}
                sellerLevelFilter={sellerLevelFilter}
                setSellerLevelFilter={setSellerLevelFilter}
                budgetFilter={budgetFilter}
                setBudgetFilter={setBudgetFilter}
                deliveryTimeFilter={deliveryTimeFilter}
                setDeliveryTimeFilter={setDeliveryTimeFilter}
                onlineNowOnly={onlineNowOnly}
                setOnlineNowOnly={setOnlineNowOnly}
                gigViewMode={gigViewMode}
                setGigViewMode={setGigViewMode}
                likedGigIds={likedGigIds}
                handleToggleLike={handleToggleLike}
                navigate={navigate}
                getGigUrl={getGigUrl}
                currentUser={effectiveUser}
                setIsSignupModalOpen={setIsSignupOpen}
                slugify={slugify}
                CATEGORY_SLUGS={Object.fromEntries(PPH_CATEGORIES.map(c => [c.name, c.slug]))}
              />
            );
          })()
        ) : path.startsWith('/gig/') || path.startsWith('/gigs/') ? (
          (() => {
            const parts = path.split('/').filter(Boolean);
            const identifier = parts[1];
            const subIdentifier = parts[2];
            const targetGig = gigs.find(g => 
              g.id === identifier || 
              g.slug === identifier || 
              slugify(g.title) === identifier ||
              (subIdentifier && (g.slug === subIdentifier || slugify(g.title) === subIdentifier || g.id === subIdentifier))
            );
            if (targetGig && canViewGig(targetGig)) {
              return (
                <GigDetailView 
                  currentGig={targetGig} 
                  gigs={gigs} 
                  reviews={appData.reviews} 
                  orders={orders} 
                  currentUser={effectiveUser} 
                  navigate={navigate} 
                  handleContactSeller={() => navigate('/messages')} 
                  handleCreateOrder={() => navigate('/messages')} 
                  slugify={slugify} 
                />
              );
            }
            return (
              <MarketplaceGigsView 
                filteredGigs={filteredGigs}
                projects={projects}
                currentCategory={currentCategory}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                activeDropdown={activeDropdown}
                setActiveDropdown={setActiveDropdown}
                serviceOptionFilter={serviceOptionFilter}
                setServiceOptionFilter={setServiceOptionFilter}
                sellerLevelFilter={sellerLevelFilter}
                setSellerLevelFilter={setSellerLevelFilter}
                budgetFilter={budgetFilter}
                setBudgetFilter={setBudgetFilter}
                deliveryTimeFilter={deliveryTimeFilter}
                setDeliveryTimeFilter={setDeliveryTimeFilter}
                onlineNowOnly={onlineNowOnly}
                setOnlineNowOnly={setOnlineNowOnly}
                gigViewMode={gigViewMode}
                setGigViewMode={setGigViewMode}
                likedGigIds={likedGigIds}
                handleToggleLike={handleToggleLike}
                navigate={navigate}
                getGigUrl={getGigUrl}
                currentUser={effectiveUser}
                setIsSignupModalOpen={setIsSignupOpen}
                slugify={slugify}
                CATEGORY_SLUGS={Object.fromEntries(PPH_CATEGORIES.map(c => [c.name, c.slug]))}
              />
            );
          })()
        ) : (() => {
          // Dynamic path resolution for /:username/:gigSlug, /:username, /categories/:slug
          const cleanPath = path.split('?')[0].split('#')[0];
          const parts = cleanPath.split('/').filter(Boolean);

          if (parts.length === 2 && parts[0] === 'categories') {
            const catSlug = parts[1];
            const matchedParent = PPH_CATEGORIES.find(c => c.slug === catSlug);
            const matchedSub = !matchedParent ? PPH_CATEGORIES.flatMap(c => c.subcategories).find(s => s.slug === catSlug) : undefined;
            const matchedCategory = matchedParent || matchedSub;
            const categoryName = matchedCategory ? matchedCategory.name : 'All';
            const categoryFilteredGigs = gigs.filter(g => {
              if (matchedParent) {
                if (g.category !== matchedParent.name && slugify(g.category) !== matchedParent.slug) return false;
              } else if (matchedSub) {
                if (g.subcategory?.toLowerCase() !== matchedSub.name.toLowerCase() && slugify(g.subcategory || '') !== matchedSub.slug) return false;
              }
              if (searchQuery.trim() && !g.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
              return true;
            });

            return (
              <div>
                {!matchedCategory && (
                  <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs font-semibold">
                    Category "{catSlug}" not found. Showing all marketplace offers.
                  </div>
                )}
                <MarketplaceGigsView 
                  filteredGigs={categoryFilteredGigs}
                  projects={projects}
                  currentCategory={categoryName}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  activeDropdown={activeDropdown}
                  setActiveDropdown={setActiveDropdown}
                  serviceOptionFilter={serviceOptionFilter}
                  setServiceOptionFilter={setServiceOptionFilter}
                  sellerLevelFilter={sellerLevelFilter}
                  setSellerLevelFilter={setSellerLevelFilter}
                  budgetFilter={budgetFilter}
                  setBudgetFilter={setBudgetFilter}
                  deliveryTimeFilter={deliveryTimeFilter}
                  setDeliveryTimeFilter={setDeliveryTimeFilter}
                  onlineNowOnly={onlineNowOnly}
                  setOnlineNowOnly={setOnlineNowOnly}
                  gigViewMode={gigViewMode}
                  setGigViewMode={setGigViewMode}
                  likedGigIds={likedGigIds}
                  handleToggleLike={handleToggleLike}
                  navigate={navigate}
                  getGigUrl={getGigUrl}
                  currentUser={effectiveUser}
                  setIsSignupModalOpen={setIsSignupOpen}
                  slugify={slugify}
                  CATEGORY_SLUGS={Object.fromEntries(PPH_CATEGORIES.map(c => [c.name, c.slug]))}
                />
              </div>
            );
          }

          if (parts.length >= 1 && (parts[0] === 'gig' || parts[0] === 'gigs')) {
            const identifier = parts[1];
            const subIdentifier = parts[2];
            const targetGig = gigs.find(g => 
              g.id === identifier || 
              g.slug === identifier || 
              slugify(g.title) === identifier ||
              (subIdentifier && (g.slug === subIdentifier || slugify(g.title) === subIdentifier || g.id === subIdentifier))
            );
            if (targetGig && canViewGig(targetGig)) {
              return (
                <GigDetailView 
                  currentGig={targetGig} 
                  gigs={gigs} 
                  reviews={appData.reviews} 
                  orders={orders} 
                  currentUser={effectiveUser} 
                  navigate={navigate} 
                  handleContactSeller={() => navigate('/messages')} 
                  handleCreateOrder={() => navigate('/messages')} 
                  slugify={slugify} 
                />
              );
            }
          }

          if (parts.length === 1) {
            const idOrUsername = parts[0];
            const directGig = gigs.find(g => g.id === idOrUsername || g.slug === idOrUsername || slugify(g.title) === idOrUsername);
            if (directGig && canViewGig(directGig)) {
              return (
                <GigDetailView 
                  currentGig={directGig} 
                  gigs={gigs} 
                  reviews={appData.reviews} 
                  orders={orders} 
                  currentUser={effectiveUser} 
                  navigate={navigate} 
                  handleContactSeller={() => navigate('/messages')} 
                  handleCreateOrder={() => navigate('/messages')} 
                  slugify={slugify} 
                />
              );
            }
            const targetUser = users.find(u => u.username?.toLowerCase() === idOrUsername.toLowerCase() || slugify(u.name).toLowerCase() === idOrUsername.toLowerCase() || u.id === idOrUsername);
            if (targetUser) {
              return <FreelancerProfileView profileUser={targetUser} currentUser={effectiveUser} gigs={gigs} reviews={appData.reviews} onNavigate={navigate} />;
            }
          }

          if (parts.length === 2) {
            const [seg1, seg2] = parts;
            if (seg1 !== 'categories') {
              const targetGig = gigs.find(g => {
                const gigUser = (g.freelancerUsername || slugify(g.freelancerName || '')).toLowerCase();
                const gSlug = (g.slug || slugify(g.title)).toLowerCase();
                return (
                  (gigUser === seg1.toLowerCase() || g.freelancerId === seg1) && 
                  (gSlug === seg2.toLowerCase() || g.id === seg2)
                ) || gSlug === seg2.toLowerCase() || g.id === seg2;
              });
              if (targetGig && canViewGig(targetGig)) {
                return (
                  <GigDetailView 
                    currentGig={targetGig} 
                    gigs={gigs} 
                    reviews={appData.reviews} 
                    orders={orders} 
                    currentUser={effectiveUser} 
                    navigate={navigate} 
                    handleContactSeller={() => navigate('/messages')} 
                    handleCreateOrder={() => navigate('/messages')} 
                    slugify={slugify} 
                  />
                );
              }
              const targetUser = users.find(u => u.username?.toLowerCase() === seg1.toLowerCase() || slugify(u.name).toLowerCase() === seg1.toLowerCase() || u.id === seg1);
              if (targetUser) {
                return <FreelancerProfileView profileUser={targetUser} currentUser={effectiveUser} gigs={gigs} reviews={appData.reviews} onNavigate={navigate} />;
              }
            }
          }

          return (
            <MarketplaceGigsView 
              filteredGigs={filteredGigs}
              projects={projects}
              currentCategory={currentCategory}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              activeDropdown={activeDropdown}
              setActiveDropdown={setActiveDropdown}
              serviceOptionFilter={serviceOptionFilter}
              setServiceOptionFilter={setServiceOptionFilter}
              sellerLevelFilter={sellerLevelFilter}
              setSellerLevelFilter={setSellerLevelFilter}
              budgetFilter={budgetFilter}
              setBudgetFilter={setBudgetFilter}
              deliveryTimeFilter={deliveryTimeFilter}
              setDeliveryTimeFilter={setDeliveryTimeFilter}
              onlineNowOnly={onlineNowOnly}
              setOnlineNowOnly={setOnlineNowOnly}
              gigViewMode={gigViewMode}
              setGigViewMode={setGigViewMode}
              likedGigIds={likedGigIds}
              handleToggleLike={handleToggleLike}
              navigate={navigate}
              getGigUrl={getGigUrl}
              currentUser={effectiveUser}
              setIsSignupModalOpen={setIsSignupOpen}
              slugify={slugify}
              CATEGORY_SLUGS={Object.fromEntries(PPH_CATEGORIES.map(c => [c.name, c.slug]))}
            />
          );
        })()}
      </main>

      {/* Footer */}
      <Footer navigate={navigate} />

      {/* Modals */}
      {isLoginOpen && (
        <LoginModal 
          isOpen={isLoginOpen}
          onClose={() => setIsLoginOpen(false)}
          loginRequiresCode={loginRequiresCode}
          loginVerificationMessage={loginVerificationMessage}
          mockEmailCodeDisplay={mockEmailCodeDisplay}
          loginEmail={loginEmail}
          setLoginEmail={setLoginEmail}
          loginPassword={loginPassword}
          setLoginPassword={setLoginPassword}
          loginCode={loginCode}
          setLoginCode={setLoginCode}
          handleLoginSubmit={async (e: React.FormEvent) => {
            e.preventDefault();
            try {
              const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  query: loginEmail,
                  password: loginPassword,
                  code: loginCode,
                  deviceId: getDeviceId()
                })
              });
              const data = await res.json();
              if (res.status === 403 && data.requiresVerification) {
                setIsLoginOpen(false);
                setVerifyEmail(data.email || loginEmail);
                if (data.mockEmailCode) setMockEmailCodeDisplay(data.mockEmailCode);
                setEmailCodeInput('');
                setIsVerifyModalOpen(true);
                showToast(data.error || 'Please verify your email before logging in.');
                return;
              }
              if (data.requiresCode) {
                setLoginRequiresCode(true);
                setLoginVerificationMessage(data.message || 'Verification code sent to your email.');
                if (data.mockCode) setMockEmailCodeDisplay(data.mockCode);
                showToast(data.message || 'Verification code required.');
                return;
              }
              if (res.ok && data.token && data.user) {
                setAuthToken(data.token);
                setCurrentUser(data.user);
                setImpersonatedUser(null);
                await refresh(data.user.id);
                setIsLoginOpen(false);
                setLoginEmail('');
                setLoginPassword('');
                setLoginCode('');
                setLoginRequiresCode(false);
                showToast(`Welcome back, ${data.user.name}!`);
              } else {
                showToast(data.error || 'Login failed. Please check your credentials.');
              }
            } catch {
              showToast('An error occurred during login.');
            }
          }}
          setLoginRequiresCode={setLoginRequiresCode}
          usersList={users}
          updateCurrentUser={setCurrentUser}
          setImpersonatedUser={setImpersonatedUser}
          refresh={refresh}
          setIsForgotPasswordModalOpen={setIsForgotPasswordOpen}
          setMockEmailCodeDisplay={setMockEmailCodeDisplay}
          onSwitchToSignup={() => { setIsLoginOpen(false); setIsSignupOpen(true); }}
        />
      )}

      {isSignupOpen && (
        <SignupModal 
          isOpen={isSignupOpen}
          onClose={() => setIsSignupOpen(false)}
          handleSignupSubmit={async (e: React.FormEvent) => {
            e.preventDefault();
            if (signupPassword.length < 6) {
              showToast('Password must be at least 6 characters');
              return;
            }
            if (signupPassword !== signupConfirmPassword) {
              showToast('Passwords do not match');
              return;
            }
            try {
              const res = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  name: signupName,
                  email: signupEmail,
                  mobile: signupMobile,
                  password: signupPassword,
                  confirmPassword: signupConfirmPassword,
                  deviceId: getDeviceId()
                })
              });
              const data = await res.json();
              if (res.ok && data.requiresVerification) {
                setIsSignupOpen(false);
                setVerifyEmail(data.email || signupEmail);
                setVerifyMobile(signupMobile);
                if (data.mockEmailCode) setMockEmailCodeDisplay(data.mockEmailCode);
                setEmailCodeInput('');
                setIsVerifyModalOpen(true);
                setSignupName('');
                setSignupEmail('');
                setSignupMobile('');
                setSignupPassword('');
                setSignupConfirmPassword('');
                showToast(data.message || 'Verification code sent to your email. Please verify to complete registration.');
                return;
              }
              if (res.ok && data.token && data.user) {
                setAuthToken(data.token);
                setCurrentUser(data.user);
                setImpersonatedUser(null);
                await refresh(data.user.id);
                setIsSignupOpen(false);
                setSignupName('');
                setSignupEmail('');
                setSignupMobile('');
                setSignupPassword('');
                setSignupConfirmPassword('');
                showToast(`Account created successfully! Welcome, ${data.user.name}.`);
              } else {
                showToast(data.error || 'Signup failed.');
              }
            } catch {
              showToast('An error occurred during signup.');
            }
          }}
          signupName={signupName}
          setSignupName={setSignupName}
          signupEmail={signupEmail}
          setSignupEmail={setSignupEmail}
          signupMobile={signupMobile}
          setSignupMobile={setSignupMobile}
          signupPassword={signupPassword}
          setSignupPassword={setSignupPassword}
          signupConfirmPassword={signupConfirmPassword}
          setSignupConfirmPassword={setSignupConfirmPassword}
          onSwitchToLogin={() => { setIsSignupOpen(false); setIsLoginOpen(true); }}
        />
      )}

      {isVerifyModalOpen && (
        <VerifyModal
          isOpen={isVerifyModalOpen}
          onClose={() => setIsVerifyModalOpen(false)}
          verificationMode={verificationMode}
          setVerificationMode={setVerificationMode}
          emailCodeInput={emailCodeInput}
          setEmailCodeInput={setEmailCodeInput}
          smsCodeInput={smsCodeInput}
          setSmsCodeInput={setSmsCodeInput}
          handleVerifyEmailSubmit={handleVerifyEmailSubmit}
          handleVerifySmsSubmit={handleVerifySmsSubmit}
          handleResendEmailCode={handleResendEmailCode}
          handleResendSmsCode={handleResendSmsCode}
          verifyEmail={verifyEmail}
          verifyMobile={verifyMobile}
          mockEmailCodeDisplay={mockEmailCodeDisplay || undefined}
          mockSmsCodeDisplay={mockSmsCodeDisplay || undefined}
        />
      )}

      {isForgotPasswordOpen && (
        <ForgotPasswordModal
          isOpen={isForgotPasswordOpen}
          onClose={() => setIsForgotPasswordOpen(false)}
          forgotStep={forgotStep}
          setForgotStep={setForgotStep}
          forgotQuery={forgotQuery}
          setForgotQuery={setForgotQuery}
          forgotCode={forgotCode}
          setForgotCode={setForgotCode}
          mockForgotCodeDisplay={mockForgotCodeDisplay}
          newPassword={newPassword}
          setNewPassword={setNewPassword}
          confirmNewPassword={confirmNewPassword}
          setConfirmNewPassword={setConfirmNewPassword}
          handleForgotRequest={handleForgotRequest}
          handleForgotVerify={handleForgotVerify}
          handleForgotReset={handleForgotReset}
          setForgotCodeEmpty={() => setForgotCode('')}
        />
      )}

      {isSwitchUserOpen && (
        <UserSwitchModal 
          isOpen={isSwitchUserOpen}
          onClose={() => setIsSwitchUserOpen(false)}
          usersList={users}
          currentUser={effectiveUser}
          setCurrentUser={setCurrentUser}
          setImpersonatedUser={setImpersonatedUser}
          refresh={refresh}
        />
      )}

      {isWishlistOpen && (
        <WishlistModal
          isOpen={isWishlistOpen}
          onClose={() => setIsWishlistOpen(false)}
          likedGigIds={likedGigIds}
          gigs={gigs}
          onToggleLike={(gigId: string) => setLikedGigIds(prev => prev.includes(gigId) ? prev.filter(id => id !== gigId) : [...prev, gigId])}
          getGigUrl={getGigUrl}
          navigate={(to: string, e: React.MouseEvent) => {
            setIsWishlistOpen(false);
            navigate(to, e);
          }}
        />
      )}

      {isSupportOpen && (
        <SupportModal
          isOpen={isSupportOpen}
          onClose={() => setIsSupportOpen(false)}
          supportSubject={supportSubject}
          setSupportSubject={setSupportSubject}
          supportMessage={supportMessage}
          setSupportMessage={setSupportMessage}
          onSubmitTicket={handleSubmitSupportTicket}
        />
      )}
    </div>
  );
}
