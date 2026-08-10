import { TitleOptimizer } from "@/components/dashboard/title-optimizer";

export const dynamic = "force-dynamic";

export default function TitleOptimizerPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-bold">Title Optimizer</h1>
      <p className="mt-1 text-sm text-neutral-600">
        Get 12 scored, conversion-optimized title variations for any book. Enter your
        working title and context, and we rank each idea on clarity, keyword strength,
        emotional pull &amp; click appeal.
      </p>

      <div className="mt-6">
        <TitleOptimizer />
      </div>
    </div>
  );
}
