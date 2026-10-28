import React from 'react';
import { ShieldCheck, HelpCircle, Settings, Users, Globe, DollarSign } from 'lucide-react';

interface FooterProps {
  navigate: (to: string, e?: React.MouseEvent) => void;
}

/**
 * Fiverr-styled comprehensive footer with 5 distinct directory columns,
 * localized settings badges, and 100% Escrow buyer protection credentials.
 */
export function Footer({ navigate }: FooterProps) {
  return (
    <footer className="bg-white border-t border-[#E4E5E7] mt-20 pt-16 pb-12 text-[#74767E] text-[14px]">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top Directory Columns */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-8 pb-12 border-b border-[#E4E5E7]">
          {/* Column 1: Categories */}
          <div>
            <h5 className="font-bold text-[#404145] text-[16px] mb-4">Categories</h5>
            <ul className="space-y-3 font-normal">
              <li>
                <a href="/categories/design-creative" onClick={(e) => navigate('/categories/design-creative', e)} className="hover:text-[#1DBF73] transition-colors">
                  Graphics & Design
                </a>
              </li>
              <li>
                <a href="/categories/digital-marketing" onClick={(e) => navigate('/categories/digital-marketing', e)} className="hover:text-[#1DBF73] transition-colors">
                  Digital Marketing
                </a>
              </li>
              <li>
                <a href="/categories/writing-translation" onClick={(e) => navigate('/categories/writing-translation', e)} className="hover:text-[#1DBF73] transition-colors">
                  Writing & Translation
                </a>
              </li>
              <li>
                <a href="/categories/video-animation" onClick={(e) => navigate('/categories/video-animation', e)} className="hover:text-[#1DBF73] transition-colors">
                  Video & Animation
                </a>
              </li>
              <li>
                <a href="/categories/music-audio" onClick={(e) => navigate('/categories/music-audio', e)} className="hover:text-[#1DBF73] transition-colors">
                  Music & Audio
                </a>
              </li>
              <li>
                <a href="/categories/technology-programming" onClick={(e) => navigate('/categories/technology-programming', e)} className="hover:text-[#1DBF73] transition-colors">
                  Programming & Tech
                </a>
              </li>
              <li>
                <a href="/categories/ai-services" onClick={(e) => navigate('/categories/ai-services', e)} className="hover:text-[#1DBF73] transition-colors">
                  AI Services
                </a>
              </li>
            </ul>
          </div>

          {/* Column 2: About */}
          <div>
            <h5 className="font-bold text-[#404145] text-[16px] mb-4">About</h5>
            <ul className="space-y-3 font-normal">
              <li>
                <button onClick={(e) => navigate('/support', e)} className="hover:text-[#1DBF73] transition-colors text-left cursor-pointer">
                  Careers
                </button>
              </li>
              <li>
                <button onClick={(e) => navigate('/support', e)} className="hover:text-[#1DBF73] transition-colors text-left cursor-pointer">
                  Press & News
                </button>
              </li>
              <li>
                <button onClick={(e) => navigate('/support', e)} className="hover:text-[#1DBF73] transition-colors text-left cursor-pointer">
                  Partnerships
                </button>
              </li>
              <li>
                <button onClick={(e) => navigate('/support', e)} className="hover:text-[#1DBF73] transition-colors text-left cursor-pointer">
                  Privacy Policy
                </button>
              </li>
              <li>
                <button onClick={(e) => navigate('/support', e)} className="hover:text-[#1DBF73] transition-colors text-left cursor-pointer">
                  Terms of Service
                </button>
              </li>
              <li>
                <button onClick={(e) => navigate('/support', e)} className="hover:text-[#1DBF73] transition-colors text-left cursor-pointer">
                  Intellectual Property
                </button>
              </li>
            </ul>
          </div>

          {/* Column 3: Support & Education */}
          <div>
            <h5 className="font-bold text-[#404145] text-[16px] mb-4">Support & Education</h5>
            <ul className="space-y-3 font-normal">
              <li>
                <button onClick={(e) => navigate('/support', e)} className="hover:text-[#1DBF73] transition-colors text-left inline-flex items-center gap-1.5 cursor-pointer">
                  <HelpCircle className="w-4 h-4 text-[#1DBF73]" />
                  <span>Help & Support</span>
                </button>
              </li>
              <li>
                <button onClick={(e) => navigate('/support', e)} className="hover:text-[#1DBF73] transition-colors text-left cursor-pointer">
                  Trust & Safety
                </button>
              </li>
              <li>
                <a href="/gigs" onClick={(e) => navigate('/gigs', e)} className="hover:text-[#1DBF73] transition-colors">
                  Selling on WorkPerHour
                </a>
              </li>
              <li>
                <a href="/projects" onClick={(e) => navigate('/projects', e)} className="hover:text-[#1DBF73] transition-colors">
                  Buying on WorkPerHour
                </a>
              </li>
              <li>
                <span className="inline-flex items-center gap-1.5 text-[#1DBF73] font-semibold">
                  <ShieldCheck className="w-4 h-4" />
                  <span>100% Escrow Guarantee</span>
                </span>
              </li>
            </ul>
          </div>

          {/* Column 4: Community */}
          <div>
            <h5 className="font-bold text-[#404145] text-[16px] mb-4">Community</h5>
            <ul className="space-y-3 font-normal">
              <li>
                <button onClick={(e) => navigate('/support', e)} className="hover:text-[#1DBF73] transition-colors text-left cursor-pointer">
                  Customer Success Stories
                </button>
              </li>
              <li>
                <button onClick={(e) => navigate('/support', e)} className="hover:text-[#1DBF73] transition-colors text-left cursor-pointer">
                  Community Hub
                </button>
              </li>
              <li>
                <button onClick={(e) => navigate('/support', e)} className="hover:text-[#1DBF73] transition-colors text-left cursor-pointer">
                  Forum & Discussions
                </button>
              </li>
              <li>
                <button onClick={(e) => navigate('/support', e)} className="hover:text-[#1DBF73] transition-colors text-left cursor-pointer">
                  Events & Meetups
                </button>
              </li>
              <li>
                <button onClick={(e) => navigate('/support', e)} className="hover:text-[#1DBF73] transition-colors text-left cursor-pointer">
                  Creator Blog
                </button>
              </li>
            </ul>
          </div>

          {/* Column 5: Business Solutions & Operations */}
          <div>
            <h5 className="font-bold text-[#404145] text-[16px] mb-4">Business Solutions</h5>
            <ul className="space-y-3 font-normal">
              <li>
                <span className="inline-flex items-center gap-1.5 text-[#2E258E] font-semibold text-xs bg-[#F0EFFF] px-2 py-0.5 rounded">
                  PRO
                  <span className="text-[#404145] font-normal text-sm">WorkPerHour Pro</span>
                </span>
              </li>
              <li>
                <a href="/projects" onClick={(e) => navigate('/projects', e)} className="hover:text-[#1DBF73] transition-colors">
                  Project Workspace
                </a>
              </li>
              <li>
                <button onClick={(e) => navigate('/switch-user', e)} className="hover:text-[#1DBF73] transition-colors text-left inline-flex items-center gap-1.5 cursor-pointer">
                  <Users className="w-4 h-4 text-[#1DBF73]" />
                  <span>Switch Role / User</span>
                </button>
              </li>
              <li>
                <a href="/admin" onClick={(e) => navigate('/admin', e)} className="hover:text-[#1DBF73] transition-colors inline-flex items-center gap-1.5">
                  <Settings className="w-4 h-4 text-[#1DBF73]" />
                  <span>Admin Console</span>
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar: Logo, Copyright & Currency */}
        <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4 text-center md:text-left">
            <a href="/gigs" onClick={(e) => navigate('/gigs', e)} className="inline-flex items-center font-black tracking-tight text-[22px] text-[#222325]">
              WorkPerHour<span className="text-[#1DBF73]">.</span>
            </a>
            <span className="text-xs text-[#74767E]">
              © 2026 WorkPerHour International Ltd. All rights reserved.
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs font-semibold text-[#74767E]">
            <div className="flex items-center gap-1 cursor-pointer hover:text-[#222325] transition-colors">
              <Globe className="w-4 h-4" />
              <span>English</span>
            </div>
            <div className="flex items-center gap-1 cursor-pointer hover:text-[#222325] transition-colors">
              <DollarSign className="w-4 h-4" />
              <span>USD ($)</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#F7F7F7] border border-[#E4E5E7] text-[#404145]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#1DBF73]" />
              <span>100% Escrow Protected</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
