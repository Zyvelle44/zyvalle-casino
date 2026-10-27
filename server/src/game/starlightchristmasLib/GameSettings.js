/** PHP port: PragmaticLib/GameSettings.php */
export default class GameSettings {
  constructor(init = []) {
    const entries = Array.isArray(init) ? init : Object.entries(init).map(([k,v]) => `${k}=${v}`);
    this.all = {};
    for (const value of entries) {
      const i = String(value).indexOf('=');
      if (i < 0) this.all[String(value)] = '';
      else this.all[String(value).slice(0,i)] = String(value).slice(i+1);
    }
  }
  get(key, fallback = undefined) { return this.all[key] ?? fallback; }
}
