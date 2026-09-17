import { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Skeleton } from "#/components/ui/skeleton";
import type { BuyListItem } from "#/lib/database.types";
import type { BuyListController } from "./-useBuyListController";

function BuyListRow({ item, controller }: { item: BuyListItem; controller: BuyListController }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.name);
  const savingRef = useRef(false);
  const nameButtonRef = useRef<HTMLButtonElement>(null);
  const wasEditingRef = useRef(false);
  useEffect(() => {
    if (!editing && wasEditingRef.current) nameButtonRef.current?.focus();
    wasEditingRef.current = editing;
  }, [editing]);
  const pending = controller.pendingIds.has(item.id);
  const close = () => {
    setEditing(false);
  };
  const save = async () => {
    if (savingRef.current || pending || !draft.trim()) return;
    savingRef.current = true;
    try {
      if (await controller.rename(item.id, draft.trim())) close();
    } finally {
      savingRef.current = false;
    }
  };
  return (
    <li
      className="group flex min-w-0 items-center gap-1 border-b border-border/40 last:border-0"
      aria-busy={pending}
    >
      {editing ? (
        <Input
          aria-label="Rename item"
          autoFocus
          maxLength={300}
          value={draft}
          disabled={pending}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === "Enter") {
              event.preventDefault();
              void save();
            }
            if (event.key === "Escape") {
              event.preventDefault();
              close();
            }
          }}
        />
      ) : (
        <button
          ref={nameButtonRef}
          type="button"
          aria-label={`Rename ${item.name}`}
          disabled={pending}
          className="min-w-0 flex-1 rounded-sm py-2 text-left text-sm break-words whitespace-pre-wrap outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          onClick={() => {
            setDraft(item.name);
            setEditing(true);
          }}
        >
          {item.name}
        </button>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={`Delete ${item.name}`}
        disabled={pending}
        className="size-8 shrink-0 text-muted-foreground hover:text-destructive focus-visible:opacity-100 [@media(hover:hover)_and_(pointer:fine)]:opacity-0 [@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-100 [@media(hover:hover)_and_(pointer:fine)]:group-focus-within:opacity-100"
        onClick={() => void controller.remove(item.id)}
      >
        <Trash2 className="size-3.5" />
      </Button>
    </li>
  );
}

export function BuyList({
  controller,
  compact,
}: {
  controller: BuyListController;
  compact: boolean;
}) {
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const addingRef = useRef(false);
  const add = async () => {
    const name = draft.trim();
    if (!name || addingRef.current || controller.status !== "ready") return;
    addingRef.current = true;
    setAdding(true);
    try {
      if (await controller.add(name)) setDraft("");
    } finally {
      addingRef.current = false;
      setAdding(false);
    }
  };
  return (
    <div className="space-y-3">
      {controller.status === "loading" ? (
        <div role="status" aria-label="Loading Buy list" className="space-y-2">
          <span className="sr-only">Loading Buy list…</span>
          <Skeleton className="h-8 w-full motion-reduce:animate-none" />
        </div>
      ) : null}
      {controller.loadError ? (
        <div role="alert" className="text-sm text-destructive">
          <p>{controller.loadError}</p>
          <Button
            type="button"
            variant="outline"
            className="mt-2"
            onClick={() => void controller.refresh()}
          >
            Try again
          </Button>
        </div>
      ) : null}
      {controller.status === "ready" ? (
        <>
          {controller.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No items</p>
          ) : (
            <ul aria-label="Items to buy" className={compact ? "max-h-80 overflow-y-auto" : ""}>
              {controller.items.map((item) => (
                <BuyListRow key={item.id} item={item} controller={controller} />
              ))}
            </ul>
          )}
        </>
      ) : null}
      <form
        className="flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void add();
        }}
      >
        <Input
          aria-label="Item to buy"
          placeholder="Item to buy"
          maxLength={300}
          value={draft}
          disabled={adding || controller.status !== "ready"}
          onChange={(event) => setDraft(event.target.value)}
        />
        <Button type="submit" disabled={adding || !draft.trim() || controller.status !== "ready"}>
          Add
        </Button>
      </form>
      {controller.mutationError ? (
        <p role="alert" className="text-sm text-destructive">
          {controller.mutationError}
        </p>
      ) : null}
    </div>
  );
}
