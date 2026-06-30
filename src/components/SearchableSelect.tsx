"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
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
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});

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

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPanelStyle({
        position: "fixed",
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        zIndex: 9999,
      });
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const update = () => {
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        setPanelStyle({
          position: "fixed",
          top: rect.bottom + 4,
          left: rect.left,
          width: rect.width,
          zIndex: 9999,
        });
      }
    };
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [isOpen]);

  const filteredOptions = options.filter(opt =>
    opt.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (opt.sku && opt.sku.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const dropdownPanel = isOpen && (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto" style={panelStyle}>
      <div className="p-2 sticky top-0 bg-white">
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
  );

  return (
    <div className={`relative ${className}`} ref={wrapperRef}>
      <input type="hidden" name={name} value={value} />
      <button ref={buttonRef} type="button" onClick={() => setIsOpen(!isOpen)} className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-left bg-white focus:ring-2 focus:ring-emerald-500 outline-none text-sm flex justify-between items-center">
        {selectedOption ? `[${selectedOption.sku}] ${selectedOption.label}` : <span className="text-slate-400">{placeholder}</span>}
        <ChevronDown size={16} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {typeof window !== 'undefined' && createPortal(dropdownPanel, document.body)}
    </div>
  );
}
