"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

export function Header() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-800/50 bg-slate-950/80 backdrop-blur-xl">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center space-x-2 group">
            <div className="relative">
              <div className="absolute inset-0 bg-indigo-500/20 blur-xl group-hover:bg-indigo-500/30 transition-colors"></div>
              <div className="relative text-2xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                Sabiscore
              </div>
            </div>
          </Link>

          <nav className="flex items-center space-x-6">
            <Link
              href="/match"
              className="text-sm font-medium text-slate-300 hover:text-slate-100 transition-colors"
            >
              Matches
            </Link>
            <Link
              href="/docs"
              className="text-sm font-medium text-slate-300 hover:text-slate-100 transition-colors"
            >
              Docs
            </Link>
            <a
              href="https://github.com/sabiscore"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-slate-300 hover:text-slate-100 transition-colors"
            >
              GitHub
            </a>
            
            <div className="pl-4 border-l border-slate-800">
              <div className="flex items-center space-x-2 text-xs">
                <div className="flex items-center space-x-1">
                  <div className={`h-2 w-2 rounded-full ${mounted ? "bg-green-500" : "bg-slate-600"} animate-pulse`}></div>
                  <span className="text-slate-400">
                    {mounted ? "Live" : "Loading"}
                  </span>
                </div>
              </div>
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}
