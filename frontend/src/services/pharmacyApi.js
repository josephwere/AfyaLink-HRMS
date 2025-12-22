// frontend/src/services/pharmacyApi.js
import { apiFetch } from '../utils/apiFetch';

// ===================== PHARMACY API =====================
export async function listItems({ q, page = 1, limit = 25 } = {}) {
  const query = new URLSearchParams({ q, page, limit }).toString();
  const res = await apiFetch(`/pharmacy?${query}`);
  return res.json();
}

export async function getItem(id) {
  const res = await apiFetch(`/pharmacy/${id}`);
  return res.json();
}

export async function createItem(payload) {
  const res = await apiFetch('/pharmacy', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function updateItem(id, payload) {
  const res = await apiFetch(`/pharmacy/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function deleteItem(id) {
  const res = await apiFetch(`/pharmacy/${id}`, {
    method: 'DELETE',
  });
  return res.json();
}

export async function addStock(id, payload) {
  const res = await apiFetch(`/pharmacy/${id}/add-stock`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function dispenseStock(id, payload) {
  const res = await apiFetch(`/pharmacy/${id}/dispense`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.json();
}

// default export compatible with existing imports
export default {
  listItems,
  getItem,
  createItem,
  updateItem,
  deleteItem,
  addStock,
  dispenseStock,
};
