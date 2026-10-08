import React from 'react';
import { Loader2, AlertCircle, Inbox } from 'lucide-react';

export const LoadingState: React.FC<{ message?: string }> = ({ 
  message = 'Loading technical telemetry...' 
}) => (
  <div className="flex flex-col items-center justify-center p-8 space-y-3 text-[#8FA0BF]">
    <Loader2 className="w-6 h-6 animate-spin text-[#0E7C86]" />
    <span className="font-mono text-xs tracking-wider">{message}</span>
  </div>
);

export const EmptyState: React.FC<{ title: string; description?: string }> = ({
  title,
  description,
}) => (
  <div className="flex flex-col items-center justify-center p-8 space-y-2 text-center text-[#8FA0BF] border border-dashed border-[#22304D] rounded bg-[#0B1220]/40">
    <Inbox className="w-8 h-8 stroke-[1.5] text-[#22304D]" />
    <p className="font-mono text-xs font-semibold text-[#E6EDF7] tracking-wider">{title}</p>
    {description && <p className="text-xs max-w-sm">{description}</p>}
  </div>
);

export const ErrorState: React.FC<{ message: string; onRetry?: () => void }> = ({
  message,
  onRetry,
}) => (
  <div className="p-4 bg-[#EF4444]/10 border border-[#EF4444]/40 rounded text-xs space-y-2">
    <div className="flex items-center gap-2 text-[#EF4444] font-mono font-semibold">
      <AlertCircle className="w-4 h-4" />
      <span>TELEMETRY / GATEWAY ERROR</span>
    </div>
    <p className="text-[#E6EDF7] font-mono">{message}</p>
    {onRetry && (
      <button
        onClick={onRetry}
        className="px-3 py-1 bg-[#16223B] border border-[#22304D] text-[#8FA0BF] hover:text-[#E6EDF7] rounded font-mono text-xs transition-colors"
      >
        RETRY CONNECTION
      </button>
    )}
  </div>
);
