"use client";

import { cn } from "@/lib/utils";

type ChatSidebarProps = {
  /** Controlled value for the prompt/style input */
  value?: string;
  /** Called when the user types in the input */
  onChange?: (value: string) => void;
  /** Placeholder for the input */
  placeholder?: string;
  /** Optional label above the input */
  label?: string;
  className?: string;
};

export function ChatSidebar({
  value = "",
  onChange,
  placeholder = "Extra style prompt (e.g. Scandinavian minimal, warm light)…",
  label = "Style prompt",
  className,
}: ChatSidebarProps) {
  return (
    <aside
      className={cn(
        "flex w-full max-w-sm flex-col border-l border-neutral-200 bg-white/30 dark:border-neutral-800 dark:bg-neutral-950/30",
        "min-h-screen"
      )}
    >
      <div className="flex flex-1 flex-col p-4">
        {label && (
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-neutral-500">
            {label}
          </p>
        )}
        <div className="flex-1" />
        <div className="pt-4">
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
