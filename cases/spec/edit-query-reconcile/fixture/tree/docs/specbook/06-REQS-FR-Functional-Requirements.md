---
Created:  2026-11-19 10:05
Modified: 2026-11-19 10:17
---

#   REQS: Functional Requirements (FR)

##  REQUIREMENT: Search Free Rooms for a Slot

-   PRIORITY: MUST

When an [[ROLE:Employee]] searches for a [[TERM:Slot]], the system MUST list every
[[TERM:Room]] without a [[TERM:Booking]] overlapping that Slot, BECAUSE employees have to see
which rooms are free before they book one.

##  REQUIREMENT: Filter Free Rooms by Capacity

-   PRIORITY: MUST
-   DEPENDS-ON: [[Search Free Rooms for a Slot]]

When an [[ROLE:Employee]] restricts the search for free rooms to a minimum capacity, the system
MUST list only the rooms whose capacity reaches that minimum, BECAUSE a meeting needs a room
holding all its participants.

##  REQUIREMENT: Filter Free Rooms by Equipment

-   PRIORITY: MUST
-   DEPENDS-ON: [[Search Free Rooms for a Slot]]

When an [[ROLE:Employee]] restricts the search for free rooms to some [[TERM:Equipment]], the
system MUST list only the rooms providing all of that Equipment, BECAUSE a meeting needs a room
providing all the [[TERM:Equipment]] it requires.

##  REQUIREMENT: Book a Free Room for a Slot

-   PRIORITY: MUST

When an [[ROLE:Employee]] books a free [[TERM:Room]] for a [[TERM:Slot]], the system MUST record
a [[TERM:Booking]] of that Room for that Slot held by that Employee, BECAUSE the employees are
to book the rooms themselves instead of mailing Facility Management.

##  REQUIREMENT: Cancel an Own Booking

-   PRIORITY: MUST
-   DEPENDS-ON: [[Book a Free Room for a Slot]]

When an [[ROLE:Employee]] cancels one of the own bookings, the system MUST perform the
[[TERM:Cancellation]] of that [[TERM:Booking]], BECAUSE employees have to give back rooms they
no longer need.

##  REQUIREMENT: Cancel Any Booking

-   PRIORITY: MUST
-   DEPENDS-ON: [[Book a Free Room for a Slot]]

When [[ROLE:Facility Management]] cancels any [[TERM:Booking]], the system MUST perform the
[[TERM:Cancellation]] of that Booking, BECAUSE Facility Management has to be able to free rooms
regardless of who booked them.

##  REQUIREMENT: Mail the Cancellation Reason

-   PRIORITY: MUST
-   DEPENDS-ON: [[Cancel Any Booking]]

When [[ROLE:Facility Management]] has cancelled a [[TERM:Booking]], the system MUST mail the
stated reason to the [[TERM:Employee]] holding that Booking, BECAUSE the employee has to learn
that and why the booked room is no longer available.

##  REQUIREMENT: Check In via the Web UI

-   PRIORITY: MUST
-   DEPENDS-ON: [[Book a Free Room for a Slot]]

When the [[ROLE:Employee]] holding a [[TERM:Booking]] checks in via the web UI, the system MUST
record the [[TERM:Check-In]] of that Booking, BECAUSE the check-in via a
tablet at the door is not part of the first release.

##  REQUIREMENT: Release No-Shows Automatically

-   PRIORITY: MUST
-   DEPENDS-ON: [[Check In via the Web UI]]

When a [[TERM:Booking]] becomes a [[TERM:No-Show]], the system MUST perform the
[[TERM:Cancellation]] of it automatically, making its [[TERM:Room]] free again, BECAUSE a room
booked but not used would otherwise stay
blocked for the other employees.

##  REQUIREMENT: Check In via a Door Tablet

-   PRIORITY: WONT
-   DEPENDS-ON: [[Book a Free Room for a Slot]]

When the [[ROLE:Employee]] holding a [[TERM:Booking]] checks in on the tablet at the door of
its [[TERM:Room]], the system MUST record the [[TERM:Check-In]] of that Booking, BECAUSE the
employee can confirm the use of the booked room right on arrival, without opening the web UI.

##  REQUIREMENT: Book a Recurring Slot

-   PRIORITY: WONT
-   DEPENDS-ON: [[Book a Free Room for a Slot]]

When an [[ROLE:Employee]] books a [[TERM:Room]] for a recurring [[TERM:Slot]] (e.g. a weekly
team meeting), the system MUST book that Room for every recurrence of the Slot, BECAUSE
a regular meeting needs the same room for each recurrence without booking every one separately.
