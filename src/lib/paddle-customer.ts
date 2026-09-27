import { ApiError } from "@paddle/paddle-node-sdk";

type PaddleCustomer = { id: string };

type PaddleCustomers = {
  create: (body: {
    email: string;
    customData: { userId: string };
  }) => Promise<PaddleCustomer>;
  list: (query: {
    email: string[];
    perPage: number;
  }) => { next: () => Promise<PaddleCustomer[]> };
};

const CUSTOMER_ID = /\bctm_[a-z0-9]+\b/i;

export function existingCustomerIdFromConflict(error: unknown): string | null {
  if (!(error instanceof ApiError) || error.code !== "customer_already_exists") {
    return null;
  }
  return error.detail.match(CUSTOMER_ID)?.[0] ?? null;
}

export async function findOrCreatePaddleCustomer(
  customers: PaddleCustomers,
  input: { email: string; userId: string },
): Promise<string> {
  try {
    const created = await customers.create({
      email: input.email,
      customData: { userId: input.userId },
    });
    return created.id;
  } catch (error) {
    const fromDetail = existingCustomerIdFromConflict(error);
    if (fromDetail) return fromDetail;
    if (!(error instanceof ApiError) || error.code !== "customer_already_exists") {
      throw error;
    }
    const matches = await customers.list({
      email: [input.email],
      perPage: 1,
    }).next();
    const existing = matches[0];
    if (!existing?.id) throw error;
    return existing.id;
  }
}
