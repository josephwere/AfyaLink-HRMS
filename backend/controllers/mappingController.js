import Hl7Mapping from "../models/Hl7Mapping.js";

/* ======================================================
   ➕ CREATE HL7 MAPPING
====================================================== */
export const createHl7Mapping = async (req, res) => {
  try {
    const mapping = await Hl7Mapping.create(req.body);
    res.status(201).json(mapping);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

/* ======================================================
   📋 LIST ALL HL7 MAPPINGS
====================================================== */
export const getHl7Mappings = async (req, res) => {
  try {
    const mappings = await Hl7Mapping.find();
    res.json(mappings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ======================================================
   🔍 GET SINGLE HL7 MAPPING
====================================================== */
export const getHl7MappingById = async (req, res) => {
  try {
    const mapping = await Hl7Mapping.findById(req.params.id);
    if (!mapping) {
      return res.status(404).json({ message: "Mapping not found" });
    }
    res.json(mapping);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ======================================================
   ✏️ UPDATE HL7 MAPPING
====================================================== */
export const updateHl7Mapping = async (req, res) => {
  try {
    const mapping = await Hl7Mapping.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(mapping);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

/* ======================================================
   🗑 DELETE HL7 MAPPING
====================================================== */
export const deleteHl7Mapping = async (req, res) => {
  try {
    await Hl7Mapping.findByIdAndDelete(req.params.id);
    res.json({ message: "Mapping deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
