'use client';

import React, { useRef } from 'react';
import { Calendar } from 'lucide-react';

interface DatePickerInputProps {
  value: string; // ISO YYYY-MM-DD string
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  min?: string;
  max?: string;
  placeholder?: string;
  required?: boolean;
  id?: string;
  name?: string;
}

export default function DatePickerInput({
  value,
  onChange,
  className = '',
  disabled = false,
  min,
  max,
  placeholder = 'Select Date',
  required = false,
  id,
  name,
}: DatePickerInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleCalendarClick = () => {
    if (disabled) return;
    if (inputRef.current) {
      if ('showPicker' in inputRef.current && typeof inputRef.current.showPicker === 'function') {
        try {
          inputRef.current.showPicker();
        } catch (e) {
          inputRef.current.focus();
        }
      } else {
        inputRef.current.focus();
      }
    }
  };

  return (
    <div className={`relative flex items-center w-full ${className}`}>
      <input
        ref={inputRef}
        type="date"
        id={id}
        name={name}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        min={min}
        max={max}
        required={required}
        aria-label={placeholder}
        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 text-sm font-semibold shadow-xs focus:outline-none focus:border-[#2E5BFF] focus:ring-2 focus:ring-[#2E5BFF]/20 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={handleCalendarClick}
        disabled={disabled}
        className="absolute right-3 p-1 text-slate-400 hover:text-[#2E5BFF] cursor-pointer disabled:cursor-not-allowed"
      >
        <Calendar className="w-4 h-4 shrink-0" />
      </button>
    </div>
  );
}
