---
Created:  2026-11-19 10:05
Modified: 2026-11-19 10:17
---

#   REQS: Domain Glossary (DG)

##  TERM: Room

-   TYPE: Entity
-   DISTINCT-FROM: [[TERM:Desk]]

A bookable meeting room of the office, characterized by its capacity and its
[[TERM:Equipment]], BECAUSE employees choose a room by how many people it holds and by what it
provides.

##  TERM: Desk

-   TYPE: Entity
-   DISTINCT-FROM: [[TERM:Room]]

A single workplace in the office, which is not a [[TERM:Room]] and hence not bookable, BECAUSE
Facility Management insists on keeping desks out of the room booking.

##  TERM: Equipment

-   TYPE: Entity

A facility of a [[TERM:Room]] by which the free rooms are filtered: a screen, video
conferencing, or a whiteboard, BECAUSE a meeting needs a room providing the facilities it
requires.

##  TERM: Slot

-   TYPE: Entity
-   SYNONYMS: Time Slot

A time span for which the free rooms are searched and for which a [[TERM:Booking]] reserves a
[[TERM:Room]], BECAUSE both searching and booking refer to one concrete time span.

##  TERM: Booking

-   TYPE: Entity

A reservation of exactly one [[TERM:Room]] for exactly one [[TERM:Slot]] by exactly one
[[TERM:Employee]], BECAUSE every reserved room has to be attributable to the one employee who
checks in to it or cancels it.

##  TERM: No-Show

-   TYPE: Entity
-   BROADER: [[TERM:Booking]]

A [[TERM:Booking]] whose [[TERM:Check-In]] is still missing once the grace period of
[[No-Show After 10 Minutes Without Check-In]] has passed, BECAUSE the bookings actually used have
to be told apart from the rooms blocked but left empty.

##  TERM: Check-In

-   TYPE: Activity

The confirmation of a [[TERM:Booking]] by the [[TERM:Employee]] holding it, showing that the
booked room is actually used, BECAUSE a Booking without it turns into a [[TERM:No-Show]].

##  TERM: Cancellation

-   TYPE: Activity

The withdrawal of a [[TERM:Booking]], making its [[TERM:Room]] free again for its
[[TERM:Slot]], BECAUSE a booked room has to become bookable again once it is no longer needed.

##  TERM: Employee

-   TYPE: Actor

A person working at the office who books rooms for meetings, BECAUSE the solution lets the
employees book the meeting rooms themselves.

##  TERM: Facility Management

-   TYPE: Actor

The organizational unit responsible for the facilities of the office, including its rooms,
which so far took the booking requests by mail, BECAUSE the solution replaces exactly this
mail-based booking, while the unit stays in charge of the rooms.
