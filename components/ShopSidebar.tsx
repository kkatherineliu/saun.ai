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
  productQueries?: string[]; // List of product names/queries to search for
  onAddItem?: (item: string) => void;
  onResetWidth?: () => void;
  isOpen?: boolean;
  onOpenChat?: () => void;
  onResizeStart?: () => void;
  onResizeEnd?: () => void;
};

// Sample data for fallback
const SAMPLE_ITEMS: ShopItem[] = [
  { id: "1", name: "Modern Beige Sofa", price: "$1,299", category: "Furniture" },
  { id: "2", name: "Abstract Canvas Art", price: "$149", category: "Decor" },
  { id: "3", name: "Minimalist Floor Lamp", price: "$299", category: "Lighting" },
  { id: "4", name: "Wool Area Rug", price: "$499", category: "Flooring" },
];

export function ShopSidebar({
  className,
  items,
  productQueries = [],
  onAddItem,
  onResetWidth,
  isOpen = false,
  onOpenChat,
  onResizeStart,
  onResizeEnd,
}: ShopSidebarProps) {
  const sidebarRef = useRef<HTMLElement>(null);
  const [width, setWidth] = useState(400); // Default width
  const [isResizing, setIsResizing] = useState(false);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [fetchedItems, setFetchedItems] = useState<ShopItem[]>(items || SAMPLE_ITEMS);
  const [loading, setLoading] = useState(false);

  // Fetch products from SERPapi if productQueries provided
  useEffect(() => {
    if (items) {
      setFetchedItems(items);
      return;
    }

    if (productQueries.length === 0) {
      setFetchedItems(SAMPLE_ITEMS);
      return;
    }

    const fetchProducts = async () => {
      setLoading(true);
      try {
        const queryString = productQueries.join(",");
        const response = await fetch(
          `http://localhost:5001/api/batch_search?q=${encodeURIComponent(queryString)}`
        );
        
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        
        // Transform SERPapi results to ShopItem format
        const shopItems: ShopItem[] = data.results.map(
          (result: any, index: number) => ({
            id: `serp-${index}`,
            name: result.result?.title || result.query,
            price: result.result?.price || "N/A",
            image: result.result?.image,
            link: result.result?.link,
            category: result.result?.source || "Product",
          })
        );

        setFetchedItems(shopItems.length > 0 ? shopItems : SAMPLE_ITEMS);
      } catch (error) {
        console.error("Failed to fetch products:", error);
        setFetchedItems(SAMPLE_ITEMS);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [productQueries, items]);

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
      const newWidth = e.clientX; // Left sidebar width is just mouse X
      setWidth(Math.max(280, Math.min(newWidth, 600)));
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
        "flex flex-col border-r border-neutral-200 bg-[#FDFBF7] backdrop-blur-sm relative",
        !isResizing && "transition-[width] duration-300 ease-in-out",
        "h-full shrink-0",
        className
      )}
    >
      <div className={cn("flex flex-col h-full w-full overflow-hidden")}>
        {/* Resize Handle */}
        <div
          className="absolute -right-1 top-0 w-3 h-full cursor-col-resize z-40 flex items-center justify-center group touch-none hover:bg-black/5 transition-colors"
          onMouseDown={(e) => {
            e.preventDefault();
            setIsResizing(true);
            onResizeStart?.();
          }}
        />

      {/* Header */}
      <div 
        className={cn(
          "flex items-center justify-between border-b border-neutral-200/50 px-6 py-4 shrink-0 bg-white/50 transition-all duration-500 ease-in-out",
          isOpen ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"
        )}
      >
        <div className="flex items-center gap-2">
          <ShoppingBag className="w-4 h-4 text-neutral-900" />
          <span className="text-sm font-medium uppercase tracking-widest text-neutral-900">
            Shopping List
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-neutral-500 font-medium">
            {checkedItems.size} / {fetchedItems.length} items
            {loading && <span className="ml-1 animate-pulse">...</span>}
          </span>
        </div>
      </div>

      {/* Items List */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scrollbar-hide">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="text-center space-y-2">
              <div className="w-6 h-6 border-2 border-neutral-300 border-t-neutral-900 rounded-full animate-spin mx-auto" />
              <p className="text-xs text-neutral-500">Loading products...</p>
            </div>
          </div>
        )}
        
        {!loading && fetchedItems.map((item) => (
          <a
            key={item.id}
            href={item.link || "#"}
            target={item.link ? "_blank" : undefined}
            rel={item.link ? "noreferrer" : undefined}
            className={cn(
              "group relative block rounded-lg border overflow-hidden transition-all duration-300 hover:shadow-lg",
              checkedItems.has(item.id)
                ? "bg-neutral-100 border-neutral-300 opacity-60"
                : "bg-white border-neutral-200 hover:border-neutral-400",
              !item.link && "cursor-default hover:shadow-none"
            )}
            onClick={(e) => {
              if (!item.link) e.preventDefault();
              toggleItem(item.id);
            }}
          >
            {/* Image + Overlay */}
            <div className="relative w-full h-32 bg-neutral-100 overflow-hidden">
              {item.image ? (
                <img
                  src={item.image}
                  alt={item.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-neutral-300">
                  <span className="text-xs">No image</span>
                </div>
              )}
              {/* Checkbox Overlay */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleItem(item.id);
                }}
                className={cn(
                  "absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded border transition-colors",
                  checkedItems.has(item.id)
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-300 bg-white/80 hover:border-neutral-400"
                )}
              >
                {checkedItems.has(item.id) && <Check className="h-3 w-3" />}
              </button>
            </div>

            {/* Content */}
            <div className="p-3 space-y-1">
              <h3 className={cn(
                "font-medium text-sm text-neutral-900 line-clamp-2",
                checkedItems.has(item.id) && "line-through text-neutral-500"
              )}>
                {item.name}
              </h3>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-neutral-900">{item.price}</span>
                {item.link && (
                  <span className="text-xs text-neutral-400 group-hover:text-neutral-600">View →</span>
                )}
              </div>
            </div>
          </a>
        ))}
        
        {/* Add Item Placeholder */}
        {!loading && fetchedItems.length === 0 && (
          <button 
            onClick={() => onAddItem?.("New Item")}
            className="w-full flex items-center justify-center gap-2 p-4 rounded-xl border border-dashed border-neutral-300 text-neutral-400 hover:text-neutral-600 hover:border-neutral-400 hover:bg-neutral-50 transition-all group"
          >
            <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" />
            <span className="text-sm font-medium">Add Item</span>
          </button>
        )}
      </div>

      {/* Footer Total */}
      <div className="border-t border-neutral-200 bg-white/80 p-4 shrink-0 backdrop-blur-sm">
        <div className="flex items-center justify-between text-sm mb-3">
          <span className="text-neutral-500">Selected</span>
          <span className="font-semibold text-neutral-900">{checkedItems.size} / {fetchedItems.length}</span>
        </div>
        <button className="w-full rounded-full bg-neutral-900 py-2.5 text-xs font-semibold text-white transition-all hover:bg-black disabled:opacity-50" disabled={fetchedItems.length === 0 || loading}>
          Explore Selected
        </button>
      </div>
      </div>
    </aside>
  );
}
