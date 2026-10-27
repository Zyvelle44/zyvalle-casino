/** Reconcile Free Spins protocol fields with GatesofOlympus/PragmaticLib/LogAndServer.php. */
const number = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export function reconcileFreeSpinResponse(response, {
  activeBeforeSpin = false,
  state = {},
  newState = {},
  defaultFreeSpins = 15,
} = {}) {
  if (!activeBeforeSpin || typeof response !== 'string') return response;

  const total = Math.max(0, number(newState.FreeSpins, number(state.FreeSpins, defaultFreeSpins)));
  // Do not let a missing/zero next counter silently strip the Free Game fields
  // from a response when the persisted state says a feature was active.
  const nextNumber = Math.max(1, number(newState.FreeSpinNumber, number(state.FreeSpinNumber, 1)));
  const finished = total > 0 && nextNumber > total;
  const fields = response.split('&').filter((field) => !/^(?:fsmul|fsmax|fswin|fs|fsres|fsmul_total|fswin_total|fs_total|fsres_total|fs_bought|puri)=/.test(field));
  let naSeen = false;
  const normalized = fields.map((field) => {
    if (field.startsWith('na=')) {
      if (!naSeen) {
        naSeen = true;
        return `na=${finished ? 'c' : 's'}`;
      }
      return null;
    }
    return field;
  }).filter(Boolean);
  if (!naSeen) normalized.push(`na=${finished ? 'c' : 's'}`);

  if (finished) {
    normalized.push('fsmul_total=1', 'fswin_total=0.00', `fs_total=${total}`, 'fsres_total=0.00', 'fs_bought=10', 'puri=0');
  } else {
    normalized.push('fsmul=1', `fsmax=${total}`, 'fswin=0.00', `fs=${nextNumber}`, 'fsres=0.00');
  }
  return normalized.join('&');
}
