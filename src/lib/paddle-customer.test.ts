import { ApiError } from "@paddle/paddle-node-sdk";
import { describe, expect, it, vi } from "vitest";
import {
  existingCustomerIdFromConflict,
  findOrCreatePaddleCustomer,
} from "./paddle-customer";

function conflict(detail: string): ApiError {
  return new ApiError(
    {
      type: "request_error",
      code: "customer_already_exists",
      detail,
      documentation_url:
        "https://developer.paddle.com/v1/errors/customers/customer_already_exists",
    },
    null,
  );
}

describe("existingCustomerIdFromConflict", () => {
  it("reads the existing customer id from Paddle's conflict detail", () => {
    expect(
      existingCustomerIdFromConflict(
        conflict(
          "customer email conflicts with customer of id ctm_01m2nbs3tfyx94wq6w39rn4dsz",
        ),
      ),
    ).toBe("ctm_01m2nbs3tfyx94wq6w39rn4dsz");
  });

  it("ignores other errors", () => {
    expect(existingCustomerIdFromConflict(new Error("nope"))).toBeNull();
  });
});

describe("findOrCreatePaddleCustomer", () => {
  it("creates a customer when the email is new", async () => {
    const customers = {
      create: vi.fn().mockResolvedValue({ id: "ctm_new" }),
      list: vi.fn(),
    };
    await expect(
      findOrCreatePaddleCustomer(customers, {
        email: "new@example.com",
        userId: "user_1",
      }),
    ).resolves.toBe("ctm_new");
    expect(customers.list).not.toHaveBeenCalled();
  });

  it("reuses the Paddle customer when the email already exists", async () => {
    const customers = {
      create: vi.fn().mockRejectedValue(
        conflict(
          "customer email conflicts with customer of id ctm_01m2nbs3tfyx94wq6w39rn4dsz",
        ),
      ),
      list: vi.fn(),
    };
    await expect(
      findOrCreatePaddleCustomer(customers, {
        email: "customer4@demo.test",
        userId: "user_1",
      }),
    ).resolves.toBe("ctm_01m2nbs3tfyx94wq6w39rn4dsz");
    expect(customers.list).not.toHaveBeenCalled();
  });

  it("looks the customer up by email when the conflict has no id", async () => {
    const customers = {
      create: vi.fn().mockRejectedValue(conflict("customer email conflicts")),
      list: vi.fn().mockReturnValue({
        next: vi.fn().mockResolvedValue([{ id: "ctm_listed" }]),
      }),
    };
    await expect(
      findOrCreatePaddleCustomer(customers, {
        email: "customer4@demo.test",
        userId: "user_1",
      }),
    ).resolves.toBe("ctm_listed");
  });
});
