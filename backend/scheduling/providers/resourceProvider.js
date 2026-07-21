/**
 * ResourceProvider Contract
 *
 * This is the interface that all resource providers must implement.
 * The Scheduling Runtime depends only on this contract, making it agnostic
 * to whether the resource is a doctor, room, equipment, ambulance, or operating theatre.
 *
 * Implementations:
 * - DoctorResourceProvider
 * - RoomResourceProvider
 * - EquipmentResourceProvider
 * - AmbulanceResourceProvider
 * - TheatreResourceProvider
 */

export class ResourceProvider {
  /**
   * Get the type of resource this provider manages
   * @abstract
   * @returns {string} Resource type (e.g., 'DOCTOR', 'ROOM', 'EQUIPMENT')
   */
  getResourceType() {
    throw new Error("Not implemented");
  }

  /**
   * Find all available resources for a given time slot
   *
   * @abstract
   * @param {Object} options
   * @param {Date} options.startTime - Desired start time
   * @param {number} options.durationMins - Appointment duration in minutes
   * @param {string} options.hospitalId - Hospital context
   * @param {string} options.appointmentTypeId - Appointment type (optional)
   * @param {string} options.timeZone - IANA timezone for availability check
   * @returns {Promise<Array>} Array of available resources
   *   [
   *     { resourceId: "...", resourceName: "...", availableSlots: [...], confidence: 0.95 }
   *   ]
   */
  async findAvailable(options) {
    throw new Error("Not implemented");
  }

  /**
   * Reserve (hold) a resource for a time slot
   *
   * @abstract
   * @param {Object} options
   * @param {string} options.resourceId - Resource to reserve
   * @param {Date} options.startTime - Start of appointment
   * @param {number} options.durationMins - Appointment duration
   * @param {string} options.appointmentId - Appointment being booked (optional)
   * @param {string} options.patientId - Patient identifier
   * @param {number} options.holdDurationSeconds - How long to hold (default 300)
   * @returns {Promise<Object>} Reservation details
   *   {
   *     reservationId: "...",
   *     resourceId: "...",
   *     status: "HELD",
   *     expiresAt: <Date>,
   *     startTime: <Date>,
   *     endTime: <Date>
   *   }
   */
  async reserve(options) {
    throw new Error("Not implemented");
  }

  /**
   * Release (cancel) a hold on a resource
   *
   * @abstract
   * @param {string} reservationId - Reservation to release
   * @returns {Promise<Object>} Release confirmation
   *   { success: true, reservationId, status: "AVAILABLE" }
   */
  async release(reservationId) {
    throw new Error("Not implemented");
  }

  /**
   * Confirm a reservation (transition from HELD to CONFIRMED)
   *
   * @abstract
   * @param {string} reservationId - Reservation to confirm
   * @returns {Promise<Object>} Confirmed reservation details
   *   { reservationId, status: "CONFIRMED", expiresAt, appointmentId }
   */
  async confirmReservation(reservationId) {
    throw new Error("Not implemented");
  }

  /**
   * Check if this provider supports a given capability
   *
   * @abstract
   * @param {string} capability - Capability name (e.g., 'VIDEO', 'CHAT', 'IN_PERSON')
   * @returns {Promise<boolean>}
   */
  async supports(capability) {
    throw new Error("Not implemented");
  }

  /**
   * Get resource capacity constraints
   *
   * @abstract
   * @param {string} resourceId - Resource identifier
   * @returns {Promise<Object>}
   *   {
   *     maxConcurrentAppointments: 1,
   *     maxAppointmentsPerDay: 10,
   *     minTimeBetweenAppointments: 5,
   *     maxAppointmentDuration: 120
   *   }
   */
  async getCapacity(resourceId) {
    throw new Error("Not implemented");
  }

  /**
   * Get working hours for a resource
   *
   * @abstract
   * @param {string} resourceId - Resource identifier
   * @param {string} timeZone - IANA timezone
   * @returns {Promise<Object>}
   *   {
   *     workingDays: [1, 2, 3, 4, 5],
   *     workingHours: [
   *       { startTime: "08:00", endTime: "12:00", breakAfter: 60 },
   *       { startTime: "13:00", endTime: "17:00" }
   *     ],
   *     timeZone: "Africa/Nairobi"
   *   }
   */
  async getWorkingHours(resourceId, timeZone) {
    throw new Error("Not implemented");
  }

  /**
   * Get exceptions (holidays, leave, etc.) for a resource
   *
   * @abstract
   * @param {string} resourceId - Resource identifier
   * @param {Date} startDate - Start of date range
   * @param {Date} endDate - End of date range
   * @returns {Promise<Array>}
   *   [
   *     { type: 'LEAVE', date: <Date>, reason: 'Annual Leave', allDay: true },
   *     { type: 'HOLIDAY', date: <Date>, reason: 'Public Holiday' },
   *     { type: 'MAINTENANCE', date: <Date>, timeRange: { start: '14:00', end: '16:00' } }
   *   ]
   */
  async getExceptions(resourceId, startDate, endDate) {
    throw new Error("Not implemented");
  }

  /**
   * Get current status of a resource
   *
   * @abstract
   * @param {string} resourceId - Resource identifier
   * @returns {Promise<Object>}
   *   {
   *     resourceId,
   *     status: 'AVAILABLE' | 'BUSY' | 'OFFLINE' | 'MAINTENANCE',
   *     currentActivity: null or activity details,
   *     nextAvailable: <Date>
   *   }
   */
  async getStatus(resourceId) {
    throw new Error("Not implemented");
  }

  /**
   * Get all resources of this type in a hospital
   *
   * @abstract
   * @param {string} hospitalId - Hospital identifier
   * @param {Object} filters - Optional filters { active: true, ... }
   * @returns {Promise<Array>} Resources
   *   [
   *     { resourceId, name, specialization, status, ... },
   *     ...
   *   ]
   */
  async listResources(hospitalId, filters) {
    throw new Error("Not implemented");
  }

  /**
   * Assign a resource to an appointment (final confirmation)
   * This transitions the resource from HELD → BOOKED state
   *
   * @abstract
   * @param {string} appointmentId - Appointment identifier
   * @param {string} resourceId - Resource to assign
   * @returns {Promise<Object>}
   *   { appointmentId, resourceId, status: 'BOOKED', assignedAt: <Date> }
   */
  async assignToAppointment(appointmentId, resourceId) {
    throw new Error("Not implemented");
  }

  /**
   * Release a resource from an appointment
   *
   * @abstract
   * @param {string} appointmentId - Appointment identifier
   * @returns {Promise<Object>}
   *   { appointmentId, status: 'UNASSIGNED', releasedAt: <Date> }
   */
  async releaseFromAppointment(appointmentId) {
    throw new Error("Not implemented");
  }
}

/**
 * Factory for creating resource providers
 * This allows the system to instantiate the correct provider based on resource type
 */
export class ResourceProviderFactory {
  static #providers = new Map();

  /**
   * Register a provider for a resource type
   * @param {string} resourceType - Resource type (e.g., 'DOCTOR')
   * @param {ResourceProvider} provider - Provider instance
   */
  static registerProvider(resourceType, provider) {
    if (!(provider instanceof ResourceProvider)) {
      throw new Error(
        `Provider must extend ResourceProvider. Got: ${provider.constructor.name}`
      );
    }
    this.#providers.set(resourceType, provider);
  }

  /**
   * Get a provider for a resource type
   * @param {string} resourceType - Resource type
   * @returns {ResourceProvider} The registered provider
   * @throws {Error} If provider not found
   */
  static getProvider(resourceType) {
    const provider = this.#providers.get(resourceType);
    if (!provider) {
      throw new Error(
        `No provider registered for resource type: ${resourceType}. ` +
        `Available: ${Array.from(this.#providers.keys()).join(", ")}`
      );
    }
    return provider;
  }

  /**
   * Check if a provider is registered
   * @param {string} resourceType - Resource type
   * @returns {boolean}
   */
  static hasProvider(resourceType) {
    return this.#providers.has(resourceType);
  }

  /**
   * List all registered providers
   * @returns {Array<string>} Resource types
   */
  static listProviders() {
    return Array.from(this.#providers.keys());
  }
}
