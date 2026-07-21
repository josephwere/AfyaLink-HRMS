import { useCallback, useEffect, useState } from "react";
import {
  createMapping,
  deleteMapping,
  getMapping,
  listMappings,
  updateMapping,
} from "../services/mappingStudioApi";

const EMPTY_FORM = { connector: "", name: "", fields: { hl7: {}, fhir: {} } };

export function useMappingEditor() {
  const [list, setList] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    const js = await listMappings();
    setList(Array.isArray(js) ? js : Array.isArray(js?.items) ? js.items : []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const setField = useCallback((type, path, target) => {
    setForm((f) => {
      const nf = { ...f };
      nf.fields = { ...nf.fields };
      nf.fields[type] = { ...nf.fields[type] };
      nf.fields[type][path] = target;
      return nf;
    });
  }, []);

  const save = useCallback(async () => {
    if (editing) {
      await updateMapping(editing, form);
      alert("Updated");
    } else {
      await createMapping(form);
      alert("Created");
    }
    setForm(EMPTY_FORM);
    setEditing(null);
    await load();
  }, [editing, form, load]);

  const edit = useCallback(async (id) => {
    const js = await getMapping(id);
    setForm({
      connector: js?.connector || "",
      name: js?.name || "",
      fields: {
        hl7: js?.fields?.hl7 || {},
        fhir: js?.fields?.fhir || {},
      },
    });
    setEditing(id);
  }, []);

  return {
    list,
    form,
    setForm,
    editing,
    setEditing,
    setField,
    load,
    save,
    edit,
  };
}

export default useMappingEditor;
