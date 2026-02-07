"use client";

import { useState } from "react";
import { Upload, ArrowRight, MoveRight, Star, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const Assets = () =>{
  return (
    <section className="mt-32 w-full max-w-5xl pt-24 border-t border-neutral-300/50">
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

export default function Home() {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    // Handle file drop logic here
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

        {/* Existing Stars/Sparkles (kept for texture) */}
        <div className="absolute top-[10%] left-[5%] text-neutral-400 font-serif text-9xl select-none rotate-12 opacity-50">
          *
        </div>
        <div className="absolute bottom-[10%] right-[5%] text-neutral-400 font-serif text-9xl select-none -rotate-12 opacity-50">
          *
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
        <div 
          className={cn(
            "w-full max-w-lg mx-auto group cursor-pointer transition-all duration-500 ease-out",
            "border border-dashed rounded-xl p-12",
            isDragging 
              ? "border-black bg-white/50 scale-[1.02]" 
              : "border-neutral-300 hover:border-neutral-400 bg-white/20 hover:bg-white/40"
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="flex flex-col items-center space-y-4">
            <div className={cn(
              "p-4 rounded-full border transition-colors duration-300",
              "border-neutral-200 bg-white group-hover:border-black/10"
            )}>
              <Upload className="w-6 h-6 text-neutral-600 group-hover:text-black transition-colors" />
            </div>
            <div className="space-y-1">
              <p className="font-serif text-2xl">Upload Photo</p>
              <p className="text-sm text-neutral-500 font-sans">
                or drag and drop your image here
              </p>
            </div>
          </div>
        </div>
      </div>
      {/* <Assets /> */}
    </main>
  );
}
