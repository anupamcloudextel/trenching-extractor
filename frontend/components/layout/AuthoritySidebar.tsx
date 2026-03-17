import { authorities } from "@/constants/authorities";
import { Home, Building2, Landmark, Factory, Settings, Waves, ChevronLeft, ChevronRight, BarChart3, FileSpreadsheet, Zap, Database, Sparkles } from "lucide-react";
import React, { useState } from "react";

const authorityIcons: Record<string, React.ReactNode> = {
  kdmc: <Landmark className="h-5 w-5" />,
  mbmc: <Building2 className="h-5 w-5" />,
  mcgm: <Home className="h-5 w-5" />,
  "midc-type1": <Factory className="h-5 w-5" />,
  "midc-type2": <Settings className="h-5 w-5" />,
  nmmc: <Waves className="h-5 w-5" />,
};

export function AuthoritySidebar({ selected, onSelect }: { selected: string; onSelect: (id: string) => void }) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (    <aside 
      className={`h-screen bg-[#1d2636] flex flex-col py-6 transition-all duration-300 border-r border-[#232f47] fixed top-0 left-0 z-40 ${
        isCollapsed ? "w-20" : "w-64"
      }`}
    >
      <div className={`mb-6 flex items-center ${isCollapsed ? "justify-center px-2" : "justify-between px-4"}`}>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#232f47] rounded-lg">
            <Home className="h-6 w-6 text-white" />
          </div>
          {!isCollapsed && (
            <div>
              <div className="text-lg font-bold text-white font-inter">CloudExtel</div>
              <div className="text-xs text-gray-400 font-inter"> DN Parser</div>
            </div>
          )}
        </div>
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-[#232f47]/60 transition-colors"
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
        </button>
      </div>

      {/* Budget Approvals Section - moved above authorities */}
      {!isCollapsed && (
        <>
          <div className="uppercase text-xs text-purple-300 font-semibold tracking-widest mb-2 px-4 mt-2">
            Budget Approvals
          </div>
          <nav className="flex flex-col gap-1 px-2 mb-4">
            {/* Data Management Tab */}
            <button
              className={`flex items-center w-full px-3 py-2 rounded-lg font-inter text-sm transition-colors ${
                selected === 'data-management' ? "bg-[#232f47] text-white font-semibold" : "text-gray-300 hover:bg-[#232f47]/60"
              }`}
              onClick={() => onSelect('data-management')}
              title="Data Management"
            >
              <Database className="h-5 w-5" />
              {!isCollapsed && <span className="ml-2">Data Management</span>}
            </button>
            <button
              className={`flex items-center w-full px-3 py-2 rounded-lg font-inter text-sm transition-colors ${
                selected === 'budget-lmc' ? "bg-[#232f47] text-white font-semibold" : "text-gray-300 hover:bg-[#232f47]/60"
              }`}
              onClick={() => onSelect('budget-lmc')}
              title="LMC Analysis"
            >
              <Settings className="h-5 w-5" />
              {!isCollapsed && <span className="ml-2">LMC Analysis</span>}
            </button>
            {/* Master Tracker Tab */}
            <button
              className={`flex items-center w-full px-3 py-2 rounded-lg font-inter text-sm transition-colors ${
                selected === 'master-tracker' ? "bg-[#232f47] text-white font-semibold" : "text-gray-300 hover:bg-[#232f47]/60"
              }`}
              onClick={() => onSelect('master-tracker')}
              title="Master Tracker"
            >
              <Factory className="h-5 w-5" />
              {!isCollapsed && <span className="ml-2">Master Tracker</span>}
            </button>
            <button
              className={`flex items-center w-full px-3 py-2 rounded-lg font-inter text-sm transition-colors ${
                selected === 'route-overview' ? "bg-[#232f47] text-white font-semibold" : "text-gray-300 hover:bg-[#232f47]/60"
              }`}
              onClick={() => onSelect('route-overview')}
              title="Route Analysis"
            >
              <Zap className="h-5 w-5" />
              {!isCollapsed && <span className="ml-2">Route Analysis</span>}
            </button>
          </nav>
        </>
      )}

      {!isCollapsed && (
        <div className="uppercase text-xs text-gray-400 font-semibold tracking-widest mb-2 px-4">
          Authorities
        </div>
      )}
      <nav className="flex-1 flex flex-col gap-1 px-2">
        {authorities.map((auth) => (
          <button
            key={auth.id}
            onClick={() => onSelect(auth.id)}
            className={`flex items-center ${isCollapsed ? "justify-center" : ""} w-full px-3 py-2 rounded-lg font-inter text-sm transition-colors
              ${selected === auth.id ? "bg-[#232f47] text-white font-semibold" : "text-gray-300 hover:bg-[#232f47]/60"}`}
            title={isCollapsed ? auth.name : ""}
          >
            {authorityIcons[auth.id] || <Landmark className="h-5 w-5" />}
            {!isCollapsed && <span className="ml-2">{auth.name}</span>}
          </button>
        ))}
      </nav>

      {/* Client Parser V2 Section - below authorities */}
      {!isCollapsed && (
        <>
          <div className="uppercase text-xs text-purple-300 font-semibold tracking-widest mb-2 px-4 mt-4">
            Advanced Tools
          </div>
          <nav className="flex flex-col gap-1 px-2 mb-4">
            <button
              className={`flex items-center w-full px-3 py-2 rounded-lg font-inter text-sm transition-colors ${
                selected === 'client-parser-v2' ? "bg-[#232f47] text-white font-semibold" : "text-gray-300 hover:bg-[#232f47]/60"
              }`}
              onClick={() => onSelect('client-parser-v2')}
              title="Client Parser V2"
            >
              <Sparkles className="h-5 w-5" />
              {!isCollapsed && <span className="ml-2">Client Parser V2</span>}
            </button>
          </nav>
        </>
      )}
    </aside>
  );
}