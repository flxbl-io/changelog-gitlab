import React from 'react';

interface ProgressBarProps {
  isLoading: boolean;
}

export default function ProgressBar({ isLoading }: ProgressBarProps) {
  return (
    <div className={`h-1 bg-blue-500 transition-all duration-500 ${isLoading ? 'w-full' : 'w-0'}`}></div>
  );
}