// LocalStorage-backed cart with react hook for reactivity
import { useSyncExternalStore } from "react";

const KEY = "ty_cart_v1";
const listeners = new Set();

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function write(items) {
  try { localStorage.setItem(KEY, JSON.stringify(items)); } catch {}
  listeners.forEach((fn) => fn());
}

export const cart = {
  get: () => read(),
  add: (product, variant = null, qty = 1) => {
    const items = read();
    const key = `${product.id}|${variant || ""}`;
    const idx = items.findIndex((i) => i.key === key);
    if (idx >= 0) items[idx].quantity += qty;
    else items.push({
      key, product_id: product.id, title: product.title,
      price: product.price, currency: product.currency || "usd",
      image: product.images?.[0] || null, variant, quantity: qty,
    });
    write(items);
  },
  updateQty: (key, qty) => {
    const items = read();
    const idx = items.findIndex((i) => i.key === key);
    if (idx < 0) return;
    if (qty <= 0) items.splice(idx, 1);
    else items[idx].quantity = qty;
    write(items);
  },
  remove: (key) => write(read().filter((i) => i.key !== key)),
  clear: () => write([]),
  count: () => read().reduce((n, i) => n + i.quantity, 0),
  subtotal: () => read().reduce((n, i) => n + i.price * i.quantity, 0),
};

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function getSnapshot() { return localStorage.getItem(KEY) || "[]"; }

export function useCart() {
  useSyncExternalStore(subscribe, getSnapshot, () => "[]");
  return {
    items: cart.get(),
    count: cart.count(),
    subtotal: cart.subtotal(),
    add: cart.add,
    updateQty: cart.updateQty,
    remove: cart.remove,
    clear: cart.clear,
  };
}
