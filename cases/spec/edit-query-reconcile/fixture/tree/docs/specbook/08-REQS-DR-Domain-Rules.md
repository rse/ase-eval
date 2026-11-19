---
Created:  2026-11-19 10:05
Modified: 2026-11-19 10:17
---

#   REQS: Domain Rules (DR)

##  RULE: Slots in 15-Minute Steps

-   CATEGORY: Constraint
-   SOURCE: Business
-   GOVERNS: [[TERM:Slot]]
-   CONSTRAINS: [[Search Free Rooms for a Slot]], [[Book a Free Room for a Slot]]

A [[TERM:Slot]] MUST start and end on a 15-minute step of the clock, BECAUSE a common
granularity lets consecutive bookings of a room adjoin without unbookable gaps.

##  RULE: Booking Lasts at Most 4 Hours

-   CATEGORY: Constraint
-   SOURCE: Business
-   GOVERNS: [[TERM:Booking]], [[TERM:Slot]]
-   CONSTRAINS: [[Book a Free Room for a Slot]]

The [[TERM:Slot]] of a [[TERM:Booking]] MUST NOT last longer than 4 hours, BECAUSE a single
booking must not block a room for most of the day for the other employees.

##  RULE: Booking at Most 30 Days Ahead

-   CATEGORY: Constraint
-   SOURCE: Business
-   GOVERNS: [[TERM:Booking]], [[TERM:Slot]]
-   CONSTRAINS: [[Book a Free Room for a Slot]]

The [[TERM:Slot]] of a [[TERM:Booking]] MUST NOT start later than 30 days after the Booking is
made, BECAUSE bookings far ahead would block rooms long before the actual need is certain.

##  RULE: At Most 2 Simultaneous Bookings per Employee

-   CATEGORY: Constraint
-   SOURCE: Business
-   GOVERNS: [[TERM:Employee]], [[TERM:Booking]]
-   CONSTRAINS: [[Book a Free Room for a Slot]]

An [[TERM:Employee]] MUST NOT hold more than 2 bookings whose slots overlap in time, BECAUSE
Facility Management observed that people block rooms "just in case".

##  RULE: Room Booked Only Once per Slot

-   CATEGORY: Constraint
-   SOURCE: Domain
-   GOVERNS: [[TERM:Room]], [[TERM:Booking]]
-   CONSTRAINS: [[Search Free Rooms for a Slot]], [[Book a Free Room for a Slot]]

A [[TERM:Room]] MUST NOT carry two bookings whose slots overlap in time, BECAUSE a room counts
as free in a slot only while no booking reserves it.

##  RULE: No-Show After 10 Minutes Without Check-In

-   CATEGORY: Derivation
-   SOURCE: Business
-   GOVERNS: [[TERM:No-Show]], [[TERM:Check-In]]
-   CONSTRAINS: [[Release No-Shows Automatically]]

A [[TERM:Booking]] MUST count as a [[TERM:No-Show]] once 10 minutes after the start of its
[[TERM:Slot]] have passed without a [[TERM:Check-In]], BECAUSE a booked but unused room has
to become bookable again soon, while a holder arriving late still keeps the booking.

##  RULE: Cancellation Only by Holder or Facility Management

-   CATEGORY: Constraint
-   SOURCE: Business
-   GOVERNS: [[TERM:Cancellation]], [[TERM:Booking]]
-   CONSTRAINS: [[Cancel an Own Booking]], [[Cancel Any Booking]]

A [[TERM:Cancellation]] of a [[TERM:Booking]] MUST be performed only by the [[TERM:Employee]]
holding the Booking, by [[TERM:Facility Management]], or by the system for a [[TERM:No-Show]]
([[Release No-Shows Automatically]]), BECAUSE an employee relying on a booking must not lose it
through another employee.

##  RULE: Facility Management States a Cancellation Reason

-   CATEGORY: Constraint
-   SOURCE: Business
-   GOVERNS: [[TERM:Cancellation]], [[TERM:Facility Management]]
-   CONSTRAINS: [[Cancel Any Booking]], [[Mail the Cancellation Reason]]

A [[TERM:Cancellation]] by [[TERM:Facility Management]] MUST carry a reason, BECAUSE the reason
is mailed to the employee holding the cancelled booking.
