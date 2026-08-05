/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ResourceChart } from "./-ResourceChart";

afterEach(cleanup);

describe("ResourceChart 24-hour time domain", () => {
  it("catches the production break where irregular reversed samples are positioned by array index", () => {
    render(
      <ResourceChart
        resource="cpu"
        current={{
          resource: "cpu",
          usagePercent: 100,
          observedAt: "2026-08-04T12:00:00.000Z",
        }}
        history={{
          resource: "cpu",
          points: [
            { timestamp: "2026-08-04T12:00:00.000Z", value: 100 },
            { timestamp: "not-a-timestamp", value: 90 },
            { timestamp: "2026-08-03T12:00:00.000Z", value: 0 },
            { timestamp: "2026-08-04T06:00:00.000Z", value: 50 },
          ],
        }}
      />,
    );

    const chart = screen.getByRole("img", { name: "CPU usage over 24 hours" });
    expect(chart.querySelector("polyline")?.getAttribute("points")).toBe(
      "0.00,72.00 180.00,36.00 240.00,0.00",
    );
  });

  it("catches the production break where a single sample has no visible latest-time marker", () => {
    render(
      <ResourceChart
        resource="memory"
        current={undefined}
        history={{
          resource: "memory",
          points: [{ timestamp: "2026-08-04T06:00:00.000Z", value: 25 }],
        }}
      />,
    );

    const chart = screen.getByRole("img", { name: "Memory usage over 24 hours" });
    expect(chart.querySelector("polyline")?.getAttribute("points")).toBe("240.00,54.00");
    expect(chart.querySelector("circle")?.getAttribute("cx")).toBe("240.00");
    expect(chart.querySelector("circle")?.getAttribute("cy")).toBe("54.00");
  });
});
