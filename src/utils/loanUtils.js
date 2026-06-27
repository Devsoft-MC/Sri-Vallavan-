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

function getCollectionTotal(value) {
  if (Array.isArray(value)) {
    return value.reduce((total, collection) => (
      total + toAmount(collection?.collection_amount ?? collection)
    ), 0);
  }

  return toAmount(value);
}

export function getLoanCollectedAmount(loan, collectionsByLoan) {
  if (!loan) return 0;
  const loanId = normalizeLoanId(loan.loan_id);

  if (loanId && collectionsByLoan instanceof Map && collectionsByLoan.has(loanId)) {
    return getCollectionTotal(collectionsByLoan.get(loanId));
  }

  if (loanId && collectionsByLoan && typeof collectionsByLoan === 'object' && Object.prototype.hasOwnProperty.call(collectionsByLoan, loanId)) {
    return getCollectionTotal(collectionsByLoan[loanId]);
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
