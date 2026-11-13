import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronDown } from "lucide-react";

export interface StudioDropdownOption {
  value: string;
  label: string;
  sublabel?: string;
  badge?: string;
  badgeColor?: "emerald" | "sky" | "amber" | "rose" | "violet" | "neutral";
  dotColor?: string;
}

interface StudioDropdownProps {
  value: string;
  options: StudioDropdownOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  direction?: "down" | "up";
  align?: "left" | "right";
  size?: "sm" | "md";
  mono?: boolean;
  className?: string;
  menuWidthClass?: string;
  icon?: React.ReactNode;
}

const BADGE_CLASSES: Record<
  NonNullable<StudioDropdownOption["badgeColor"]>,
  string
> = {
  emerald:
    "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
  sky: "bg-sky-500/12 text-sky-700 dark:text-sky-300 border-sky-500/20",
  amber:
    "bg-amber-500/12 text-amber-700 dark:text-amber-300 border-amber-500/20",
  rose: "bg-rose-500/12 text-rose-700 dark:text-rose-300 border-rose-500/20",
  violet:
    "bg-violet-500/12 text-violet-700 dark:text-violet-300 border-violet-500/20",
  neutral:
    "bg-black/[0.05] dark:bg-white/[0.08] text-[#6E6E73] dark:text-zinc-300 border-transparent",
};

export const StudioDropdown: React.FC<StudioDropdownProps> = ({
  value,
  options,
  onChange,
  placeholder = "Select...",
  direction = "down",
  align = "left",
  size = "sm",
  mono = false,
  className = "",
  menuWidthClass = "min-w-[210px]",
  icon,
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const selected = options.find((o) => o.value === value) || options[0];

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className={`relative inline-flex ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`group w-full inline-flex items-center justify-between gap-2 rounded-[10px] border transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] cursor-pointer select-none active:scale-[0.98] ${
          size === "sm" ? "h-8 px-2.5 text-xs" : "h-9 px-3 text-xs"
        } ${
          open
            ? "bg-white dark:bg-[#1E1E26] border-black/[0.18] dark:border-white/[0.22] shadow-[0_4px_14px_rgba(0,0,0,0.06)] text-[#1D1D1F] dark:text-white"
            : "bg-white/90 dark:bg-[#141419] hover:bg-white dark:hover:bg-[#1B1B22] border-black/[0.08] dark:border-white/[0.09] hover:border-black/[0.15] dark:hover:border-white/[0.16] text-[#1D1D1F] dark:text-zinc-200"
        } ${mono ? "font-mono" : "font-medium"}`}
      >
        <span className="inline-flex items-center gap-1.5 min-w-0 truncate">
          {icon && <span className="shrink-0 opacity-75">{icon}</span>}
          {selected?.dotColor && (
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: selected.dotColor }}
            />
          )}
          <span className="truncate">{selected?.label || placeholder}</span>
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-[#8E8E93] dark:text-zinc-400 shrink-0 transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            open ? "rotate-180 text-[#1D1D1F] dark:text-white" : ""
          }`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{
              opacity: 0,
              scale: 0.95,
              y: direction === "up" ? 6 : -6,
            }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
            }}
            exit={{
              opacity: 0,
              scale: 0.96,
              y: direction === "up" ? 4 : -4,
            }}
            transition={{
              duration: 0.18,
              ease: [0.22, 1, 0.36, 1],
            }}
            className={`absolute z-50 ${menuWidthClass} max-h-64 overflow-y-auto studio-scroll p-1.5 rounded-[14px] bg-white/96 dark:bg-[#18181F]/96 backdrop-blur-2xl border border-black/[0.09] dark:border-white/[0.11] shadow-[0_16px_42px_-8px_rgba(0,0,0,0.16)] dark:shadow-[0_20px_48px_-8px_rgba(0,0,0,0.72)] ${
              direction === "up" ? "bottom-full mb-1.5" : "top-full mt-1.5"
            } ${align === "right" ? "right-0" : "left-0"}`}
          >
            {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={`w-full px-2.5 py-2 rounded-[9px] text-left flex items-center justify-between gap-2.5 transition-all duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] cursor-pointer ${
                    isSelected
                      ? "bg-[#1D1D1F] dark:bg-white text-white dark:text-[#1D1D1F] font-semibold"
                      : "text-[#1D1D1F] dark:text-zinc-200 hover:bg-black/[0.05] dark:hover:bg-white/[0.08]"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div
                      className={`text-xs flex items-center gap-1.5 truncate ${
                        mono ? "font-mono" : ""
                      }`}
                    >
                      {opt.dotColor && (
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: opt.dotColor }}
                        />
                      )}
                      <span className="truncate">{opt.label}</span>
                    </div>
                    {opt.sublabel && (
                      <div
                        className={`text-[10.5px] truncate mt-0.5 ${
                          isSelected
                            ? "text-white/75 dark:text-[#1D1D1F]/70"
                            : "text-[#8E8E93] dark:text-zinc-400"
                        }`}
                      >
                        {opt.sublabel}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {opt.badge && (
                      <span
                        className={`px-1.5 py-0.5 rounded-[6px] text-[10px] font-mono border ${
                          isSelected
                            ? "bg-white/20 dark:bg-black/15 text-white dark:text-[#1D1D1F] border-transparent"
                            : BADGE_CLASSES[opt.badgeColor || "neutral"]
                        }`}
                      >
                        {opt.badge}
                      </span>
                    )}
                    {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                  </div>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
