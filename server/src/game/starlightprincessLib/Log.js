/** PHP port: PragmaticLib/Log.php. Storage is injected to keep this module DB-agnostic. */
export default class Log {
  constructor(initialLog=null){this.log=initialLog||false;}
  getLog(){return this.log;}
  setLocalLog(log){this.log=log;return this.log;}
  static async setLog(log, save) { if(typeof save!=='function')throw new TypeError('Log.setLog requires an injected persistence callback'); return save(log); }
}
