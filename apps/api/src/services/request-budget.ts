// A deterministic, in-memory GitHub request budget. One instance is expected to
// represent the request allowance for a single bounded operation (e.g. all GitHub
// calls made while inspecting one repository). It has no knowledge of HTTP or
// GitHub specifics so it stays trivially unit-testable and reusable by future
// analysis phases.
export class RequestBudgetExceededError extends Error {
  constructor(limit: number, used: number) {
    super(`GitHub request budget exhausted: ${used}/${limit} requests used.`);
    this.name = "RequestBudgetExceededError";
  }
}

export class RequestBudget {
  public readonly limit: number;
  private usedCount: number;

  constructor(limit: number) {
    if (!Number.isInteger(limit) || limit < 1) {
      throw new RangeError("RequestBudget limit must be a positive integer.");
    }

    this.limit = limit;
    this.usedCount = 0;
  }

  get used(): number {
    return this.usedCount;
  }

  get remaining(): number {
    return this.limit - this.usedCount;
  }

  canConsume(cost = 1): boolean {
    return cost > 0 && this.usedCount + cost <= this.limit;
  }

  consume(cost = 1): void {
    if (!this.canConsume(cost)) {
      throw new RequestBudgetExceededError(this.limit, this.usedCount);
    }

    this.usedCount += cost;
  }
}

// Reserves `cost` units of the budget before running `operation`, so a request
// that would exceed the budget is rejected without ever reaching GitHub.
export async function executeWithBudget<T>(
  budget: RequestBudget,
  cost: number,
  operation: () => Promise<T>,
): Promise<T> {
  budget.consume(cost);

  return operation();
}

// Reusable primitive for a future Phase 3 preflight check: given how many GitHub
// requests remain in the user's quota and how many a planned operation would need,
// can it proceed without risking exhaustion mid-operation?
export function canProceedWithBudget(
  availableRequests: number,
  requiredRequests: number,
): boolean {
  return availableRequests >= requiredRequests;
}
