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
  const loanId = normalizeLoanId(loan.loan_id);

  if (loanId && collectionsByLoan instanceof Map && collectionsByLoan.has(loanId)) {
    return toAmount(collectionsByLoan.get(loanId) || 0);
  }

  if (loanId && collectionsByLoan && typeof collectionsByLoan === 'object' && Object.prototype.hasOwnProperty.call(collectionsByLoan, loanId)) {
    return toAmount(collectionsByLoan[loanId] || 0);
  }

  if (isDefined(loan.collected_amount)) {
    return toAmount(loan.collected_amount);
  }

  return 0;
}

export function getLoanBalance(loan, collectionsByLoan) {
  if (!loan) return 0;
  if (!collectionsByLoan && isDefined(loan.balance_amount)) {
    return toAmount(loan.balance_amount);
  }
  return toAmount(loan.issue_amount) - getLoanCollectedAmount(loan, collectionsByLoan);
}
