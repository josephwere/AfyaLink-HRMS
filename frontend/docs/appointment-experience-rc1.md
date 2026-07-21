# Appointment Experience v2.0 RC1

## Release target

Release Candidate 1 for the patient appointment journey should focus on stabilization, consistency, and production-readiness rather than adding new capabilities.

## Objective

Finish the appointment experience to the same quality standard as the rest of AfyaLink by aligning the UI with the shared dashboard design system, tightening interactions, and validating the full booking flow through build, test, and responsive checks.

## Scope

- Polish the existing Discover → Hospital → Doctor → Slot → Confirmation journey.
- Preserve existing booking APIs, RBAC behavior, and appointment workflow contracts.
- Defer advanced AI recommendations and other future-facing features until the core experience is stable.

## Acceptance criteria

### 1. Functional criteria
- All booking flows complete successfully from Discover → Hospital → Doctor → Slot → Confirmation.
- Geolocation gracefully falls back to manual location search when permission is denied.
- Map, hospital cards, and the selected hospital remain synchronized.
- The “View All Hospitals” drawer/search behaves correctly.
- Existing appointment APIs remain backward compatible.

### 2. Design consistency
- All cards use the same spacing, border radius, shadow, typography, and button treatment as the shared dashboard system.
- Cards in the same row use equal height and consistent content density.
- Badges are capped to 3–4 visible values, with overflow grouped behind a compact “More” action where needed.
- One primary accent color is used consistently for primary actions.

### 3. User journey
- The experience flows linearly: Discover → Hospital → Doctor → Slot → Confirmation.
- Unnecessary sections do not appear early in the flow.
- Progress indicators clearly communicate the next step without adding noise.

### 4. Performance
- Skeleton loaders replace generic loading states.
- Transitions feel smooth at 150–250 ms durations.
- Layout shifts are minimized.
- Heavy components are lazy-loaded where appropriate.
- Hospital discovery loads within the target performance budget on a typical network.
- Smooth animations are maintained without dropped frames during transitions.

### 5. Responsiveness
- Desktop, tablet, and mobile layouts are verified.
- Mobile interaction patterns feel native: bottom-sheet hospital selection, thumb-friendly spacing, sticky continue actions, large touch targets.
- No visual overflow occurs on supported screen sizes.

### 6. Accessibility
- Keyboard navigation works end-to-end.
- Focus states are visible and logical.
- Screen-reader labels and semantics are present for interactive elements and progress states.
- Color contrast meets WCAG 2.1 AA expectations.
- Reduced-motion preferences are respected.
- Screen reader labels and focus indicators are verified in supported browsers.

### 7. Map integration
- The map experience uses a real provider rather than placeholder visuals.
- Map markers and hospital cards stay synchronized in both directions.
- Directions links use the user’s preferred navigation app.
- Map and card state remain aligned after filtering, selection, and drawer interactions.

### 8. Booking and safety
- Existing booking APIs remain unchanged.
- RBAC and patient/staff workflow permissions remain unchanged.
- No regressions in appointment creation, confirmation, or booking lock behavior.
- Authorization remains enforced for all appointment APIs.
- No exposure of sensitive location or patient data occurs.

### 9. Quality gates
- Production build succeeds.
- Unit tests pass.
- Playwright end-to-end tests pass.
- Cross-browser verification is completed in Chrome, Edge, Firefox, and Safari where supported.
- No console errors or warnings occur during normal usage.
- Lighthouse Performance is at or above 90.
- Lighthouse Accessibility is at or above 95.
- Lighthouse Best Practices is at or above 95.
- Lighthouse SEO is at or above 90 for applicable public pages.

### 10. Documentation and release readiness
- User guide is updated.
- API documentation is updated if contracts change.
- Release notes are prepared.
- Migration notes are included if any UI behavior changes.

## Deferred after RC1

The following should be deferred until after RC1 is complete:
- Advanced AI recommendations and personalized ranking
- Predictive wait-time estimation
- Broader AI-driven journey suggestions

## Release sequence after RC1

1. Appointment Experience RC1 (polish and stabilization)
2. Real maps and navigation integration
3. Live doctor availability and queue updates
4. Video and voice consultation workflow
5. Post-consultation journey (pharmacy, labs, billing, follow-up)
6. AI personalization and recommendations

## Exit criteria

Appointment Experience v2.0 RC1 is considered complete only when all functional, quality, accessibility, performance, security, and testing criteria are satisfied, all automated tests pass, the production build succeeds without errors, and stakeholder review confirms that the experience aligns with the AfyaLink design system and patient journey standards.
