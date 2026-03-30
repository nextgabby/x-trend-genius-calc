'use client';

const STEPS = ['Input', 'Keywords', 'Data', 'Thresholds', 'Results'];

interface StepIndicatorProps {
  currentStep: number;
}

export default function StepIndicator({ currentStep }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-1 sm:gap-2 mb-8">
      {STEPS.map((label, index) => (
        <div key={label} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                index < currentStep
                  ? 'bg-x-blue text-white'
                  : index === currentStep
                    ? 'bg-x-blue text-white ring-2 ring-x-blue ring-offset-2 ring-offset-black'
                    : 'bg-x-darkgray text-x-gray border border-x-border'
              }`}
            >
              {index < currentStep ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                index + 1
              )}
            </div>
            <span
              className={`mt-1 text-xs hidden sm:block ${
                index <= currentStep ? 'text-white' : 'text-x-gray'
              }`}
            >
              {label}
            </span>
          </div>
          {index < STEPS.length - 1 && (
            <div
              className={`w-6 sm:w-12 h-0.5 mx-1 ${
                index < currentStep ? 'bg-x-blue' : 'bg-x-border'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}
