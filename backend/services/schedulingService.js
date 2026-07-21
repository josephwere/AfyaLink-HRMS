import { createSchedulingRuntime } from "../scheduling/runtime/schedulingRuntime.js";

const schedulingService = createSchedulingRuntime({
  observability: {
    emit() {},
  },
});

export { schedulingService };
export default schedulingService;
