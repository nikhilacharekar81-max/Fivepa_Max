import React, { useState, useMemo } from 'react';
import { 
  ShieldCheck, CheckCircle2, Star, MapPin, Clock, MessageSquare, 
  Briefcase, Check, ExternalLink, Award, User, 
  Sparkles, Globe, Pencil, Heart
} from 'lucide-react';
import { UserAccount, Gig, Review } from '../../types';
import { Reviews } from '../gig_reviews';
import { DEFAULT_AVATAR, DEFAULT_GIG_IMAGE } from '../../constants';

interface FreelancerProfileViewProps {
  profileUser: UserAccount;
  currentUser: UserAccount | null;
  gigs: Gig[];
  reviews?: Review[];
  onNavigate: (to: string, e?: React.MouseEvent) => void;
  onFeatureGig?: (gigId: string) => void;
  onContact?: () => void;
  onEditProfile?: () => void;
}

export const FreelancerProfileView: React.FC<FreelancerProfileViewProps> = ({
  profileUser,
  currentUser,
  gigs,
  reviews = [],
  onNavigate,
  onFeatureGig,
  onContact,
  onEditProfile
}) => {
  const [activeTab, setActiveTab] = useState<'gigs' | 'reviews'>('gigs');
  const [searchGigs, setSearchGigs] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [copiedLink, setCopiedLink] = useState(false);

  const isOwner = currentUser?.id === profileUser.id;

  // Filter gigs for this freelancer
  const userGigs = useMemo(() => {
    return gigs.filter(g => g.freelancerId === profileUser.id);
  }, [gigs, profileUser.id]);

  const filteredGigs = useMemo(() => {
    return userGigs.filter(g => {
      const matchesSearch = g.title.toLowerCase().includes(searchGigs.toLowerCase()) ||
                            g.description.toLowerCase().includes(searchGigs.toLowerCase());
      const matchesCat = selectedCategory === 'all' || g.category === selectedCategory;
      return matchesSearch && matchesCat;
    });
  }, [userGigs, searchGigs, selectedCategory]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    userGigs.forEach(g => {
      if (g.category) cats.add(g.category);
    });
    return Array.from(cats);
  }, [userGigs]);

  const userReviews = useMemo(() => {
    return reviews.filter(r => r.targetUserId === profileUser.id);
  }, [reviews, profileUser.id]);

  const averageRating = useMemo(() => {
    if (userReviews.length === 0) return profileUser.rating || 5.0;
    const sum = userReviews.reduce((acc, r) => acc + (r.rating || 5), 0);
    return Number((sum / userReviews.length).toFixed(1));
  }, [userReviews, profileUser.rating]);

  const handleShare = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-300">
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* =================================================================== */}
        {/* LEFT COLUMN: 4 cols (360px) Fiverr Seller Profile Card & Bio      */}
        {/* =================================================================== */}
        <div className="w-full lg:w-[380px] shrink-0 space-y-6">
          {/* Card 1: Avatar, Status, Ratings, Contact */}
          <div className="bg-white border border-[#E4E5E7] rounded-xl p-6 shadow-xs text-center relative">
            {profileUser.isAvailableNow && (
              <div className="absolute top-4 right-4 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#EBF8F2] text-[#1DBF73] text-[11px] font-bold">
                <span className="w-2 h-2 rounded-full bg-[#1DBF73] animate-pulse" />
                Online
              </div>
            )}

            {/* Profile Avatar */}
            <div className="relative inline-block mx-auto mb-4">
              <img
                src={profileUser.avatar || DEFAULT_AVATAR}
                alt={profileUser.name}
                className="w-28 h-28 sm:w-32 sm:h-32 rounded-full object-cover border border-[#E4E5E7] p-1 shadow-xs"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = DEFAULT_AVATAR;
                }}
              />
              <span 
                className="absolute bottom-2 right-2 w-4 h-4 rounded-full bg-[#1DBF73] border-2 border-white"
                title="Online on WorkPerHour" 
              />
            </div>

            {/* Name & Tagline */}
            <h1 className="text-[20px] font-bold text-[#222325] leading-tight flex items-center justify-center gap-1.5">
              <span>{profileUser.name}</span>
              {profileUser.verified && (
                <span title="Verified Seller" className="inline-flex">
                  <ShieldCheck className="w-4 h-4 text-[#1DBF73]" />
                </span>
              )}
            </h1>
            <p className="text-xs text-[#74767E] mt-0.5">@{profileUser.username || profileUser.name.toLowerCase().replace(/\s+/g, '_')}</p>
            
            <p className="text-[14px] text-[#404145] font-medium mt-2 max-w-xs mx-auto">
              {profileUser.title || 'Professional Freelance Creator'}
            </p>

            {/* Star Rating Strip */}
            <div className="flex items-center justify-center gap-1.5 mt-3 text-sm">
              <Star className="w-4 h-4 fill-[#FFBE5B] text-[#FFBE5B]" />
              <span className="font-bold text-[#222325]">{averageRating}</span>
              <span className="text-[#74767E]">({userReviews.length || profileUser.reviewsCount || 0} reviews)</span>
            </div>

            {/* Action Button: Contact Me or Edit Profile */}
            <div className="mt-5 space-y-2">
              {isOwner ? (
                <button
                  type="button"
                  onClick={onEditProfile}
                  className="w-full py-2.5 px-4 bg-[#F5F5F5] hover:bg-[#E4E5E7] text-[#222325] font-bold text-[14px] rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Pencil className="w-4 h-4 text-[#74767E]" />
                  <span>Edit Profile</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onContact}
                  className="w-full py-2.5 px-4 bg-[#1DBF73] hover:bg-[#19A463] text-white font-bold text-[14px] rounded-lg transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Contact Me</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleShare}
                className="w-full py-2 px-3 bg-white border border-[#E4E5E7] hover:bg-[#F7F7F7] text-[#404145] font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-[#1DBF73]" /> : <ExternalLink className="w-3.5 h-3.5 text-[#74767E]" />}
                <span>{copiedLink ? 'Profile Link Copied' : 'Share Profile'}</span>
              </button>
            </div>

            {/* Divider & Metadata Details */}
            <div className="mt-6 pt-6 border-t border-[#E4E5E7] space-y-3 text-[14px] text-left">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-[#74767E]">
                  <MapPin className="w-4 h-4" /> From
                </span>
                <span className="font-semibold text-[#222325] flex items-center gap-1">
                  {profileUser.countryFlag && <span>{profileUser.countryFlag}</span>}
                  <span>{profileUser.location || 'United States'}</span>
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-[#74767E]">
                  <User className="w-4 h-4" /> Member since
                </span>
                <span className="font-semibold text-[#222325]">{profileUser.createdAt || 'Jan 2026'}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-[#74767E]">
                  <Clock className="w-4 h-4" /> Avg. response time
                </span>
                <span className="font-semibold text-[#222325]">{profileUser.responseTime || '1 hour'}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-[#74767E]">
                  <Briefcase className="w-4 h-4" /> Completed Orders
                </span>
                <span className="font-semibold text-[#222325]">{profileUser.completedJobs || userGigs.length || 12}</span>
              </div>
            </div>
          </div>

          {/* Card 2: Description, Skills, Languages, Certifications */}
          <div className="bg-white border border-[#E4E5E7] rounded-xl p-6 shadow-xs space-y-6 text-left">
            {/* Description */}
            <div>
              <h3 className="font-bold text-[#222325] text-[16px] mb-3">Description</h3>
              <p className="text-[14px] text-[#404145] leading-relaxed whitespace-pre-line">
                {profileUser.bio || 'Experienced professional dedicated to delivering top-tier digital services on WorkPerHour with complete escrow security and punctual delivery.'}
              </p>
            </div>

            {/* Languages */}
            <div className="pt-5 border-t border-[#E4E5E7]">
              <h3 className="font-bold text-[#222325] text-[16px] mb-3">Languages</h3>
              <div className="space-y-1.5 text-[14px]">
                {(profileUser.languages || ['English (Fluent)', 'Spanish (Conversational)']).map((lang, idx) => (
                  <div key={idx} className="text-[#404145]">
                    {lang}
                  </div>
                ))}
              </div>
            </div>

            {/* Skills */}
            <div className="pt-5 border-t border-[#E4E5E7]">
              <h3 className="font-bold text-[#222325] text-[16px] mb-3">Skills</h3>
              <div className="flex flex-wrap gap-2">
                {(profileUser.skills && profileUser.skills.length > 0 
                  ? profileUser.skills 
                  : ['Web Development', 'React', 'TypeScript', 'UI/UX Design', 'Full Stack']
                ).map((skill, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-[#F5F5F5] hover:bg-[#E4E5E7] text-[#404145] text-xs font-semibold rounded-full transition-colors cursor-pointer"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>

            {/* Certifications & Badges */}
            <div className="pt-5 border-t border-[#E4E5E7]">
              <h3 className="font-bold text-[#222325] text-[16px] mb-3">Linked Accounts & Trust</h3>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between text-[#404145]">
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#1DBF73]" />
                    <span>Email & ID Verified</span>
                  </span>
                  <span className="text-[#1DBF73] font-bold">100% Escrow Protected</span>
                </div>
                <div className="flex items-center justify-between text-[#404145]">
                  <span className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-[#1DBF73]" />
                    <span>Payment Methods Verified</span>
                  </span>
                  <span className="text-[#74767E]">Verified</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* =================================================================== */}
        {/* RIGHT COLUMN: 8 cols (Flex-1) Gigs Showcase & Reviews               */}
        {/* =================================================================== */}
        <div className="flex-1 min-w-0 space-y-8">
          {/* Section Navigation Header */}
          <div className="flex items-center justify-between border-b border-[#E4E5E7] pb-3">
            <div className="flex items-center gap-6">
              <button
                type="button"
                onClick={() => setActiveTab('gigs')}
                className={`pb-3 text-[16px] font-bold transition-colors cursor-pointer border-b-2 -mb-3.5 ${
                  activeTab === 'gigs'
                    ? 'border-[#1DBF73] text-[#222325]'
                    : 'border-transparent text-[#74767E] hover:text-[#222325]'
                }`}
              >
                Gigs by {profileUser.name.split(' ')[0]} ({userGigs.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('reviews')}
                className={`pb-3 text-[16px] font-bold transition-colors cursor-pointer border-b-2 -mb-3.5 ${
                  activeTab === 'reviews'
                    ? 'border-[#1DBF73] text-[#222325]'
                    : 'border-transparent text-[#74767E] hover:text-[#222325]'
                }`}
              >
                Reviews ({userReviews.length})
              </button>
            </div>

            {/* Quick search if on Gigs tab */}
            {activeTab === 'gigs' && userGigs.length > 2 && (
              <div className="hidden sm:block">
                <input
                  type="text"
                  placeholder="Search in gigs..."
                  value={searchGigs}
                  onChange={(e) => setSearchGigs(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-white border border-[#E4E5E7] rounded-lg text-[#222325] focus:outline-none focus:border-[#1DBF73]"
                />
              </div>
            )}
          </div>

          {/* TAB 1: GIGS GRID */}
          {activeTab === 'gigs' && (
            <div>
              {filteredGigs.length === 0 ? (
                <div className="bg-white border border-[#E4E5E7] rounded-xl p-12 text-center space-y-3">
                  <Sparkles className="w-10 h-10 text-[#74767E] mx-auto opacity-50" />
                  <h3 className="text-[18px] font-bold text-[#222325]">No Gigs active currently</h3>
                  <p className="text-[14px] text-[#74767E]">
                    {isOwner ? 'Publish your first gig to showcase your skills and start receiving escrow orders.' : 'This seller has not published active gigs in this category.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                  {filteredGigs.map((gig) => (
                    <div
                      key={gig.id}
                      onClick={(e) => onNavigate(`/gig/${gig.id}`, e)}
                      className="bg-white border border-[#E4E5E7] rounded-xl overflow-hidden hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col group"
                    >
                      {/* 16:10 Thumbnail */}
                      <div className="aspect-[16/10] bg-[#F7F7F7] relative overflow-hidden">
                        <img
                          src={gig.image || DEFAULT_GIG_IMAGE}
                          alt={gig.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = DEFAULT_GIG_IMAGE;
                          }}
                        />
                        {gig.featured && (
                          <span className="absolute top-2.5 left-2.5 px-2 py-0.5 bg-[#2E258E] text-white text-[10px] font-bold rounded tracking-wider uppercase">
                            Pro
                          </span>
                        )}
                        <span className="absolute bottom-2.5 right-2.5 px-2 py-0.5 bg-black/70 backdrop-blur-xs text-white text-[10px] font-bold rounded">
                          {gig.deliveryDays || 3}d delivery
                        </span>
                      </div>

                      {/* Content */}
                      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                        {/* Seller row */}
                        <div className="flex items-center gap-2">
                          <img
                            src={profileUser.avatar || DEFAULT_AVATAR}
                            alt={profileUser.name}
                            className="w-6 h-6 rounded-full object-cover border border-[#E4E5E7]"
                          />
                          <span className="text-[14px] font-bold text-[#222325] truncate">
                            {profileUser.name}
                          </span>
                          <span className="text-[11px] font-semibold text-[#74767E]">Level 2</span>
                        </div>

                        {/* Title: 16px hover green */}
                        <h4 className="text-[16px] text-[#222325] group-hover:text-[#1DBF73] font-normal leading-snug line-clamp-2 transition-colors">
                          {gig.title.toLowerCase().startsWith('i will') ? gig.title : `I will ${gig.title}`}
                        </h4>

                        {/* Rating Row */}
                        <div className="flex items-center gap-1.5 text-[14px]">
                          <Star className="w-4 h-4 fill-[#222325] text-[#222325]" />
                          <span className="font-bold text-[#222325]">{gig.rating || 5.0}</span>
                          <span className="text-[#74767E]">({gig.reviewsCount || 12})</span>
                        </div>

                        {/* Pricing Footer */}
                        <div className="pt-3 border-t border-[#E4E5E7] flex items-center justify-between">
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1DBF73]">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>100% Escrow</span>
                          </span>
                          <div className="text-right">
                            <span className="text-[10px] font-extrabold uppercase text-[#74767E] block leading-none">
                              From
                            </span>
                            <span className="text-[18px] font-bold text-[#222325]">
                              ${gig.price}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: REVIEWS */}
          {activeTab === 'reviews' && (
            <div className="bg-white border border-[#E4E5E7] rounded-xl p-6 sm:p-8 shadow-xs">
              <h2 className="text-[20px] font-bold text-[#222325] mb-6">
                Reviews as Seller
              </h2>
              <Reviews
                allReviews={userReviews}
                targetUser={profileUser}
                currentUser={currentUser}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
