"use client";

import { useEffect, useRef, useState, type SubmitEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Upload, ArrowRight, MoveRight, Star, Sparkles, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

type AnalyzeResponse = {
  data: {
    summary: string;
    labels: string[];
    confidence: number;
    safety_notes: string[];
  };
};

const Assets = () =>{
  return (
    <section className="mt-32 w-full max-w-5xl pt-24 border-t border-neutral-300/50 relative z-10">
    <div className="flex flex-col md:flex-row justify-between items-start gap-12">
      
      <div className="space-y-4">
        <h3 className="font-serif text-3xl">Design Elements</h3>
        <p className="text-neutral-500 text-sm max-w-xs">
          Reusable components and typography styles matching the curated aesthetic.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 w-full max-w-2xl">
        
        {/* Buttons */}
        <div className="space-y-6">
          <p className="text-xs uppercase tracking-widest text-neutral-400 font-medium">Buttons</p>
          
          <div className="flex flex-col gap-4 items-start">
            {/* Primary Button */}
            <button className="group relative flex items-center justify-between gap-4 px-8 py-4 bg-[#121212] text-[#F3F1E7] rounded-none hover:bg-neutral-800 transition-all duration-300 w-full md:w-auto min-w-[200px]">
              <span className="font-serif text-lg tracking-wide">Get Started</span>
              <MoveRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
            </button>

            {/* Secondary Button */}
            <button className="group flex items-center gap-3 px-6 py-3 border border-[#121212] text-[#121212] rounded-full hover:bg-[#121212] hover:text-[#F3F1E7] transition-all duration-300">
              <span className="text-sm font-medium tracking-wide">View Gallery</span>
            </button>

            {/* Text Link */}
            <button className="group flex items-center gap-2 text-[#121212] hover:opacity-70 transition-opacity">
              <span className="border-b border-black pb-0.5 text-sm uppercase tracking-widest">Learn More</span>
              <ArrowRight className="w-4 h-4 -rotate-45 group-hover:rotate-0 transition-transform duration-300" />
            </button>
          </div>
        </div>

        {/* Typography & Cards */}
        <div className="space-y-6">
          <p className="text-xs uppercase tracking-widest text-neutral-400 font-medium">Typography & Surface</p>
          
          <div className="p-8 bg-white border border-neutral-100 shadow-sm hover:shadow-md transition-shadow duration-300">
            <div className="flex items-center gap-2 mb-4 text-neutral-400">
              <Sparkles className="w-4 h-4" />
              <span className="text-xs uppercase tracking-wider">Feature Card</span>
            </div>
            <h4 className="font-serif text-2xl mb-2">Modern Minimalist</h4>
            <p className="text-neutral-500 text-sm leading-relaxed">
              Clean lines, neutral palette, and functional furniture design.
            </p>
          </div>
        </div>

      </div>
    </div>
  </section>
  )
}

const sampleRooms = [
  "/sample-rooms/bedroom1.jpg",
  "/sample-rooms/bedroom2.jpg",
  "/sample-rooms/bedroom3.jpg",
  "/sample-rooms/bedroom5.jpg",
];

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";
const DESIGN_API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:5001";
const DESIGN_SESSION_KEY = "saun-design-session";

export default function Home() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped?.type.startsWith("image/")) {
      setFile(dropped);
      setError(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = e.target.files?.[0];
    if (chosen) {
      setFile(chosen);
      setError(null);
    }
    e.target.value = "";
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
      const response = await fetch(`${API_BASE}/api/analyze-photo`, {
        method: "POST",
        body: formData,
      });
      const payload = await response.json();
      if (!response.ok) {
        setError((payload as { error?: string })?.error ?? "Request failed.");
        return;
      }
      const data = (payload as AnalyzeResponse).data;
      if (typeof window !== "undefined") {
        sessionStorage.setItem("saun-analyze-result", JSON.stringify(data));
        // Create design session with same image so design page can skip upload
        try {
          const designForm = new FormData();
          designForm.append("image", file);
          const designRes = await fetch(`${DESIGN_API_BASE}/api/sessions`, {
            method: "POST",
            body: designForm,
          });
          const designData = await designRes.json();
          if (designRes.ok && designData.session_id) {
            sessionStorage.setItem(
              DESIGN_SESSION_KEY,
              JSON.stringify({
                session_id: designData.session_id,
                original_image_url: designData.original_image_url ?? null,
              })
            );
          }
        } catch {
          // design session optional; design page can still show upload
        }
        router.push("/design");
      }
    } catch {
      setError("Could not reach backend. Ensure the API is running.");
    } finally {
      setLoading(false);
    }


  };

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

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
    setError(null);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    inputRef.current?.form?.reset();
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
          <h1 className="font-serif text-6xl md:text-8xl lg:text-9xl leading-[0.9] tracking-tight text-foreground">
            Curate <br />
            <span className="italic font-light">Your Space</span>
          </h1>
          <p className="pt-4 max-w-md mx-auto text-lg text-neutral-600 font-sans leading-relaxed">
            Drive decisions and iterate quickly on interior design
          </p>
        </div>

        {/* Upload Component */}
        <form onSubmit={handleSubmit} className="w-full max-w-lg mx-auto flex flex-col items-center gap-6">
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
              "border-2 border-dashed rounded-2xl p-12",
              isDragging
                ? "border-black bg-white/80 scale-[1.02] shadow-2xl"
                : "border-neutral-900/20 hover:border-neutral-900 bg-white/40 hover:bg-white/60 backdrop-blur-sm hover:shadow-xl"
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
          {/* Accent corners */}
          <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-black -translate-x-1 -translate-y-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-black translate-x-1 -translate-y-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-black -translate-x-1 translate-y-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-black translate-x-1 translate-y-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          <div className="flex flex-col items-center space-y-6">
            {file ? (
              <>
                <div className="relative">
                  <img
                    src={previewUrl ?? undefined}
                    alt="Preview"
                    className="max-h-32 w-auto rounded-lg object-cover border border-neutral-200 shadow-sm"
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
                <p className="font-sans text-sm text-neutral-600 truncate max-w-full px-4">{file.name}</p>
              </>
            ) : (
              <>
                <div className={cn(
                  "p-5 rounded-full border-2 duration-300 group-hover:scale-110",
                  "border-neutral-900/10 bg-white shadow-sm group-hover:border-neutral-900 group-hover:shadow-md"
                )}>
                  <Upload className="w-8 h-8 text-neutral-600 group-hover:text-black" strokeWidth={1.5} />
                </div>
                <div className="space-y-2">
                  <p className="font-serif text-3xl text-neutral-900">Upload Photo</p>
                  <p className="text-sm text-neutral-500 font-sans">
                    Drag & Drop or Click to Browse
                  </p>
                </div>
                
              </>
            )}
          </div>
        </div>

        {file && (
          <>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-3 px-8 py-4 bg-neutral-900 text-white rounded-full font-medium text-sm hover:bg-black hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-60 disabled:hover:scale-100"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="tracking-wider">Analyzing…</span>
                </>
              ) : (
                <>
                  <span className="tracking-wider">Analyze Photo</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </>
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
