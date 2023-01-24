**This is the staff audit for the code you performed a peer audit on. We give you this so you can compare your peer audit against a staff audit for the same project.**

https://github.com/0xMacro/student.tommyrharper/tree/a3cb1b12ca116f153c789321e610a79ea7898b3f/ico

Audited By: Leoni Mella (MrLeoni)

# General Comments

Hi Thomas! Great job on your ICO project!
I made some notes about quality issues and nitpicks about some names and variables, but overall you did a very good contract and frontend application.

One thing that I found a bit confusing was your `privates` functions in the ICO contract to handle individuals and global contributions. Maybe you could write it more directly without so many functions connected. I'm sure you will get a fresh view of this when you see the project solution.

That's it! Keep up the good work!

# Design Exercise

Good answer of the Design Exercise! Your answer mentioned, and pseudo implemented, all the required component of a Vesting proccess: Start Time, End Time (or duration) and the mechanism. Good job!

# Issues

## **[Q-1]** No use of indexed parameters in events in `SpaceCoin.sol` and `Ico.sol`

Indexing parameters in events are a great way to keep track of specific outputs from events, allowing the creation of topics to sort and track data from them. Using `indexed` in parameters on events will allow dapps to track the specific events of an address with ease.

# Nitpicks

## **[N-1]** Enum `Phase` declaration is missplaced

You declared your `enum Phase` on line 139 in the Ico contract alongside with other functions. Would be better to declared it along with the other contract variables for consistency

## **[N-2]** Misleading function name

IMO your `advancePhase()` function name is a bit misleading since it will require to pass the **current** phase as the parameter. Maybe it would be better to call it `advanceToNextPhase()` or something similar.

# Score

| Reason                     | Score |
| -------------------------- | ----- |
| Late                       | 0     |
| Unfinished features        | 0     |
| Extra features             | 0     |
| Vulnerability              | 0     |
| Unanswered design exercise | 0     |
| Insufficient tests         | 0     |
| Technical mistake          | 0     |

Total: 0
Great Job!
