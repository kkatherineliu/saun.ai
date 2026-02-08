"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { ArrowUp, GripVertical, Check, Loader2, ChevronLeft, ChevronRight, PanelRightClose, ShoppingBag } from "lucide-react";

export type Suggestion = {
  id: string;
  category?: string;
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
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
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
  /** Callback when user clicks curate */
  onCurate?: () => void;
  /** Whether curate is running */
  isCurating?: boolean;
  onResetWidth?: () => void;
  isOpen?: boolean;
  onToggle?: () => void;
  onOpenShop?: () => void;
  onResizeStart?: () => void;
  onResizeEnd?: () => void;
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
  onCurate,
  isCurating = false,
  onResetWidth,
  isOpen = true,
  onToggle,
  onOpenShop,
  onResizeStart,
  onResizeEnd,
}: ChatSidebarProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600); // Default max width
  const [isResizing, setIsResizing] = useState(false);
  const [isShopHovered, setIsShopHovered] = useState(false);

  // Initialize width to 30% of screen on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      setWidth(window.innerWidth * 0.3);
    }
  }, []);

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
      onResizeEnd?.();
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

  useEffect(() => {
    if (!messagesRef.current) return;
    messagesRef.current.scrollTo({
      top: messagesRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages.length]);
  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const newHeight = value ? textareaRef.current.scrollHeight : 44;
      textareaRef.current.style.height = `${Math.min(Math.max(newHeight, 44), 200)}px`;
    }
  }, [value]);

  useEffect(() => {
    if (!messagesRef.current) return;
    messagesRef.current.scrollTo({
      top: messagesRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages.length]);

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
      style={{ width: isOpen ? width : 0 }}
      className={cn(
        "flex flex-col border-l border-neutral-200 bg-[#FDFBF7] backdrop-blur-sm relative",
        !isResizing && "transition-[width] duration-300 ease-in-out",
        "h-full shrink-0", 
        className
      )}
    >
      {/* Toggle Handle - Centered on border */}
      {!isOpen && (
        <button
          onClick={onToggle}
          className="absolute left-0 top-1/2 -translate-x-full -translate-y-1/2 z-50 flex h-24 w-8 items-center justify-center rounded-l-3xl border-y border-l border-neutral-200 bg-white shadow-[0_4px_20px_rgba(0,0,0,0.08)] transition-all hover:scale-105 hover:bg-neutral-50 active:scale-95 active:bg-neutral-100"
          title="Open sidebar"
        >
          <ChevronLeft className="h-5 w-5 text-neutral-400" strokeWidth={2.5} />
        </button>
      )}

      <div className={cn("flex flex-col h-full w-full overflow-hidden")}>
        {/* Resize Handle */}
        <div
          className="absolute -left-1 top-0 w-3 h-full cursor-col-resize z-40 flex items-center justify-center group touch-none hover:bg-black/5 transition-colors"
          onMouseDown={(e) => {
            e.preventDefault();
            setIsResizing(true);
            onResizeStart?.();
          }}
        />

        {/* Header */}
        <div 
          className={cn(
            "flex items-center justify-between border-b border-neutral-200/50 px-6 py-4 shrink-0 transition-all duration-500 ease-in-out",
            isOpen ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"
          )}
        >
          <span className="text-xs font-medium uppercase tracking-widest text-neutral-500">
            {label}
          </span>
      </div>

      <div
        ref={messagesRef}
        className="flex-1 overflow-y-auto px-6 py-4 space-y-6 scrollbar-hide [&::-webkit-scrollbar]:hidden"
      >
        {messages.map((msg, i) => {
          const hasSuggestions = msg.suggestions && msg.suggestions.length > 0;
          
          return (
            <div
              key={msg.id}
              style={{ transitionDelay: `${i * 50}ms` }}
              className={cn(
                "flex flex-col gap-2 text-sm transition-all duration-500 ease-in-out",
                hasSuggestions 
                  ? "w-full" 
                  : cn("max-w-[95%]", msg.role === "user" ? "ml-auto items-end" : "mr-auto items-start"),
                isOpen ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"
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
      <div 
        className={cn(
          "px-6 py-4 pt-2 shrink-0 relative transition-all duration-700 ease-in-out delay-200",
          isOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        )}
      >
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
        </div>
        
        {/* Curate / Shop Action Bar */}
        <div className="mt-3 flex w-full h-12 rounded-full border border-neutral-900 bg-neutral-900 overflow-hidden shadow-sm relative isolate">
          {onOpenShop && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenShop();
              }}
              className={cn(
                "relative z-20 flex items-center justify-center bg-neutral-800 hover:bg-neutral-700 text-white transition-all duration-300 ease-out border-r border-neutral-700/50",
                isShopHovered ? "w-full border-r-0" : "w-14"
              )}
              onMouseEnter={() => setIsShopHovered(true)}
              onMouseLeave={() => setIsShopHovered(false)}
            >
              <ShoppingBag className="w-4 h-4 shrink-0" />
              <span 
                className={cn(
                  "font-serif text-sm tracking-[0.2em] uppercase whitespace-nowrap overflow-hidden transition-all duration-300",
                  isShopHovered ? "ml-2 max-w-[200px] opacity-100" : "max-w-0 opacity-0"
                )}
              >
                Shop Now!
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={onCurate}
            disabled={!onCurate || isCurating}
            className={cn(
              "relative z-10 flex items-center justify-center text-[#F3F1E7] font-serif text-sm tracking-[0.2em] uppercase transition-all duration-300 hover:bg-black",
              isShopHovered ? "w-0 p-0 opacity-0 overflow-hidden border-0" : "flex-1",
              (!onCurate || isCurating) && "cursor-not-allowed opacity-50"
            )}
          >
            <span className="inline-flex items-center justify-center gap-2">
              {isCurating && <Loader2 className="h-4 w-4 animate-spin" />}
              {isCurating ? "Curating..." : "Curate"}
            </span>
          </button>
        </div>

      </div>
      </div>
    </aside>
  );
}
