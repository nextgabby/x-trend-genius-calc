'use client';

import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export default function Card({ children, className = '' }: CardProps) {
  return (
    <div className={`bg-x-darkgray border border-x-border rounded-2xl p-6 ${className}`}>
      {children}
    </div>
  );
}
