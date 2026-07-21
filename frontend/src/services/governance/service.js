import manifest from "./manifest.js";

const governanceService = {
  manifest,
  async getFeatures() {
    return manifest.features || [];
  },
};

export default governanceService;
