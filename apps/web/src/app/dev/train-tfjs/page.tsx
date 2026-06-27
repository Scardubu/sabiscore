import Link from "next/link";
import { ShieldAlert } from "lucide-react";

export default function TrainTFJSPage() {
  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-16 text-neutral-100">
      <section className="mx-auto max-w-2xl rounded-lg border border-amber-500/30 bg-amber-500/10 p-6">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-1 h-5 w-5 text-amber-300" />
          <div>
            <h1 className="text-xl font-semibold">Browser training disabled</h1>
            <p className="mt-2 text-sm text-neutral-300">
              Production SabiScore models are trained and verified through backend pipelines only.
              Client-side TensorFlow.js training and inference are not exposed.
            </p>
            <Link
              className="mt-4 inline-flex rounded-md bg-amber-300 px-3 py-2 text-sm font-semibold text-neutral-950"
              href="/intelligence"
            >
              Open Intelligence Workspace
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
