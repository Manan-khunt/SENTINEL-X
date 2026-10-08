import React from 'react';
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';

interface FeedbackStatesProps {
  message?: string;
  onRetry?: () => void;
}

export const LoadingState: React.FC<FeedbackStatesProps> = ({ message = 'Loading...' }) => {
  return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-[#0B1220] text-[#8FA0BF] font-mono text-xs select-none">
      <Loader2 className="w-8 h-8 text-[#0E7C86] animate-spin mb-3" />
      <span>{message}</span>
    </div>
  );
};

export const ErrorState: React.FC<FeedbackStatesProps> = ({ message = 'Something went wrong.', onRetry }) => {
  return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-[#0B1220] text-[#8FA0BF] font-mono text-xs select-none p-4 text-center">
      <div className="p-3 rounded-full bg-[#EF4444]/15 border border-[#EF4444]/40 mb-3">
        <AlertTriangle className="w-8 h-8 text-[#EF4444]" />
      </div>
      <span className="text-[#E6EDF7] font-semibold mb-1">CONNECTION ERROR</span>
      <span className="text-[11px] text-[#8FA0BF] mb-4 max-w-xs">{message}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#16223B] hover:bg-[#1f3054] border border-[#22304D] text-[#E6EDF7] text-[11px] font-mono transition-colors"
        >
          <RefreshCw className="w-3 h-3" />
          RETRY
        </button>
      )}
    </div>
  );
};

export const EmptyState: React.FC<FeedbackStatesProps> = ({ message = 'No data available.' }) => {
  return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-[#0B1220] text-[#8FA0BF] font-mono text-xs select-none p-4 text-center">
      <span className="text-[#E6EDF7] font-semibold mb-1">NO RECORDS</span>
      <span className="text-[11px] text-[#8FA0BF]">{message}</span>
    </div>
  );
};

export default { LoadingState, ErrorState, EmptyState };