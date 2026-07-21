import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createMapping,
  deleteMapping,
  listMappingTemplates,
  listMappings,
  previewMapping,
  signMappingPayload,
  updateMapping,
  verifyMappingPayload,
} from "../services/mappingStudioApi";

const DEFAULT_FORM = {
  messageType: "ORM^O01",
  sourceSystem: "LIS",
  targetSystem: "EMR",
  mappingJson: JSON.stringify(
    {
      "PID-5": "patient.name",
      "PID-7": "patient.dateOfBirth",
      "OBR-4": "order.testCode",
    },
    null,
    2
  ),
};

const DEFAULT_PREVIEW_PAYLOAD = "MSH|^~\\&|LIS|HOSP|EMR|HOSP|20260220||ORM^O01|123|P|2.3\nPID|1||P001||Jane Doe||1988-02-02\nOBR|1|||CBC^Panel";

export function useMappingStudio() {
  const [mappings, setMappings] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [editingId, setEditingId] = useState(null);
  const [format, setFormat] = useState("HL7");
  const [previewPayload, setPreviewPayload] = useState(DEFAULT_PREVIEW_PAYLOAD);
  const [selectedMappingId, setSelectedMappingId] = useState("");
  const [previewResult, setPreviewResult] = useState(null);
  const [signatureInput, setSignatureInput] = useState("");
  const [verifyInput, setVerifyInput] = useState("");
  const [verifyResult, setVerifyResult] = useState(null);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const parsedMapping = useMemo(() => {
    try {
      return JSON.parse(form.mappingJson || "{}");
    } catch {
      return null;
    }
  }, [form.mappingJson]);

  const load = useCallback(async () => {
    setLoading(true);
    setMsg("");
    try {
      const [rows, tpls] = await Promise.all([listMappings(), listMappingTemplates()]);
      setMappings(Array.isArray(rows) ? rows : []);
      setTemplates(Array.isArray(tpls?.templates) ? tpls.templates : []);
    } catch (e) {
      setMsg(e?.message || "Failed to load mapping studio");
      setMappings([]);
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const resetForm = useCallback(() => {
    setForm(DEFAULT_FORM);
    setEditingId(null);
  }, []);

  const save = useCallback(async () => {
    setMsg("");
    if (!parsedMapping) {
      setMsg("Mapping JSON is invalid.");
      return;
    }
    try {
      const payload = {
        messageType: form.messageType,
        sourceSystem: form.sourceSystem,
        targetSystem: form.targetSystem,
        mapping: parsedMapping,
      };
      if (editingId) {
        await updateMapping(editingId, payload);
        setMsg("Mapping updated.");
      } else {
        await createMapping(payload);
        setMsg("Mapping created.");
      }
      resetForm();
      await load();
    } catch (e) {
      setMsg(e?.message || "Failed to save mapping");
    }
  }, [editingId, form.messageType, form.sourceSystem, form.targetSystem, load, parsedMapping, resetForm]);

  const edit = useCallback((row) => {
    setEditingId(row._id);
    setForm({
      messageType: row.messageType || "",
      sourceSystem: row.sourceSystem || "",
      targetSystem: row.targetSystem || "",
      mappingJson: JSON.stringify(row.mapping || {}, null, 2),
    });
  }, []);

  const remove = useCallback(async (id) => {
    setMsg("");
    try {
      await deleteMapping(id);
      setMsg("Mapping deleted.");
      await load();
    } catch (e) {
      setMsg(e?.message || "Failed to delete mapping");
    }
  }, [load]);

  const runPreview = useCallback(async () => {
    setMsg("");
    setPreviewResult(null);
    try {
      const payload = {
        format,
        payload: format === "FHIR" ? JSON.parse(previewPayload || "{}") : previewPayload,
        ...(selectedMappingId ? { mappingId: selectedMappingId } : { mapping: parsedMapping || {} }),
      };
      const out = await previewMapping(payload);
      setPreviewResult(out || null);
      if (out?.provenance?.signature) setVerifyInput(out.provenance.signature);
    } catch (e) {
      setMsg(e?.message || "Preview failed");
    }
  }, [format, parsedMapping, previewPayload, selectedMappingId]);

  const runSign = useCallback(async () => {
    setMsg("");
    try {
      const payloadObj = JSON.parse(signatureInput || "{}");
      const out = await signMappingPayload({ payload: payloadObj, context: { module: "mapping_studio_ui" } });
      setVerifyInput(out?.signature?.signature || "");
      setMsg("Payload signed.");
    } catch (e) {
      setMsg(e?.message || "Sign failed");
    }
  }, [signatureInput]);

  const runVerify = useCallback(async () => {
    setMsg("");
    setVerifyResult(null);
    try {
      const payloadObj = JSON.parse(signatureInput || "{}");
      const out = await verifyMappingPayload({ payload: payloadObj, signature: verifyInput });
      setVerifyResult(out?.verification || null);
    } catch (e) {
      setMsg(e?.message || "Verify failed");
    }
  }, [signatureInput, verifyInput]);

  return {
    DEFAULT_FORM,
    mappings,
    templates,
    form,
    setForm,
    editingId,
    format,
    setFormat,
    previewPayload,
    setPreviewPayload,
    selectedMappingId,
    setSelectedMappingId,
    previewResult,
    signatureInput,
    setSignatureInput,
    verifyInput,
    setVerifyInput,
    verifyResult,
    msg,
    loading,
    parsedMapping,
    load,
    resetForm,
    save,
    edit,
    remove,
    runPreview,
    runSign,
    runVerify,
  };
}

export default useMappingStudio;
