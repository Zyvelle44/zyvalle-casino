/** PHP port: PragmaticLib/WinPermission.php */
export default class WinPermission {
  static winCheck(freespins,buyFS,bank,currentState,win,multipliers,log) {
    if(freespins && buyFS!=='0' && Object.hasOwn(freespins,'Pay') && Number(bank.bonus)<Number(freespins.Pay))return false;
    if(!freespins && !Object.hasOwn(currentState,'FreeSpinNumber') && Number(bank.slots)<Number(win))return false;
    if(Object.hasOwn(currentState,'FreeSpinNumber') && currentState.FreeState!=='FirstFreeSpin') {
      if(currentState.State==='LastRespin' && Object.hasOwn(log||{},'BankCredit')) delete log.BankCredit;
      let amount=Object.hasOwn(currentState,'tmb_win')?Number(currentState.tmb_win):Number(win);
      if(multipliers && multipliers.length) {
        let total=multipliers.reduce((s,m)=>s+Number(m.Multiplier),0);
        if(currentState.State==='LastRespin') total=Number(currentState.PrgSum||0);
        else total+=Number(currentState.PrgSum||0);
        amount=(Object.hasOwn(currentState,'tmb_win')?Number(currentState.tmb_win):Number(win))*total;
      }
      if(Number(bank.bonus)<amount)return false;
      return {CurrentWin:currentState.State==='LastRespin'?amount:0};
    }
    return true;
  }
}
