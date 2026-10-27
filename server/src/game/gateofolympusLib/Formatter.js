/** PHP port: PragmaticLib/Formatter.php */
export default class Formatter {
  static positionsToServer(winLines=[]) {
    const result=[];
    const tmb=[];
    winLines.forEach((w,i)=>{
      result.push(`l${i}=0~${w.Pay}~${(w.Positions||[]).join('~')}`);
      tmb.push((w.Positions||[]).map(pos=>`${pos},${w.WinSymbol}`).join('~'));
    });
    result.push(`tmb=${tmb.join('~')}`);
    return result;
  }
  static toLog(slotArea,index,counter,bet,lines,doubleChance,reelSet,win,log,user,freeSpins) {
    const base={SymbolsAfter:slotArea.SymbolsAfter,SymbolsBelow:slotArea.SymbolsBelow,SlotArea:slotArea.SlotArea,Balance:user.balance,Index:index,Counter:counter,Bet:bet,Lines:lines,DoubleChance:doubleChance,ReelSet:reelSet,TotalWin:win.TotalWin,Win:win.TotalWin};
    return {...base,...this.situationToLog(log,win,freeSpins,base)};
  }
  static situationToLog(log,win,freeSpins,base={}) {
    const out={};
    if(Number(win.TotalWin)>0){
      if(log && ['Respin','FirstRespin'].includes(log.State)) Object.assign(out,{Respin:Number(log.Respin||0)+1,RespinWin:Number(log.RespinWin||0)+win.TotalWin,WinLines:win.WinLines,TotalWin:Number(log.TotalWin||0)+win.TotalWin,tmb_res:Number(log.tmb_res||0)+win.TotalWin,tmb_win:Number(log.tmb_win||0)+win.TotalWin,State:'Respin'});
      else Object.assign(out,{Respin:0,RespinWin:0,WinLines:win.WinLines,tmb_res:win.TotalWin,tmb_win:win.TotalWin,State:'FirstRespin'});
    } else if(log && ['Respin','FirstRespin'].includes(log.State)) {
      Object.assign(out,{Respin:Number(log.Respin||0)+1,RespinWin:Number(log.RespinWin||0),WinLines:[],TotalWin:Number(log.TotalWin||0),tmb_res:Number(log.tmb_res||0),tmb_win:Number(log.tmb_win||0),State:'LastRespin'});
    } else Object.assign(out,{State:'Spin',WinLines:[]});
    if(freeSpins) {
      if(freeSpins.AddFreeSpins) Object.assign(out,{FreeState:'AddFreeSpin',FreeSpins:Number(log?.FreeSpins||0)+Number(freeSpins.AddFreeSpins),FreeSpinNumber:Number(log?.FreeSpinNumber||0)+1});
      else Object.assign(out,{FreeState:'FirstFreeSpin',FreeSpins:freeSpins.FreeSpins,FreeSpinNumber:1,FSPay:freeSpins.Pay,Scatter:freeSpins.Scatter,ScatterPositions:freeSpins.ScatterPositions});
    } else if(log?.FreeSpinNumber && log.FreeState!=='LastFreeSpin') {
      out.FreeSpinNumber=['Spin','LastRespin'].includes(out.State)?Number(log.FreeSpinNumber)+1:Number(log.FreeSpinNumber);
      out.FreeSpins=Number(log.FreeSpins||0);
      out.TotalWin=Number(out.Win||0)+Number(log.TotalWin||0);
      out.FreeState=out.FreeSpinNumber<=out.FreeSpins?'FreeSpin':'LastFreeSpin';
    }
    return out;
  }
  static toServer(logData) {
    const r=[`tw=${logData.TotalWin??0}`,'prg_m=wm',`balance=${logData.Balance??0}`,'prg=1',`index=${logData.Index??1}`,`balance_cash=${logData.Balance??0}`,`reel_set=${logData.ReelSet??0}`,'balance_bonus=0.00','na=s',`bl=${logData.DoubleChance??0}`,`stime=${Date.now()}`,`sa=${(logData.SymbolsAfter||[]).join(',')}`,`sb=${(logData.SymbolsBelow||[]).join(',')}`,'sh=5',`c=${logData.Bet??0}`,'sver=5',`counter=${logData.Counter??2}`,`l=${logData.Lines??20}`,`s=${(logData.SlotArea||[]).join(',')}`,`w=${logData.Win??0}`];
    if(logData.State==='FirstRespin'&&Number(logData.Win)>0)r.push('rs=t',`rs_p=${logData.Respin}`, 'rs_c=1','rs_m=1',`tmb_win=${logData.TotalWin}`);
    if(logData.State==='Respin'&&Number(logData.Win)>0)r.push(`rs_p=${logData.Respin}`,'rs_c=1','rs_m=1',`tmb_win=${logData.TotalWin}`,`rs_win=${logData.RespinWin}`);
    if(logData.State==='LastRespin')r.push('na=c',`rs_t=${logData.Respin}`,`rs_win=${logData.RespinWin}`,`tmb_res=${logData.TotalWin}`,`tmb_win=${logData.TotalWin}`);
    if(logData.FSPay!==undefined)r.push(`psym=${logData.Scatter}~${logData.FSPay}~${(logData.ScatterPositions||[]).join(',')}`);
    if(logData.FreeSpinNumber!==undefined && logData.FreeSpinNumber<logData.FreeSpins)r.push('fsmul=1',`fsmax=${logData.FreeSpins}`,'fswin=0.00',`fs=${logData.FreeSpinNumber}`,'fsres=0.00');
    if(logData.FreeState==='LastFreeSpin')r.push('fsmul_total=1','fswin_total=0.00',`fs_total=${logData.FreeSpinNumber}`,'fsres_total=0.00','fs_bought=10');
    return r;
  }
}
