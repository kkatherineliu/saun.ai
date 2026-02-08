"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { ArrowUp, GripVertical, Check } from "lucide-react";

export type Suggestion = {
  id: string;
  title: string;
  why: string;
  impact: string;
  effort: string;
  steps?: string[];
};

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  suggestions?: Suggestion[];
};

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
  /** Optional chat history */
  messages?: Message[];
  /** IDs of selected suggestions */
  selectedSuggestionIds?: Set<string>;
  /** Callback to toggle a suggestion */
  onToggleSuggestion?: (id: string) => void;
  /** Callback when user submits a message */
  onSubmit?: (value: string) => void;
};

export function ChatSidebar({
  value = "",
  onChange,
  placeholder = "Style requests...",
  label = "Style prompt",
  className,
  messages = [],
  selectedSuggestionIds = new Set(),
  onToggleSuggestion,
  onSubmit,
}: ChatSidebarProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const [width, setWidth] = useState(600); // Default max width
  const [isResizing, setIsResizing] = useState(false);

  // Resize logic
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      // Calculate new width: window width - mouse X position
      // (Since sidebar is on the right)
      const newWidth = document.body.clientWidth - e.clientX;
      setWidth(Math.max(280, Math.min(newWidth, 600))); // Min 280px, Max 600px
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = "default";
      document.body.style.userSelect = "auto";
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const newHeight = value ? textareaRef.current.scrollHeight : 44;
      textareaRef.current.style.height = `${Math.min(Math.max(newHeight, 44), 200)}px`;
    }
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim()) {
        onSubmit?.(value);
      }
    }
  };

  return (
    <aside
      ref={sidebarRef}
      style={{ width }}
      className={cn(
        "flex flex-col border-l border-neutral-200 bg-[#F3F1E7]/50 backdrop-blur-sm relative",
        "h-screen sticky top-0",
        className
      )}
    >
      {/* Resize Handle */}
      <div
        className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-full cursor-col-resize z-50 flex items-center justify-center group touch-none"
        onMouseDown={(e) => {
          e.preventDefault();
          setIsResizing(true);
        }}
      >
        {/* Visual indicator - Round Grip Icon */}
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white border border-neutral-200 shadow-sm text-neutral-400 transition-all duration-300 group-hover:scale-110 group-hover:border-neutral-300 group-hover:text-neutral-600 group-active:scale-95">
          <GripVertical className="h-4 w-4" />
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-200/50 px-6 py-4 shrink-0">
        <span className="text-xs font-medium uppercase tracking-widest text-neutral-500">
          {label}
        </span>
      </div>

      {/* Messages Area - Scrollable */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6 scrollbar-hide [&::-webkit-scrollbar]:hidden">
        {messages.map((msg) => {
          const hasSuggestions = msg.suggestions && msg.suggestions.length > 0;
          
          return (
            <div
              key={msg.id}
              className={cn(
                "flex flex-col gap-2 text-sm",
                hasSuggestions 
                  ? "w-full" 
                  : cn("max-w-[95%]", msg.role === "user" ? "ml-auto items-end" : "mr-auto items-start")
              )}
            >
              {hasSuggestions ? (
                /* Result View: Content and Suggestions separated */
                <div className="flex flex-col gap-6 w-full">
                  {/* Summary/Rating Box */}
                  <div className="bg-white border border-neutral-200 text-neutral-800 rounded-2xl rounded-bl-sm shadow-sm px-4 py-3 leading-relaxed">
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  </div>

                  {/* Suggestions List */}
                  <div className="flex flex-col gap-3">
                    {msg.suggestions!.map((s) => {
                      const isSelected = selectedSuggestionIds.has(s.id);
                      return (
                        <button
                          key={s.id}
                          onClick={() => onToggleSuggestion?.(s.id)}
                          className={cn(
                            "group relative flex flex-col items-start w-full text-left transition-all duration-300",
                            "rounded-xl border p-3 hover:shadow-lg",
                            isSelected 
                              ? "bg-white border-neutral-900 text-neutral-900 scale-[1.02] z-10 ring-1 ring-neutral-900/5" 
                              : "bg-white border-neutral-200 text-neutral-900 hover:border-neutral-300"
                          )}
                        >
                          {/* Header Line */}
                          <div className="flex items-center justify-between w-full gap-2">
                            <span className="font-medium text-sm">{s.title}</span>
                            <div className={cn(
                              "w-5 h-5 rounded-full border flex items-center justify-center transition-colors shrink-0",
                              isSelected 
                                ? "border-neutral-900 bg-neutral-900 text-white" 
                                : "border-neutral-300 group-hover:border-neutral-400"
                            )}>
                               {isSelected && <Check className="w-3 h-3" />}
                            </div>
                          </div>

                          {/* Expandable Content */}
                          <div className="grid grid-rows-[0fr] group-hover:grid-rows-[1fr] transition-[grid-template-rows] duration-300 w-full">
                             <div className="overflow-hidden">
                               <div className="pt-3 text-xs leading-relaxed space-y-2 text-neutral-600">
                                 <p>{s.why}</p>
                                 <div className="flex gap-3 text-[10px] uppercase tracking-wider opacity-80">
                                   <span>Impact: <b>{s.impact}</b></span>
                                   <span>Effort: <b>{s.effort}</b></span>
                                 </div>
                               </div>
                             </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* Standard Chat Bubble */
                <div
                  className={cn(
                    "rounded-2xl px-4 py-3 leading-relaxed",
                    msg.role === "user"
                      ? "bg-[#121212] text-[#F3F1E7] rounded-br-sm" // Chic Black Bubble
                      : "bg-white border border-neutral-200 text-neutral-800 rounded-bl-sm shadow-sm" // Chic White Bubble
                  )}
                >
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Input Area - Fixed at bottom */}
      <div className="px-6 py-4 pt-2 shrink-0">
        <div className="relative flex items-end gap-2 rounded-xl border border-neutral-300 bg-white p-2 shadow-sm focus-within:ring-1 focus-within:ring-neutral-900 transition-shadow">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="flex-1 resize-none bg-transparent px-2 py-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none max-h-48 [&::-webkit-scrollbar]:hidden"
            rows={1}
            style={{ minHeight: "44px" }}
            aria-label={label}
            disabled={onChange === undefined}
          />
          <button
            className="mb-1 rounded-lg bg-neutral-900 p-2 text-white hover:bg-neutral-800 disabled:opacity-50 transition-colors"
            disabled={!value.trim()}
            onClick={() => value.trim() && onSubmit?.(value)}
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
