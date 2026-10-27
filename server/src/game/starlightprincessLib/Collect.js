/** PHP port: PragmaticLib/Collect.php; caller supplies DB-locked wallet and state. */
export default class Collect {
  static collect({balance,totalWin=0,index=1,counter=2}) {
    const nextBalance=Number(balance)+Number(totalWin);
    return {balance:nextBalance,response:[
      `balance=${nextBalance}`,`index=${index}`,`balance_cash=${nextBalance}`,
      'balance_bonus=0.00','na=s',`stime=${Date.now()}`,'sver=5',`counter=${counter}`
    ].join('&')};
  }
}
