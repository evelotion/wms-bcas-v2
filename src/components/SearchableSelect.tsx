"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown } from "lucide-react";

type Option = {
  id: string;
  label: string;
  sku?: string;
};

interface SearchableSelectProps {
  name: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}

export default function SearchableSelect({ name, options, value, onChange, placeholder, className }: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(opt => opt.id === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  const filteredOptions = options.filter(opt =>
    opt.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (opt.sku && opt.sku.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className={`relative ${className}`} ref={wrapperRef}>
      <input type="hidden" name={name} value={value} />
      <button type="button" onClick={() => setIsOpen(!isOpen)} className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-left bg-white focus:ring-2 focus:ring-emerald-500 outline-none text-sm flex justify-between items-center">
        {selectedOption ? `[${selectedOption.sku}] ${selectedOption.label}` : <span className="text-slate-400">{placeholder}</span>}
        <ChevronDown size={16} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
          <div className="p-2">
            <input
              type="text"
              placeholder="Cari..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          {filteredOptions.map(opt => (
            <div
              key={opt.id}
              onClick={() => { onChange(opt.id); setIsOpen(false); setSearchTerm(''); }}
              className="px-4 py-2 hover:bg-emerald-50 cursor-pointer text-sm"
            >
              {`[${opt.sku}] ${opt.label}`}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}