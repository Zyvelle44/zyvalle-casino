/** PHP port: PragmaticLib/WinChecker.php */
export default class WinChecker {
  constructor(gameSettings) {
    this.paytable = String(gameSettings.paytable||'').split(';').map(row=>row.split(',').map(v=>Number(v)));
  }
  getWin(bet, slotArea) {
    const symbols = slotArea.SlotArea || slotArea;
    const counts = new Map();
    symbols.forEach(s=>counts.set(Number(s),(counts.get(Number(s))||0)+1));
    const WinLines=[]; let TotalWin=0;
    for(const [symbol,count] of counts){
      const row=this.paytable[symbol]||[];
      const raw=Number(row[row.length-count]||0);
      const Pay=Math.round((raw*Number(bet)+Number.EPSILON)*100)/100;
      if(Pay>0){
        const Positions=[]; symbols.forEach((s,i)=>{if(Number(s)===symbol)Positions.push(i);});
        WinLines.push({WinSymbol:symbol,CountSymbols:count,Pay,Positions});
        TotalWin=Math.round((TotalWin+Pay+Number.EPSILON)*100)/100;
      }
    }
    return {TotalWin,WinLines};
  }
}
