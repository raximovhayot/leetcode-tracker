"use client";

import { type ReactNode, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PhaseWithProblems, Timeline } from "@/lib/types";

export type TimelineFormValues = {
  name: string;
  startAt: string;
  endAt: string;
  problemIds: string[];
};

type Props = {
  /** Phases (with their problems) the user can pick problems from. */
  phases: PhaseWithProblems[];
  /** Existing timeline to edit, or undefined to create a new one. */
  timeline?: Timeline;
  trigger: ReactNode;
  onSubmit: (values: TimelineFormValues) => Promise<boolean>;
};

/** Converts a stored ISO timestamp into a `datetime-local` input value. */
function isoToLocalInput(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

/** Converts a `datetime-local` input value back into an ISO timestamp. */
function localInputToIso(local: string): string {
  if (!local) return "";
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString();
}

export function TimelineFormDialog({
  phases,
  timeline,
  trigger,
  onSubmit,
}: Props) {
  const isEdit = Boolean(timeline);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Reset the form to reflect the latest data each time the dialog opens.
  function resetForm() {
    setName(timeline?.name ?? "");
    setStart(isoToLocalInput(timeline?.startAt ?? ""));
    setEnd(isoToLocalInput(timeline?.endAt ?? ""));
    setSelected(new Set(timeline?.problemIds ?? []));
  }

  function handleOpenChange(next: boolean) {
    if (next) resetForm();
    setOpen(next);
  }

  function toggleProblem(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function handleSubmit() {
    if (!name.trim()) return;

    setSaving(true);
    const ok = await onSubmit({
      name: name.trim(),
      startAt: localInputToIso(start),
      endAt: localInputToIso(end),
      problemIds: [...selected],
    });
    setSaving(false);
    if (ok) setOpen(false);
  }

  const totalProblems = phases.reduce((n, p) => n + p.problems.length, 0);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit timeline" : "New timeline"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update this timeline and the problems it contains."
              : "Create a time-boxed challenge and pick the problems to solve."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="timeline-name">Name</Label>
            <Input
              id="timeline-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Weekend sprint"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="timeline-start">Starts</Label>
              <Input
                id="timeline-start"
                type="datetime-local"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="timeline-end">Ends</Label>
              <Input
                id="timeline-end"
                type="datetime-local"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Problems ({selected.size} selected)</Label>
            {totalProblems === 0 ? (
              <p className="text-muted-foreground text-sm">
                No problems yet. Add problems on the tracker first.
              </p>
            ) : (
              <div className="flex max-h-64 flex-col gap-3 overflow-y-auto rounded-lg border p-3">
                {phases.map((phase) =>
                  phase.problems.length === 0 ? null : (
                    <div key={phase.$id} className="flex flex-col gap-2">
                      <p className="text-muted-foreground text-xs font-medium uppercase">
                        {phase.name}
                      </p>
                      {phase.problems.map((problem) => (
                        <label
                          key={problem.$id}
                          className="flex items-center gap-2 text-sm"
                        >
                          <Checkbox
                            checked={selected.has(problem.$id)}
                            onCheckedChange={(v) =>
                              toggleProblem(problem.$id, v === true)
                            }
                          />
                          <span className="text-muted-foreground font-mono">
                            {problem.number}
                          </span>
                          <span>{problem.title}</span>
                        </label>
                      ))}
                    </div>
                  ),
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {isEdit ? "Save changes" : "Create timeline"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
