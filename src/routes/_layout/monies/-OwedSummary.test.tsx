/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { OwedSummary } from "./-OwedSummary";

const creditor = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Lumi",
};
const debtor = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Dum",
};

afterEach(cleanup);

describe("OwedSummary", () => {
  it.each([
    ["19999999999.98", "$19,999,999,999.98"],
    ["9007199254740992.01", "$9,007,199,254,740,992.01"],
  ])("formats the exact aggregate CAD string %s", (amount, expected) => {
    render(<OwedSummary summary={{ amount, creditor, debtor }} />);

    expect(screen.getByText(expected)).toBeTruthy();
  });
});
