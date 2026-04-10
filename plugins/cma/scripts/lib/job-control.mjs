// plugins/cma/scripts/lib/job-control.mjs
import fs from "node:fs";

import { listJobs, readJobFile, resolveJobFile } from "./state.mjs";
import { resolveWorkspaceRoot } from "./workspace.mjs";

export const DEFAULT_MAX_STATUS_JOBS = 8;

export function sortJobsNewestFirst(jobs) {
  return [...jobs].sort((a, b) => String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")));
}

function formatElapsedDuration(startValue, endValue = null) {
  const start = Date.parse(startValue ?? "");
  if (!Number.isFinite(start)) return null;
  const end = endValue ? Date.parse(endValue) : Date.now();
  if (!Number.isFinite(end) || end < start) return null;
  const totalSeconds = Math.max(0, Math.round((end - start) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function enrichJob(job) {
  return {
    ...job,
    kindLabel: job.kindLabel ?? "task",
    elapsed: formatElapsedDuration(job.startedAt ?? job.createdAt, job.completedAt ?? null),
    duration: (job.status === "completed" || job.status === "failed" || job.status === "cancelled")
      ? formatElapsedDuration(job.startedAt ?? job.createdAt, job.completedAt ?? job.updatedAt)
      : null
  };
}

export function readStoredJob(workspaceRoot, jobId) {
  const jobFile = resolveJobFile(workspaceRoot, jobId);
  if (!fs.existsSync(jobFile)) return null;
  return readJobFile(jobFile);
}

function matchJobReference(jobs, reference, predicate = () => true) {
  const filtered = jobs.filter(predicate);
  if (!reference) return filtered[0] ?? null;

  const exact = filtered.find((j) => j.id === reference);
  if (exact) return exact;

  const prefixMatches = filtered.filter((j) => j.id.startsWith(reference));
  if (prefixMatches.length === 1) return prefixMatches[0];
  if (prefixMatches.length > 1) {
    throw new Error(`Job reference "${reference}" is ambiguous. Use a longer job id.`);
  }
  throw new Error(`No job found for "${reference}". Run /cma:status to list known jobs.`);
}

export function buildStatusSnapshot(cwd, options = {}) {
  const workspaceRoot = resolveWorkspaceRoot(cwd);
  const jobs = sortJobsNewestFirst(listJobs(workspaceRoot));
  const maxJobs = options.maxJobs ?? DEFAULT_MAX_STATUS_JOBS;

  const running = jobs
    .filter((j) => j.status === "queued" || j.status === "running")
    .map(enrichJob);

  const latestFinishedRaw = jobs.find((j) => j.status !== "queued" && j.status !== "running") ?? null;
  const latestFinished = latestFinishedRaw ? enrichJob(latestFinishedRaw) : null;

  const recent = jobs.slice(0, maxJobs)
    .filter((j) => j.status !== "queued" && j.status !== "running" && j.id !== latestFinished?.id)
    .map(enrichJob);

  return { workspaceRoot, running, latestFinished, recent };
}

export function buildSingleJobSnapshot(cwd, reference) {
  const workspaceRoot = resolveWorkspaceRoot(cwd);
  const jobs = sortJobsNewestFirst(listJobs(workspaceRoot));
  const selected = matchJobReference(jobs, reference);
  if (!selected) {
    throw new Error(`No job found for "${reference}". Run /cma:status to inspect known jobs.`);
  }
  return { workspaceRoot, job: enrichJob(selected) };
}

export function resolveResultJob(cwd, reference) {
  const workspaceRoot = resolveWorkspaceRoot(cwd);
  const jobs = sortJobsNewestFirst(listJobs(workspaceRoot));

  let finished = null;
  try {
    finished = matchJobReference(
      jobs, reference,
      (j) => j.status === "completed" || j.status === "failed" || j.status === "cancelled"
    );
  } catch {
    // Not found in finished — check active jobs for a better error message
  }

  if (finished) return { workspaceRoot, job: finished };

  let active = null;
  try {
    active = matchJobReference(
      jobs, reference,
      (j) => j.status === "queued" || j.status === "running"
    );
  } catch {
    // Not found in active either
  }

  if (active) {
    throw new Error(`Job ${active.id} is still ${active.status}. Check /cma:status and try again once it finishes.`);
  }
  throw new Error(reference
    ? `No finished job found for "${reference}".`
    : "No finished jobs found for this repository yet.");
}

export function resolveCancelableJob(cwd, reference) {
  const workspaceRoot = resolveWorkspaceRoot(cwd);
  const jobs = sortJobsNewestFirst(listJobs(workspaceRoot));
  const activeJobs = jobs.filter((j) => j.status === "queued" || j.status === "running");

  if (reference) {
    const selected = matchJobReference(activeJobs, reference);
    if (!selected) throw new Error(`No active job found for "${reference}".`);
    return { workspaceRoot, job: selected };
  }

  if (activeJobs.length === 1) return { workspaceRoot, job: activeJobs[0] };
  if (activeJobs.length > 1) {
    throw new Error("Multiple jobs are active. Pass a job id to /cma:cancel.");
  }
  throw new Error("No active jobs to cancel.");
}
