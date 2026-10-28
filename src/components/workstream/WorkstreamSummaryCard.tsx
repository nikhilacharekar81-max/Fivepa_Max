import React from 'react';
import { 
  ShieldCheck, Calendar, DollarSign, User, CheckCircle2, 
  Briefcase, Clock, Lock, ArrowUpRight
} from 'lucide-react';
import { WorkstreamItem } from './types';
import { UserAccount } from '../../types';
import { DEFAULT_AVATAR } from '../../constants';

interface WorkstreamSummaryCardProps {
  order: WorkstreamItem;
  partner?: UserAccount;
  currentUser?: UserAccount | null;
  escrowRemaining?: number;
  totalReleased?: number;
  currencySymbol?: string;
  onViewPartnerProfile?: (user: UserAccount) => void;
}

export const WorkstreamSummaryCard: React.FC<WorkstreamSummaryCardProps> = ({
  order,
  partner,
  currentUser,
  escrowRemaining,
  totalReleased,
  currencySymbol = '$',
  onViewPartnerProfile
}) => {
  const isBuyer = currentUser?.id === order.buyerId;
  const activeEscrow = escrowRemaining !== undefined ? escrowRemaining : ((order as any).escrowRemaining ?? (order.status === 'completed' ? 0 : Number(order.amount || 0)));
  const releasedAmt = totalReleased !== undefined ? totalReleased : ((order as any).totalReleased ?? (order.status === 'completed' ? Number(order.amount || 0) : 0));

  return (
    <div className="bg-white border border-[#E4E5E7] rounded-xl p-5 shadow-xs space-y-6">
      {/* FIVERR-STYLE FINANCIAL METRICS CARD */}
      <div className="bg-[#F7F7F7] border border-[#E4E5E7] rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#EBF8F2] text-[#1DBF73] flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-[#1DBF73]" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-[#222325] leading-tight">Escrow Vault</h4>
              <p className="text-[11px] text-[#74767E] mt-0.5">WorkPerHour 100% Protection</p>
            </div>
          </div>
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#EBF8F2] text-[#1DBF73] border border-[#1DBF73]/20">
            {activeEscrow > 0 ? 'Protected' : (releasedAmt > 0 ? 'Released' : 'Deposit Ready')}
          </span>
        </div>

        {/* Financial Breakdown */}
        <div className="bg-white rounded-lg p-3.5 border border-[#E4E5E7] space-y-3">
          <div>
            <div className="text-xs text-[#74767E]">Held in Escrow</div>
            <div className="text-2xl font-bold text-[#222325] mt-0.5 font-mono tabular-nums tracking-tight">
              {currencySymbol}{Number(activeEscrow || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div className="pt-2.5 border-t border-[#E4E5E7] grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-[10px] text-[#74767E] uppercase font-bold tracking-wider block mb-0.5">Released</span>
              <span className="font-mono font-bold text-[#222325] text-sm tabular-nums">{currencySymbol}{Number(releasedAmt || 0).toLocaleString()}</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-[#74767E] uppercase font-bold tracking-wider block mb-0.5">Total Value</span>
              <span className="font-mono font-bold text-[#222325] text-sm tabular-nums">{currencySymbol}{Number(order.amount || 0).toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-[#74767E] font-medium">
          <Lock className="w-3.5 h-3.5 text-[#1DBF73] shrink-0" />
          <span className="leading-snug text-[11px]">
            {activeEscrow > 0
              ? '100% Secured in Fivepa Escrow'
              : releasedAmt > 0
                ? 'Invoice Paid & Released to Seller'
                : 'Awaiting Order Deposit'}
          </span>
        </div>
      </div>

      {/* COLLABORATOR / PARTNER CARD (Fiverr Profile UX) */}
      {partner && (
        <div className="space-y-2 pt-1">
          <span className="text-[11px] font-bold text-[#74767E] uppercase tracking-wider block">
            {isBuyer ? 'Seller' : 'Buyer'}
          </span>
          <div className="flex items-center justify-between p-3 bg-white border border-[#E4E5E7] rounded-lg hover:border-[#1DBF73] transition-colors">
            <div className="flex items-center gap-3">
              <div className="relative">
                <img
                  src={partner.avatar || DEFAULT_AVATAR}
                  alt={partner.name}
                  className="w-10 h-10 rounded-full object-cover border border-[#E4E5E7]"
                  onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_AVATAR; }}
                />
                {partner.kycStatus === 'verified' && (
                  <div className="absolute -bottom-0.5 -right-0.5 bg-[#1DBF73] text-white p-0.5 rounded-full border-2 border-white shadow-2xs" title="Verified User">
                    <CheckCircle2 className="w-2.5 h-2.5" />
                  </div>
                )}
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#222325] flex items-center gap-1">
                  <span>{partner.name}</span>
                </h4>
                <p className="text-[11px] text-[#74767E]">
                  {partner.ActiveRole || (isBuyer ? 'Specialist' : 'Buyer')}
                </p>
              </div>
            </div>
            {onViewPartnerProfile && (
              <button
                onClick={() => onViewPartnerProfile(partner)}
                className="p-2 text-[#74767E] hover:text-[#1DBF73] hover:bg-[#EBF8F2] rounded-lg transition-colors cursor-pointer"
                title="View Full Profile"
              >
                <ArrowUpRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* ORDER METADATA (Fiverr Specification Cards) */}
      <div className="space-y-3 pt-3 border-t border-[#E4E5E7] text-xs">
        <div className="flex items-center justify-between text-[#404145]">
          <span className="flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-[#74767E]" />
            <span>Type</span>
          </span>
          <span className="font-semibold text-[#222325] text-xs">
            {order.type === 'gig' ? 'Gig Order' : 'Project Brief'}
          </span>
        </div>

        <div className="flex items-center justify-between text-[#404145]">
          <span className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#74767E]" />
            <span>Ordered</span>
          </span>
          <span className="font-semibold text-[#222325] font-mono text-[11px]">{order.createdAt}</span>
        </div>

        <div className="flex items-center justify-between text-[#404145]">
          <span className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#74767E]" />
            <span>Order Status</span>
          </span>
          <span className={`font-bold uppercase text-[10px] px-2.5 py-0.5 rounded-full border ${
            order.status === 'completed' ? 'bg-[#EBF8F2] text-[#1DBF73] border-[#1DBF73]/30' :
            order.status === 'delivered' ? 'bg-amber-50 text-amber-800 border-amber-200' :
            order.status === 'revision' ? 'bg-purple-50 text-purple-800 border-purple-200' :
            'bg-blue-50 text-blue-800 border-blue-200'
          }`}>
            {order.status.replace('_', ' ')}
          </span>
        </div>
      </div>
    </div>
  );
};
