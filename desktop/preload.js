"use strict";
// Preload mínimo: expone SOLO lo necesario al renderizador (contextIsolation activo). No hay acceso a Node ni a Electron.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("bittyDesktop", Object.freeze({
  isDesktop: true,
  platform: process.platform,
  // La app registra aquí su manejador del enlace profundo bitty://confirmed. Solo se reenvía ese valor exacto.
  onDeepLink(cb) {
    if (typeof cb !== "function") return;
    ipcRenderer.on("bitty-deep", (_e, url) => { if (url === "bitty://confirmed") cb(url); });
  }
}));
