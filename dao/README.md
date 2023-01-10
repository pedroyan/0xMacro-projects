# DAO Project

## Setup

See [README-Setup.md](./README-Setup.md)

## Technical Spec

<!-- Here you should list your DAO specification, so that your staff micro-auditor knows what spec to compare your implementation to. -->

## Code Coverage Report

<!-- Copy + paste your coverage report here before submitting your project -->
<!-- You can see how to generate a coverage report in the "Solidity Code Coverage" section located here: -->
<!-- https://learn.0xmacro.com/training/project-crowdfund/p/4 -->

## Design Exercise Answer

<!-- Answer the Design Exercise. -->
<!-- In your answer: (1) Consider the tradeoffs of your design, and (2) provide some pseudocode, or a diagram, to illustrate how one would get started. -->

> Per project specs there is no vote delegation; it's not possible for Alice to delegate her voting power to Bob, so that when Bob votes he does so with the voting power of both himself and Alice in a single transaction. This means for someone's vote to count, that person must sign and broadcast their own transaction every time. How would you design your contract to allow for non-transitive vote delegation?

> What are some problems with implementing transitive vote delegation on-chain? (Transitive means: If A delegates to B, and B delegates to C, then C gains voting power from both A and B, while B has no voting power).
