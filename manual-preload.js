// The manual window's only bridge: its text, and links out to the browser.
// Nothing else of Mutiny's (no library, no keys) is reachable from here.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('manual', {
  get: (lang) => ipcRenderer.invoke('manual:get', lang),
  openLink: (url) => ipcRenderer.invoke('link:open', url),
  onRefresh: (cb) => ipcRenderer.on('manual:refresh', () => cb())
});
