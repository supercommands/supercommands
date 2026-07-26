import React from 'react';
import { FiFileText } from 'react-icons/fi';

interface NotesIconProps {
  size?: number | string;
  className?: string;
}

export default function NotesIcon({ size = 16, className = '' }: NotesIconProps) {
  return (
    <FiFileText
      size={typeof size === 'number' ? size : parseInt(String(size), 10) || 16}
      className={`shrink-0 text-neutral-400 ${className}`}
    />
  );
}
