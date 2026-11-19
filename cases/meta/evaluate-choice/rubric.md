# Rubric: Decision Matrix for a Message Broker

The output evaluates RabbitMQ, Apache Kafka, and a managed cloud queue
(AWS SQS) for a 6-person team, ~200 msg/s, at-least-once delivery, no ops
staff, with a weighted multi-criteria decision matrix. Score each
criterion and average them:

1.  **Criteria**: relevant, weighted criteria (operational effort,
    delivery guarantees, throughput fit, cost, ecosystem/lock-in, team
    skills) derived from the stated constraints.
2.  **Ratings**: plausible ratings per alternative and criterion (e.g.
    Kafka over-dimensioned and ops-heavy for 200 msg/s without ops
    staff; SQS lowest ops effort; RabbitMQ in between).
3.  **Arithmetic**: the weighted totals are consistent with the weights
    and ratings shown (no obvious calculation errors).
4.  **Conclusion**: the best alternative follows from the totals and is
    well justified for the constraints (a managed queue or RabbitMQ is
    defensible; Kafka would need a strong reason).
5.  **Form**: the matrix is readable and the reasoning is honest about
    trade-offs.
