// appointments_adminController - placeholder implementations
import express from 'express';

export const index = async (req, res) => {
  res.json({ module: 'appointments_admin', status: 'ok', msg: 'Placeholder response' });
};

// Example: list items
export const list = async (req, res) => {
  res.json([]);
};
