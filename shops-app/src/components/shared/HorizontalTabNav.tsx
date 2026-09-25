"use client";

import React, { useState } from 'react';
import { Menu, Leaf, Bookmark, User, Clock } from 'lucide-react';

interface TabItem {
  id: string;
  icon: React.ReactNode;
  label: string;
}

interface HorizontalTabNavProps {
  tabs: TabItem[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
}

export const HorizontalTabNav: React.FC<HorizontalTabNavProps> = ({
  tabs,
  activeTab = tabs[0]?.id,
  onTabChange,
}) => {
  const [active, setActive] = useState(activeTab);

  const handleTabChange = (tabId: string) => {
    setActive(tabId);
    onTabChange?.(tabId);
  };

  return (
    <div className="flex flex-col items-center gap-8 py-12">
      {/* Tab Navigation Bar */}
      <div className="relative w-full max-w-2xl">
        {/* White bar background */}
        <div className="bg-white rounded-full shadow-lg p-6 flex items-center justify-between">
          {tabs.map((tab, index) => {
            const isActive = active === tab.id;
            const isCenter = index === Math.floor(tabs.length / 2);

            return (
              <div
                key={tab.id}
                className="flex flex-col items-center gap-4 flex-1"
              >
                {/* Icon button */}
                <button
                  onClick={() => handleTabChange(tab.id)}
                  className={`relative flex items-center justify-center transition-all duration-300 ${
                    isCenter
                      ? 'w-20 h-20 -mt-12'
                      : 'w-12 h-12'
                  }`}
                >
                  {/* Green circle for center active tab */}
                  {isActive && isCenter && (
                    <div className="absolute inset-0 bg-emerald-600 rounded-full shadow-lg flex items-center justify-center">
                      {typeof tab.icon === 'string' ? (
                        <span className="text-white text-2xl">{tab.icon}</span>
                      ) : (
                        <div className="text-white scale-150">{tab.icon}</div>
                      )}
                    </div>
                  )}

                  {/* Regular icon for non-center tabs */}
                  {!(isActive && isCenter) && (
                    <div
                      className={`transition-colors duration-300 ${
                        isActive ? 'text-emerald-600' : 'text-gray-400'
                      }`}
                    >
                      {typeof tab.icon === 'string' ? (
                        <span className="text-xl">{tab.icon}</span>
                      ) : (
                        tab.icon
                      )}
                    </div>
                  )}
                </button>

                {/* Active indicator dot */}
                {isActive && (
                  <div className="w-2 h-2 bg-emerald-600 rounded-full"></div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// Example usage component
export const HorizontalTabNavExample: React.FC = () => {
  const [activeTab, setActiveTab] = useState('organic');

  const tabs = [
    { id: 'list', icon: <Menu className="w-6 h-6" /> },
    { id: 'organic', icon: <Leaf className="w-6 h-6" /> },
    { id: 'bookmark', icon: <Bookmark className="w-6 h-6" /> },
    { id: 'user', icon: <User className="w-6 h-6" /> },
    { id: 'time', icon: <Clock className="w-6 h-6" /> },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <HorizontalTabNav
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
      <div className="text-center mt-8">
        <p className="text-gray-600">Active Tab: <span className="font-bold text-emerald-600">{activeTab}</span></p>
      </div>
    </div>
  );
};
