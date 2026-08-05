import { describe, expect, it } from "vitest";
import {
  evaluateCertificate,
  evaluateNode,
  evaluateResources,
  evaluateSourceFreshness,
  evaluateWorkload,
  rollUpStatus,
} from "./health-rules";

describe("node health", () => {
  it.each([
    [{ name: "dumachine", ready: false }, "critical", "node-not-ready"],
    [{ name: "dumachine", ready: true }, "healthy", "node-ready"],
  ] as const)("evaluates node health", (input, status, ruleId) => {
    expect(evaluateNode(input)).toMatchObject({ status, ruleId });
  });
});

describe("workload health", () => {
  it.each([
    [
      {
        kind: "Deployment",
        name: "gateway",
        desiredReplicas: 2,
        availableReplicas: 0,
      },
      "critical",
      "workload-unavailable",
    ],
    [
      {
        kind: "Deployment",
        name: "gateway",
        desiredReplicas: 2,
        availableReplicas: 1,
      },
      "warning",
      "workload-partially-available",
    ],
    [
      {
        kind: "Deployment",
        name: "gateway",
        desiredReplicas: 2,
        availableReplicas: 2,
      },
      "healthy",
      "workload-ready",
    ],
    [
      {
        kind: "Deployment",
        name: "gateway",
        desiredReplicas: 2,
        availableReplicas: 2,
        restartIncrease15m: true,
      },
      "warning",
      "workload-restarts-increasing",
    ],
    [
      {
        kind: "Deployment",
        name: "gateway",
        desiredReplicas: 2,
        availableReplicas: 0,
        failureReason: "CrashLoopBackOff",
      },
      "critical",
      "workload-failure-unavailable",
    ],
  ] as const)("evaluates workload health", (input, status, ruleId) => {
    expect(evaluateWorkload(input)).toMatchObject({ status, ruleId });
  });
});

describe("certificate health", () => {
  const now = Date.parse("2026-08-04T00:00:00Z");

  it.each([
    [{ name: "dashboard", expiresAt: "2026-08-03T23:59:59Z" }, "critical", "certificate-expired"],
    [{ name: "dashboard", expiresAt: "2026-08-04T00:00:00Z" }, "critical", "certificate-expired"],
    [{ name: "dashboard", expiresAt: "2026-08-18T00:00:00Z" }, "warning", "certificate-expiring"],
    [{ name: "dashboard", expiresAt: "2026-08-19T00:00:00Z" }, "healthy", "certificate-valid"],
  ] as const)("evaluates certificate expiry", (input, status, ruleId) => {
    expect(evaluateCertificate(input, now)).toMatchObject({ status, ruleId });
  });
});

describe("resource health", () => {
  it.each([
    [{ resource: "cpu", usagePercent: 85, sustainedMinutes: 5 }, "warning", "cpu-usage-warning"],
    [
      { resource: "memory", usagePercent: 95, sustainedMinutes: 5 },
      "critical",
      "memory-usage-critical",
    ],
    [{ resource: "cpu", usagePercent: 99, sustainedMinutes: 4 }, "healthy", "cpu-usage-normal"],
    [{ resource: "disk", usagePercent: 90, sustainedMinutes: 0 }, "warning", "disk-usage-warning"],
    [
      { resource: "disk", usagePercent: 97, sustainedMinutes: 0 },
      "critical",
      "disk-usage-critical",
    ],
  ] as const)("evaluates resource thresholds", (input, status, ruleId) => {
    expect(evaluateResources(input)).toMatchObject({ status, ruleId });
  });
});

describe("source freshness", () => {
  it("never reports stale source data as healthy", () => {
    expect(
      evaluateSourceFreshness("2026-08-04T00:00:00Z", Date.parse("2026-08-04T00:00:31Z")),
    ).toMatchObject({ status: "unknown", ruleId: "source-stale" });
  });

  it("accepts source data at the thirty-second limit", () => {
    expect(
      evaluateSourceFreshness("2026-08-04T00:00:00Z", Date.parse("2026-08-04T00:00:30Z")),
    ).toMatchObject({ status: "healthy", ruleId: "source-fresh" });
  });
});

describe("status roll-up", () => {
  const healthy = {
    status: "healthy",
    ruleId: "healthy",
    reason: "Healthy",
    evidence: {},
  } as const;
  const warning = {
    status: "warning",
    ruleId: "warning",
    reason: "Warning",
    evidence: {},
  } as const;
  const critical = {
    status: "critical",
    ruleId: "critical",
    reason: "Critical",
    evidence: {},
  } as const;
  const unknown = {
    status: "unknown",
    ruleId: "unknown",
    reason: "Unknown",
    evidence: {},
  } as const;

  it.each([
    [[healthy, critical, warning], "critical"],
    [[healthy, warning, unknown], "warning"],
    [[healthy, unknown], "unknown"],
    [[healthy], "healthy"],
  ] as const)("uses proven failures before unknown evidence", (evaluations, status) => {
    expect(rollUpStatus(evaluations)).toMatchObject({ status });
  });

  it("keeps unknown evaluations separate from proven issues", () => {
    const rollup = rollUpStatus([critical, unknown]);

    expect(rollup.issues).toEqual([critical]);
    expect(rollup.unknownIssues).toEqual([unknown]);
  });
});
