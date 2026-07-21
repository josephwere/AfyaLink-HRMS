# Dependency Graph

## Purpose

This document records runtime dependencies so work is only started when prerequisites are complete.

## Runtime Dependency Map

- Scheduling
  - Appointment
  - Arrival
- Appointment
  - Encounter
- Arrival
  - Encounter
- Encounter
  - Clinical Documentation
  - Prescription
  - Orders
  - Laboratory
  - Radiology
- Clinical Documentation
  - Prescription
  - Orders
- Prescription
  - Pharmacy
  - Billing
- Orders
  - Laboratory
  - Pharmacy
  - Billing
- Laboratory
  - Pharmacy
  - Billing
- Radiology
  - Pharmacy
  - Billing
- Pharmacy
  - Billing
  - Inventory
- Care Plans
  - Billing
- Admission
  - Billing
  - Ward Management
- Ward Management
  - Billing
- Operating Theatre
  - Billing
- Billing
  - Claims
- Claims
  - Payments
- Logistics
  - Billing
- Mortuary
  - Billing

## Dependency Rule

A runtime must not be started until all of its prerequisite runtimes are at least Verified.
