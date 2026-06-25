import Link from "next/link";

export const metadata = {
  title: "Page Not Found",
  description: "The page you are looking for does not exist.",
};

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-900 to-slate-950 px-4">
      <div className="max-w-xl space-y-6 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.4em] text-slate-500">
          404
        </p>
        <h1 className="text-4xl font-bold text-slate-100 md:text-5xl">
          Page not found
        </h1>
        <p className="text-slate-400">
          The page you are looking for moved, was renamed, or no longer exists.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl border border-indigo-500/60 bg-indigo-500/20 px-6 py-3 text-sm font-semibold text-indigo-200 transition hover:bg-indigo-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          >
            Go home
          </Link>
          <Link
            href="/match"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700/60 bg-slate-800/40 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
          >
            Browse matches
          </Link>
        </div>
      </div>
    </div>
  );
}
