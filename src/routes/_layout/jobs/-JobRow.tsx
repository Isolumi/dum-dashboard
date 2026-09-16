import { useState } from "react";
import { ExternalLink, Trash2 } from "lucide-react";

import { Button, buttonVariants } from "#/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "#/components/ui/dialog";
import type { Job } from "#/lib/database.types";

interface JobRowProps {
  job: Job;
  onDelete(id: string): Promise<boolean>;
}

const savedDateFormatter = new Intl.DateTimeFormat("en-CA", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Toronto",
});

function formatSavedDate(value: string): string {
  return savedDateFormatter
    .format(new Date(value))
    .replace(" at ", ", ")
    .replace(/\bAM\b/, "a.m.")
    .replace(/\bPM\b/, "p.m.");
}

function getSafeJobUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? value : null;
  } catch {
    return null;
  }
}

export function JobRow({ job, onDelete }: JobRowProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const safeJobUrl = getSafeJobUrl(job.url);

  async function confirmDelete(): Promise<void> {
    if (deleting) return;
    setDeleting(true);
    try {
      if (await onDelete(job.id)) setConfirmingDelete(false);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <li className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="break-words font-medium">{job.title}</p>
          <p className="mt-1 break-words text-sm text-muted-foreground">{job.company}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Saved {formatSavedDate(job.saved_at)}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {safeJobUrl ? (
            <a
              href={safeJobUrl}
              target="_blank"
              rel="noreferrer"
              aria-label={`Open ${job.title} at ${job.company}`}
              className={buttonVariants({ variant: "outline", className: "min-h-11 px-3" })}
            >
              <ExternalLink data-icon="inline-start" />
              Open
            </a>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11 text-muted-foreground hover:text-destructive"
            onClick={() => setConfirmingDelete(true)}
            aria-label={`Delete ${job.title}`}
          >
            <Trash2 />
          </Button>
        </div>
      </div>

      <Dialog
        open={confirmingDelete}
        onOpenChange={(open) => {
          if (!open && !deleting) setConfirmingDelete(false);
        }}
      >
        <DialogContent closeLabel="Close job delete confirmation" closeButtonSize="touch">
          <div className="space-y-2 px-5 py-5 pr-12">
            <DialogTitle>Delete this saved job?</DialogTitle>
            <p className="break-words text-sm text-muted-foreground">
              Delete “{job.title}” at {job.company}?
            </p>
          </div>
          <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 px-4"
              onClick={() => setConfirmingDelete(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="min-h-11 px-4"
              onClick={() => void confirmDelete()}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </li>
  );
}
