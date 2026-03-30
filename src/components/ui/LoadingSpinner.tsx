'use client';

interface LoadingSpinnerProps {
  message?: string;
}

export default function LoadingSpinner({ message = 'Loading...' }: LoadingSpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-4">
      <div className="relative w-12 h-12">
        <div className="absolute inset-0 border-4 border-x-border rounded-full" />
        <div className="absolute inset-0 border-4 border-transparent border-t-x-blue rounded-full animate-spin" />
      </div>
      <p className="text-x-gray text-sm">{message}</p>
    </div>
  );
}
