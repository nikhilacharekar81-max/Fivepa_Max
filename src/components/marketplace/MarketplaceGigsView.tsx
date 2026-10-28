import React, { useState, useMemo } from 'react';
import { 
  ShieldCheck, 
  Search, 
  ChevronRight, 
  ChevronLeft,
  Grid, 
  List, 
  Briefcase, 
  Star, 
  Heart,
  Clock,
  Sparkles,
  Check,
  Zap
} from 'lucide-react';
import { Gig, Project } from '../../types';
import { Avatar, GigImage } from '../../components/ui';

interface MarketplaceGigsViewProps {
  filteredGigs: Gig[];
  projects?: Project[];
  currentCategory: string;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  activeDropdown: string | null;
  setActiveDropdown: (d: string | null) => void;
  serviceOptionFilter: string;
  setServiceOptionFilter: (f: string) => void;
  sellerLevelFilter: string;
  setSellerLevelFilter: (f: string) => void;
  budgetFilter: string;
  setBudgetFilter: (f: string) => void;
  deliveryTimeFilter: number | null;
  setDeliveryTimeFilter: (d: number | null) => void;
  onlineNowOnly: boolean;
  setOnlineNowOnly: (b: boolean) => void;
  gigViewMode: 'grid' | 'list';
  setGigViewMode: (m: 'grid' | 'list') => void;
  likedGigIds: string[];
  handleToggleLike: (gigId: string, e: React.MouseEvent) => void;
  navigate: (path: string, e?: React.MouseEvent) => void;
  getGigUrl: (gig: Gig) => string;
  currentUser: any;
  setIsSignupModalOpen: (b: boolean) => void;
  slugify: (name: string) => string;
  CATEGORY_SLUGS: Record<string, string>;
  isHomePage?: boolean;
}

type SortOption = 'recommended' | 'bestselling' | 'rating' | 'price_asc' | 'price_desc' | 'newest';

function formatFiverrTitle(title: string): string {
  const trimmed = title.trim();
  if (trimmed.toLowerCase().startsWith('i will')) {
    return 'I will ' + trimmed.slice(6).trim();
  }
  return `I will ${trimmed.charAt(0).toLowerCase()}${trimmed.slice(1)}`;
}

function formatFiverrReviewCount(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  return String(count);
}

export const MarketplaceGigsView: React.FC<MarketplaceGigsViewProps> = ({
  filteredGigs,
  projects = [],
  currentCategory,
  searchQuery,
  setSearchQuery,
  activeDropdown,
  setActiveDropdown,
  serviceOptionFilter,
  setServiceOptionFilter,
  sellerLevelFilter,
  setSellerLevelFilter,
  budgetFilter,
  setBudgetFilter,
  deliveryTimeFilter,
  setDeliveryTimeFilter,
  onlineNowOnly,
  setOnlineNowOnly,
  gigViewMode,
  setGigViewMode,
  likedGigIds,
  handleToggleLike,
  navigate,
  getGigUrl,
  currentUser,
  setIsSignupModalOpen,
  slugify,
  CATEGORY_SLUGS,
  isHomePage = false
}) => {
  const [sortBy, setSortBy] = useState<SortOption>('recommended');
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  // Custom budget inputs
  const [customMin, setCustomMin] = useState('');
  const [customMax, setCustomMax] = useState('');

  // Filter & Sort Logic
  const sortedAndFilteredGigs = useMemo(() => {
    let list = [...filteredGigs];

    if (budgetFilter.startsWith('custom:')) {
      const parts = budgetFilter.replace('custom:', '').split('-');
      const min = parseFloat(parts[0]) || 0;
      const max = parseFloat(parts[1]) || Infinity;
      list = list.filter(g => g.price >= min && g.price <= max);
    }

    switch (sortBy) {
      case 'bestselling':
        list.sort((a, b) => (b.reviewsCount || 0) - (a.reviewsCount || 0));
        break;
      case 'rating':
        list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        break;
      case 'price_asc':
        list.sort((a, b) => a.price - b.price);
        break;
      case 'price_desc':
        list.sort((a, b) => b.price - a.price);
        break;
      case 'newest':
        list.sort((a, b) => (b as any).id.localeCompare((a as any).id));
        break;
      default:
        break;
    }

    return list;
  }, [filteredGigs, budgetFilter, sortBy]);

  const sortLabels: Record<SortOption, string> = {
    recommended: 'Recommended',
    bestselling: 'Best Selling',
    rating: 'Top Rated',
    price_asc: 'Price: Low to High',
    price_desc: 'Price: High to Low',
    newest: 'Newest Arrivals'
  };

  const handleApplyCustomBudget = () => {
    const min = parseFloat(customMin) || 0;
    const max = parseFloat(customMax) || 0;
    if (max > 0 && max >= min) {
      setBudgetFilter(`custom:${min}-${max}`);
    } else if (min > 0) {
      setBudgetFilter(`custom:${min}-999999`);
    } else {
      setBudgetFilter('All');
    }
    setActiveDropdown(null);
  };

  const popularTags = [
    { label: 'Website Design', query: 'Website Design' },
    { label: 'WordPress', query: 'WordPress' },
    { label: 'Logo Design', query: 'Logo Design' },
    { label: 'AI Services', query: 'AI' },
    { label: 'Mobile Apps', query: 'Mobile App' },
    { label: 'Video Editing', query: 'Video' }
  ];

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 font-sans text-[#404145]">
      {isHomePage ? (
        /* ========================================================= */
        /* EXACT FIVERR HERO BANNER (Dark Green #0A4226)             */
        /* ========================================================= */
        <div className="relative rounded-2xl bg-[#0A4226] text-white p-8 sm:p-12 md:p-16 mb-10 overflow-hidden shadow-md">
          <div
            className="absolute right-0 top-0 w-1/2 h-full opacity-15 bg-cover bg-center pointer-events-none hidden md:block"
            style={{ backgroundImage: `url('https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&h=800&fit=crop')` }}
          />
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-white text-xs font-semibold mb-6 border border-white/20">
              <ShieldCheck className="w-4 h-4 text-[#1DBF73]" /> 
              <span>100% Escrow Payment Protection</span>
            </div>

            <h1 className="text-[34px] sm:text-[42px] md:text-[48px] leading-[42px] sm:leading-[50px] md:leading-[56px] font-bold tracking-tight mb-4 text-white">
              Find the right <span className="font-serif italic font-normal text-[#1DBF73]">freelance</span> service, right away
            </h1>

            <p className="text-white/80 text-base md:text-lg leading-relaxed mb-8 max-w-xl">
              Connect with top-rated talent worldwide. Funds are secured in escrow until you inspect and approve the completed work.
            </p>

            {/* Hero Global Search Bar */}
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                navigate(`/gigs?q=${encodeURIComponent(searchQuery)}`);
              }}
              className="flex items-center bg-white rounded-lg p-1.5 shadow-2xl max-w-xl border border-white/20"
            >
              <Search className="w-5 h-5 text-[#74767E] ml-3 shrink-0" />
              <input
                type="text"
                placeholder="Search for any service (e.g. Website, Logo, Python)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 text-sm text-[#222325] placeholder-[#74767E] focus:outline-none"
              />
              <button
                type="submit"
                className="px-6 py-3 bg-[#1DBF73] hover:bg-[#19A463] text-white text-sm font-bold rounded-md transition-colors cursor-pointer shrink-0 shadow-xs"
              >
                Search
              </button>
            </form>

            {/* Popular Search Tag Pills */}
            <div className="flex flex-wrap items-center gap-2 mt-5 text-xs text-white/80">
              <span className="font-semibold text-white">Popular:</span>
              {popularTags.map(tag => (
                <button
                  key={tag.label}
                  type="button"
                  onClick={() => {
                    setSearchQuery(tag.query);
                    navigate(`/gigs?q=${encodeURIComponent(tag.query)}`);
                  }}
                  className="px-3 py-1 rounded-full border border-white/30 text-white/90 hover:border-white hover:bg-white hover:text-[#222325] transition-all cursor-pointer font-medium"
                >
                  {tag.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* ========================================================= */
        /* EXPLORE GIGS HEADER: Breadcrumbs & Page Headline          */
        /* ========================================================= */
        <div className="mb-6">
          <div className="flex items-center gap-1.5 text-xs text-[#74767E] mb-2 font-medium">
            <a 
              href="/" 
              onClick={(e) => navigate('/', e)} 
              className="hover:text-[#222325] transition-colors"
            >
              WorkPerHour
            </a>
            <ChevronRight className="w-3 h-3 text-[#B5B6BA]" />
            <span className="text-[#222325] font-semibold capitalize">
              {currentCategory === 'All' ? 'Services' : currentCategory}
            </span>
          </div>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-[28px] sm:text-[32px] leading-[38px] font-bold text-[#222325] tracking-tight">
                {currentCategory === 'All' ? 'Explore Freelance Services' : `${currentCategory} Services`}
              </h1>
              <p className="text-sm text-[#74767E] mt-1 max-w-2xl leading-relaxed">
                Find top-rated talent, review verified portfolios, and hire securely with 100% Escrow protection.
              </p>
            </div>

            {/* Quick Search Input */}
            <div className="relative w-full md:w-80 shrink-0">
              <Search className="w-4 h-4 text-[#74767E] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder="Search gigs..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white border border-[#E4E5E7] rounded-md text-sm text-[#222325] placeholder-[#74767E] focus:outline-none focus:border-[#222325] transition"
              />
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* FIVERR FILTER TOOLBAR                                     */}
      {/* ========================================================= */}
      <div className="bg-white border border-[#E4E5E7] rounded-lg p-3.5 mb-6 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Left: Filter Dropdown Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Service Options Filter */}
            <div className="relative">
              <button 
                type="button"
                onClick={() => setActiveDropdown(activeDropdown === 'service' ? null : 'service')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-md text-xs font-bold border transition-all cursor-pointer ${
                  serviceOptionFilter !== 'All'
                    ? 'bg-[#222325] text-white border-[#222325]'
                    : 'bg-white text-[#404145] border-[#E4E5E7] hover:border-[#74767E]'
                }`}
              >
                <span>Service Options {serviceOptionFilter !== 'All' ? `(${serviceOptionFilter})` : ''}</span>
                <ChevronRight className={`w-3.5 h-3.5 transition-transform ${activeDropdown === 'service' ? '-rotate-90' : 'rotate-90'}`} />
              </button>
              {activeDropdown === 'service' && (
                <div className="absolute left-0 mt-2 w-56 bg-white border border-[#E4E5E7] rounded-lg shadow-xl z-30 p-2 space-y-1">
                  {['All', 'Development & IT', 'AI & Data', 'Design & Creative', 'Mobile Apps'].map(opt => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => { setServiceOptionFilter(opt); setActiveDropdown(null); }}
                      className={`w-full text-left px-3 py-2 text-xs rounded-md font-medium transition-colors flex items-center justify-between cursor-pointer ${
                        serviceOptionFilter === opt ? 'bg-[#F7F7F7] text-[#222325] font-bold' : 'text-[#404145] hover:bg-[#F7F7F7]'
                      }`}
                    >
                      <span>{opt}</span>
                      {serviceOptionFilter === opt && <Check className="w-3.5 h-3.5 text-[#1DBF73]" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Seller Details Filter */}
            <div className="relative">
              <button 
                type="button"
                onClick={() => setActiveDropdown(activeDropdown === 'seller' ? null : 'seller')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-md text-xs font-bold border transition-all cursor-pointer ${
                  sellerLevelFilter !== 'All'
                    ? 'bg-[#222325] text-white border-[#222325]'
                    : 'bg-white text-[#404145] border-[#E4E5E7] hover:border-[#74767E]'
                }`}
              >
                <span>Seller Details {sellerLevelFilter !== 'All' ? `(${sellerLevelFilter})` : ''}</span>
                <ChevronRight className={`w-3.5 h-3.5 transition-transform ${activeDropdown === 'seller' ? '-rotate-90' : 'rotate-90'}`} />
              </button>
              {activeDropdown === 'seller' && (
                <div className="absolute left-0 mt-2 w-52 bg-white border border-[#E4E5E7] rounded-lg shadow-xl z-30 p-2 space-y-1">
                  {[
                    { label: 'All Sellers', value: 'All' },
                    { label: 'Top Rated Sellers', value: 'Top Rated' },
                    { label: 'Level 2 Sellers', value: 'Level 2' },
                    { label: 'Level 1 Sellers', value: 'Level 1' }
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => { setSellerLevelFilter(opt.value); setActiveDropdown(null); }}
                      className={`w-full text-left px-3 py-2 text-xs rounded-md font-medium transition-colors flex items-center justify-between cursor-pointer ${
                        sellerLevelFilter === opt.value ? 'bg-[#F7F7F7] text-[#222325] font-bold' : 'text-[#404145] hover:bg-[#F7F7F7]'
                      }`}
                    >
                      <span>{opt.label}</span>
                      {sellerLevelFilter === opt.value && <Check className="w-3.5 h-3.5 text-[#1DBF73]" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Budget Filter */}
            <div className="relative">
              <button 
                type="button"
                onClick={() => setActiveDropdown(activeDropdown === 'budget' ? null : 'budget')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-md text-xs font-bold border transition-all cursor-pointer ${
                  budgetFilter !== 'All'
                    ? 'bg-[#222325] text-white border-[#222325]'
                    : 'bg-white text-[#404145] border-[#E4E5E7] hover:border-[#74767E]'
                }`}
              >
                <span>Budget {budgetFilter !== 'All' ? `(${budgetFilter})` : ''}</span>
                <ChevronRight className={`w-3.5 h-3.5 transition-transform ${activeDropdown === 'budget' ? '-rotate-90' : 'rotate-90'}`} />
              </button>
              {activeDropdown === 'budget' && (
                <div className="absolute left-0 mt-2 w-64 bg-white border border-[#E4E5E7] rounded-lg shadow-xl z-30 p-3 space-y-3">
                  <div className="space-y-1">
                    {[
                      { label: 'Any Budget', value: 'All' },
                      { label: 'Under $50', value: 'Under $50' },
                      { label: '$50 to $200', value: '$50 to $200' },
                      { label: '$200 & Above', value: '$200 & Above' }
                    ].map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => { setBudgetFilter(opt.value); setActiveDropdown(null); }}
                        className={`w-full text-left px-2.5 py-1.5 text-xs rounded-md font-medium transition-colors flex items-center justify-between cursor-pointer ${
                          budgetFilter === opt.value ? 'bg-[#F7F7F7] text-[#222325] font-bold' : 'text-[#404145] hover:bg-[#F7F7F7]'
                        }`}
                      >
                        <span>{opt.label}</span>
                        {budgetFilter === opt.value && <Check className="w-3.5 h-3.5 text-[#1DBF73]" />}
                      </button>
                    ))}
                  </div>

                  <div className="border-t border-[#E4E5E7] pt-2.5 space-y-2">
                    <span className="text-[11px] font-bold text-[#74767E] uppercase block">Custom Budget</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        placeholder="Min ($)"
                        value={customMin}
                        onChange={(e) => setCustomMin(e.target.value)}
                        className="w-1/2 px-2 py-1 border border-[#E4E5E7] rounded text-xs focus:outline-none focus:border-[#222325]"
                      />
                      <input
                        type="number"
                        placeholder="Max ($)"
                        value={customMax}
                        onChange={(e) => setCustomMax(e.target.value)}
                        className="w-1/2 px-2 py-1 border border-[#E4E5E7] rounded text-xs focus:outline-none focus:border-[#222325]"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleApplyCustomBudget}
                      className="w-full py-1.5 bg-[#222325] hover:bg-[#1DBF73] text-white text-xs font-bold rounded transition cursor-pointer"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Delivery Time Filter */}
            <div className="relative">
              <button 
                type="button"
                onClick={() => setActiveDropdown(activeDropdown === 'delivery' ? null : 'delivery')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-md text-xs font-bold border transition-all cursor-pointer ${
                  deliveryTimeFilter !== null
                    ? 'bg-[#222325] text-white border-[#222325]'
                    : 'bg-white text-[#404145] border-[#E4E5E7] hover:border-[#74767E]'
                }`}
              >
                <span>Delivery Time {deliveryTimeFilter !== null ? `(Up to ${deliveryTimeFilter}d)` : ''}</span>
                <ChevronRight className={`w-3.5 h-3.5 transition-transform ${activeDropdown === 'delivery' ? '-rotate-90' : 'rotate-90'}`} />
              </button>
              {activeDropdown === 'delivery' && (
                <div className="absolute left-0 mt-2 w-48 bg-white border border-[#E4E5E7] rounded-lg shadow-xl z-30 p-2 space-y-1">
                  {[
                    { label: 'Any Delivery Time', value: null },
                    { label: 'Express 24H', value: 1 },
                    { label: 'Up to 3 Days', value: 3 },
                    { label: 'Up to 7 Days', value: 7 }
                  ].map(opt => (
                    <button
                      key={String(opt.value)}
                      type="button"
                      onClick={() => { setDeliveryTimeFilter(opt.value); setActiveDropdown(null); }}
                      className={`w-full text-left px-3 py-2 text-xs rounded-md font-medium transition-colors flex items-center justify-between cursor-pointer ${
                        deliveryTimeFilter === opt.value ? 'bg-[#F7F7F7] text-[#222325] font-bold' : 'text-[#404145] hover:bg-[#F7F7F7]'
                      }`}
                    >
                      <span>{opt.label}</span>
                      {deliveryTimeFilter === opt.value && <Check className="w-3.5 h-3.5 text-[#1DBF73]" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Online Now Toggle */}
          <div className="flex items-center gap-5 text-xs font-bold text-[#222325]">
            {/* Online Now Toggle */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <div 
                onClick={() => setOnlineNowOnly(!onlineNowOnly)}
                className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${
                  onlineNowOnly ? 'bg-[#1DBF73]' : 'bg-[#E4E5E7]'
                }`}
              >
                <div 
                  className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${
                    onlineNowOnly ? 'left-4.5' : 'left-0.5'
                  }`}
                />
              </div>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#1DBF73] inline-block" />
                <span>Online now</span>
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Meta Bar: Services Available & Sort */}
      <div className="flex items-center justify-between gap-4 mb-5 text-xs">
        <div className="text-[#74767E] font-medium">
          <strong className="text-[#222325] font-bold">{sortedAndFilteredGigs.length.toLocaleString()}</strong> services available
        </div>

        <div className="flex items-center gap-3">
          {/* Sort By Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowSortDropdown(!showSortDropdown)}
              className="flex items-center gap-1.5 text-[#404145] hover:text-[#222325] font-bold cursor-pointer px-2 py-1 rounded-md hover:bg-[#F7F7F7] transition"
            >
              <span className="text-[#74767E] font-normal">Sort by:</span>
              <span>{sortLabels[sortBy]}</span>
              <ChevronRight className={`w-3.5 h-3.5 text-[#74767E] transition-transform ${showSortDropdown ? '-rotate-90' : 'rotate-90'}`} />
            </button>

            {showSortDropdown && (
              <div className="absolute right-0 mt-1.5 w-48 bg-white border border-[#E4E5E7] rounded-lg shadow-xl z-30 p-1.5 space-y-0.5">
                {(Object.keys(sortLabels) as SortOption[]).map(key => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setSortBy(key);
                      setShowSortDropdown(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs rounded-md font-medium transition-colors flex items-center justify-between cursor-pointer ${
                      sortBy === key ? 'bg-[#F7F7F7] text-[#222325] font-bold' : 'text-[#404145] hover:bg-[#F7F7F7]'
                    }`}
                  >
                    <span>{sortLabels[key]}</span>
                    {sortBy === key && <Check className="w-3.5 h-3.5 text-[#1DBF73]" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Grid / Listicle Toggle */}
          <div className="flex items-center gap-1 bg-[#F7F7F7] p-0.5 rounded-md border border-[#E4E5E7]">
            <button
              type="button"
              onClick={() => setGigViewMode('grid')}
              className={`p-1.5 rounded transition-all cursor-pointer ${
                gigViewMode === 'grid' 
                  ? 'bg-white text-[#222325] shadow-xs font-bold' 
                  : 'text-[#74767E] hover:text-[#222325]'
              }`}
              title="Grid View"
            >
              <Grid className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setGigViewMode('list')}
              className={`p-1.5 rounded transition-all cursor-pointer ${
                gigViewMode === 'list' 
                  ? 'bg-white text-[#222325] shadow-xs font-bold' 
                  : 'text-[#74767E] hover:text-[#222325]'
              }`}
              title="List View"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 4-COLUMN DESKTOP GIG GRID (Exact Fiverr Anatomy)          */}
      {/* ========================================================= */}
      {sortedAndFilteredGigs.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E4E5E7] p-12 text-center max-w-lg mx-auto shadow-2xs space-y-4 my-8">
          <div className="w-14 h-14 rounded-full bg-[#F7F7F7] flex items-center justify-center mx-auto text-[#74767E]">
            <Briefcase className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-[#222325]">No Services Found</h3>
          <p className="text-xs text-[#74767E] max-w-sm mx-auto leading-relaxed">
            Try adjusting your search query, budget parameters, or seller details to discover more freelance gigs.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setBudgetFilter('All');
                setSellerLevelFilter('All');
                setServiceOptionFilter('All');
                setDeliveryTimeFilter(null);
                setOnlineNowOnly(false);
              }}
              className="px-4 py-2 bg-[#222325] hover:bg-[#1DBF73] text-white font-bold rounded-md text-xs transition cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        </div>
      ) : gigViewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {sortedAndFilteredGigs.map(gig => {
            const gigUrl = getGigUrl(gig);
            const sellerUrl = `/${slugify(gig.freelancerName)}`;
            const isLiked = likedGigIds.includes(gig.id);
            const isTopSeller = gig.freelancerLevel?.toLowerCase().includes('top') || gig.rating >= 4.9;

            return (
              <div 
                key={gig.id} 
                onClick={(e) => navigate(gigUrl, e)}
                className="bg-white rounded-lg border border-[#E4E5E7] overflow-hidden fiverr-card-transition flex flex-col justify-between group cursor-pointer relative"
              >
                {/* 1. Media Thumbnail: aspect-[16/10] rounded-t-lg container with hover image zoom */}
                <div className="relative aspect-[16/10] overflow-hidden bg-[#F7F7F7] select-none">
                  <GigImage 
                    src={gig.image} 
                    title={gig.title} 
                    category={gig.category}
                    className="w-full h-full group-hover:scale-105 transition-transform duration-300 object-cover" 
                  />

                  {/* Top-Left Badge: Top Rated */}
                  {isTopSeller ? (
                    <div className="absolute top-2.5 left-2.5 z-10">
                      <span className="bg-[#222325] text-white font-bold text-[10px] px-2 py-0.5 rounded-sm tracking-wider uppercase shadow-xs">
                        Top Rated
                      </span>
                    </div>
                  ) : null}

                  {/* Top-Right Heart Bookmark Button */}
                  <button 
                    type="button"
                    onClick={(e) => handleToggleLike(gig.id, e)}
                    className={`absolute top-2.5 right-2.5 z-10 w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-xs ${
                      isLiked 
                        ? 'bg-white text-rose-500 fill-rose-500 scale-105' 
                        : 'bg-black/30 hover:bg-white text-white hover:text-rose-500'
                    }`}
                    title={isLiked ? 'Remove from Saved' : 'Save to List'}
                  >
                    <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-rose-500 text-rose-500' : ''}`} />
                  </button>
                </div>

                {/* Card Content */}
                <div className="p-3.5 flex-1 flex flex-col justify-between">
                  <div>
                    {/* 2. Seller Strip: 24x24 avatar + online green dot + Seller Name */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="relative shrink-0">
                          <Avatar 
                            src={gig.freelancerAvatar} 
                            name={gig.freelancerName} 
                            size="xs"
                          />
                          <span className="w-2 h-2 rounded-full bg-[#1DBF73] ring-1.5 ring-white absolute -bottom-0.5 -right-0.5 inline-block" />
                        </div>
                        <a 
                          href={sellerUrl}
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(sellerUrl, e);
                          }}
                          className="text-[14px] font-bold text-[#222325] hover:underline truncate"
                        >
                          {gig.freelancerName}
                        </a>
                      </div>

                      <span className="text-[12px] text-[#74767E] font-medium shrink-0">
                        {gig.freelancerLevel || 'Level 2'}
                      </span>
                    </div>

                    {/* 3. Gig Title: 16px font-normal, 2-line clamp leading-[22px], turns #1DBF73 on hover */}
                    <h3 className="text-[16px] leading-[22px] font-normal text-[#222325] group-hover:text-[#1DBF73] transition-colors line-clamp-2 min-h-[44px] mb-2">
                      <a
                        href={gigUrl}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(gigUrl, e);
                        }}
                        className="text-[#222325] group-hover:text-[#1DBF73] transition-colors block"
                      >
                        {formatFiverrTitle(gig.title)}
                      </a>
                    </h3>

                    {/* 4. Rating Row: Solid Star Icon + 4.9 (font-bold) + (142) */}
                    <div className="flex items-center gap-1 text-sm mb-3">
                      <Star className="w-3.5 h-3.5 fill-[#222325] text-[#222325] shrink-0" />
                      <span className="font-bold text-[#222325]">
                        {(gig.rating || 5.0).toFixed(1)}
                      </span>
                      <span className="text-[#74767E] font-normal">
                        ({formatFiverrReviewCount(gig.reviewsCount || 1)})
                      </span>
                    </div>
                  </div>

                  {/* 5. Pricing Footer: 100% Escrow Shield on left, "STARTING AT $..." on right */}
                  <div className="pt-3 border-t border-[#E4E5E7] flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-[#1DBF73] font-semibold" title="100% Escrow Protected">
                      <ShieldCheck className="w-4 h-4 shrink-0" />
                      <span className="text-[11px] text-[#74767E] font-medium hidden sm:inline">100% Escrow</span>
                    </div>

                    <div className="flex items-baseline gap-1">
                      <span className="text-[12px] uppercase tracking-wide text-[#74767E] font-semibold">STARTING AT</span>
                      <span className="text-[18px] font-bold text-[#222325]">${gig.price}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ========================================================= */
        /* FIVERR LISTICLE VIEW                                      */
        /* ========================================================= */
        <div className="space-y-4">
          {sortedAndFilteredGigs.map(gig => {
            const gigUrl = getGigUrl(gig);
            const sellerUrl = `/${slugify(gig.freelancerName)}`;
            const isLiked = likedGigIds.includes(gig.id);

            return (
              <div 
                key={gig.id} 
                onClick={(e) => navigate(gigUrl, e)}
                className="bg-white rounded-lg border border-[#E4E5E7] p-4 hover:shadow-md transition-all flex flex-col md:flex-row items-center justify-between gap-6 group cursor-pointer"
              >
                <div className="flex items-center gap-4 w-full md:w-auto">
                  <div className="relative w-44 sm:w-52 aspect-[16/10] rounded-md overflow-hidden bg-[#F7F7F7] shrink-0">
                    <GigImage 
                      src={gig.image} 
                      title={gig.title} 
                      category={gig.category}
                      className="w-full h-full group-hover:scale-105 transition-transform duration-300 object-cover" 
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Avatar src={gig.freelancerAvatar} name={gig.freelancerName} size="xs" />
                      <span className="text-[14px] font-bold text-[#222325]">{gig.freelancerName}</span>
                      <span className="text-xs text-[#74767E]">· {gig.freelancerLevel || 'Level 2'}</span>
                    </div>
                    <h3 className="text-[16px] font-normal text-[#222325] group-hover:text-[#1DBF73] transition-colors line-clamp-2 mb-2">
                      {formatFiverrTitle(gig.title)}
                    </h3>
                    <div className="flex items-center gap-1 text-sm">
                      <Star className="w-3.5 h-3.5 fill-[#222325] text-[#222325]" />
                      <span className="font-bold text-[#222325]">{(gig.rating || 5.0).toFixed(1)}</span>
                      <span className="text-[#74767E]">({formatFiverrReviewCount(gig.reviewsCount || 1)})</span>
                    </div>
                  </div>
                </div>

                <div className="flex md:flex-col items-center md:items-end justify-between w-full md:w-auto pt-3 md:pt-0 border-t md:border-t-0 border-[#E4E5E7] shrink-0">
                  <span className="text-[12px] uppercase tracking-wide text-[#74767E] font-semibold">STARTING AT</span>
                  <span className="text-[20px] font-bold text-[#222325]">${gig.price}</span>
                  <div className="flex items-center gap-1 text-[11px] text-[#74767E] mt-1">
                    <Clock className="w-3 h-3 text-[#1DBF73]" />
                    <span>{gig.deliveryDays || 3}d delivery</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
