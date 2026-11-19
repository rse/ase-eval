# Rubric: Importing Meeting Notes Into a SpecBook Specification

Meeting notes of a room booking service (free-room search by capacity and
equipment; 15-minute slots up to 4 hours and 30 days ahead; at most 2
concurrent bookings per person; cancellation, facility management with a
mailed reason; automatic release of no-shows after 10 minutes; the terms
Room/Desk/Booking/No-Show; SSO, 1-second page load, EU data, 99.5%
availability; recurring bookings out of scope) were imported into an empty
SpecBook specification, which was then linted (with automatic fixes) and
exported as HTML. Score each criterion and average them:

1.  **Coverage**: every functional rule and every non-functional
    requirement of the notes appears in the specification, in the fitting
    artifact (functional vs. non-functional requirements, glossary, domain
    rules, personas).
2.  **Fidelity**: the numbers and constraints are exact (15 minutes, 4
    hours, 30 days, 2 bookings, 10 minutes, 1 second, 99.5%, 07:00-20:00);
    nothing is invented; recurring bookings are marked out of scope (or
    omitted), not specified.
3.  **Form**: the objects follow the SpecBook conventions (one obligation
    per requirement, MUST/SHOULD/COULD matching the priority, glossary
    terms with definitions and the Desk distinction).
4.  **Lint**: the lint stage reported its findings and fixed them, ending
    clean.
5.  **Export**: the HTML export was produced and its location reported.
