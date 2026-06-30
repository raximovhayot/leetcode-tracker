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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Approach, Difficulty, Problem } from "@/lib/types";

export type ProblemFormValues = {
  phaseId: string;
  number: number;
  title: string;
  url: string;
  difficulty: Difficulty;
  must: boolean;
  approaches: Approach[];
};

type PhaseOption = { id: string; name: string };

type Props = {
  /** Phases available to assign the problem to. */
  phases: PhaseOption[];
  /** Existing problem to edit, or undefined to create a new one. */
  problem?: Problem;
  /** Phase pre-selected when adding a new problem. */
  defaultPhaseId?: string;
  trigger: ReactNode;
  onSubmit: (values: ProblemFormValues) => Promise<boolean>;
};

const DIFFICULTIES: Difficulty[] = ["Easy", "Medium", "Hard"];

function approachesToText(approaches: Approach[]): string {
  return approaches.map((a) => a.name).join(", ");
}

function textToApproaches(text: string, previous: Approach[]): Approach[] {
  const names = text
    .split(",")
    .map((n) => n.trim())
    .filter((n) => n.length > 0);
  return names.map((name) => {
    const existing = previous.find((p) => p.name === name);
    return { name, done: existing?.done ?? false };
  });
}

export function ProblemFormDialog({
  phases,
  problem,
  defaultPhaseId,
  trigger,
  onSubmit,
}: Props) {
  const isEdit = Boolean(problem);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [phaseId, setPhaseId] = useState("");
  const [number, setNumber] = useState("");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("Easy");
  const [must, setMust] = useState(false);
  const [approachesText, setApproachesText] = useState("");

  // Reset the form to reflect the latest data each time the dialog opens.
  function resetForm() {
    setPhaseId(problem?.phaseId ?? defaultPhaseId ?? phases[0]?.id ?? "");
    setNumber(problem ? String(problem.number) : "");
    setTitle(problem?.title ?? "");
    setUrl(problem?.url ?? "");
    setDifficulty(problem?.difficulty ?? "Easy");
    setMust(problem?.must ?? false);
    setApproachesText(problem ? approachesToText(problem.approaches) : "");
  }

  function handleOpenChange(next: boolean) {
    if (next) resetForm();
    setOpen(next);
  }

  async function handleSubmit() {
    const parsedNumber = Number(number);
    if (!phaseId || !title.trim() || !Number.isFinite(parsedNumber)) return;

    setSaving(true);
    const ok = await onSubmit({
      phaseId,
      number: parsedNumber,
      title: title.trim(),
      url: url.trim(),
      difficulty,
      must,
      approaches: textToApproaches(approachesText, problem?.approaches ?? []),
    });
    setSaving(false);
    if (ok) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit problem" : "Add problem"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the details of this problem."
              : "Add a new LeetCode problem to a phase."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="problem-phase">Phase</Label>
            <Select value={phaseId} onValueChange={setPhaseId}>
              <SelectTrigger id="problem-phase">
                <SelectValue placeholder="Select a phase" />
              </SelectTrigger>
              <SelectContent>
                {phases.map((phase) => (
                  <SelectItem key={phase.id} value={phase.id}>
                    {phase.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="problem-number">Number</Label>
              <Input
                id="problem-number"
                type="number"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
              />
            </div>
            <div className="col-span-2 flex flex-col gap-2">
              <Label htmlFor="problem-title">Title</Label>
              <Input
                id="problem-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="problem-url">URL</Label>
            <Input
              id="problem-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://leetcode.com/problems/..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="problem-difficulty">Difficulty</Label>
              <Select
                value={difficulty}
                onValueChange={(v) => setDifficulty(v as Difficulty)}
              >
                <SelectTrigger id="problem-difficulty">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIFFICULTIES.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Label className="flex items-center gap-2">
                <Checkbox
                  checked={must}
                  onCheckedChange={(v) => setMust(v === true)}
                />
                MUST do
              </Label>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="problem-approaches">Approaches</Label>
            <Input
              id="problem-approaches"
              value={approachesText}
              onChange={(e) => setApproachesText(e.target.value)}
              placeholder="Comma separated, e.g. Brute force, Two pointers"
            />
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
            {isEdit ? "Save changes" : "Add problem"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
