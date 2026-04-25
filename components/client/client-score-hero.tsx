import { ScoreDisplay } from "@/components/score/score-display";
import { cn } from "@/lib/utils";

type ClientScoreHeroProps = {
  score: number;
  delta: number | null;
  estado_simple: string;
  mes: string;
};

export function ClientScoreHero({ score, delta, estado_simple, mes }: ClientScoreHeroProps) {
  const positive = score >= 70;
  return (
    <section className={cn("rounded-xl border p-6", positive ? "border-yellow-300 bg-[#FFD600]" : "border-red-200 bg-red-50")}>
      <p className="text-xs font-bold uppercase tracking-wider text-zinc-700">Tu cuenta este mes · {mes}</p>
      <div className="mt-3">
        <ScoreDisplay score={score} delta={delta} size="lg" />
      </div>
      <p className="mt-3 text-base font-semibold text-zinc-900">{estado_simple}</p>
      <p className="mt-1 text-sm text-zinc-700">
        {delta === 0
          ? "Se mantuvo igual que el mes pasado."
          : delta && delta > 0
            ? `Subió ${delta} puntos vs el mes pasado.`
            : delta
              ? `Bajó ${Math.abs(delta)} puntos vs el mes pasado, ya estamos trabajando en eso.`
              : "Esta es tu primera medición visible."}
      </p>
    </section>
  );
}
