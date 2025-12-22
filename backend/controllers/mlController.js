import { trainModelPlaceholder, predictWithModelPlaceholder } from '../utils/aiAdvanced.js';

export const trainModel = async (req, res, next) => {
  try {
    const data = req.body;
    const out = await trainModelPlaceholder(data);
    res.json(out);
  } catch (err) { next(err); }
};

export const predictModel = async (req, res, next) => {
  try {
    const { modelId } = req.params;
    const input = req.body;
    const out = await predictWithModelPlaceholder(modelId, input);
    res.json(out);
  } catch (err) { next(err); }
};
