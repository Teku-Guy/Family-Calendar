# Feature Requirements Summary
## Click-to-Edit Events & Event Overflow Management

**Quick Reference for Stakeholders & Implementation Team**

---

## The Problem

1. **Month & Year views are not interactive** - Users cannot click events to edit them; they must switch to week view
2. **Hidden events are hard to discover** - Days with 4+ events only show 3, with a non-clickable "+ more…" text
3. **Inconsistent UX** - Week view has full click-to-edit; other views are read-only

---

## The Solution (2 Integrated Features)

### Feature 1: Click-to-Edit Across All Views
Make every event in every view (week, month, year, day) clickable to open the edit modal.

**Status:** Week & Day = Done. Month & Year = TODO

### Feature 2: Expandable Day Overflow
When a day has 4+ events, show an interactive "+ more…" button that expands to display all events in a modal.

**Status:** NOT IMPLEMENTED. Depends on Feature 1.

---

## User Stories at a Glance

### Feature 1: Click-to-Edit

| Story | View | Priority | Effort |
|-------|------|----------|--------|
| US-1.1 | Month view click-to-edit | MUST | 1 sprint |
| US-1.2 | Year view click-to-edit | SHOULD | 3-4 days |
| US-1.3 | Callback interface consistency | MUST | 2 days |

### Feature 2: Event Overflow

| Story | Scope | Priority | Effort |
|-------|-------|----------|--------|
| US-2.1 | "+ more…" button + overlay modal (month view) | MUST | 1 sprint |
| US-2.2 | "+ more…" in year view | SHOULD | 2-3 days |
| US-2.3 | Visual styling for button | SHOULD | 2 days |
| US-2.4 | Configuration/constants | NICE-TO-HAVE | 1 day |

---

## Acceptance Criteria Summary

### Feature 1 MVP (US-1.1 + US-1.3)
- [ ] Events in month view are clickable (styled as buttons)
- [ ] Clicking opens EventModal with correct event data (matches week view)
- [ ] Keyboard accessible: Tab/Enter to open
- [ ] Modal closes gracefully, returns to month view
- [ ] No regressions in week/day views

### Feature 2 MVP (US-2.1 + US-2.3)
- [ ] "+ more…" button appears when day has 4+ events
- [ ] Button is styled visually distinct and interactive
- [ ] Clicking "+ more…" opens overlay showing ALL events for that day
- [ ] Each event in overlay is clickable to edit (reuses EventModal)
- [ ] Closing overlay returns to month view
- [ ] Keyboard accessible: Tab through events, Enter to edit

### Phase 2 (US-1.2 + US-2.2)
- [ ] Same behavior in year view (12 mini-months)
- [ ] Year view state preserved after expand/close
- [ ] No cross-month state conflicts

---

## Implementation Roadmap

### Phase 1: Foundation (Feature 1 MVP) - **2-3 weeks**
1. **US-1.3** - Create consistent onEditEvent callback interface across all views
2. **US-1.1** - Add click handlers to MonthGrid, integrate with EventModal
3. **Testing** - Accessibility, keyboard nav, no regressions

**Deliverable:** Month view is fully interactive (click any event to edit)

### Phase 2: User Experience (Feature 2 MVP) - **2-3 weeks**
4. **US-2.4** - Define event display limit constant (MAX_EVENTS_PER_DAY)
5. **US-2.1** - Build day overflow modal/overlay component
6. **US-2.3** - Style "+ more…" button with hover/focus states
7. **Testing** - All events in overlay clickable, modal flow tested

**Deliverable:** Month view shows all hidden events when "+ more…" clicked

### Phase 3: Completeness (Feature 2 Phase 2) - **1-2 weeks**
8. **US-1.2** - Extend click-to-edit to YearGrid
9. **US-2.2** - Same overflow behavior in year view
10. **Integration** - Cross-view testing, edge cases

**Deliverable:** All 4 views (day, week, month, year) fully interactive

---

## Key Decisions

| Decision | Rationale | Status |
|----------|-----------|--------|
| Reuse existing EventModal | Avoid code duplication, consistent UX | APPROVED |
| Callback interface consistent across all views | DRY principle, easier testing | APPROVED |
| Keep overflow overlay simple (no bulk operations) | MVP focus, can add later | APPROVED |
| Local state for expandedDay in MonthGrid | Avoids prop drilling, simpler state management | PENDING |
| Three-event display limit default | Matches current Month view behavior | APPROVED |

---

## Technical Details (For Developers)

### Code Changes Location

```
src/
├── components/calendar/
│   ├── MonthGrid.tsx          ← Add click handlers, expandedDay state
│   ├── YearGrid.tsx           ← Pass callbacks, state management
│   └── [NEW] DayOverflowModal.tsx  (optional, might reuse EventModal)
├── app/calendar/
│   └── page.tsx               ← Pass callbacks to MonthGrid/YearGrid (no change)
└── lib/calendar/
    └── [NEW] event-display.ts ← Define MAX_EVENTS_PER_DAY constant
```

### Callback Signature

```typescript
// Same across all views
type OnEditEvent = (id: string, init: {
  id: string;
  calendar_id: string;
  title: string;
  location?: string;
  color?: string;
  starts_at: string;
  ends_at: string;
}) => void;
```

### State Shape

```typescript
// In MonthGrid
const [expandedDay, setExpandedDay] = useState<string | null>(null); // "2025-11-19"
```

---

## Success Metrics

### User Metrics
- Reduction in view switches (week ← month) for editing
- Increased engagement with month/year views
- Support tickets about "can't click events" → zero

### Performance Metrics
- Month view with 100+ events: < 1 second render
- Modal open: < 200ms latency
- Overlay scroll: 60 FPS (no jank)

### Quality Metrics
- Accessibility score: 90+ (Lighthouse)
- Keyboard nav: 100% coverage
- Zero regressions in existing views

---

## Risks & Mitigations

| Risk | Probability | Severity | Mitigation |
|------|-------------|----------|-----------|
| Modal doesn't integrate correctly with month view | Low | High | Reuse exact WeekGrid pattern, early testing |
| Performance degrades with 50+ events | Medium | Medium | Profile early, optimize queries if needed |
| Keyboard accessibility issues | Medium | High | Manual testing, use existing patterns from WeekGrid |
| Year view state conflicts | Low | Medium | Keep expandedDay local to each MonthGrid |

---

## Dependencies & Blockers

### No External Blockers ✓
- All required infrastructure exists (EventModal, useEvents realtime, API)
- No database schema changes needed
- No breaking changes to other features

### Internal Dependencies
- US-1.3 (callback interface) blocks US-1.1, US-1.2, US-2.1, US-2.2
- US-2.1 (overlay modal) blocks US-2.2, US-2.3

---

## Questions for Product & Design

1. **Event Limit:** Should all views use the same 3-event display limit, or customize per view?
   - *Current assumption:* 3 events + "+ more…" in month & year views

2. **Overflow Display:** Should the overflow overlay be a modal (centered dialog) or an inline dropdown?
   - *Current assumption:* Modal (consistent with EventModal), can be side-by-side on desktop

3. **Recurring Events:** When user clicks a recurring event instance in month view, should it edit just that instance or the whole series?
   - *Current assumption:* Edit series (existing behavior), let EventModal handle "this event only" option

4. **Visual Indicator:** Should "+ more…" be styled as a button, link, or text with icon?
   - *Current assumption:* Button with icon (↓ or +), hover effect

---

## Next Steps

### For Product Manager
- [ ] Review and approve 6 user stories
- [ ] Confirm priority order (MVP vs Phase 2)
- [ ] Decide on questions above (if any)
- [ ] Allocate sprints and team

### For Lead Developer
- [ ] Review technical approach, identify any risks
- [ ] Estimate effort per story (refine if different from summary)
- [ ] Plan test strategy
- [ ] Reserve 1-2 spike if needed for prototyping

### For Designer
- [ ] Review styling approach (use existing EventCard/AllDayEventBanner palette)
- [ ] Design overlay modal layout
- [ ] Provide feedback on "+ more…" styling options

### For QA Lead
- [ ] Review test plan (unit, integration, E2E, accessibility)
- [ ] Plan manual testing rounds
- [ ] Define regression test suite

---

## Appendix: Quick Feature Comparison

| Aspect | Before | After |
|--------|--------|-------|
| **Month View Interaction** | View only | Full click-to-edit |
| **Year View Interaction** | View only | Full click-to-edit |
| **Event Discovery** | Switch to week view for hidden events | Expand in-place with "+ more…" |
| **Consistency** | Week ≠ Month ≠ Year | Week = Month = Year |
| **Keyboard Nav** | Week only | All views |
| **Performance** | No change | Monitor 100+ event days |

---

**Document Version:** 1.0
**Last Updated:** 2025-11-19
**Owner:** Requirements Analyst (Claude Code)
**Status:** APPROVED FOR DEVELOPMENT

