'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import type {
  WizardState,
  CampaignInput,
  KeywordAnalysisResult,
  CountsResponse,
  ThresholdRecommendation,
} from '@/lib/types';

interface WizardContextValue extends WizardState {
  setCampaignInput: (input: CampaignInput) => void;
  setKeywordAnalysis: (result: KeywordAnalysisResult) => void;
  setApprovedQuery: (query: string) => void;
  setCountsData: (data: CountsResponse) => void;
  setThresholdRecommendation: (rec: ThresholdRecommendation) => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  goToStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  reset: () => void;
}

const initialState: WizardState = {
  currentStep: 0,
  campaignInput: {
    handle: '',
    campaignStartDate: '',
    campaignEndDate: '',
    keywords: [],
    totalBudget: 0,
    useExactKeywords: false,
  },
  keywordAnalysis: null,
  approvedQuery: '',
  countsData: null,
  thresholdRecommendation: null,
  isLoading: false,
  error: null,
};

const WizardContext = createContext<WizardContextValue | null>(null);

export function WizardProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<WizardState>(initialState);

  const setCampaignInput = useCallback((input: CampaignInput) => {
    setState((prev) => ({ ...prev, campaignInput: input }));
  }, []);

  const setKeywordAnalysis = useCallback((result: KeywordAnalysisResult) => {
    setState((prev) => ({ ...prev, keywordAnalysis: result }));
  }, []);

  const setApprovedQuery = useCallback((query: string) => {
    setState((prev) => ({ ...prev, approvedQuery: query }));
  }, []);

  const setCountsData = useCallback((data: CountsResponse) => {
    setState((prev) => ({ ...prev, countsData: data }));
  }, []);

  const setThresholdRecommendation = useCallback((rec: ThresholdRecommendation) => {
    setState((prev) => ({ ...prev, thresholdRecommendation: rec }));
  }, []);

  const setIsLoading = useCallback((loading: boolean) => {
    setState((prev) => ({ ...prev, isLoading: loading }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setState((prev) => ({ ...prev, error }));
  }, []);

  const goToStep = useCallback((step: number) => {
    setState((prev) => ({ ...prev, currentStep: step, error: null }));
  }, []);

  const nextStep = useCallback(() => {
    setState((prev) => ({ ...prev, currentStep: Math.min(prev.currentStep + 1, 4), error: null }));
  }, []);

  const prevStep = useCallback(() => {
    setState((prev) => ({ ...prev, currentStep: Math.max(prev.currentStep - 1, 0), error: null }));
  }, []);

  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  return (
    <WizardContext.Provider
      value={{
        ...state,
        setCampaignInput,
        setKeywordAnalysis,
        setApprovedQuery,
        setCountsData,
        setThresholdRecommendation,
        setIsLoading,
        setError,
        goToStep,
        nextStep,
        prevStep,
        reset,
      }}
    >
      {children}
    </WizardContext.Provider>
  );
}

export function useWizard(): WizardContextValue {
  const context = useContext(WizardContext);
  if (!context) {
    throw new Error('useWizard must be used within a WizardProvider');
  }
  return context;
}
