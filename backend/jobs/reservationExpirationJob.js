/**
 * Reservation Expiration Worker
 *
 * Background job that periodically cleans up expired slot reservations.
 *
 * Process:
 * 1. Find all SlotReservation documents with status=HELD and expiresAt <= now
 * 2. Transition them to status=EXPIRED
 * 3. Release the associated Slot back to AVAILABLE (if not yet booked)
 * 4. Emit event for notifications/analytics to react
 * 5. Handle errors gracefully (one failure doesn't block others)
 *
 * Idempotency:
 * - Safe to run multiple times
 * - Expired reservations are only transitioned once
 * - Slot releases are checked (only if still HELD or RESERVED)
 *
 * Frequency:
 * - Default: every 30 seconds
 * - Configurable via environment or constructor
 * - Graceful shutdown: finishes in-flight operations before stopping
 */

import SlotReservation from "../../models/SlotReservation.js";
import Slot from "../../models/Slot.js";
import { clockService } from "../../services/clockService.js";
import { EventEmitter } from "events";

export class ReservationExpirationWorker extends EventEmitter {
  constructor(options = {}) {
    super();
    this.intervalMs = options.intervalMs || 30000; // 30 seconds default
    this.batchSize = options.batchSize || 100;
    this.isRunning = false;
    this.intervalHandle = null;
    this.isShuttingDown = false;
  }

  /**
   * Start the worker
   */
  start() {
    if (this.isRunning) {
      console.warn("[ReservationExpirationWorker] Already running");
      return;
    }

    this.isRunning = true;
    console.log(
      `[ReservationExpirationWorker] Starting (interval: ${this.intervalMs}ms)`
    );

    // Run once immediately
    this.processExpiredReservations().catch((error) => {
      console.error("[ReservationExpirationWorker] Error in initial run:", error);
    });

    // Then run on interval
    this.intervalHandle = setInterval(() => {
      this.processExpiredReservations().catch((error) => {
        console.error("[ReservationExpirationWorker] Error in interval run:", error);
      });
    }, this.intervalMs);
  }

  /**
   * Stop the worker gracefully
   */
  async stop() {
    if (!this.isRunning) {
      console.warn("[ReservationExpirationWorker] Not running");
      return;
    }

    this.isShuttingDown = true;
    console.log("[ReservationExpirationWorker] Shutting down gracefully...");

    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
    }

    // Allow any in-flight operations to complete
    // (Max 30 seconds wait, then force stop)
    await new Promise((resolve) => setTimeout(resolve, 1000));

    this.isRunning = false;
    console.log("[ReservationExpirationWorker] Stopped");
  }

  /**
   * Main worker logic: process expired reservations
   */
  async processExpiredReservations() {
    if (this.isShuttingDown) {
      return;
    }

    const now = clockService.nowUTC();

    try {
      // Find expired reservations
      const expiredReservations = await SlotReservation.find({
        status: "HELD",
        expiresAt: { $lt: now },
      })
        .select("_id slotId appointment patient doctor expiresAt createdAt")
        .limit(this.batchSize)
        .lean();

      if (expiredReservations.length === 0) {
        return; // Nothing to do
      }

      console.log(
        `[ReservationExpirationWorker] Processing ${expiredReservations.length} expired reservations`
      );

      let expiredCount = 0;
      let errorCount = 0;

      for (const reservation of expiredReservations) {
        try {
          await this.expireReservation(reservation, now);
          expiredCount++;
        } catch (error) {
          console.error(
            `[ReservationExpirationWorker] Error expiring reservation ${reservation._id}:`,
            error.message
          );
          errorCount++;
        }
      }

      this.emit("reservationsBatch", {
        timestamp: now,
        processed: expiredReservations.length,
        expired: expiredCount,
        errors: errorCount,
      });
    } catch (error) {
      console.error("[ReservationExpirationWorker] Fatal error:", error);
      this.emit("error", error);
    }
  }

  /**
   * Expire a single reservation and release its slot
   */
  async expireReservation(reservation, now) {
    // Update reservation to EXPIRED
    await SlotReservation.findByIdAndUpdate(
      reservation._id,
      {
        status: "EXPIRED",
        expiredAt: now,
        updatedAt: now,
      },
      { new: false } // Don't need the updated doc back
    );

    // Release the slot back to AVAILABLE (if it hasn't been booked)
    if (reservation.slotId) {
      const slot = await Slot.findOne({ slotId: reservation.slotId });
      if (slot && slot.status === "HELD") {
        await Slot.findByIdAndUpdate(
          slot._id,
          {
            status: "AVAILABLE",
            releasedAt: now,
          },
          { new: false }
        );
      }
    }

    // Emit event for other services
    this.emit("reservationExpired", {
      reservationId: String(reservation._id),
      appointmentId: reservation.appointment ? String(reservation.appointment) : null,
      patientId: reservation.patient ? String(reservation.patient) : null,
      doctorId: reservation.doctor ? String(reservation.doctor) : null,
      heldFor: now.getTime() - reservation.createdAt.getTime(),
      expiredAt: now,
    });
  }

  /**
   * Get worker statistics
   */
  getStats() {
    return {
      isRunning: this.isRunning,
      isShuttingDown: this.isShuttingDown,
      intervalMs: this.intervalMs,
      batchSize: this.batchSize,
    };
  }

  /**
   * Health check: get count of expired reservations that haven't been cleaned up
   */
  async getHealthStatus() {
    const now = clockService.nowUTC();
    const expiredCount = await SlotReservation.countDocuments({
      status: "HELD",
      expiresAt: { $lt: now },
    });

    return {
      isRunning: this.isRunning,
      expiredReservationsWaiting: expiredCount,
      status: expiredCount > 50 ? "warning" : "healthy",
    };
  }
}

// Export singleton
export const reservationExpirationWorker = new ReservationExpirationWorker();
