import { ExternalLink } from "lucide-react";

import { Button } from "#/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "#/components/ui/tooltip";
import type { Job } from "#/lib/database.types";
import { getSafeJobUrl } from "./-job-links";

export function OpenAllJobsButton({
  jobs,
  disabled = false,
}: {
  jobs: readonly Pick<Job, "url">[];
  disabled?: boolean;
}) {
  const links = [
    ...new Set(jobs.map((job) => getSafeJobUrl(job.url)).filter((url) => url !== null)),
  ];

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Open all"
            className="shrink-0 text-muted-foreground [@media(pointer:coarse)]:size-11"
            disabled={disabled || links.length === 0}
            title="Allow pop-ups for DumQ if tabs do not open."
            onClick={() => {
              // Keep every open inside the click; an async callback loses user activation.
              for (const url of links) window.open(url, "_blank", "noopener,noreferrer");
            }}
          />
        }
      >
        <ExternalLink className="size-4" aria-hidden="true" />
      </TooltipTrigger>
      <TooltipContent>Open all jobs</TooltipContent>
    </Tooltip>
  );
}
