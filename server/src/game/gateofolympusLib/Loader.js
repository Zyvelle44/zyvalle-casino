/** PHP port: PragmaticLib/Loader.php */
export default class Loader {
  static build(lines) { return [...lines].join('&'); }
  constructor(initFile,balance,log=null) {
    this.initFile=[...(Array.isArray(initFile)?initFile:Object.entries(initFile||{}).map(([k,v])=>`${k}=${v}`)),`stime=${Date.now()}`,`balance=${balance}`,`balance_cash=${balance}`];
    this.log=log;
    if(!log) this.initFile.push(...this.mergeLog());
    else if(Array.isArray(log.ServerState)) this.initFile.push(log.ServerState.join('&'));
  }
  initStr(){return this.initFile.join('&');}
  mergeLog(){return ['def_s=3,8,4,8,1,10,6,10,5,7,8,9,6,9,8,7,4,5,3,4,3,8,4,8,1,10,6,10,5,7','s=3,8,4,8,1,10,6,10,5,7,8,9,6,9,8,7,4,5,3,4,3,8,4,8,1,10,6,10,5,7','sa=8,3,4,3,11,3','sb=5,10,11,8,1,7','bl=0','defc=0.10','c=0.10','l=20'];}
}
