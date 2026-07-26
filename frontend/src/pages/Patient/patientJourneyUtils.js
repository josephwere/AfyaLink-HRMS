export function buildJourneySteps(state = {}) {
  const steps = [
    {
      key: "discover",
      label: "Discover Hospital",
      description: "You found the right care setting and selected your provider.",
      status: "pending",
    },
    {
      key: "booked",
      label: "Appointment Booked",
      description: "Your appointment request is confirmed and ready for the care team.",
      status: "pending",
    },
    {
      key: "assigned",
      label: "Care Team Assigned",
      description: "The hospital scheduling team assigns the right clinician for your visit.",
      status: "pending",
    },
    {
      key: "travel",
      label: "Travel",
      description: "You are on your way or preparing for arrival at the hospital.",
      status: "pending",
    },
    {
      key: "checkin",
      label: "Check-in",
      description: "Your arrival and registration are underway.",
      status: "pending",
    },
    {
      key: "consultation",
      label: "Consultation",
      description: "Your consultation is now in progress.",
      status: "pending",
    },
    {
      key: "laboratory",
      label: "Laboratory",
      description: "Any tests are being prepared or completed.",
      status: "pending",
    },
    {
      key: "pharmacy",
      label: "Pharmacy",
      description: "Medication instructions or dispensing are progressing.",
      status: "pending",
    },
    {
      key: "billing",
      label: "Billing",
      description: "Charges and payments are being finalized.",
      status: "pending",
    },
    {
      key: "followup",
      label: "Follow-up",
      description: "Your care plan continues after discharge or review.",
      status: "pending",
    },
  ];

  const bookingDone = Boolean(state.bookingSuccess || state.bookingConfirmed || state.appointmentBooked);
  const doctorAssigned = Boolean(state.doctorAssigned || state.hasDoctor || state.appointment?.doctor || state.doctorName);
  const travelDone = Boolean(state.travelComplete || state.arrived || state.checkinComplete || state.hasCall);
  const checkInDone = Boolean(state.checkinComplete || state.arrived || state.checkInComplete || state.consultationStarted);
  const consultationDone = Boolean(state.consultationStarted || state.consultationComplete || state.hasCall || state.callComplete);
  const labDone = Boolean(state.labComplete || state.labReady || state.hasLab);
  const pharmacyDone = Boolean(state.pharmacyComplete || state.hasPrescription);
  const billingDone = Boolean(state.billingComplete || state.hasBilling);
  const followUpDone = Boolean(state.followUpReady || state.followupComplete);

  const doneStates = [
    bookingDone,
    bookingDone,
    doctorAssigned,
    travelDone,
    checkInDone,
    consultationDone,
    labDone,
    pharmacyDone,
    billingDone,
    followUpDone,
  ];

  const activeKey = state.activeStep || state.activeKey || state.currentStep || state.currentStage || state.currentJourneyStep;
  const activeIndex = activeKey ? steps.findIndex((step) => step.key === activeKey) : -1;

  return steps.map((step, index) => {
    if (index === 0) {
      return { ...step, status: bookingDone ? "done" : "active" };
    }
    if (doneStates[index]) {
      return { ...step, status: "done" };
    }
    if (activeIndex === index) {
      return { ...step, status: "active" };
    }
    return { ...step, status: "pending" };
  });
}
