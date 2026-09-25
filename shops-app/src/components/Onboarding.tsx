import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';

const SCREENS = [
  {
    image: '/discover.png',
    headline: 'Discover Products Near You',
    description: 'Browse thousands of products from local sellers and shops.',
  },
  {
    image: '/connect.png',
    headline: 'Find Shops. Compare Products. Connect.',
    description: 'Explore local shops, compare products, and communicate directly with sellers.',
  },
  {
    image: '/buysandsell.png',
    headline: 'Everything Starts Here',
    description: 'Shop for what you need or create your own shop and reach customers.',
  },
];

const STORAGE_KEY = 'onboarding_seen';

export const hasSeenOnboarding = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return true;
  }
};

interface OnboardingProps {
  onComplete: () => void;
}

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [step, setStep] = useState(0);
  const isLast = step === SCREENS.length - 1;

  const finish = () => {
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // ignore
    }
    onComplete();
  };

  const next = () => {
    if (isLast) {
      finish();
    } else {
      setStep((s) => s + 1);
    }
  };

  const screen = SCREENS[step];

  return (
    <div className="fixed inset-0 z-[100] bg-white dark:bg-black flex flex-col">
      <button
        type="button"
        onClick={finish}
        className="text-sm font-semibold text-gray-400 dark:text-neutral-400 hover:text-gray-600 dark:hover:text-neutral-200 transition-colors py-2 px-3"
        style={{
          position: 'fixed',
          top: 'calc(env(safe-area-inset-top, 0px) + 20px)',
          right: 20,
          zIndex: 110,
        }}
      >
        Skip
      </button>

      <div className="flex-1 flex flex-col items-center justify-center px-8 -mt-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.25 }}
            className="flex flex-col items-center text-center w-full max-w-sm"
          >
            <img
              src={screen.image}
              alt=""
              className="w-full max-w-[260px] h-auto mb-10 select-none pointer-events-none"
              draggable={false}
            />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3 leading-snug">
              {screen.headline}
            </h1>
            <p className="text-sm text-gray-500 dark:text-neutral-300 leading-relaxed">
              {screen.description}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="px-8 pb-10">
        <div className="flex items-center justify-center gap-2 mb-8">
          {SCREENS.map((_, idx) => (
            <div
              key={idx}
              className={`h-1.5 rounded-full transition-all ${
                idx === step ? 'w-6' : 'w-1.5 bg-gray-200 dark:bg-neutral-800'
              }`}
              style={idx === step ? { backgroundColor: '#FF9600' } : undefined}
            />
          ))}
        </div>

        <button
          onClick={next}
          className="w-full flex items-center justify-center gap-2 px-8 py-3.5 text-white rounded-full font-semibold transition-all hover:opacity-90"
          style={{ backgroundColor: '#0078E8' }}
        >
          {isLast ? 'Get Started' : 'Next'}
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );
};

export default Onboarding;
