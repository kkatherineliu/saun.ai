"use client";

import { cn } from "@/lib/utils";

type ChatSidebarProps = {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  label?: string;
  categories?: ReadonlyArray<string>;
  selectedCategories?: ReadonlySet<string>;
  onToggleCategory?: (category: string) => void;
  extraChanges?: string;
  onExtraChangesChange?: (value: string) => void;
  className?: string;
};

export function ChatSidebar({
  value = "",
  onChange,
  placeholder = "Extra style prompt (e.g. Scandinavian minimal, warm light)...",
  label = "Style prompt",
  categories = [],
  selectedCategories = new Set<string>(),
  onToggleCategory,
  extraChanges = "",
  onExtraChangesChange,
  className,
}: ChatSidebarProps) {
  return (
    <aside
      className={cn(
        "flex w-full max-w-sm flex-col border-l border-neutral-200 bg-white/30 dark:border-neutral-800 dark:bg-neutral-950/30",
        "min-h-screen",
        className
      )}
    >
      <div className="flex flex-1 flex-col p-4">
        {categories.length > 0 && (
          <>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-neutral-500">
              Improvement Areas
            </p>
            <div className="mb-4 space-y-2">
              {categories.map((category) => {
                const checked = selectedCategories.has(category);
                return (
                  <label
                    key={category}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                      checked
                        ? "border-neutral-900 bg-neutral-900 text-white"
                        : "border-neutral-200 bg-white text-neutral-800 hover:border-neutral-400"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggleCategory?.(category)}
                      className="h-4 w-4 rounded border-neutral-300"
                      disabled={!onToggleCategory}
                    />
                    <span>{category}</span>
                  </label>
                );
              })}
            </div>
          </>
        )}

        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-neutral-500">
          Additional Changes
        </p>
        <textarea
          value={extraChanges}
          onChange={(e) => onExtraChangesChange?.(e.target.value)}
          placeholder='e.g. Add a narrow bench near the window and replace rug with a jute rug'
          className={cn(
            "w-full min-h-24 resize-y rounded-xl border border-neutral-200 bg-background px-3 py-2 text-sm text-foreground placeholder:text-neutral-500",
            "focus:outline-none focus:ring-2 focus:ring-neutral-900/20 focus:border-neutral-400",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
          disabled={!onExtraChangesChange}
          rows={4}
        />

        <div className="flex-1" />

        {label && (
          <p className="mb-2 mt-4 text-xs font-medium uppercase tracking-wider text-neutral-500">
            {label}
          </p>
        )}
        <div className="pt-1">
          <textarea
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            placeholder={placeholder}
            className={cn(
              "w-full min-h-24 resize-y rounded-xl border border-neutral-200 bg-background px-3 py-2 text-sm text-foreground placeholder:text-neutral-500",
              "focus:outline-none focus:ring-2 focus:ring-neutral-900/20 focus:border-neutral-400",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
            aria-label={label}
            disabled={onChange === undefined}
            rows={4}
          />
        </div>
      </div>
    </aside>
  );
}
