'use client';

import { useWizard } from '@/context/WizardContext';
import StepIndicator from './StepIndicator';
import InputStep from './InputStep';
import KeywordAnalysisStep from './KeywordAnalysisStep';
import DataCollectionStep from './DataCollectionStep';
import ThresholdAnalysisStep from './ThresholdAnalysisStep';
import ResultsStep from './ResultsStep';

const STEP_COMPONENTS = [
  InputStep,
  KeywordAnalysisStep,
  DataCollectionStep,
  ThresholdAnalysisStep,
  ResultsStep,
];

export default function WizardContainer() {
  const { currentStep } = useWizard();
  const StepComponent = STEP_COMPONENTS[currentStep];

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-8">
      <StepIndicator currentStep={currentStep} />
      <StepComponent />
    </div>
  );
}
