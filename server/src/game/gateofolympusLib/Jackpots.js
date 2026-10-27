/** PHP port: PragmaticLib/Jackpots.php; database writes are delegated to caller. */
export default class Jackpots {
  static toJP(bet, jackpots=[]) {
    let total=0;
    const updates=jackpots.map(j=>{
      const amount=Number(bet)*Number(j.percent||0)/100;
      total+=amount;
      return {...j,balance:Number(j.balance||0)+amount,contribution:amount};
    });
    return {toJackpots:total,updates};
  }
}
