import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Briefcase,
  Search,
  PlusCircle,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Layers,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { Gig, Order, UserAccount, Category } from '../../types';
import { UserFreelanceOffersList } from '../user_dashboard/UserFreelanceOffersList';
import { UserActivitySummarySidebar } from '../user_dashboard/UserActivitySummarySidebar';
import { EditGigModal } from '../gigs/EditGigModal';
import { DeleteGigModal } from '../gigs/DeleteGigModal';
import { ViewingGigModal } from '../gigs/ViewingGigModal';
import { getGigUrl } from '../../utils/slugify';
import { getAuthToken } from '../../utils/authToken';
import { getDeviceId } from '../../utils/deviceId';

interface FreelancerActivityViewProps {
  currentUser: UserAccount | null;
  orders: Order[];
  allGigs: Gig[];
  categories: Category[];
  navigate: (path: string, e?: React.MouseEvent) => void;
  onRefresh?: () => void;
}

type GigStatusTab = 'all' | 'active' | 'paused' | 'moderation' | 'deleted';

export const FreelancerActivityView: React.FC<FreelancerActivityViewProps> = ({
  currentUser,
  orders = [],
  allGigs = [],
  categories = [],
  navigate,
  onRefresh
}) => {
  const [myGigs, setMyGigs] = useState<Gig[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<GigStatusTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);

  // Modals state
  const [viewingGig, setViewingGig] = useState<Gig | null>(null);
  const [editingGig, setEditingGig] = useState<Gig | null>(null);
  const [gigToDelete, setGigToDelete] = useState<{ id: string; title?: string } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchMyGigs = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const token = getAuthToken();
      const headers: Record<string, string> = {
        'x-device-id': getDeviceId(),
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      };

      const res = await fetch('/api/my/gigs', { headers });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setMyGigs(data);
          setLoading(false);
          return;
        }
      }
    } catch (e) {
      console.warn('Failed to fetch /api/my/gigs:', e);
    }

    // Fallback: match from allGigs
    const userGigs = allGigs.filter(g => g.freelancerId === currentUser.id);
    setMyGigs(userGigs);
    setLoading(false);
  }, [currentUser, credentialsKey(currentUser?.id), allGigs]);

  function credentialsKey(id?: string) {
    return id || 'anonymous';
  }

  useEffect(() => {
    fetchMyGigs();
  }, [fetchMyGigs]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = () => setActiveDropdownId(null);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  // Filtered gigs based on tab & search
  const filteredGigs = useMemo(() => {
    return myGigs.filter(g => {
      if (activeTab !== 'all' && g.status !== activeTab) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = (g.title || '').toLowerCase().includes(q);
        const matchCategory = (g.category || '').toLowerCase().includes(q);
        if (!matchTitle && !matchCategory) return false;
      }
      return true;
    });
  }, [myGigs, activeTab, searchQuery]);

  // Tab counts
  const counts = useMemo(() => {
    return {
      all: myGigs.length,
      active: myGigs.filter(g => g.status === 'active').length,
      paused: myGigs.filter(g => g.status === 'paused').length,
      moderation: myGigs.filter(g => g.status === 'moderation').length,
      deleted: myGigs.filter(g => g.status === 'deleted').length
    };
  }, [myGigs]);

  // Seller metrics
  const completedSellerOrders = useMemo(() => {
    if (!currentUser) return [];
    return orders.filter(o => o.sellerId === currentUser.id && o.status === 'completed');
  }, [orders, currentUser]);

  const totalEarnings = useMemo(() => {
    return completedSellerOrders.reduce((sum, o) => sum + (Number(o.amount) || 0), 0);
  }, [completedSellerOrders]);

  if (!currentUser) {
    return (
      <div className="max-w-4xl mx-auto py-20 text-center">
        <div className="bg-white p-12 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          <div className="w-20 h-20 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto text-emerald-600">
            <Briefcase className="w-10 h-10" />
          </div>
          <h1 className="text-3xl font-black text-slate-900">Freelancer Activity & Gig Management</h1>
          <p className="text-slate-500 max-w-md mx-auto">
            Please log in to your account to view your service offers, pause/resume gigs, manage orders, and track your freelance activity.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="px-8 py-3.5 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all shadow-lg cursor-pointer"
          >
            Login to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Action handlers
  const handlePauseResume = async (gig: Gig) => {
    const nextStatus = gig.status === 'active' ? 'paused' : 'active';
    // Optimistic update
    setMyGigs(prev => prev.map(g => (g.id === gig.id ? { ...g, status: nextStatus } : g)));
    showToast(`Gig "${gig.title}" is now ${nextStatus === 'active' ? 'Active' : 'Paused'}.`);

    try {
      const token = getAuthToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-device-id': getDeviceId(),
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      };

      const res = await fetch(`/api/gigs/${gig.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: nextStatus })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || 'Failed to update gig status on server.');
        await fetchMyGigs();
      } else {
        if (onRefresh) onRefresh();
      }
    } catch (e) {
      console.warn('Network error updating gig status:', e);
      await fetchMyGigs();
    }
  };

  const handleOpenEdit = (gig: Gig) => {
    if (gig.status === 'deleted') {
      showToast('Deleted gigs cannot be edited.');
      return;
    }
    setEditingGig(gig);
    setActiveDropdownId(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGig) return;

    const form = e.currentTarget as HTMLFormElement;
    const formData = new FormData(form);

    const title = String(formData.get('title') || '').trim();
    const category = String(formData.get('category') || editingGig.category);
    const subcategory = String(formData.get('subcategory') || '');
    const price = Number(formData.get('price')) || editingGig.price;
    const deliveryDays = Number(formData.get('deliveryDays')) || editingGig.deliveryDays;
    const description = String(formData.get('description') || '').trim();
    const featured = formData.get('featured') === 'on';

    // Preserving status strictly (do not pass status, so existing status remains unchanged)
    const payload = {
      title,
      category,
      subcategory,
      price,
      deliveryDays,
      description,
      featured
    };

    // Optimistic update
    setMyGigs(prev =>
      prev.map(g => (g.id === editingGig.id ? { ...g, ...payload } : g))
    );
    setEditingGig(null);
    showToast('Gig details saved successfully.');

    try {
      const token = getAuthToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-device-id': getDeviceId(),
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      };

      const res = await fetch(`/api/gigs/${editingGig.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || 'Failed to save edits on server.');
        await fetchMyGigs();
      } else {
        if (onRefresh) onRefresh();
      }
    } catch (e) {
      console.warn('Network error updating gig:', e);
      await fetchMyGigs();
    }
  };

  const handleOpenDelete = (gigId: string, title?: string) => {
    setGigToDelete({ id: gigId, title });
    setActiveDropdownId(null);
  };

  const handleConfirmDelete = async () => {
    if (!gigToDelete) return;
    const targetId = gigToDelete.id;

    // Optimistically update gig status to 'deleted'
    setMyGigs(prev =>
      prev.map(g => (g.id === targetId ? { ...g, status: 'deleted' } : g))
    );
    setGigToDelete(null);
    if (viewingGig?.id === targetId) setViewingGig(null);
    showToast('Gig has been moved to Deleted history.');

    try {
      const token = getAuthToken();
      const headers: Record<string, string> = {
        'x-device-id': getDeviceId(),
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      };

      const res = await fetch(`/api/gigs/${targetId}`, {
        method: 'DELETE',
        headers
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || 'Failed to delete gig on server.');
        await fetchMyGigs();
      } else {
        if (onRefresh) onRefresh();
      }
    } catch (e) {
      console.warn('Network error deleting gig:', e);
      await fetchMyGigs();
    }
  };

  const handleFeatureGig = async (gigId: string) => {
    const gig = myGigs.find(g => g.id === gigId);
    if (!gig) return;
    const nextFeatured = !gig.featured;

    setMyGigs(prev => prev.map(g => (g.id === gigId ? { ...g, featured: nextFeatured } : g)));
    showToast(`Gig #${gigId} ${nextFeatured ? 'featured' : 'unfeatured'}.`);

    try {
      const token = getAuthToken();
      const headers: Record<string, string> = {
        'x-device-id': getDeviceId(),
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      };
      await fetch(`/api/admin/gigs/${gigId}/feature`, { method: 'PATCH', headers });
      if (onRefresh) onRefresh();
    } catch (e) {
      console.warn('API feature error:', e);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-slate-800 animate-in fade-in slide-in-from-top-4 text-xs font-bold">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>Freelancer Activity & Gig Management</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage your service offerings, monitor live statuses, pause/resume listings, and review order analytics.
          </p>
        </div>
        <button
          onClick={() => navigate('/create-gig')}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer self-start sm:self-auto"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Post New Gig</span>
        </button>
      </div>

      {/* Main Grid: Sidebar & Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Summary Sidebar */}
        <div className="lg:col-span-4 xl:col-span-3 space-y-4">
          <UserActivitySummarySidebar
            totalOffers={counts.all - counts.deleted}
            activeOffersCount={counts.active}
            completedOrdersCount={completedSellerOrders.length}
            totalEarnings={totalEarnings}
          />

          {/* Quick Info Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-3xl p-5 text-xs text-slate-600 space-y-2.5">
            <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Status Rules</span>
            </h4>
            <ul className="space-y-1.5 text-[11px] text-slate-500">
              <li><strong className="text-emerald-700">Active:</strong> Visible to all buyers and purchasable.</li>
              <li><strong className="text-amber-700">Paused:</strong> Visible with paused notice; purchase is blocked.</li>
              <li><strong className="text-blue-700">Under Moderation:</strong> Private while pending review.</li>
              <li><strong className="text-slate-600">Deleted:</strong> Soft-deleted history; hidden from public.</li>
            </ul>
          </div>
        </div>

        {/* Right Column: Filters, Tabs & Listings */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-4">
          {/* Status Tabs Bar */}
          <div className="bg-white border border-slate-200 rounded-2xl p-1.5 shadow-2xs flex flex-wrap items-center gap-1">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <span>All Gigs</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                activeTab === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'
              }`}>
                {counts.all}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('active')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'active'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <span>Active</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                activeTab === 'active' ? 'bg-emerald-700 text-white' : 'bg-emerald-50 text-emerald-700'
              }`}>
                {counts.active}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('paused')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'paused'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <span>Paused</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                activeTab === 'paused' ? 'bg-amber-700 text-white' : 'bg-amber-50 text-amber-700'
              }`}>
                {counts.paused}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('moderation')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'moderation'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <span>Under Moderation</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                activeTab === 'moderation' ? 'bg-blue-700 text-white' : 'bg-blue-50 text-blue-700'
              }`}>
                {counts.moderation}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('deleted')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'deleted'
                  ? 'bg-slate-700 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <span>Deleted</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                activeTab === 'deleted' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'
              }`}>
                {counts.deleted}
              </span>
            </button>
          </div>

          {/* Search bar */}
          <div className="bg-white border border-slate-200 rounded-2xl p-2.5 flex items-center gap-2 shadow-2xs">
            <Search className="w-4 h-4 text-slate-400 shrink-0 ml-1.5" />
            <input
              type="text"
              placeholder="Search your gigs by title or category..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-xs text-slate-800 placeholder-slate-400 focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-xs text-slate-400 hover:text-slate-600 px-2"
              >
                Clear
              </button>
            )}
          </div>

          {/* Gigs List */}
          {loading ? (
            <div className="p-12 text-center bg-white border border-slate-200 rounded-3xl text-xs text-slate-400">
              Loading your services...
            </div>
          ) : (
            <UserFreelanceOffersList
              gigs={filteredGigs}
              freelanceSubFilter={activeTab === 'all' ? 'All' : activeTab === 'active' ? 'Active' : activeTab === 'paused' ? 'Paused' : activeTab === 'moderation' ? 'Under Moderation' : 'Deleted'}
              activeFeatureDropdownGigId={activeDropdownId}
              onToggleDropdown={(id, e) => {
                e.stopPropagation();
                setActiveDropdownId(prev => (prev === id ? null : id));
              }}
              onFeatureGig={handleFeatureGig}
              onNavigateGig={(url, e) => {
                if (e) e.preventDefault();
                navigate(url, e);
              }}
              onPauseResumeGig={handlePauseResume}
              onViewGigProgress={gig => setViewingGig(gig)}
              onEditGig={handleOpenEdit}
              onDeleteGig={handleOpenDelete}
              getGigUrl={getGigUrl}
            />
          )}
        </div>
      </div>

      {/* VIEW GIG MODAL */}
      <ViewingGigModal
        viewingGig={viewingGig}
        onClose={() => setViewingGig(null)}
        onDelete={id => handleOpenDelete(id, viewingGig?.title)}
        onEdit={gig => {
          setViewingGig(null);
          handleOpenEdit(gig);
        }}
        allGigs={allGigs}
      />

      {/* EDIT GIG MODAL */}
      <EditGigModal
        editingGig={editingGig}
        categories={categories}
        onClose={() => setEditingGig(null)}
        onSave={handleSaveEdit}
        onDelete={id => {
          setEditingGig(null);
          handleOpenDelete(id, editingGig?.title);
        }}
      />

      {/* DELETE GIG MODAL */}
      <DeleteGigModal
        gigToDelete={gigToDelete}
        onClose={() => setGigToDelete(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};
