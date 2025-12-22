import PaymentSettings from '../models/PaymentSettings.js';
import { encrypt, decrypt, deriveKeyFromPassword } from '../services/cryptoService.js';
import Audit from '../models/Audit.js';
import otpStore from '../services/otpStore.js';
import notifService from '../services/notificationService.js';

/**
 * saveSettings(req): save encrypted settings (requires admin auth & adminPassword)
 */
export async function saveSettings(req, res) {
  try {
    const { stripe, mpesa, flutterwave, mode, adminPassword } = req.body;
    if (!adminPassword)
      return res.status(400).json({ error: 'adminPassword required to encrypt' });

    const key = deriveKeyFromPassword(adminPassword);

    const payload = {
      stripe: { ...stripe },
      mpesa: { ...mpesa },
      flutterwave: { ...flutterwave },
      mode
    };

    if (payload.stripe?.secret) {
      payload.stripe._enc = encrypt(payload.stripe.secret, key);
      delete payload.stripe.secret;
    }

    if (payload.mpesa?.consumerSecret) {
      payload.mpesa._enc = encrypt(payload.mpesa.consumerSecret, key);
      delete payload.mpesa.consumerSecret;
    }

    if (payload.flutterwave?.secret) {
      payload.flutterwave._enc = encrypt(payload.flutterwave.secret, key);
      delete payload.flutterwave.secret;
    }

    let doc = await PaymentSettings.findOne();

    if (!doc) {
      doc = await PaymentSettings.create({ ...payload, updatedBy: req.user?._id });
    } else {
      Object.assign(doc, payload);
      doc.updatedBy = req.user?._id;
      doc.updatedAt = new Date();
      await doc.save();
    }

    await Audit.create({
      actor: req.user?._id,
      action: 'payment_settings_saved',
      target: 'PaymentSettings',
      details: { mode },
      ip: req.ip
    });

    try {
      await notifService.sendSMS({
        provider: 'twilio',
        to: process.env.ADMIN_ALERT_PHONE || '',
        message: `Payment settings updated by ${req.user?.email || req.user?._id}`
      });
    } catch (e) {}

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}

/**
 * getSettings(req): metadata only, no secrets
 */
export async function getSettings(req, res) {
  try {
    const doc = await PaymentSettings.findOne().lean();
    if (!doc) return res.json({});

    const safe = {
      mode: doc.mode,
      stripe: {
        publishable: doc.stripe?.publishable || null,
        hasSecret: !!doc.stripe?._enc
      },
      mpesa: {
        shortcode: doc.mpesa?.shortcode || null,
        hasSecret: !!doc.mpesa?._enc
      },
      flutterwave: {
        hasSecret: !!doc.flutterwave?._enc
      }
    };

    res.json(safe);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}

/**
 * requestReveal2FA(req): OTP for revealing secrets
 */
export async function requestReveal2FA(req, res) {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'not auth' });

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    await otpStore.setOtp(`reveal:${String(user._id)}`, code, 300);

    const to = user.phone || user.email || process.env.ADMIN_ALERT_PHONE;

    try {
      await notifService.sendSMS({
        provider: 'twilio',
        to,
        message: `Your AfyaLink reveal code is ${code}`
      });
    } catch (e) {}

    await Audit.create({
      actor: user._id,
      action: 'payment_settings_reveal_otp_sent',
      target: 'PaymentSettings',
      details: { to },
      ip: req.ip
    });

    res.json({ ok: true, message: 'OTP sent' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}

/**
 * verifyReveal2FA(req): decrypt secrets after OTP
 */
export async function verifyReveal2FA(req, res) {
  try {
    const user = req.user;
    const { code, adminPassword } = req.body;

    if (!user) return res.status(401).json({ error: 'not auth' });

    const stored = await otpStore.getOtp(`reveal:${String(user._id)}`);
    if (!stored || stored !== String(code))
      return res.status(400).json({ error: 'Invalid or expired code' });

    await otpStore.delOtp(`reveal:${String(user._id)}`);

    const doc = await PaymentSettings.findOne().lean();
    if (!doc) return res.status(404).json({ error: 'no settings found' });

    const key = deriveKeyFromPassword(adminPassword);
    const out = {};

    try {
      if (doc.stripe?._enc)
        out.stripe = {
          secret: decrypt(doc.stripe._enc, key),
          publishable: doc.stripe.publishable
        };

      if (doc.mpesa?._enc)
        out.mpesa = {
          consumerSecret: decrypt(doc.mpesa._enc, key),
          shortcode: doc.mpesa.shortcode,
          consumerKey: doc.mpesa.consumerKey
        };

      if (doc.flutterwave?._enc)
        out.flutterwave = { secret: decrypt(doc.flutterwave._enc, key) };
    } catch (e) {
      return res.status(400).json({ error: 'Decryption failed' });
    }

    await Audit.create({
      actor: user._id,
      action: 'payment_settings_revealed',
      target: 'PaymentSettings',
      details: {},
      ip: req.ip
    });

    res.json({ ok: true, secrets: out });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}

/**
 * rotateAdminPassword(req): re-encrypt secrets with new password
 */
export async function rotateAdminPassword(req, res) {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword)
      return res
        .status(400)
        .json({ error: 'oldPassword and newPassword required' });

    const doc = await PaymentSettings.findOne();
    if (!doc) return res.status(404).json({ error: 'no settings found' });

    const oldKey = deriveKeyFromPassword(oldPassword);

    try {
      const stripeSecret = doc.stripe?._enc
        ? decrypt(doc.stripe._enc, oldKey)
        : null;

      const mpesaSecret = doc.mpesa?._enc
        ? decrypt(doc.mpesa._enc, oldKey)
        : null;

      const flutterSecret = doc.flutterwave?._enc
        ? decrypt(doc.flutterwave._enc, oldKey)
        : null;

      const newKey = deriveKeyFromPassword(newPassword);

      if (stripeSecret) doc.stripe._enc = encrypt(stripeSecret, newKey);
      if (mpesaSecret) doc.mpesa._enc = encrypt(mpesaSecret, newKey);
      if (flutterSecret)
        doc.flutterwave._enc = encrypt(flutterSecret, newKey);

      await doc.save();

      await Audit.create({
        actor: req.user?._id,
        action: 'payment_settings_password_rotated',
        target: 'PaymentSettings',
        details: {},
        ip: req.ip
      });

      res.json({ ok: true });
    } catch (e) {
      return res
        .status(400)
        .json({ error: 'Old password invalid or decryption failed' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}

export default {
  saveSettings,
  getSettings,
  requestReveal2FA,
  verifyReveal2FA,
  rotateAdminPassword
};
