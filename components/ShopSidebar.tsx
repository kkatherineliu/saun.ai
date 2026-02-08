"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { GripVertical, ShoppingBag, ExternalLink, Check, Plus, PanelLeftClose, ChevronRight, ChevronLeft } from "lucide-react";

export type ShopItem = {
  id: string;
  name: string;
  price: string;
  image?: string;
  link?: string;
  category?: string;
};

type ShopSidebarProps = {
  className?: string;
  items?: ShopItem[];
  onAddItem?: (item: string) => void;
  onResetWidth?: () => void;
  isOpen?: boolean;
  onToggle?: () => void;
};

// Sample data for now
const SAMPLE_ITEMS: ShopItem[] = [
  { id: "1", name: "Modern Beige Sofa", price: "$1,299", category: "Furniture" },
  { id: "2", name: "Abstract Canvas Art", price: "$149", category: "Decor" },
  { id: "3", name: "Minimalist Floor Lamp", price: "$299", category: "Lighting" },
  { id: "4", name: "Wool Area Rug", price: "$499", category: "Flooring" },
];

export function ShopSidebar({
  className,
  items = SAMPLE_ITEMS,
  onAddItem,
  onResetWidth,
  isOpen = false,
  onToggle,
}: ShopSidebarProps) {
  const sidebarRef = useRef<HTMLElement>(null);
  const [width, setWidth] = useState(400); // Default width
  const [isResizing, setIsResizing] = useState(false);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

  // Resize logic
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = e.clientX; // Left sidebar width is just mouse X
      setWidth(Math.max(280, Math.min(newWidth, 600)));
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

  const toggleItem = (id: string) => {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <aside
      ref={sidebarRef}
      style={{ width: isOpen ? width : 0 }}
      className={cn(
        "flex flex-col border-r border-neutral-200 bg-[#F3F1E7]/50 backdrop-blur-sm relative transition-[width] duration-300 ease-in-out",
        "h-full shrink-0",
        className
      )}
    >
      {/* Toggle Handle - Centered on border */}
      <button
        onClick={onToggle}
        className="absolute right-0 top-1/2 translate-x-full -translate-y-1/2 z-50 flex h-24 w-8 items-center justify-center rounded-r-xl border-y border-r border-neutral-200 bg-white shadow-md transition-transform hover:bg-neutral-50 active:scale-95"
        title={isOpen ? "Close sidebar" : "Open sidebar"}
      >
        {!isOpen && <ChevronRight className="h-4 w-4 text-neutral-400" />}
        {isOpen && <ChevronLeft className="h-4 w-4 text-neutral-400" />}
      </button>

      <div className={cn("flex flex-col h-full w-full overflow-hidden", !isOpen && "invisible")}>
        {/* Resize Handle */}
        <div
          className="absolute -right-1 top-0 w-3 h-full cursor-col-resize z-40 flex items-center justify-center group touch-none hover:bg-black/5 transition-colors"
          onMouseDown={(e) => {
            e.preventDefault();
            setIsResizing(true);
          }}
        />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-200/50 px-6 py-4 shrink-0 bg-white/50">
        <div className="flex items-center gap-2">
          <ShoppingBag className="w-4 h-4 text-neutral-900" />
          <span className="text-sm font-medium uppercase tracking-widest text-neutral-900">
            Shopping List
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-neutral-500 font-medium">
            {checkedItems.size} / {items.length} items
          </span>
        </div>
      </div>

      {/* Items List */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4 scrollbar-hide">
        {items.map((item) => (
          <div
            key={item.id}
            className={cn(
              "group relative flex items-start gap-4 p-4 rounded-xl border transition-all duration-300",
              checkedItems.has(item.id)
                ? "bg-neutral-50 border-neutral-200 opacity-60"
                : "bg-white border-neutral-200 hover:shadow-md hover:border-neutral-300"
            )}
          >
            {/* Checkbox */}
            <button
              onClick={() => toggleItem(item.id)}
              className={cn(
                "mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors",
                checkedItems.has(item.id)
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-300 hover:border-neutral-400"
              )}
            >
              {checkedItems.has(item.id) && <Check className="h-3 w-3" />}
            </button>

            {/* Content */}
            <div className="flex-1 space-y-1">
              <div className="flex justify-between items-start">
                <h3 className={cn(
                  "font-medium text-neutral-900",
                  checkedItems.has(item.id) && "line-through text-neutral-500"
                )}>
                  {item.name}
                </h3>
                <span className="text-sm font-medium text-neutral-900">{item.price}</span>
              </div>
              <p className="text-xs text-neutral-500">{item.category}</p>
            </div>

            {/* Link Action */}
            <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-neutral-100 rounded">
              <ExternalLink className="w-4 h-4 text-neutral-400 hover:text-neutral-900" />
            </button>
          </div>
        ))}
        
        {/* Add Item Placeholder */}
        <button 
          onClick={() => onAddItem?.("New Item")}
          className="w-full flex items-center justify-center gap-2 p-4 rounded-xl border border-dashed border-neutral-300 text-neutral-400 hover:text-neutral-600 hover:border-neutral-400 hover:bg-neutral-50 transition-all group"
        >
          <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" />
          <span className="text-sm font-medium">Add Item</span>
        </button>
      </div>

      {/* Footer Total */}
      <div className="border-t border-neutral-200 bg-white/80 p-6 shrink-0 backdrop-blur-sm">
        <div className="flex items-center justify-between text-sm">
          <span className="text-neutral-500">Estimated Total</span>
          <span className="font-serif text-lg font-medium text-neutral-900">$2,246.00</span>
        </div>
        <button className="mt-4 w-full rounded-full bg-neutral-900 py-3 text-sm font-medium text-white transition-all hover:bg-black hover:shadow-lg">
          Checkout All Items
        </button>
      </div>
      </div>
    </aside>
  );
}
