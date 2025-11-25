# Priority & Sequencing Matrix

## User Stories at a Glance

### Effort Estimate Summary

| Story | Title | Effort | Points | Priority |
|-------|-------|--------|--------|----------|
| US-1.3 | Callback Interface Consistency | 1-2 days | 2-3 | MUST |
| US-1.1 | Click-to-Edit in Month View | 2-3 days | 5-8 | MUST |
| US-1.2 | Click-to-Edit in Year View | 2-3 days | 5-8 | SHOULD |
| US-2.4 | Configurable Event Limit | 1 day | 2-3 | NICE |
| US-2.1 | "+more…" Button & Overflow Modal | 3-4 days | 8-13 | MUST |
| US-2.3 | "+more…" Visual Styling | 1-2 days | 2-3 | SHOULD |
| US-2.2 | Overflow in Year View | 2-3 days | 5-8 | SHOULD |

**Total Effort (MVP): 7-9 days (14-21 points)**
**Total Effort (Complete): 12-17 days (29-48 points)**

---

## Dependency Graph

```
┌─────────────────────────────────────────────────┐
│          FEATURE 1: CLICK-TO-EDIT               │
│                                                 │
│  ┌──────────────────────────────────────────┐  │
│  │  US-1.3: Callback Interface (Foundation) │  │
│  │  1-2 days │ MUST                         │  │
│  └──────────────────────────────────────────┘  │
│       ▼                                         │
│  ┌────────────────────────┐  ┌──────────────┐  │
│  │ US-1.1: Month View     │  │ US-1.2: Year │  │
│  │ 2-3 days │ MUST        │  │ 2-3 days │   │  │
│  │ ⮕ Blocks US-2.1 ────────→ │ SHOULD       │  │
│  └────────────────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────┘
        ▼
┌─────────────────────────────────────────────────┐
│          FEATURE 2: EVENT OVERFLOW              │
│                                                 │
│  ┌──────────────────────────────────────────┐  │
│  │  US-2.4: Config Constant (Optional)      │  │
│  │  1 day │ NICE                            │  │
│  └──────────────────────────────────────────┘  │
│       ▼                                         │
│  ┌────────────────────────┐                    │
│  │ US-2.1: Month Overflow │                    │
│  │ 3-4 days │ MUST        │                    │
│  │ ⮕ Blocks US-2.3,US-2.2 │                    │
│  └────────────────────────┘                    │
│       ▼        ▼                                │
│  ┌──────────────┐  ┌──────────────────────┐   │
│  │ US-2.3:      │  │  US-2.2: Year View   │   │
│  │ Styling      │  │  2-3 days │ SHOULD   │   │
│  │ 1-2 days │   │  └──────────────────────┘   │
│  │ SHOULD       │                             │
│  └──────────────┘                             │
└─────────────────────────────────────────────────┘
```

---

## Implementation Sequencing

### Phase 1: Click-to-Edit MVP (Sprint 1 - 2 weeks)

**Goal:** Make month view clickable (solves primary pain point)

**Order:**
1. **Day 1-2: US-1.3** - Establish callback interface (unblocks everything)
2. **Day 3-5: US-1.1** - Implement month view click handlers
3. **Day 6-8: Testing & Review** - Verify accessibility, no regressions

**Why this order?**
- US-1.3 is the foundation; all other stories depend on it
- US-1.1 is high-value: directly solves "can't click events in month view"
- Early testing catches integration issues

**Deliverable:**
- Month view fully interactive
- Clicking any event opens EventModal with correct data
- Keyboard navigation works

**Success Criteria:**
- All acceptance criteria for US-1.3 + US-1.1 met
- No regression in week/day views
- Accessibility audit: 90+

---

### Phase 2: Event Overflow MVP (Sprint 2 - 2 weeks)

**Goal:** Show all events for busy days (solves secondary pain point)

**Order:**
1. **Day 1: US-2.4** - Define configuration constant (quick, enables flexibility)
2. **Day 2-5: US-2.1** - Build overflow modal, integrate with month view
3. **Day 6-8: US-2.3** - Style button, accessibility review
4. **Day 9-10: Testing & Review** - End-to-end testing, edge cases

**Why this order?**
- US-2.4 is quick, sets up infrastructure
- US-2.1 is core functionality; test thoroughly
- US-2.3 polish happens after core works

**Deliverable:**
- "+ more…" button appears on busy days
- Overlay modal shows all events
- All events in overlay clickable to edit

**Success Criteria:**
- "+ more…" interactive
- Overflow modal tested with 30+ events
- Performance: < 200ms open time
- Keyboard navigation works

---

### Phase 3: Completeness (Sprint 3 - 1-2 weeks)

**Goal:** Full feature parity across all views

**Order:**
1. **Day 1-2: US-1.2** - Extend click-to-edit to year view
2. **Day 3-4: US-2.2** - Add overflow to year view
3. **Day 5+: Integration Testing** - Cross-view scenarios, edge cases

**Why this order?**
- Build on working foundation from Sprint 1 & 2
- Year view changes are mostly prop passing
- Final testing ensures no regressions

**Deliverable:**
- All 4 views (day, week, month, year) fully interactive
- Event overflow works everywhere
- Feature complete

---

## Alternative Sequencing (Reduced Scope)

**If timeline is tight, reduce to Phase 1 only:**

**Phase 1 (MANDATORY):**
- US-1.3: Callback interface
- US-1.1: Month view click-to-edit

**Why stop here?**
- Solves primary pain point (can't click in month view)
- Event overflow can be future enhancement
- Smaller scope, faster to ship

**Future work:**
- Phase 2: Event overflow (next sprint)
- Phase 3: Year view (subsequent sprint)

---

## Risk-Adjusted Timeline

### Optimistic Case
- Phase 1: 10 days
- Phase 2: 10 days
- Phase 3: 8 days
- **Total: 28 days (4 weeks)**

### Realistic Case
- Phase 1: 12 days
- Phase 2: 12 days
- Phase 3: 10 days
- **Total: 34 days (5-6 weeks)**

### Pessimistic Case
- Phase 1: 14 days (unexpected accessibility issues)
- Phase 2: 16 days (complex state management in overflow)
- Phase 3: 12 days (year view integration tricky)
- **Total: 42 days (6-7 weeks)**

**Recommendation:** Plan for realistic case (5-6 weeks for full feature)

---

## MoSCoW Prioritization

### MUST HAVE (Do First - Commits Required)

| ID | Title | Reason |
|----|-------|--------|
| US-1.3 | Callback Interface | Foundation for all other work |
| US-1.1 | Month View Click-to-Edit | Solves primary pain point |
| US-2.1 | "+more…" Overflow | Solves event discovery problem |

**Effort:** 7-9 days
**MVP Scope:** If you have 2 weeks, complete these three

---

### SHOULD HAVE (Do Second - Value-Add)

| ID | Title | Reason |
|----|-------|--------|
| US-1.2 | Year View Click-to-Edit | Feature completeness |
| US-2.3 | "+more…" Visual Styling | User experience polish |
| US-2.2 | Year View Overflow | Feature parity |

**Effort:** 5-8 days
**Enhanced Scope:** If you have 4 weeks, complete MUST + SHOULD

---

### NICE TO HAVE (Do Last - Future)

| ID | Title | Reason |
|----|-------|--------|
| US-2.4 | Config Event Limit | Future A/B testing flexibility |

**Effort:** 1 day
**Nice-to-Have:** One-liner when you have time

---

## Critical Path Analysis

**Critical Path (determines minimum schedule):**

```
US-1.3 (1-2d) → US-1.1 (2-3d) → US-2.1 (3-4d) = 6-9 days minimum
```

**Parallel Work (can happen simultaneously):**
- US-1.2 can start once US-1.3 is done
- US-2.3 can start once US-2.1 is working
- US-2.4 can start anytime

**Recommended Team:**
- 1 developer (critical path): US-1.3 → US-1.1 → US-2.1
- 1 developer (parallel): US-1.2, US-2.2, US-2.4
- (Or 1 developer sequentially if smaller team)

---

## Acceptance Criteria Checklist (Prioritized)

### Phase 1 Acceptance (MUST)
- [ ] Every event in month view is clickable
- [ ] Clicking opens EventModal with correct data
- [ ] Keyboard navigation works (Tab, Enter, Space)
- [ ] Focus indicators visible
- [ ] No regression in week view
- [ ] Modal closes gracefully

### Phase 2 Acceptance (MUST)
- [ ] "+ more…" button appears on busy days (4+ events)
- [ ] Clicking opens overflow modal
- [ ] All events in modal are clickable
- [ ] Modal closes and returns to month view
- [ ] Editing events from modal saves correctly
- [ ] Performance: < 200ms open time

### Phase 3 Acceptance (SHOULD)
- [ ] Year view events are clickable (same as month)
- [ ] Year view supports overflow modal
- [ ] No state conflicts between month cards
- [ ] Year view performance acceptable (365+ events)

---

## Quality Gates (Pass/Fail Criteria)

### Must Pass Before Phase 2
1. [ ] US-1.3 types defined, no TypeScript errors
2. [ ] US-1.1 events clickable in month view
3. [ ] EventModal opens with correct event data
4. [ ] Keyboard accessibility passes axe-core audit
5. [ ] No regression: Week view still works
6. [ ] Manual testing: Click 5 events, verify modal data

### Must Pass Before Phase 3
1. [ ] US-2.1 overflow modal appears and works
2. [ ] All events in modal clickable
3. [ ] Edit from modal → save → refresh works
4. [ ] Keyboard nav in modal works
5. [ ] Accessibility: focus/ARIA/contrast pass
6. [ ] Performance: 100 events, < 1s render

### Must Pass Before Release
1. [ ] US-1.2 year view click-to-edit works
2. [ ] US-2.2 year view overflow works
3. [ ] Cross-view testing: same event clickable from week + month + year
4. [ ] No memory leaks (toggle views repeatedly)
5. [ ] Mobile testing: touch targets adequate
6. [ ] Lighthouse: 90+ accessibility, 85+ performance

---

## Resource Planning

### Minimum Team

**Option 1: Single Developer (Sequential)**
- Phase 1: 2 weeks
- Phase 2: 2 weeks
- Phase 3: 1-2 weeks
- **Total: 5-6 weeks**

**Breakdown:**
- Week 1: US-1.3 → US-1.1 (foundation)
- Week 2: US-1.1 finish, testing
- Week 3: US-2.1 (overflow modal)
- Week 4: US-2.3 styling, testing
- Week 5: US-1.2 + US-2.2 (year view)
- Week 6: Integration, edge cases, release

**Skills Needed:**
- React/Next.js (component development)
- TypeScript (type safety)
- Tailwind CSS (styling)
- Accessibility (keyboard nav, ARIA)
- Testing (unit, integration, E2E)

---

### Recommended Team (Optimal)

**Option 2: Two Developers (Parallel)**
- Developer A: Critical path (US-1.3, US-1.1, US-2.1)
- Developer B: Parallel work (US-1.2, US-2.2, US-2.4)
- Shared: Testing, review, integration

**Timeline:**
- Sprint 1 (2 weeks): Phase 1 (US-1.3 + US-1.1)
- Sprint 2 (2 weeks): Phase 2 (US-2.1 + US-2.3) + Phase 3 prep (US-1.2)
- Sprint 3 (1 week): Phase 3 (US-2.2) + integration testing

**Total: 5 weeks (4 weeks dev + 1 week testing)**

---

## Estimation Confidence

### High Confidence (Well-Understood)
- US-1.3: 90% confident (simple type definitions)
- US-1.1: 85% confident (follow WeekGrid pattern)
- US-2.4: 95% confident (simple constant)

### Medium Confidence (Some Unknowns)
- US-2.1: 70% confident (overflow modal is new component)
- US-2.3: 80% confident (styling/accessibility testing)

### Lower Confidence (Complex)
- US-1.2: 75% confident (year view prop passing)
- US-2.2: 70% confident (state management across month cards)

**Recommendation:** Allocate 20% buffer for unknowns (Phase 1: +2 days, Phase 2: +2 days)

---

## Success Metrics & Validation

### MVP Success (Phase 1)
- [ ] Month view click rate: monitor clicks on events
- [ ] Modal engagement: time spent in edit modal
- [ ] Support tickets: zero "can't click events in month" reports
- [ ] Accessibility audit: 90+ score

### Enhanced Success (Phase 1 + 2)
- [ ] Event discovery: X% users expand hidden events
- [ ] View preference: increase in month view usage
- [ ] Performance: no degradation with 100+ event days
- [ ] User satisfaction: survey feedback positive

### Full Success (All Phases)
- [ ] Feature adoption: Y% users use click-to-edit in month/year
- [ ] View consistency: users report unified experience across views
- [ ] Performance: all views render < 2 seconds
- [ ] Quality: zero critical bugs post-release

---

## Decision Framework

### When to Start Phase 1?
**Prerequisites:**
- [ ] Requirements document approved by product
- [ ] Developer capacity available (2 weeks minimum)
- [ ] Designer/UX sign-off on interaction model
- [ ] TestNG/E2E framework in place

**Go/No-Go Decision:**
- [ ] All prerequisites met → START
- [ ] Missing any prerequisite → DELAY

---

### When to Start Phase 2?
**Prerequisites:**
- [ ] Phase 1 complete and testing passed
- [ ] No critical bugs in Phase 1
- [ ] Accessibility audit passed
- [ ] Performance acceptable

**Go/No-Go Decision:**
- [ ] All prerequisites met → START
- [ ] Critical bugs in Phase 1 → FIX FIRST
- [ ] Performance issues → INVESTIGATE & OPTIMIZE

---

### When to Start Phase 3?
**Prerequisites:**
- [ ] Phase 2 complete and stable
- [ ] No regressions from Phase 1 or 2
- [ ] Capacity available for 1-2 weeks
- [ ] Feature complete for MVP (optional to ship)

**Go/No-Go Decision:**
- [ ] All prerequisites met → START
- [ ] No capacity → DEFER to next sprint
- [ ] Phase 2 issues → FIX FIRST

---

## Rollback & Contingency Plan

**If US-1.1 fails (month view click-to-edit doesn't work):**
1. Revert changes
2. Investigate failure (likely callback signature issue)
3. Align with WeekGrid pattern
4. Re-test before proceeding

**If US-2.1 fails (overflow modal too complex):**
1. Simplify to inline event list (not modal)
2. Or reuse EventPopover (existing component)
3. Reduce scope: ship modal without edit capability, add later

**If performance issues arise:**
1. Profile with React DevTools Profiler
2. Check event count in month cell
3. Implement virtual scrolling if needed
4. Or reduce default event display limit

**Contingency Effort:**
- +2-3 days for troubleshooting/fixes
- Plan buffer time in schedule

---

## Version Control & Release Plan

### Branching Strategy

```
main (stable)
  ↑
release/v1.2.0 (release candidate)
  ↑
develop (integration branch)
  ↑
feature/click-to-edit (Phase 1)
feature/event-overflow (Phase 2)
feature/year-view-interactive (Phase 3)
```

### Release Checklist

**Phase 1 Release:**
- [ ] All tests passing
- [ ] Accessibility audit: 90+
- [ ] Staging tested (full month view scenario)
- [ ] Prod deploy: low-risk (month view only, not default)

**Phase 2 Release:**
- [ ] All overflow tests passing
- [ ] Performance verified (100+ events)
- [ ] Staging tested
- [ ] Prod deploy: medium-risk (new component)

**Phase 3 Release:**
- [ ] All year view tests passing
- [ ] Integration testing complete
- [ ] Staging tested
- [ ] Prod deploy: low-risk (extends existing, no new components)

---

## Communication Plan

### Stakeholder Updates

**Weekly (Team Sync):**
- Progress update
- Blockers/risks
- Next week's plan

**At Phase Boundaries:**
- Accomplishments
- Lessons learned
- Scope adjustments if needed

**At Release:**
- Feature announcement
- User documentation
- Release notes

### Documentation

- **Developers:** USER_STORIES_DETAILED.md, FEATURE_REQUIREMENTS_ANALYSIS.md
- **Product:** FEATURE_REQUIREMENTS_SUMMARY.md, PRIORITY_MATRIX.md
- **Users:** Help docs, release notes (not in scope here)

---

**Document Version:** 1.0
**Last Updated:** 2025-11-19
**Owner:** Requirements Analyst
**Status:** APPROVED FOR PLANNING

