export class UiRoot {
  readonly host: HTMLDivElement;
  readonly shadow: ShadowRoot;
  constructor() {
    document.querySelectorAll('#crovim-ui-root').forEach((el) => el.remove());
    this.host = document.createElement('div');
    this.host.id = 'crovim-ui-root';
    this.shadow = this.host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `:host{all:initial;z-index:2147483647 !important} .hud,.hints,.hint-label,.help-dialog,.vomnibar-frame{z-index:2147483647 !important}.hud{position:fixed;top:12px;right:12px;min-width:180px;background:#202124;color:#fff;padding:8px 12px;border-radius:8px;box-shadow:0 4px 18px #0005;font:14px system-ui;pointer-events:auto}.find-bar{display:flex;align-items:center;gap:8px}.find-bar input{width:280px;border:0;outline:0;background:transparent;color:inherit;font:inherit}.find-count{opacity:.75}.hints{position:fixed;inset:0;pointer-events:none}.hint-label{position:fixed;display:inline-flex;background:#ffe45c;color:#171717;border:1px solid #a98200;border-radius:3px;padding:2px 4px;font:bold 12px/1 monospace;box-shadow:0 1px 3px #0005}.hint-label b.matched{color:#d22;background:#fff}.help-dialog{pointer-events:auto;border:0;border-radius:10px;padding:20px;min-width:320px;max-height:80vh;box-shadow:0 12px 50px #0008}.vomnibar-frame{pointer-events:auto;position:fixed;inset:15% 10%;width:80%;height:210px;border:0;border-radius:12px;box-shadow:0 12px 60px #0008;background:#fff}`;
    this.shadow.append(style);
    this.host.style.setProperty('z-index', '2147483647', 'important');
    const attach = (): void => {
      if (!this.host.isConnected) (document.documentElement ?? document.body)?.append(this.host);
    };
    attach();
    if (!this.host.isConnected) document.addEventListener('DOMContentLoaded', attach, { once: true });
  }
}
