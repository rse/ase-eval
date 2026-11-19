---
Created:  2026-11-19 10:05
Modified: 2026-11-19 10:17
---

#   REQS: Non-Functional Requirements (NR)

##  REQUIREMENT: Login via the Company SSO

-   PRIORITY: MUST
-   CATEGORY: Security
-   METRIC: 100 % of the logins to the booking service are performed through the company SSO via
    OIDC

The system MUST authenticate every user through the company SSO using OIDC, BECAUSE the
employees log in with their existing company account, so the booking service keeps no own
accounts or passwords.

##  REQUIREMENT: Booking Page Loads Within 1 Second

-   PRIORITY: MUST
-   CATEGORY: Performance
-   QUALIFIES: [[Book a Free Room for a Slot]]
-   METRIC: load time of the booking page < 1 s for at least 95 % of the page loads

The system MUST load the booking page in under 1 second, BECAUSE the employees are to find
and book a free room themselves quicker than by mailing Facility Management.

##  REQUIREMENT: Data Stays in the EU

-   PRIORITY: MUST
-   CATEGORY: Constraint
-   METRIC: 100 % of the data of the booking service is stored and processed within the EU

The system MUST keep all its data within the EU, BECAUSE the bookings record which employee
uses which room when, which is personal data falling under EU data protection law.

##  REQUIREMENT: Availability During Office Hours

-   PRIORITY: MUST
-   CATEGORY: Reliability
-   METRIC: availability >= 99.5 % per calendar month within the office hours of 07:00-20:00
    local time of the Vienna office

The system MUST be available for at least 99.5 % of the office hours, BECAUSE the employees
search, book, and check in during the office hours.
