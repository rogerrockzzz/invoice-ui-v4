/* Injectable id generators. v3 uses Math.random() for invoice ids; tests switch to a sequence. */
let random: () => number = Math.random;
let ledSeq = 9500000;
let walletDocSeq = 400100;
let nextCaseId = 100;

export const setRandom = (fn: (() => number) | null) => {
  random = fn || Math.random;
};
export const resetIds = () => {
  ledSeq = 9500000;
  walletDocSeq = 400100;
  nextCaseId = 100;
};
export const newInvoiceId = () => "INV-" + Math.floor(100000 + random() * 899999);
export const nextLedgerKey = () => ++ledSeq;
export const nextWalletDocNo = () => ++walletDocSeq;
export const nextVisitId = () => nextCaseId++;
