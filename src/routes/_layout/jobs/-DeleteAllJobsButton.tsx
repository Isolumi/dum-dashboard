import { useRef, useState } from "react";
import { Trash2 } from "lucide-react";

import { Button } from "#/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "#/components/ui/tooltip";
import { Dialog, DialogContent, DialogTitle } from "#/components/ui/dialog";

export function DeleteAllJobsButton({
  count,
  disabled = false,
  onDelete,
}: {
  count: number;
  disabled?: boolean;
  onDelete(): Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [failed, setFailed] = useState(false);
  const [confirmedCount, setConfirmedCount] = useState(count);
  const pending = useRef(false);

  async function confirmDelete() {
    if (pending.current) return;
    pending.current = true;
    setDeleting(true);
    setFailed(false);
    try {
      if (await onDelete()) setOpen(false);
      else setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      pending.current = false;
      setDeleting(false);
    }
  }

  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Delete all"
              className="shrink-0 text-muted-foreground hover:text-destructive [@media(pointer:coarse)]:size-11"
              disabled={disabled || count === 0 || deleting}
              onClick={() => {
                setFailed(false);
                setConfirmedCount(count);
                setOpen(true);
              }}
            />
          }
        >
          <Trash2 className="size-4" aria-hidden="true" />
        </TooltipTrigger>
        <TooltipContent>Delete all saved jobs</TooltipContent>
      </Tooltip>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!pending.current) setOpen(next);
        }}
      >
        <DialogContent closeLabel="Close bulk job delete confirmation" closeButtonSize="touch">
          <div className="space-y-2 px-5 py-5 pr-12">
            <DialogTitle>Delete all saved jobs?</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Delete all {confirmedCount} saved {confirmedCount === 1 ? "job" : "jobs"}. You cannot
              undo this.
            </p>
            {failed ? (
              <p role="alert" className="text-sm text-destructive">
                Could not delete saved jobs. Try again.
              </p>
            ) : null}
          </div>
          <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 px-4"
              disabled={deleting}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="min-h-11 px-4"
              disabled={deleting}
              onClick={() => void confirmDelete()}
            >
              {deleting ? "Deleting…" : "Delete all"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
