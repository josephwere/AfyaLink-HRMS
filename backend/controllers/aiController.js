import Appointment from '../models/Appointment.js';
import Prescription from '../models/Prescription.js';
import User from '../models/User.js';
import { extractDocumentBase64, assistantChat, assistantChatStream, assistantFeedback } from '../services/aiAdapter.js';
import { logAudit } from '../services/auditService.js';
import { normalizeRole } from '../utils/normalizeRole.js';
import { resolvePatientIdsForUser } from '../services/familyMonitoringService.js';

const MAX_ASSISTANT_HISTORY = 30;
const MAX_ASSISTANT_TEXT = 600;
const RETENTION_DAYS = 14;
const MAX_DICTIONARY_TERMS = 32;
const MAX_DOT_PHRASES = 24;
const MAX_WORKFLOW_TEMPLATES = 16;
const DEFAULT_AUTOFILL_THRESHOLD = 0.88;

function normalizeChatMessage(role, text) {
  const clean = String(text || '').trim();
  if (!clean) return null;
  return {
    role,
    text: clean.slice(0, MAX_ASSISTANT_TEXT),
    createdAt: new Date().toISOString(),
  };
}

function getRetentionCutoff() {
  return new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
}

function normalizeHospitalKey(value) {
  const key = String(value || '').trim();
  return key || 'GLOBAL';
}

function trimText(value, max = 2400) {
  return String(value || '').trim().slice(0, max);
}

function normalizeAssistantRating(value) {
  return String(value || '').toLowerCase() === 'down' ? 'down' : 'up';
}

function normalizeStringList(value, { maxItems = 24, maxLength = 120 } = {}) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => trimText(entry, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function normalizeMedications(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((m) => ({
      name: trimText(m?.name, 120),
      dosage: trimText(m?.dosage, 120),
      schedule: trimText(m?.schedule, 120),
    }))
    .filter((m) => m.name || m.dosage || m.schedule)
    .slice(0, 24);
}

function normalizeDictionaryTerms(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => {
      if (typeof row === 'string') {
        const [term, replacement] = row.split(/\s*=>\s*/);
        return {
          term: trimText(term, 120),
          replacement: trimText(replacement, 240),
        };
      }
      return {
        term: trimText(row?.term, 120),
        replacement: trimText(row?.replacement, 240),
      };
    })
    .filter((row) => row.term && row.replacement)
    .slice(0, MAX_DICTIONARY_TERMS);
}

function normalizeDotPhrases(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => {
      if (typeof row === 'string') {
        const [shortcut, content] = row.split(/\s*=>\s*/);
        return {
          shortcut: trimText(shortcut, 80),
          content: trimText(content, 600),
          scope: 'global',
        };
      }
      return {
        shortcut: trimText(row?.shortcut, 80),
        content: trimText(row?.content, 600),
        scope: trimText(row?.scope || 'global', 40).toLowerCase() || 'global',
      };
    })
    .filter((row) => row.shortcut && row.content)
    .slice(0, MAX_DOT_PHRASES);
}

function normalizeWorkflowTemplates(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => {
      if (typeof row === 'string') {
        const [workflow, instructions] = row.split(/\s*:\s*/);
        return {
          workflow: trimText(workflow, 80).toLowerCase(),
          instructions: trimText(instructions, 1000),
        };
      }
      return {
        workflow: trimText(row?.workflow, 80).toLowerCase(),
        instructions: trimText(row?.instructions, 1000),
      };
    })
    .filter((row) => row.workflow && row.instructions)
    .slice(0, MAX_WORKFLOW_TEMPLATES);
}

function normalizeAutofillPreferences(value = {}) {
  const threshold = Number(value?.confidenceThreshold);
  return {
    autoApplyHighConfidence: value?.autoApplyHighConfidence === true,
    confidenceThreshold:
      Number.isFinite(threshold) && threshold >= 0.5 && threshold <= 0.99
        ? Number(threshold.toFixed(2))
        : DEFAULT_AUTOFILL_THRESHOLD,
    reviewUnmatchedOnly: value?.reviewUnmatchedOnly === true,
    preferHoverReveal: value?.preferHoverReveal === true,
  };
}

function normalizeAssistantProfileInput(incoming = {}) {
  return {
    conditions: normalizeStringList(incoming.conditions, { maxItems: 24, maxLength: 120 }),
    medications: normalizeMedications(incoming.medications),
    notes: trimText(incoming.notes, 2400),
    dictionaryTerms: normalizeDictionaryTerms(incoming.dictionaryTerms),
    dotPhrases: normalizeDotPhrases(incoming.dotPhrases),
    workflowTemplates: normalizeWorkflowTemplates(incoming.workflowTemplates),
    autofillPreferences: normalizeAutofillPreferences(incoming.autofillPreferences),
    updatedAt: new Date().toISOString(),
  };
}

function hydrateAssistantProfile(stored = {}) {
  const normalized = normalizeAssistantProfileInput(stored);
  return {
    ...normalized,
    updatedAt: trimText(stored?.updatedAt, 80) || normalized.updatedAt,
  };
}

function getScopedAssistantProfile(userOrMetadata, hospitalKey = 'GLOBAL') {
  const metadata =
    userOrMetadata?.metadata && typeof userOrMetadata.metadata === 'object'
      ? userOrMetadata.metadata
      : userOrMetadata && typeof userOrMetadata === 'object'
      ? userOrMetadata
      : {};
  const legacy = metadata.aiAssistant && typeof metadata.aiAssistant === 'object' ? metadata.aiAssistant : {};
  const map = metadata.aiAssistantByHospital && typeof metadata.aiAssistantByHospital === 'object' ? metadata.aiAssistantByHospital : {};
  const scoped = map[hospitalKey] || (hospitalKey === 'GLOBAL' ? legacy : map.GLOBAL || legacy);
  return hydrateAssistantProfile(scoped || {});
}

function sanitizeAutofillAuditItems(items = []) {
  if (!Array.isArray(items)) return [];
  return items.slice(0, 40).map((item) => ({
    fieldKey: trimText(item?.fieldKey, 120),
    fieldLabel: trimText(item?.fieldLabel, 180),
    value: trimText(item?.value, 240),
    confidence: Number.isFinite(Number(item?.confidence)) ? Number(Number(item.confidence).toFixed(2)) : null,
    evidence: trimText(item?.evidence, 400),
    reason: trimText(item?.reason, 240),
    status: trimText(item?.status, 40),
  }));
}

async function appendAssistantMemory(user, hospitalKey, entries = []) {
  if (!user) return [];
  const metadata = user.metadata && typeof user.metadata === 'object' ? user.metadata : {};
  const legacy = metadata.aiAssistantMemory?.messages || [];
  const map = metadata.aiAssistantMemoryByHospital || {};
  if (!map.GLOBAL && legacy.length) {
    map.GLOBAL = {
      messages: legacy,
      updatedAt: metadata.aiAssistantMemory?.updatedAt || new Date().toISOString(),
    };
  }

  const key = normalizeHospitalKey(hospitalKey);
  const existing = map[key]?.messages || (key === 'GLOBAL' ? legacy : []);
  const cutoff = getRetentionCutoff();
  const filtered = existing.filter((entry) => {
    const ts = entry?.createdAt ? new Date(entry.createdAt) : null;
    return ts && !Number.isNaN(ts.getTime()) ? ts >= cutoff : true;
  });

  const next = [...filtered, ...entries.filter(Boolean)].slice(-MAX_ASSISTANT_HISTORY);
  const updatedAt = new Date().toISOString();
  map[key] = { messages: next, updatedAt };

  user.metadata = {
    ...metadata,
    aiAssistantMemoryByHospital: map,
    aiAssistantMemory: {
      messages: map.GLOBAL?.messages || [],
      updatedAt: map.GLOBAL?.updatedAt || updatedAt,
    },
  };
  await user.save();
  return next;
}

export const extractDocument = async (req, res, next) => {
  try {
    const file = req.file;
    if (!file?.buffer) {
      return res.status(400).json({ message: 'No uploaded file provided' });
    }

    const contentBase64 = file.buffer.toString('base64');
    const extraction = await extractDocumentBase64({
      contentBase64,
      mimeType: file.mimetype,
      filename: file.originalname,
    });

    await logAudit({
      actorId: req.user?._id,
      actorRole: req.user?.role,
      action: 'AI_DOCUMENT_EXTRACTED',
      resource: 'ai_document',
      hospital: req.user?.hospital || req.user?.hospitalId || null,
      after: {
        filename: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        provider: extraction?.provider || 'unknown',
      },
      ip: req.ip,
      userAgent: req.get?.('user-agent'),
    });

    return res.json({
      ok: true,
      filename: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      extraction,
    });
  } catch (err) {
    next(err);
  }
};

export const getAssistantContext = async (req, res, next) => {
  try {
    const role = normalizeRole(req.user?.role || '');
    const hospitalId = req.user?.hospitalId || req.user?.hospital || null;
    const hospitalKey = normalizeHospitalKey(req.user?.hospitalId || req.headers['x-hospital']);
    let nextAppointment = null;

    if (role === 'PATIENT') {
      const patientIds = await resolvePatientIdsForUser(req.user.id, hospitalId || null);
      if (patientIds.length) {
        nextAppointment = await Appointment.findOne({
          patient: { $in: patientIds },
          scheduledAt: { $gte: new Date() },
          status: { $in: ['Scheduled', 'CheckedIn', 'InConsultation'] },
        })
          .sort({ scheduledAt: 1 })
          .select('scheduledAt reason status')
          .lean();
      }
    } else if (role === 'DOCTOR') {
      nextAppointment = await Appointment.findOne({
        doctor: req.user.id,
        scheduledAt: { $gte: new Date() },
        status: { $in: ['Scheduled', 'CheckedIn', 'InConsultation'] },
      })
        .sort({ scheduledAt: 1 })
        .select('scheduledAt reason status')
        .lean();
    }

    const activePrescriptions = await Prescription.countDocuments({
      patient: req.user.id,
      status: { $in: ['Pending'] },
    });

    const profile = getScopedAssistantProfile(req.user, hospitalKey);
    const memoryMap = req.user?.metadata?.aiAssistantMemoryByHospital || {};
    const legacy = req.user?.metadata?.aiAssistantMemory?.messages || [];
    const rawHistory = memoryMap[hospitalKey]?.messages || (hospitalKey === 'GLOBAL' ? legacy : []);
    const cutoff = getRetentionCutoff();
    const chatHistory = rawHistory.filter((entry) => {
      const ts = entry?.createdAt ? new Date(entry.createdAt) : null;
      return ts && !Number.isNaN(ts.getTime()) ? ts >= cutoff : true;
    });

    return res.json({
      success: true,
      context: {
        role,
        nextAppointment,
        activePrescriptions,
        assistantProfile: profile,
        chatHistory,
        retentionDays: RETENTION_DAYS,
        hospitalScope: hospitalKey,
      },
    });
  } catch (err) {
    return next(err);
  }
};

export const getAssistantChat = async (req, res, next) => {
  try {
    const role = normalizeRole(req.user?.role || '');
    const hospitalKey = normalizeHospitalKey(req.user?.hospitalId || req.headers['x-hospital']);
    const profile = getScopedAssistantProfile(req.user, hospitalKey);
    const message = String(req.body?.message || '').trim();
    const userMessage = String(req.body?.userMessage || message).trim();
    if (!message) {
      return res.status(400).json({ message: 'message is required' });
    }

    const out = await assistantChat({
      ...req.body,
      role,
      healthProfile: profile,
    });

    const answer = out?.text || out?.answer || 'No response generated';
    try {
      const toAppend = [
        normalizeChatMessage('user', userMessage),
        normalizeChatMessage('assistant', answer),
      ];
      await appendAssistantMemory(req.user, hospitalKey, toAppend);
    } catch (err) {
      console.warn('Assistant memory save failed:', err?.message || err);
    }

    return res.json({
      success: true,
      answer,
      provider: out?.provider || 'unknown',
    });
  } catch (err) {
    return next(err);
  }
};

export const streamAssistantChatResponse = async (req, res, next) => {
  try {
    const role = normalizeRole(req.user?.role || '');
    const hospitalKey = normalizeHospitalKey(req.user?.hospitalId || req.headers['x-hospital']);
    const profile = getScopedAssistantProfile(req.user, hospitalKey);
    const message = String(req.body?.message || '').trim();
    const userMessage = String(req.body?.userMessage || message).trim();
    if (!message) {
      return res.status(400).json({ message: 'message is required' });
    }

    res.status(200);
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }

    let finalAnswer = '';
    const writeFrame = (frame) => {
      res.write(`${JSON.stringify(frame)}\n`);
      if (typeof res.flush === 'function') {
        res.flush();
      }
    };

    const out = await assistantChatStream({
      ...req.body,
      role,
      healthProfile: profile,
      onChunk: (delta) => {
        const text = String(delta || '');
        if (!text) return;
        finalAnswer += text;
        writeFrame({ type: 'chunk', delta: text });
      },
    });

    const answer = String(finalAnswer || out?.text || out?.answer || 'No response generated').trim();
    try {
      const toAppend = [
        normalizeChatMessage('user', userMessage),
        normalizeChatMessage('assistant', answer),
      ];
      await appendAssistantMemory(req.user, hospitalKey, toAppend);
    } catch (err) {
      console.warn('Assistant memory save failed:', err?.message || err);
    }

    writeFrame({
      type: 'done',
      answer,
      provider: out?.provider || 'unknown',
      degraded: out?.degraded === true,
      code: out?.code || '',
      retryAfterSeconds:
        Number(out?.retryAfterMs || 0) > 0
          ? Math.max(1, Math.ceil(Number(out.retryAfterMs) / 1000))
          : 0,
    });
    return res.end();
  } catch (err) {
    if (res.headersSent) {
      res.write(
        `${JSON.stringify({ type: 'error', message: err?.message || 'Assistant stream failed' })}\n`
      );
      return res.end();
    }
    return next(err);
  }
};

export const submitAssistantChatFeedback = async (req, res, next) => {
  try {
    const rating = normalizeAssistantRating(req.body?.rating);
    const message = trimText(req.body?.message, 4000);
    const answer = trimText(req.body?.answer, 12000);
    const reason = trimText(req.body?.reason, 1000);
    const pageContext = trimText(req.body?.pageContext, 2400);
    const hospitalKey = normalizeHospitalKey(req.user?.hospitalId || req.headers['x-hospital']);

    if (!message || !answer) {
      return res.status(400).json({ message: 'message and answer are required' });
    }

    const result = await assistantFeedback({
      message,
      answer,
      rating,
      reason,
      metadata: {
        pageContext,
        hospitalKey,
        userId: req.user?.id || req.user?._id || null,
        role: req.user?.role || null,
      },
    });

    if (result?.accepted === false) {
      const retryAfterSeconds = Math.max(0, Number(result?.retryAfterSeconds || 0));
      if (retryAfterSeconds > 0) {
        res.setHeader('Retry-After', String(retryAfterSeconds));
      }

      await logAudit({
        actorId: req.user?._id || req.user?.id,
        actorRole: req.user?.role,
        action: 'AI_ASSISTANT_FEEDBACK_DEFERRED',
        resource: 'ai_assistant_feedback',
        hospital: req.user?.hospital || req.user?.hospitalId || null,
        after: {
          hospitalKey,
          rating,
          provider: result?.provider || 'unknown',
          accepted: false,
          degraded: result?.degraded === true,
          retryable: result?.retryable === true,
          retryAfterSeconds,
          reason: result?.reason || '',
          pageContext,
          messagePreview: message.slice(0, 240),
        },
        ip: req.ip,
        userAgent: req.get?.('user-agent'),
        success: false,
        error: result?.reason || 'AI_ASSISTANT_FEEDBACK_UNAVAILABLE',
        metadata: {
          response: result?.response || null,
        },
      });

      return res.status(result?.retryable ? 429 : 503).json({
        success: false,
        provider: result?.provider || 'unknown',
        code: result?.reason || 'AI_ASSISTANT_FEEDBACK_UNAVAILABLE',
        message:
          result?.message ||
          'Feedback could not be saved right now. Please try again shortly.',
        degraded: result?.degraded === true,
        retryable: result?.retryable === true,
        retryAfterSeconds,
      });
    }

    await logAudit({
      actorId: req.user?._id || req.user?.id,
      actorRole: req.user?.role,
      action: 'AI_ASSISTANT_FEEDBACK_RECORDED',
      resource: 'ai_assistant_feedback',
      hospital: req.user?.hospital || req.user?.hospitalId || null,
      after: {
        hospitalKey,
        rating,
        provider: result?.provider || 'unknown',
        accepted: result?.accepted !== false,
        degraded: result?.degraded === true,
        reason,
        pageContext,
        messagePreview: message.slice(0, 240),
      },
      ip: req.ip,
      userAgent: req.get?.('user-agent'),
      success: true,
      error: null,
      metadata: {
        response: result?.response || null,
      },
    });

    return res.json({
      success: true,
      rating,
      provider: result?.provider || 'unknown',
      accepted: result?.accepted !== false,
      degraded: result?.degraded === true,
    });
  } catch (err) {
    return next(err);
  }
};

export const clearAssistantMemory = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const metadata = user.metadata && typeof user.metadata === 'object' ? user.metadata : {};
    const map = metadata.aiAssistantMemoryByHospital || {};
    const hospitalKey = normalizeHospitalKey(req.user?.hospitalId || req.headers['x-hospital']);
    map[hospitalKey] = { messages: [], updatedAt: new Date().toISOString() };
    user.metadata = {
      ...metadata,
      aiAssistantMemoryByHospital: map,
      aiAssistantMemory: {
        messages: map.GLOBAL?.messages || [],
        updatedAt: map.GLOBAL?.updatedAt || new Date().toISOString(),
      },
    };
    await user.save();
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
};

export const logAssistantAutofillAudit = async (req, res, next) => {
  try {
    const eventType = trimText(req.body?.eventType, 40).toLowerCase();
    if (!['drafted', 'applied'].includes(eventType)) {
      return res.status(400).json({ message: 'eventType must be drafted or applied' });
    }

    const hospitalKey = normalizeHospitalKey(req.user?.hospitalId || req.headers['x-hospital']);
    const templateId = trimText(req.body?.templateId, 80).toLowerCase();
    const templateTitle = trimText(req.body?.templateTitle, 140);
    const route = trimText(req.body?.route, 240);
    const sourceKinds = normalizeStringList(req.body?.sourceKinds, { maxItems: 8, maxLength: 40 });
    const summary = trimText(req.body?.summary, 500);
    const items = sanitizeAutofillAuditItems(req.body?.items);
    const unmatched = normalizeStringList(req.body?.unmatched, { maxItems: 20, maxLength: 200 });

    await logAudit({
      actorId: req.user?._id || req.user?.id,
      actorRole: req.user?.role,
      action: eventType === 'applied' ? 'AI_ASSISTANT_AUTOFILL_APPLIED' : 'AI_ASSISTANT_AUTOFILL_DRAFTED',
      resource: 'ai_assistant_autofill',
      hospital: req.user?.hospital || req.user?.hospitalId || null,
      after: {
        eventType,
        templateId,
        templateTitle,
        route,
        hospitalKey,
        summary,
        sourceKinds,
        itemCount: items.length,
        unmatchedCount: unmatched.length,
      },
      ip: req.ip,
      userAgent: req.get?.('user-agent'),
      success: true,
      error: null,
      metadata: {
        hospitalKey,
        sourceKinds,
        items,
        unmatched,
      },
    });

    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
};
