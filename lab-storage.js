/* PolyTrack Lab: separate this edition's browser data from every other edition. */
(() => {
  'use strict';
  const lab = window.PolyTrackLab = window.PolyTrackLab || {};
  const prefix = 'polytrack-lab:game:';
  const key = name => prefix + (/record/i.test(name) ? (lab.getPhysicsKey?.() || 'default') + ':' : '') + name;
  lab.storage = {
    getItem: name => localStorage.getItem(key(name)),
    setItem: (name, value) => localStorage.setItem(key(name), value),
    removeItem: name => localStorage.removeItem(key(name)),
    getAllKeys: () => {
      const profile = lab.getPhysicsKey?.() || 'default';
      return Object.keys(localStorage).filter(k => k.startsWith(prefix)).map(k => k.slice(prefix.length))
        .filter(k => !k.includes(':') || k.startsWith(profile + ':'))
        .map(k => k.startsWith(profile + ':') ? k.slice(profile.length + 1) : k);
    }
  };
})();

/* A numbered experiment keeps its settings beside its finish. */
