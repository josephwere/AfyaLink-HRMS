// notificationsController - placeholder implementations
import express from 'express';

export const index = async (req, res) => {
  res.json({ module: 'notifications', status: 'ok', msg: 'Placeholder response' });
};

// Example: list items
export const list = async (req, res) => {
  res.json([]);
};
