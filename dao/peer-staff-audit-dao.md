**This is the staff audit for the code you performed a peer audit on. We give you this so you can compare your peer audit against a staff audit for the same project.**

https://github.com/0xMacro/student.sgzsh269/tree/4bb3aebb16722d5e85a92d8468f64196b6248cb3/dao

Audited By: Abhi

# General Comments

Great work on this assignment, Sagar. Overall, this was an awesome submission. Your code is super well organized and documented. I liked how you extracted some logic into the `EIP712` contract, and the `divRoundUp` function was an elegant and easy to understand solution to the quorum rounding down issue. Your solution to the edge case of a voter joining in the same block as proposal creation was also clever and not an approach I've seen before. The test coverage was really solid, too.

I found one High vulnerability, but no major issues besides that.


# Design Exercise

1. Good point about the situation where a delagatee joins after proposal creation. I think you also have to worry about situations where a delegatee is allowed to vote on a proposal but the delegator is not. You mention iterating over the array of delegators to check voting eligibility - I think this would solve both problems. There is a sort of weird edge where a delegatee is able to vote using only delegated votes but no voting power of their own, but I think that's ok. 

2. Both of these are good points. Yes, some of the traversals for maintaining proper delegation totals could be gas intensive. Another potential pitfall is circular delegations.


# Issues

## **[H-1]** A member can vote repeatedly on the same proposal

A member is able to vote multiple times on the same proposal, simply by voting on some other proposal before voting on the first one a second time.

I confirmed this issue with this test case. Note, there is only one member voting (`memberAlice`) but by the end the first proposal has two votes.
```typescript
it("Known issue - allows member to vote multiple times", async () => {
    const { collectorDAO, memberAlice, proposalId, proposalId2 } =
    await loadFixture(setupVotingFixture);

    await collectorDAO.connect(memberAlice).castVote(proposalId, true);

    let proposal = await collectorDAO.proposals(proposalId);
    expect(proposal.yesVoteCount).to.eq(1);
    expect(proposal.voterCount).to.eq(1);
    expect(
        await collectorDAO.memberToProposalIdMap(memberAlice.address)
    ).to.eq(proposalId);

    await collectorDAO.connect(memberAlice).castVote(proposalId2, true);

    const proposal2 = await collectorDAO.proposals(proposalId2);
    expect(proposal2.yesVoteCount).to.eq(1);
    expect(proposal2.voterCount).to.eq(1);
    expect(
        await collectorDAO.memberToProposalIdMap(memberAlice.address)
    ).to.eq(proposalId2);

    await collectorDAO.connect(memberAlice).castVote(proposalId, true);
    proposal = await collectorDAO.proposals(proposalId);
    expect(proposal.yesVoteCount).to.eq(2);
    expect(proposal.voterCount).to.eq(2);
    expect(
        await collectorDAO.memberToProposalIdMap(memberAlice.address)
    ).to.eq(proposalId);
});
```

The core problem here is the `memberToProposalIdMap`. This map is only tracking the _last_ proposal the member voted on. As soon as they vote on something else, the data about their prior votes is lost.

Consider tracking voter information in a mapping like `(proposalId) => (memberAddress) => (bool hasVoted)`.


# Score

| Reason | Score |
|-|-|
| Late                       | - |
| Unfinished features        | - |
| Extra features             | - |
| Vulnerability              | 3 |
| Unanswered design exercise | - |
| Insufficient tests         | - |
| Technical mistake          | - |

Total: 3

