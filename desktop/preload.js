"use strict";
// Preload mínimo: expone SOLO lo necesario al renderizador (contextIsolation activo). No hay acceso a Node ni a Electron.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("bittyDesktop", Object.freeze({
  isDesktop: true,
  platform: process.platform,
  // Versión instalada (1.0.N). Se valida el formato; vacío si no se puede saber.
  version: (() => { try { const v = ipcRenderer.sendSync("bitty-version"); return typeof v === "string" && /^\d{1,3}\.\d{1,3}\.\d{1,6}$/.test(v) ? v : ""; } catch (e) { return ""; } })(),
  // La app registra aquí su manejador del enlace profundo bitty://confirmed. Solo se reenvía ese valor exacto.
  onDeepLink(cb) {
    if (typeof cb !== "function") return;
    ipcRenderer.on("bitty-deep", (_e, url) => { if (url === "bitty://confirmed") cb(url); });
  }
}));
