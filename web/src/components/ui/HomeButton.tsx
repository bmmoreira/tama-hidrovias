"use client";
import Link from "next/link";
import { Home } from "lucide-react";

export default function HomeButton({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`absolute right-4 top-4 z-20 flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-lg transition hover:bg-gray-50 md:right-4 ${className}`}
      aria-label="Go to home page"
    >
      <Home className="h-4 w-4 text-gray-500" />
      <span className="hidden sm:inline">Home</span>
    </Link>
  );
}
