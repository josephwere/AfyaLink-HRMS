// frontend/src/services/pharmacyApi.js
import { apiFetch } from '../utils/apiFetch';

// ===================== PHARMACY API =====================
export async function listItems({ q, page = 1, limit = 25 } = {}) {
  const query = new URLSearchParams({ q, page, limit }).toString();
  return apiFetch(`/api/pharmacy?${query}`);
}

export async function getItem(id) {
  return apiFetch(`/api/pharmacy/${id}`);
}

export async function createItem(payload) {
  return apiFetch("/api/pharmacy", {
    method: 'POST',
    body: payload,
  });
}

export async function updateItem(id, payload) {
  return apiFetch(`/api/pharmacy/${id}`, {
    method: 'PUT',
    body: payload,
  });
}

export async function deleteItem(id) {
  return apiFetch(`/api/pharmacy/${id}`, {
    method: 'DELETE',
  });
}

export async function addStock(id, payload) {
  return apiFetch(`/api/pharmacy/${id}/add-stock`, {
    method: 'POST',
    body: payload,
  });
}

export async function dispenseStock(id, payload) {
  return apiFetch(`/api/pharmacy/${id}/dispense`, {
    method: 'POST',
    body: payload,
  });
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
