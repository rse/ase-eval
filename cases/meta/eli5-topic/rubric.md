# Rubric: ELI5 of Eventual Consistency

The output explains eventual consistency in distributed databases "like I'm
five". Score each criterion and average them:

1.  **Simplicity**: plain, child-friendly language; jargon is avoided or
    immediately explained.
2.  **Correctness**: the core idea is right - replicas may disagree for a
    while, but without new writes they converge to the same value; reads
    can be stale in between.
3.  **Analogy**: a concrete, fitting analogy (e.g. friends updating
    copies of a shared list or notebook) that maps onto replicas,
    propagation delay, and convergence.
4.  **Completeness**: it also conveys why systems accept this (speed,
    availability) without overloading the explanation.
5.  **Form**: short, well structured, no factual errors.
