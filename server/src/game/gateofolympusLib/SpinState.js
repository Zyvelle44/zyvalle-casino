/** Named state transitions extracted from PHP LogAndServer.php. */
export default class SpinState {
  static initial(log,win) {
    if(Number(win?.TotalWin)>0) return log&&['FirstRespin','Respin'].includes(log.State)?'Respin':'FirstRespin';
    if(log&&['FirstRespin','Respin'].includes(log.State))return 'LastRespin';
    return 'Spin';
  }
  static freeState(number,total){return Number(number)<=Number(total)?'FreeSpin':'LastFreeSpin';}
}
