import React from 'react';

interface Step {
  key: string;
  number: string;
  title: string;
}

interface StepIndicatorProps {
  steps: Step[];
  currentStep: string;
}

const StepIndicator: React.FC<StepIndicatorProps> = ({ steps, currentStep }) => {
  const currentIndex = steps.findIndex((s) => s.key === currentStep);

  return (
    <div>
      {/* Mobile View - Simplified */}
      <div className="md:hidden">
        <div className="flex items-center justify-center mb-4">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold mx-auto mb-2">
              {currentIndex + 1}
            </div>
            <p className="text-sm font-semibold text-gray-900">{steps[currentIndex]?.title}</p>
            <p className="text-xs text-gray-500">{currentIndex + 1} of {steps.length}</p>
          </div>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Desktop View - Full Steps */}
      <div className="hidden md:flex items-center justify-between">
        {steps.map((step, idx) => (
          <div key={step.key} className="flex items-center flex-1">
            {/* Step Circle */}
            <div className="flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition ${
                  idx <= currentIndex
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                {step.number}
              </div>
              <p
                className={`text-xs font-semibold mt-2 text-center max-w-[80px] ${
                  idx <= currentIndex ? 'text-gray-900' : 'text-gray-400'
                }`}
              >
                {step.title}
              </p>
            </div>

            {/* Connector Line */}
            {idx < steps.length - 1 && (
              <div
                className={`flex-1 h-1 mx-2 transition ${
                  idx < currentIndex ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default StepIndicator;
