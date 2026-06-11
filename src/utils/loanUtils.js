export function toAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

function isDefined(value) {
  return value !== undefined && value !== null && value !== '';
}

function normalizeLoanId(value) {
  return String(value || '').trim();
}

export function getLoanCollectedAmount(loan, collectionsByLoan) {
  if (!loan) return 0;
  if (isDefined(loan.collected_amount)) {
    return toAmount(loan.collected_amount);
  }

  const loanId = normalizeLoanId(loan.loan_id);
  if (!loanId || !collectionsByLoan) return 0;

  if (collectionsByLoan instanceof Map) {
    return toAmount(collectionsByLoan.get(loanId) || 0);
  }

  if (typeof collectionsByLoan === 'object') {
    return toAmount(collectionsByLoan[loanId] || 0);
  }

  return 0;
}

export function getLoanBalance(loan, collectionsByLoan) {
  if (!loan) return 0;
  if (isDefined(loan.balance_amount)) {
    return toAmount(loan.balance_amount);
  }
  return toAmount(loan.issue_amount) - getLoanCollectedAmount(loan, collectionsByLoan);
}
