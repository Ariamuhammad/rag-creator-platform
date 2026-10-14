import { expect, test } from 'bun:test';
import { BillingCreditsService } from '../src/modules/billing-credits/billing-credits.service';

test('AI quota uses a conditional decrement in the same transaction as its ledger', async () => {
  const plan = {};
  let sql = '';
  let values: unknown[] = [];
  let ledger: any;
  const prisma = {
    db: {
      raw: {
        sql: (parts: TemplateStringsArray, ...params: unknown[]) => {
          sql = parts.join('?');
          values = params;
          return { returnsRow: () => ({ build: () => plan }) };
        },
      },
    },
  };
  const tx = {
    subscription: {
      findFirst: async ({ where }: any) => {
        expect(where.currentPeriodEnd.gte).toBeInstanceOf(Date);
        return { id: 'subscription', remainingCredits: 100 };
      },
    },
    query: async (input: unknown) => {
      expect(input).toBe(plan);
      return [{ remainingCredits: 70 }];
    },
    creditLedger: {
      create: async ({ data }: any) => {
        ledger = data;
        return { id: 'ledger' };
      },
    },
  };
  const billing = new BillingCreditsService(prisma as any, {} as any);
  const result = await billing.deductTokens(
    'student',
    'creator',
    'session',
    20,
    10,
    tx,
  );
  expect(sql).toContain('"remainingCredits" = "remainingCredits" -');
  expect(sql).toContain('"remainingCredits" >=');
  expect(sql).toContain('"currentPeriodEnd" >= NOW()');
  expect(values).toEqual([30, 'subscription', 30]);
  expect(result.remainingCredits).toBe(70);
  expect(ledger.creditsDeducted).toBe(30);
  ledger = undefined;
  tx.query = async () => [];
  await expect(
    billing.deductTokens('student', 'creator', 'session', 90, 10, tx),
  ).rejects.toThrow('Insufficient credits');
  expect(ledger).toBeUndefined();
});
