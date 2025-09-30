export const fmt = (n) =>
  Math.abs(n) >= 1000 ? n.toFixed(0) : parseFloat(n.toFixed(2));

export const ids = (id) => document.getElementById(id); 