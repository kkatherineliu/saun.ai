"use client";

import { useEffect, useRef, useState, type SubmitEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Upload, ArrowRight, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const sampleRooms = [
  "/sample-rooms/bedroom1.jpg",
  "/sample-rooms/bedroom2.jpg",
  "/sample-rooms/bedroom3.jpg",
  "/sample-rooms/bedroom5.jpg",
];

export default function Home() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5001";
  const DESIGN_SESSION_KEY = "saun-design-session";

  const imagePreviewSrc = file && previewUrl != null ? previewUrl : undefined;

  useEffect(() => {
    if (!file) {
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const clearFile = () => {
    setFile(null);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) {
      setFile(file);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setFile(file);
    }
  };

  const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!file) {
      setError("Please select an image first.");
      return;
    }

    const formData = new FormData();
    formData.append("image", file);
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/sessions`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = (data as { error?: { message?: string } })?.error?.message ?? "Upload failed.";
        setError(msg);
        return;
      }
      if (!(data as { session_id?: string }).session_id) {
        setError("Invalid response from server.");
        return;
      }

      if (typeof window !== "undefined") {
        sessionStorage.setItem(
          DESIGN_SESSION_KEY,
          JSON.stringify({
            session_id: (data as { session_id: string }).session_id,
            original_image_url: (data as { original_image_url?: string }).original_image_url ?? null,
            rating_result: (data as { rating_result?: unknown }).rating_result ?? null,
          })
        );
        router.push("/design");
      }
    } catch {
      setError("Could not reach server. Ensure the backend is running on " + API_BASE);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 md:p-24 relative overflow-hidden">
      
      {/* Decorative Background Elements */}
      <div className="absolute inset-0 w-full h-full pointer-events-none z-0 overflow-hidden">
        {/* Bold Opinionated Curves */}
        <svg className="absolute inset-0 w-full h-full text-black" viewBox="0 0 100 100" preserveAspectRatio="none">
          {/* Large sweeping curve from bottom left */}
          <path 
            d="M-10,100 C20,40 50,80 100,20" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="0.3" 
            className="opacity-100"
          />
          {/* Secondary architectural curve */}
          <path 
            d="M0,60 C30,70 60,30 110,40" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="0.2" 
            className="opacity-100"
          />
          {/* Sharp contrast line */}
          <path 
            d="M70,0 C70,30 90,60 90,100" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="0.4" 
            className="opacity-100"
          />
        </svg>
      </div>

      {/* Horizontal Image Strip (Background Center) */}
      <div className="absolute top-1/2 left-0 -translate-y-1/2 w-full overflow-hidden opacity-20 pointer-events-none z-0 mix-blend-multiply grayscale-[20%]">
        <div className="flex gap-8 animate-in fade-in duration-1000 min-w-max px-8">
          {[...sampleRooms, ...sampleRooms].map((src, i) => (
            <div key={i} className="relative w-64 h-48 md:w-96 md:h-72 shrink-0 grayscale hover:grayscale-0 transition-all duration-700">
               <Image 
                 src={src} 
                 alt={`Room Style ${i}`}
                 fill
                 className="object-cover rounded-sm"
                 sizes="(max-width: 768px) 100vw, 33vw"
               />
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="z-10 w-full max-w-4xl flex flex-col items-center text-center space-y-12 relative">
        
        {/* Soft Glow Cutout */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200%] h-[150%] -z-10 pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(circle_closest-side,var(--background)_60%,transparent_100%)] opacity-95 blur-3xl" />
        </div>

        {/* Header */}
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-1000">
          <p className="uppercase tracking-[0.2em] text-sm font-medium text-neutral-500">
            Interior Design AI
          </p>
          <h1 className="font-serif text-6xl md:text-7xl lg:text-8xl leading-[0.9] tracking-tight text-foreground">
            Curate <br />
            <span className="italic font-light">Your Space</span>
          </h1>
          <p className="pt-4 max-w-md mx-auto text-lg text-neutral-600 font-sans leading-relaxed">
            Drive decisions and iterate quickly on interior design
          </p>
        </div>

        {/* Upload Component */}
        <form onSubmit={handleSubmit} className="w-full max-w-lg mx-auto flex flex-col items-center gap-4">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
            aria-hidden
          />
          <div
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
            className={cn(
              "w-full group cursor-pointer transition-all duration-500 ease-out relative",
              "border-2 border-dashed rounded-2xl px-6 py-6",
              isDragging
                ? "border-black bg-white/80 scale-[1.01] shadow-xl"
                : "border-neutral-900/20 hover:border-neutral-900 bg-white/30 hover:bg-white/50 backdrop-blur-sm hover:shadow-lg"
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {/* Accent corners */}
            <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-black -translate-x-1 -translate-y-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-black translate-x-1 -translate-y-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-black -translate-x-1 translate-y-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-black translate-x-1 translate-y-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

            <div className="flex flex-col items-center space-y-3">
              {file ? (
                <>
                  <div className="relative">
                    <img
                      src={imagePreviewSrc}
                      alt="Preview"
                      className="max-h-20 w-auto rounded-md object-cover border border-neutral-200 shadow-sm transition-all duration-300"
                    />
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); clearFile(); }}
                      className="absolute -top-2 -right-2 rounded-full bg-neutral-900 text-white p-1 hover:bg-black transition-colors"
                      aria-label="Remove image"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="font-sans text-xs text-neutral-600 truncate max-w-full px-2">{file.name}</p>
                </>
              ) : (
                <>
                  <div className={cn(
                    "p-3 rounded-full border duration-300 group-hover:scale-105",
                    "border-neutral-900/10 bg-white shadow-sm group-hover:border-neutral-900 group-hover:shadow-md"
                  )}>
                    <Upload className="w-5 h-5 text-neutral-600 group-hover:text-black" strokeWidth={1.5} />
                  </div>
                  <div className="space-y-1">
                    <p className="font-serif text-xl text-neutral-900">Upload Photo</p>
                    <p className="text-xs text-neutral-500 font-sans">
                      Drag & Drop or Click to Browse
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          {file && (
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-2 bg-neutral-900 text-white rounded-full font-medium text-xs hover:bg-black hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              {loading ? <>
                <span className="tracking-wider">Loading...</span> 
                <Loader2 className="w-4 h-4 animate-spin" />
                </> : <>
                <span className="tracking-wider">Start Design</span> 
                <ArrowRight className="w-4 h-4" />
              </>}
              
            </button>
          )}
        
      </form>

      {error && (
        <p className="w-full max-w-lg mx-auto rounded-xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
      </div>
    </main>
  );
}
