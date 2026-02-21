import mongoose from "mongoose";

const Hl7MappingSchema = new mongoose.Schema(
  {
    messageType: {
      type: String,
      required: true,
      example: "ORM^O01",
    },

    sourceSystem: {
      type: String,
      required: true,
      example: "LIS",
    },

    targetSystem: {
      type: String,
      required: true,
      example: "EMR",
    },

    mapping: {
      type: Object,
      required: true,
      example: {
        "PID-5": "patientName",
        "PID-7": "dateOfBirth",
        "OBR-4": "testCode",
      },
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Hl7Mapping", Hl7MappingSchema);
