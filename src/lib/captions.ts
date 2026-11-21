import { Job } from "./jobs";

export function captionsText(job: Job): string {
  return job.variations
    .map(
      (v) =>
        `${v.file} (${v.recipe})\nHook: ${v.hook}\nLegenda: ${v.caption}\n${v.hashtags.map((h) => "#" + h).join(" ")}\n`,
    )
    .join("\n");
}
