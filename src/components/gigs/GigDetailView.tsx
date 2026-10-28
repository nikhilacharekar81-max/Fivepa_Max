import React, { useState, useEffect } from 'react';
import { 
  Star, Clock, RefreshCw, ShieldCheck, MessageSquare, 
  AlertCircle, CheckCircle2, Loader2, X, Check, ArrowRight, ChevronLeft, ChevronRight, User
} from 'lucide-react';
import { Gig, Review, UserAccount, Order } from '../../types';
import { RelatedGigsSection } from './RelatedGigsSection';
import { Reviews } from '../gig_reviews';
import { PPH_CATEGORIES } from '../HeaderCategoriesNav';
import { DEFAULT_AVATAR, DEFAULT_GIG_IMAGE } from '../../constants';

const CATEGORY_SLUGS: Record<string, string> = {
  'All': 'all',
  'Development & IT': 'technology-programming',
  'AI & Data': 'ai-services',
  'Design & Creative': 'design',
  'Mobile Apps': 'technology-programming'
};

PPH_CATEGORIES.forEach(cat => {
  CATEGORY_SLUGS[cat.name] = cat.slug;
  cat.subcategories.forEach(sub => {
    CATEGORY_SLUGS[sub.name] = sub.slug;
  });
});

interface GigDetailViewProps {
  currentGig: Gig;
  gigs: Gig[];
  reviews: Review[];
  orders?: Order[];
  currentUser?: UserAccount | null;
  navigate: (path: string, e?: React.MouseEvent) => void;
  handleContactSeller: (freelancerId: string, freelancerName: string, gigTitle: string, gigId?: string, projectId?: string) => void;
  handleCreateOrder: (orderTitle: string, priceUSD: number, sellerId: string, gigId?: string, extraIds?: string[]) => void;
  isCreatingOrder?: boolean;
  orderFeedback?: { type: 'success' | 'error'; message: string; orderId?: string } | null;
  onDismissOrderFeedback?: () => void;
  slugify?: (text: string) => string;
}

export const GigDetailView: React.FC<GigDetailViewProps> = ({
  currentGig,
  gigs,
  reviews,
  orders,
  currentUser,
  navigate,
  handleContactSeller,
  handleCreateOrder,
  isCreatingOrder = false,
  orderFeedback = null,
  onDismissOrderFeedback,
  slugify
}) => {
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);

  // Fee quote from the server
  const [quote, setQuote] = useState<{ gigPrice: number; serviceFee: number; smallOrderFee: number; clientTotal: number; config?: { buyerFeePercent: number; smallOrderThreshold: number } } | null>(null);
  useEffect(() => {
    let cancelled = false;
    const qs = new URLSearchParams({ gigId: currentGig.id });
    if (selectedExtras.length > 0) qs.set('extraIds', selectedExtras.join(','));
    fetch(`/api/fees/quote?${qs.toString()}`)
      .then(r => (r.ok ? r.json() : null))
      .then(q => { if (!cancelled) setQuote(q); })
      .catch(() => { if (!cancelled) setQuote(null); });
    return () => { cancelled = true; };
  }, [currentGig.id, selectedExtras]);

  const safeSlugify = (str: string) => {
    if (slugify) return slugify(str);
    return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
  };

  const extrasList = currentGig.extras || [];
  const selectedExtrasObjects = extrasList.filter(e => selectedExtras.includes(e.id));
  const extrasTotalUSD = selectedExtrasObjects.reduce((sum, e) => sum + e.price, 0);
  const totalOrderPrice = currentGig.price + extrasTotalUSD;

  return (
    <div className="max-w-[1300px] mx-auto px-4 sm:px-6 py-8 font-sans text-[#404145]">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs text-[#74767E] font-medium mb-6">
        <a href="/" onClick={(e) => navigate('/', e)} className="hover:text-[#222325]">Home</a>
        <span>/</span>
        <a 
          href={`/categories/${CATEGORY_SLUGS[currentGig.category] || 'technology-programming'}`} 
          onClick={(e) => navigate(`/categories/${CATEGORY_SLUGS[currentGig.category] || 'technology-programming'}`, e)} 
          className="hover:text-[#222325]"
        >
          {currentGig.category}
        </a>
        <span>/</span>
        <span className="text-[#222325] font-semibold truncate max-w-xs">{currentGig.subcategory || 'Services'}</span>
      </div>

      {/* 2-COLUMN ASYMMETRIC LAYOUT (8 Cols Left, 4 Cols Right Sticky) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
        
        {/* ========================================================= */}
        {/* LEFT COLUMN: Main Showcase & Details (8 Columns)          */}
        {/* ========================================================= */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* Bold H1 Title */}
          <div>
            <h1 className="text-[26px] sm:text-[28px] leading-[36px] font-bold text-[#222325] tracking-tight mb-4">
              {currentGig.title}
            </h1>

            {/* Seller Summary Bar */}
            <div className="flex flex-wrap items-center gap-4 text-xs pb-4 border-b border-[#E4E5E7]">
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <img 
                    src={currentGig.freelancerAvatar || DEFAULT_AVATAR} 
                    alt={currentGig.freelancerName} 
                    className="w-10 h-10 rounded-full object-cover border border-[#E4E5E7]" 
                  />
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#1DBF73] border-2 border-white" />
                </div>
                <div>
                  <a 
                    href={`/${currentGig.freelancerUsername || safeSlugify(currentGig.freelancerName)}`}
                    onClick={(e) => navigate(`/${currentGig.freelancerUsername || safeSlugify(currentGig.freelancerName)}`, e)}
                    className="font-bold text-[#222325] hover:text-[#1DBF73] text-[14px] transition-colors"
                  >
                    {currentGig.freelancerName}
                  </a>
                  <div className="flex items-center gap-1.5 text-[11px] text-[#74767E]">
                    <span className="font-semibold text-[#404145]">Level 2 Seller</span>
                    <span>|</span>
                    <span className="text-[#1DBF73] font-semibold">100% Escrow Verified</span>
                  </div>
                </div>
              </div>

              <div className="h-4 w-px bg-[#E4E5E7] hidden sm:block" />

              {/* Star Rating Badge */}
              <div className="flex items-center gap-1 text-[13px]">
                <div className="flex items-center">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-3.5 h-3.5 fill-[#222325] text-[#222325]" />
                  ))}
                </div>
                <span className="font-bold text-[#222325] ml-1">{currentGig.rating.toFixed(1)}</span>
                <span className="text-[#74767E]">({currentGig.reviewsCount || 0} reviews)</span>
              </div>

              <div className="h-4 w-px bg-[#E4E5E7] hidden sm:block" />

              <div className="text-xs text-[#74767E]">
                <span>2 Orders in Queue</span>
              </div>
            </div>
          </div>

          {/* 16:10 Main Image */}
          <div className="aspect-[16/10] bg-[#F7F7F7] rounded-lg overflow-hidden border border-[#E4E5E7]">
            <img 
              src={currentGig.image || DEFAULT_GIG_IMAGE} 
              alt={currentGig.title} 
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = DEFAULT_GIG_IMAGE;
              }}
            />
          </div>

          {/* About This Gig Section */}
          <div className="space-y-4 pt-4 border-t border-[#E4E5E7]">
            <h2 className="text-[20px] font-bold text-[#222325]">About This Gig</h2>
            <div className="text-[15px] leading-relaxed text-[#404145] whitespace-pre-line space-y-3 font-normal">
              {currentGig.description}
            </div>

            {/* Deliverable Highlights */}
            <div className="bg-[#F7F7F7] border border-[#E4E5E7] rounded-lg p-5 mt-4 space-y-3">
              <h3 className="text-xs font-bold text-[#222325] uppercase tracking-wider">What you will receive</h3>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-[#404145]">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#1DBF73] shrink-0" />
                  <span>Production-Ready Final Deliverables</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#1DBF73] shrink-0" />
                  <span>Full Commercial & Usage Rights</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#1DBF73] shrink-0" />
                  <span>Editable Source Files & High-Res Exports</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#1DBF73] shrink-0" />
                  <span>100% Escrow Milestone Protection</span>
                </li>
              </ul>
            </div>
          </div>

          {/* About The Seller Bio Card */}
          <div className="bg-white border border-[#E4E5E7] rounded-lg p-6 space-y-6">
            <h2 className="text-[20px] font-bold text-[#222325]">About The Seller</h2>
            
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <img 
                src={currentGig.freelancerAvatar || DEFAULT_AVATAR} 
                alt={currentGig.freelancerName}
                className="w-16 h-16 rounded-full object-cover border border-[#E4E5E7]" 
              />
              <div className="space-y-1">
                <a 
                  href={`/${currentGig.freelancerUsername || safeSlugify(currentGig.freelancerName)}`}
                  onClick={(e) => navigate(`/${currentGig.freelancerUsername || safeSlugify(currentGig.freelancerName)}`, e)}
                  className="font-bold text-[18px] text-[#222325] hover:text-[#1DBF73] transition-colors"
                >
                  {currentGig.freelancerName}
                </a>
                <p className="text-xs text-[#74767E]">Professional Digital Creator & Verified Expert</p>
                <div className="flex items-center gap-1.5 text-xs">
                  <Star className="w-3.5 h-3.5 fill-[#FFBE5B] text-[#FFBE5B]" />
                  <span className="font-bold text-[#222325]">{currentGig.rating.toFixed(1)}</span>
                  <span className="text-[#74767E]">({currentGig.reviewsCount || 0} reviews)</span>
                </div>
              </div>
            </div>

            {/* Seller Quick Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-[#F7F7F7] rounded-lg border border-[#E4E5E7] text-xs">
              <div>
                <span className="text-[#74767E] block mb-0.5">From</span>
                <strong className="text-[#222325] font-bold">United States</strong>
              </div>
              <div>
                <span className="text-[#74767E] block mb-0.5">Member since</span>
                <strong className="text-[#222325] font-bold">2026</strong>
              </div>
              <div>
                <span className="text-[#74767E] block mb-0.5">Avg. response time</span>
                <strong className="text-[#222325] font-bold">1 hour</strong>
              </div>
              <div>
                <span className="text-[#74767E] block mb-0.5">Last delivery</span>
                <strong className="text-[#222325] font-bold">About 12 hours</strong>
              </div>
            </div>
          </div>

          {/* Gig Reviews Section */}
          <div className="pt-6 border-t border-[#E4E5E7]">
            <Reviews currentGig={currentGig} allReviews={reviews} allOrders={orders} currentUser={currentUser} />
          </div>
        </div>

        {/* ========================================================= */}
        {/* RIGHT COLUMN: Sticky Order / Purchase Widget (4 Columns)  */}
        {/* ========================================================= */}
        <div className="lg:col-span-4 sticky top-28 space-y-4">
          <div className="bg-white border border-[#E4E5E7] rounded-lg shadow-sm overflow-hidden">
            {/* Widget Header */}
            <div className="p-6 border-b border-[#E4E5E7] bg-[#F7F7F7]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#74767E] block">
                    Service Price
                  </span>
                  <h3 className="text-[15px] font-bold text-[#222325] mt-0.5">
                    Order Deliverable
                  </h3>
                </div>
                <div className="text-[28px] font-bold text-[#222325] leading-none shrink-0 font-mono">
                  ${currentGig.price}
                </div>
              </div>
            </div>

            {/* Widget Body */}
            <div className="p-6 space-y-5">
              {/* Delivery Time & Revisions */}
              <div className="flex items-center gap-6 text-xs font-bold text-[#222325]">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-[#74767E]" />
                  <span>{currentGig.deliveryDays || 3} Days Delivery</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <RefreshCw className="w-4 h-4 text-[#74767E]" />
                  <span>Revisions Included</span>
                </div>
              </div>

              {/* Checklist with Green Checkmarks */}
              <ul className="space-y-2 text-xs text-[#404145]">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#1DBF73] shrink-0" />
                  <span>Complete Core Deliverable</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#1DBF73] shrink-0" />
                  <span>High-Resolution Export & Source Files</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#1DBF73] shrink-0" />
                  <span>Rounds of Iterative Revisions</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#1DBF73] shrink-0" />
                  <span>100% Escrow Milestone Protection</span>
                </li>
              </ul>

              {/* Optional Gig Extras Section */}
              {extrasList.length > 0 && (
                <div className="space-y-2.5 pt-4 border-t border-[#E4E5E7]">
                  <span className="text-[11px] font-bold text-[#74767E] uppercase tracking-wide block">
                    Upgrade with Extras:
                  </span>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 scrollbar-none">
                    {extrasList.map(extra => {
                      const isChecked = selectedExtras.includes(extra.id);
                      return (
                        <label 
                          key={extra.id} 
                          className={`flex items-start gap-2.5 p-2.5 rounded-md border text-xs cursor-pointer transition ${
                            isChecked ? 'bg-[#F7F7F7] border-[#1DBF73] text-[#222325] font-semibold' : 'bg-white border-[#E4E5E7] text-[#404145] hover:bg-[#F7F7F7]'
                          }`}
                        >
                          <input 
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedExtras(prev => [...prev, extra.id]);
                              } else {
                                setSelectedExtras(prev => prev.filter(id => id !== extra.id));
                              }
                            }}
                            className="mt-0.5 rounded border-[#E4E5E7] text-[#1DBF73] focus:ring-[#1DBF73] w-4 h-4 shrink-0"
                          />
                          <div className="flex-1 flex items-center justify-between gap-2">
                            <span>{extra.title}</span>
                            <span className="font-bold text-[#222325] shrink-0">+${extra.price}</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Price summary & Escrow badge */}
              <div className="pt-3 border-t border-[#E4E5E7] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#74767E]">Total due now</span>
                  <span className="text-[22px] font-bold text-[#222325] font-mono">${totalOrderPrice}</span>
                </div>

                <div className="p-3 bg-[#0A4226]/5 rounded-md border border-[#0A4226]/15 flex items-center gap-2.5 text-[11px] text-[#0A4226]">
                  <ShieldCheck className="w-4 h-4 text-[#1DBF73] shrink-0" />
                  <span><strong>100% Escrow Protected:</strong> Funds are locked safely until you approve work.</span>
                </div>
              </div>

              {/* Order Feedback Alert */}
              {orderFeedback && (
                <div
                  className={`p-3 rounded-md border text-xs flex items-start justify-between gap-2 ${
                    orderFeedback.type === 'success'
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                      : 'bg-rose-50 border-rose-300 text-rose-950'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {orderFeedback.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 text-[#1DBF73] shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <div className="space-y-1">
                      <span className="font-semibold block">{orderFeedback.message}</span>
                      {orderFeedback.orderId && (
                        <button
                          type="button"
                          onClick={(e) => navigate(`/messages/${orderFeedback.orderId}`, e)}
                          className="underline font-bold text-[#1DBF73] hover:text-[#19A463] cursor-pointer"
                        >
                          Open WorkStream #{orderFeedback.orderId} →
                        </button>
                      )}
                    </div>
                  </div>
                  {onDismissOrderFeedback && (
                    <button
                      type="button"
                      onClick={onDismissOrderFeedback}
                      className="text-[#74767E] hover:text-[#222325] cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}

              {/* Action Buttons: Continue Button & Contact Seller */}
              <div className="space-y-2.5 pt-1">
                {currentGig.status === 'paused' ? (
                  <div className="p-3 bg-amber-50 border border-amber-300 rounded text-center text-xs font-bold text-amber-900">
                    This gig has been paused by the seller.
                  </div>
                ) : (
                  <button 
                    disabled={isCreatingOrder}
                    onClick={() => handleCreateOrder(
                      `${currentGig.title}${selectedExtrasObjects.length > 0 ? ` (+${selectedExtrasObjects.length} extras)` : ''}`, 
                      totalOrderPrice, 
                      currentGig.freelancerId,
                      currentGig.id,
                      selectedExtras
                    )}
                    className={`w-full py-3.5 font-bold rounded-md transition-all text-sm flex items-center justify-center gap-2 cursor-pointer shadow-xs ${
                      isCreatingOrder
                        ? 'bg-[#1DBF73]/50 text-white cursor-wait'
                        : 'bg-[#1DBF73] hover:bg-[#19A463] text-white'
                    }`}
                  >
                    {isCreatingOrder ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Securing Escrow Funds...</span>
                      </>
                    ) : (
                      <>
                        <span>Continue (${totalOrderPrice})</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                )}

                <button 
                  type="button"
                  onClick={() => handleContactSeller(currentGig.freelancerId, currentGig.freelancerName, currentGig.title, currentGig.id)}
                  className="w-full py-2.5 border border-[#E4E5E7] hover:border-[#222325] text-[#222325] font-bold rounded-md text-xs transition flex items-center justify-center gap-1.5 cursor-pointer bg-white"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-[#74767E]" />
                  <span>Contact Seller</span>
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* RELATED GIGS SECTION */}
      <div className="mt-12 pt-8 border-t border-[#E4E5E7]">
        <RelatedGigsSection
          currentGig={currentGig}
          allGigs={gigs}
          onNavigate={navigate}
          maxItems={4}
        />
      </div>
    </div>
  );
};
