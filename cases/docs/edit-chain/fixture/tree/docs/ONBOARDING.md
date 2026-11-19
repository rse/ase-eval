# Onboarding Guide for New Backend Developers

Welcome to the backend team! This guide is basicaly meant to help you to get
productive as quickly as it is in any way possible during your first week,
and it explains the most important things that you need to know.

## Your First Day

On your first day, you will recieve your laptop from the IT department, and
it is really important that you set up the full-disk encryption before you
do anything else, because this is required by our security policy. After
that, you should request access to the GitHub organisation, the AWS console,
and the on-call tool, which is done by opening a ticket in the service desk.
Please note that the approval of the AWS access can take up to two working
days, so it is a good idea to request it as early as possible.

## The Development Setup

We use Node.js 22 together with PostgreSQL 16 for all of our services. In
order to run a service localy, you need to start the database with
`docker compose up -d db` and then you need to run `npm ci` followed by
`npm run dev`. The configuration is read from a `.env` file, of which an
example is provided in the file `.env.example` in each repository. You should
never ever commit the `.env` file, since it contains secrets.

## How We Work

Every change is done on a feature branch and is merged through a pull
request, which needs at least one approval from a team member who did not
write the change. The CI pipeline runs the linter, the unit tests and the
integration tests, and a pull request can only be merged if all of them are
green. We deploy to production every tuesday and thursday at 10:00, and
deployments outside of this windows need the approval of the team lead.

## On-Call

After your first month you will join the on-call rotation, which means that
you are responsible for handling alerts for one week at a time. Before your
first on-call week, you will shadow an experienced colleague for one week,
so that you are able to learn how the runbooks are used. The runbooks are
located in the `runbooks/` folder of the `platform` repository.

## Getting Help

If you are stuck, dont hesitate to ask in the `#backend-help` channel. Your
onboarding buddy is also always happy to help you, and you will have a
check-in with the team lead at the end of your first and your second week.
