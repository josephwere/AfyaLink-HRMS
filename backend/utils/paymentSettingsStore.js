import PaymentSettings from "../models/PaymentSettings.js";

export const PAYMENT_SETTINGS_KEY = "GLOBAL";

export async function getPaymentSettingsDoc({ lean = false, createIfMissing = true } = {}) {
  let query = PaymentSettings.findOne({ key: PAYMENT_SETTINGS_KEY });
  if (lean) query = query.lean();
  let doc = await query;
  if (doc) return doc;

  let fallback = lean ? await PaymentSettings.findOne().lean() : await PaymentSettings.findOne();
  if (fallback) {
    if (!fallback.key) {
      if (lean) {
        await PaymentSettings.updateOne({ _id: fallback._id }, { $set: { key: PAYMENT_SETTINGS_KEY } });
        fallback = await PaymentSettings.findById(fallback._id).lean();
      } else {
        fallback.key = PAYMENT_SETTINGS_KEY;
        await fallback.save();
      }
    }
    return fallback;
  }

  if (!createIfMissing) return null;

  if (lean) {
    await PaymentSettings.create({ key: PAYMENT_SETTINGS_KEY });
    return PaymentSettings.findOne({ key: PAYMENT_SETTINGS_KEY }).lean();
  }

  return PaymentSettings.create({ key: PAYMENT_SETTINGS_KEY });
}

