import { getLoanBalance, getLoanCollectedAmount } from './loanUtils';

describe('loanUtils', () => {
  const loan = {
    loan_id: 'PL1286',
    issue_amount: 50000,
    collected_amount: 0,
  };

  test('totals an array of collection records for a loan', () => {
    const collectionsByLoan = new Map([
      ['PL1286', [
        { collection_amount: '500.00' },
        { collection_amount: 500 },
        { collection_amount: null },
      ]],
    ]);

    expect(getLoanCollectedAmount(loan, collectionsByLoan)).toBe(1000);
    expect(getLoanBalance(loan, collectionsByLoan)).toBe(49000);
  });

  test('continues to support pre-aggregated collection totals', () => {
    const collectionsByLoan = new Map([['PL1286', 1250]]);

    expect(getLoanCollectedAmount(loan, collectionsByLoan)).toBe(1250);
  });

  test('uses the loan total when no collection map entry exists', () => {
    expect(getLoanCollectedAmount(
      { ...loan, collected_amount: '750.00' },
      new Map()
    )).toBe(750);
  });
});
