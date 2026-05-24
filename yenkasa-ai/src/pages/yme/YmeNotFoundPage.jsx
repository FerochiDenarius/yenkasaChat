import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { YmeCard } from "../../components/yme/YmePrimitives";

export default function YmeNotFoundPage() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <YmeCard className="max-w-xl p-8 text-center" strong>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-200/80">YME Inspector</p>
        <h1 className="mt-4 text-3xl font-semibold text-white">Route not found</h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-slate-400">
          The requested inspector route does not exist yet. Return to the overview or open a supported debug surface.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link to="/" className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 px-5 py-3 text-sm font-semibold text-white">
            Go to overview <ArrowRight className="h-4 w-4" />
          </Link>
          <Link to="/retrievals" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-violet-200">
            Open retrieval debugger
          </Link>
        </div>
      </YmeCard>
    </div>
  );
}
