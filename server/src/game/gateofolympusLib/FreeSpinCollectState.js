/** Preserve the active Free Game counter if a legacy client calls doCollect mid-feature. */
export function hasRemainingFreeSpins(state = {}) {
  const number = Number(state.FreeSpinNumber || 0);
  const total = Number(state.FreeSpins || 0);
  return Number.isFinite(number) && Number.isFinite(total) && number > 0 && total > 0 && number <= total;
}

export function preserveFreeSpinsAfterCollect(state = {}) {
  const active = hasRemainingFreeSpins(state);
  if (!active) {
    return {
      ...state,
      pendingCollect: 0,
      TotalWin: 0,
      Win: 0,
      State: 'Spin',
      FreeState: 'LastFreeSpin',
      WinLines: [],
      FreeSpinNumber: 0,
      FreeSpins: 0,
      Multipliers: [],
      PrgSum: 0,
      MultWin: 0,
      TumbleWin: 0,
      Respin: 0,
      RespinWin: 0,
      PendingFeatureTrigger: null,
    };
  }

  return {
    ...state,
    pendingCollect: 0,
    Win: 0,
    State: 'Spin',
    // In this engine the last spin is still active when number === total.
    // LastFreeSpin is reserved for the state after number advances past total.
    FreeState: 'FreeSpin',
    FreeSpinNumber: Number(state.FreeSpinNumber),
    FreeSpins: Number(state.FreeSpins),
    WinLines: [],
    TumbleWin: 0,
    Respin: 0,
    RespinWin: 0,
  };
}
