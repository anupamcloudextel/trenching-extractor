import React from "react";

interface MultiSelectProps {
  id?: string;
  options: { label: string; value: string }[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  required?: boolean;
}

export const MultiSelect: React.FC<MultiSelectProps> = ({ id, options, value, onChange, placeholder, required }) => {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  const toggleOption = (val: string) => {
    if (value.includes(val)) {
      onChange(value.filter(v => v !== val));
    } else {
      onChange([...value, val]);
    }
    // Optionally close dropdown after selection (uncomment if desired)
    // setOpen(false);
  };
  const selectedLabels = options.filter(opt => value.includes(opt.value)).map(opt => opt.label);
  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        id={id}
        className="w-full bg-[#1f2937] border border-gray-600 rounded px-4 py-2 text-left text-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[40px]"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {selectedLabels.length > 0 ? selectedLabels.join(", ") : <span className="text-gray-400">{placeholder || "Select..."}</span>}
      </button>
      {open && (
        <div className="absolute z-40 mt-1 w-full bg-[#232a3a] border border-slate-600 rounded shadow-xl max-h-48 overflow-y-auto mb-16">
          {options.length === 0 ? (
            <div className="px-4 py-2 text-slate-400 text-sm">No options</div>
          ) : (
            options.map(opt => (
              <label key={opt.value} className="flex items-center px-4 py-2 cursor-pointer hover:bg-blue-600/10 text-white text-base rounded transition-all">
                <input
                  type="checkbox"
                  checked={value.includes(opt.value)}
                  onChange={() => toggleOption(opt.value)}
                  className="mr-2 accent-blue-500"
                />
                {opt.label}
              </label>
            ))
          )}
        </div>
      )}
    </div>
  );
}; 