// plugins/cma/scripts/lib/render.mjs

function escapeMarkdownCell(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim();
}

export function renderTaskResult(result, meta) {
  if (!result) {
    return `# ${meta.title ?? "CMA Task"}\n\nThe agent produced no output.\n`;
  }

  const lines = [`# ${meta.title ?? "CMA Task"}`, ""];

  if (result.subtype === "error_max_turns") {
    lines.push(`**Warning:** Task hit the turn limit. Partial result below.`, "");
  } else if (result.subtype === "error_max_budget_usd") {
    lines.push(`**Warning:** Task hit the budget limit. Partial result below.`, "");
  } else if (result.subtype === "error_during_execution") {
    lines.push(`**Error:** Task failed during execution.`, "");
  }

  if (result.content) {
    lines.push(result.content, "");
  }

  const stats = [];
  if (result.costUsd != null) stats.push(`$${result.costUsd.toFixed(2)}`);
  if (result.numTurns != null) stats.push(`${result.numTurns} turns`);
  if (result.durationMs != null) stats.push(`${(result.durationMs / 1000).toFixed(1)}s`);
  if (stats.length > 0) {
    lines.push(`Profile: ${meta.profileName ?? "unknown"} | ${stats.join(" | ")}`);
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

export function renderStatusReport(report) {
  const lines = ["# CMA Status", ""];

  if (report.running.length > 0) {
    lines.push("Active jobs:");
    lines.push("| Job | Status | Phase | Elapsed | Actions |");
    lines.push("| --- | --- | --- | --- | --- |");
    for (const job of report.running) {
      const actions = [`/cma:status ${job.id}`, `/cma:cancel ${job.id}`];
      lines.push(
        `| ${escapeMarkdownCell(job.id)} | ${escapeMarkdownCell(job.status)} | ${escapeMarkdownCell(job.phase ?? "")} | ${escapeMarkdownCell(job.elapsed ?? "")} | ${actions.map(a => `\`${a}\``).join(" ")} |`
      );
    }
    lines.push("");
  }

  if (report.latestFinished) {
    lines.push("Latest finished:");
    lines.push(`- ${report.latestFinished.id} | ${report.latestFinished.status} | ${report.latestFinished.duration ?? ""}`);
    if (report.latestFinished.summary) {
      lines.push(`  Summary: ${report.latestFinished.summary}`);
    }
    lines.push("");
  }

  if (report.recent.length > 0) {
    lines.push("Recent jobs:");
    for (const job of report.recent) {
      lines.push(`- ${job.id} | ${job.status} | ${job.duration ?? ""}`);
    }
    lines.push("");
  }

  if (report.running.length === 0 && !report.latestFinished && report.recent.length === 0) {
    lines.push("No jobs recorded yet.", "");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

export function renderJobStatusReport(job) {
  const lines = ["# CMA Job Status", ""];
  lines.push(`- Job: ${job.id}`);
  lines.push(`- Status: ${job.status}`);
  if (job.phase) lines.push(`- Phase: ${job.phase}`);
  if (job.summary) lines.push(`- Summary: ${job.summary}`);
  if (job.elapsed) lines.push(`- Elapsed: ${job.elapsed}`);
  if (job.duration) lines.push(`- Duration: ${job.duration}`);
  if (job.errorMessage) lines.push(`- Error: ${job.errorMessage}`);
  if (job.status === "queued" || job.status === "running") {
    lines.push(`- Cancel: \`/cma:cancel ${job.id}\``);
  }
  if (job.status !== "queued" && job.status !== "running") {
    lines.push(`- Result: \`/cma:result ${job.id}\``);
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

export function renderStoredJobResult(job, storedJob) {
  if (storedJob?.rendered) {
    return storedJob.rendered.endsWith("\n") ? storedJob.rendered : `${storedJob.rendered}\n`;
  }

  const lines = [`# ${job.title ?? "CMA Result"}`, ""];
  lines.push(`Job: ${job.id}`);
  lines.push(`Status: ${job.status}`);
  if (job.summary) lines.push(`Summary: ${job.summary}`);

  if (storedJob?.errorMessage) {
    lines.push("", storedJob.errorMessage);
  } else {
    lines.push("", "No captured result payload was stored for this job.");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

export function renderCancelReport(job) {
  const lines = [
    "# CMA Cancel",
    "",
    `Cancelled ${job.id}.`,
    ""
  ];
  if (job.title) lines.push(`- Title: ${job.title}`);
  lines.push("- Check `/cma:status` for the updated queue.");
  return `${lines.join("\n").trimEnd()}\n`;
}

export function renderSetupReport(report) {
  const lines = ["# CMA Profiles", ""];

  if (!report.profiles || report.profiles.length === 0) {
    lines.push("No profiles configured yet.", "");
    lines.push("Run `/cma:setup add <name>` to create your first profile.");
    return `${lines.join("\n").trimEnd()}\n`;
  }

  lines.push("| Profile | Default | Model | Env Vars |");
  lines.push("| --- | --- | --- | --- |");
  for (const p of report.profiles) {
    lines.push(
      `| ${escapeMarkdownCell(p.name)} | ${p.isDefault ? "default" : ""} | ${escapeMarkdownCell(p.model ?? "")} | ${p.envKeyCount} |`
    );
  }
  lines.push("");

  if (report.defaultProfile) {
    lines.push(`Default profile: ${report.defaultProfile}`);
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

export function renderQueuedTaskLaunch(payload) {
  return `${payload.title} started in the background as ${payload.jobId}. Check /cma:status ${payload.jobId} for progress.\n`;
}
