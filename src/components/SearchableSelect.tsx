"use client";

import { useState, useRef, useEffect } from "react";
import { Search, ChevronDown, Check } from "lucide-react";

interface Option {
  id: string;
  label: string;
  sku?: string;
}

interface SearchableSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  name?: string;
}

export default function SearchableSelect({ options, value, onChange, placeholder = "Pilih...", name }: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.id === value);
  
  const filteredOptions = options.filter((opt) => 
    opt.label.toLowerCase().includes(search.toLowerCase()) || 
    (opt.sku && opt.sku.toLowerCase().includes(search.toLowerCase()))
  );

  // Tutup dropdown kalau klik di luar area
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative w-full" ref={dropdownRef}>
      {/* Hidden input untuk form submission */}
      <input type="hidden" name={name} value={value} required />

      {/* Trigger Button */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-white/50 border border-white/40 rounded-xl px-4 py-2.5 flex items-center justify-between cursor-pointer hover:bg-white/70 transition-all focus-within:ring-2 focus-within:ring-blue-500"
      >
        <span className={`text-sm ${selectedOption ? 'text-slate-800 font-medium' : 'text-slate-500'}`}>
          {selectedOption ? (
            selectedOption.sku ? `[${selectedOption.sku}] ${selectedOption.label}` : selectedOption.label
          ) : placeholder}
        </span>
        <ChevronDown size={16} className={`text-slate-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {/* Dropdown Menu dengan animasi smooth */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white/80 backdrop-blur-xl border border-white/50 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="p-2 border-b border-slate-200/50 relative">
            <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              autoFocus
              placeholder="Ketik untuk mencari..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-100/50 rounded-lg pl-8 pr-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          
          <div className="max-h-60 overflow-y-auto p-1 custom-scrollbar">
            {filteredOptions.length === 0 ? (
              <div className="p-3 text-center text-sm text-slate-500">Barang tidak ditemukan</div>
            ) : (
              filteredOptions.map((opt) => (
                <div 
                  key={opt.id}
                  onClick={() => {
                    onChange(opt.id);
                    setIsOpen(false);
                    setSearch("");
                  }}
                  className={`flex items-center justify-between px-3 py-2 text-sm rounded-lg cursor-pointer transition-colors ${
                    value === opt.id ? 'bg-blue-100 text-blue-700 font-medium' : 'hover:bg-slate-100/80 text-slate-700'
                  }`}
                >
                  <span>{opt.sku ? `[${opt.sku}] ` : ''}{opt.label}</span>
                  {value === opt.id && <Check size={14} className="text-blue-600" />}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}