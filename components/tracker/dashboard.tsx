import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { TrackerStats } from "@/lib/types";

type Props = {
  stats: TrackerStats;
};

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

export function Dashboard({ stats }: Props) {
  const percent = Math.round(stats.progress * 100);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Metric
          label="Problems solved"
          value={`${stats.problemsSolved} / ${stats.problemsTotal}`}
        />
        <Metric
          label="Approaches done"
          value={`${stats.approachesDone} / ${stats.approachesTotal}`}
        />
        <Metric label="Progress" value={`${percent}%`} />
        <Metric
          label="MUST done"
          value={`${stats.mustDone} / ${stats.mustTotal}`}
        />
      </div>
      <Progress value={percent} />
    </div>
  );
}
