import { describe, expect, it, vi } from "vitest";
import {
  RequestBudget,
  RequestBudgetExceededError,
  canProceedWithBudget,
  executeWithBudget,
} from "../src/services/request-budget.js";

describe("RequestBudget", () => {
  it("starts with the full limit available", () => {
    const budget = new RequestBudget(10);

    expect(budget.limit).toBe(10);
    expect(budget.used).toBe(0);
    expect(budget.remaining).toBe(10);
  });

  it("tracks usage after consuming a request", () => {
    const budget = new RequestBudget(10);

    budget.consume();

    expect(budget.used).toBe(1);
    expect(budget.remaining).toBe(9);
  });

  it("allows consuming up to the exact limit", () => {
    const budget = new RequestBudget(10);

    for (let i = 0; i < 10; i += 1) {
      budget.consume();
    }

    expect(budget.used).toBe(10);
    expect(budget.remaining).toBe(0);
    expect(budget.canConsume()).toBe(false);
  });

  it("rejects consuming beyond the limit", () => {
    const budget = new RequestBudget(10);

    for (let i = 0; i < 10; i += 1) {
      budget.consume();
    }

    expect(() => budget.consume()).toThrow(RequestBudgetExceededError);
    expect(budget.used).toBe(10);
    expect(budget.remaining).toBe(0);
  });

  it("never allows the remaining count to go negative", () => {
    const budget = new RequestBudget(1);

    budget.consume();

    expect(() => budget.consume()).toThrow(RequestBudgetExceededError);
    expect(budget.remaining).toBe(0);
  });

  it("supports the configured default of 10 requests per repository", () => {
    const budget = new RequestBudget(10);

    expect(budget.canConsume(10)).toBe(true);
    expect(budget.canConsume(11)).toBe(false);
  });

  it("works with a different configured limit", () => {
    const budget = new RequestBudget(3);

    budget.consume();
    budget.consume();

    expect(budget.canConsume()).toBe(true);
    budget.consume();
    expect(budget.canConsume()).toBe(false);
  });

  it("rejects a non-positive-integer limit", () => {
    expect(() => new RequestBudget(0)).toThrow(RangeError);
    expect(() => new RequestBudget(-1)).toThrow(RangeError);
    expect(() => new RequestBudget(1.5)).toThrow(RangeError);
  });
});

describe("executeWithBudget", () => {
  it("runs the operation and consumes the budget when within limits", async () => {
    const budget = new RequestBudget(2);
    const operation = vi.fn().mockResolvedValue("ok");

    const result = await executeWithBudget(budget, 1, operation);

    expect(result).toBe("ok");
    expect(operation).toHaveBeenCalledTimes(1);
    expect(budget.used).toBe(1);
  });

  it("blocks the operation before it runs when the budget is exhausted", async () => {
    const budget = new RequestBudget(1);
    budget.consume();

    const operation = vi.fn().mockResolvedValue("should not run");

    await expect(executeWithBudget(budget, 1, operation)).rejects.toThrow(
      RequestBudgetExceededError,
    );

    expect(operation).not.toHaveBeenCalled();
    expect(budget.used).toBe(1);
  });

  it("blocks an operation whose cost would exceed remaining capacity", async () => {
    const budget = new RequestBudget(5);
    budget.consume(4);

    const operation = vi.fn().mockResolvedValue("should not run");

    await expect(executeWithBudget(budget, 2, operation)).rejects.toThrow(
      RequestBudgetExceededError,
    );

    expect(operation).not.toHaveBeenCalled();
    expect(budget.used).toBe(4);
  });
});

describe("canProceedWithBudget", () => {
  it("allows proceeding when enough requests remain", () => {
    expect(canProceedWithBudget(10, 10)).toBe(true);
  });

  it("blocks proceeding when too few requests remain", () => {
    expect(canProceedWithBudget(5, 10)).toBe(false);
  });
});
