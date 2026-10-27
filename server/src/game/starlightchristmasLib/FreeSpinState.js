/** Small shared state helper for PHP FreeSpin transitions. */
export function advanceFreeSpin(log, completedSpin=true) {
  if(!log || log.FreeSpinNumber===undefined || log.FreeState==='LastFreeSpin')return {...log};
  const next={...log};
  if(completedSpin) next.FreeSpinNumber=Number(log.FreeSpinNumber||0)+1;
  next.FreeSpins=Number(log.FreeSpins||15);
  next.FreeState=next.FreeSpinNumber<=next.FreeSpins?'FreeSpin':'LastFreeSpin';
  return next;
}

export default class FreeSpinState { static advance(log){return advanceFreeSpin(log,true);} static trigger(result){return result?.FreeSpins?{FreeState:'FirstFreeSpin',FreeSpins:result.FreeSpins,FreeSpinNumber:1,FSPay:result.Pay,Scatter:result.Scatter,ScatterPositions:result.ScatterPositions}:result?.AddFreeSpins?{FreeState:'AddFreeSpin',AddFreeSpins:result.AddFreeSpins}:null;} }
