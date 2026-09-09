import { useEffect, useRef } from 'react';
import { cn } from '@/utils/cn';

interface StrokeWidthPickerProps {
  value: number;
  onChange: (width: number) => void;
}

export function StrokeWidthPicker({ value, onChange }: StrokeWidthPickerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        // Don't close on outside click for this component
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const widths = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24];

  return (
    <div ref={ref} className="absolute left-full top-0 ml-2 p-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 animate-scale-in z-30 w-32">
      <div className="space-y-1">
        {widths.map((width) => (
          <button
            key={width}
            onClick={() => onChange(width)}
            className={cn(
              'w-full h-8 rounded-lg transition-all duration-150 flex items-center gap-2 px-2',
              value === width ? 'bg-primary-100 dark:bg-primary-900/30' : 'hover:bg-gray-100 dark:hover:bg-gray-700'
            )}
          >
            <div 
              className="flex-1 h-1.5 rounded" 
              style={{ backgroundColor: value === width ? '#2563eb' : '#374151' }}
            />
            <span className="text-xs text-gray-600 dark:text-gray-400 w-6 text-right">{width}px</span>
          </button>
        ))}
      </div>
    </div>
  );
}