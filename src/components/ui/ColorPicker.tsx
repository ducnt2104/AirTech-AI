import { useEffect, useRef } from 'react';
import { X, Check } from 'lucide-react';
import { cn } from '@/utils/cn';

interface ColorPickerProps {
  colors: string[];
  selected: string;
  onSelect: (color: string) => void;
}

export function ColorPicker({ colors, selected, onSelect }: ColorPickerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onSelect(selected);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selected, onSelect]);

  return (
    <div ref={ref} className="absolute left-full top-0 ml-2 p-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 animate-scale-in z-30">
      <div className="grid grid-cols-6 gap-1">
        {colors.map((color) => (
          <button
            key={color}
            onClick={() => onSelect(color)}
            className={cn(
              'w-8 h-8 rounded border-2 transition-all duration-150',
              color === '#ffffff' ? 'border-gray-300 dark:border-gray-600' : 'border-transparent',
              selected === color ? 'scale-110 ring-2 ring-primary-500' : 'hover:scale-105'
            )}
            style={{ backgroundColor: color }}
            title={color}
          >
            {selected === color && <Check className="w-4 h-4 text-white" />}
          </button>
        ))}
      </div>
    </div>
  );
}