# Feature Requirements Analysis

## Overview

This document provides a comprehensive breakdown of two interrelated calendar UI features for the Family Calendar application. Both features enhance event discoverability and interaction across all calendar view modes (day, week, month, year).

**Status:** Requirements Analysis Complete
**Date:** 2025-11-19
**Project:** Family Calendar (Next.js 15 + Supabase)

---

## Feature 1: Click-to-Edit Events Across Calendar Views

### Current State Analysis

**Week View (Implemented):**
- Fully functional click-to-edit for timed and all-day events
- Opens EventModal with event details pre-populated
- Keyboard accessible (Enter/Space keys)
- Event click handler: `onEditEvent` callback in WeekGrid

**Month View (Not Implemented):**
- Shows max 3 events per day as static text
- Display "+ more…" when 4+ events exist
- No click handlers on individual events or "+ more…" button
- Clicking does nothing

**Year View (Not Implemented):**
- Reuses MonthGrid component (inherits no-click behavior)
- Same "+ more…" limitation as Month view

**Day View (Implemented):**
- Inherits from WeekGrid with `mode="day"`
- Already supports click-to-edit

---

## Feature 2: Expandable Day View for Event Overflow

### Current State Analysis

**Month View:**
- Hard-coded limit of 3 events per day (line 18 in MonthGrid.tsx)
- Shows "+ more…" text at line 44
- Text is not clickable or interactive
- No expansion mechanism exists

**Year View:**
- Delegates to MonthGrid, inherits the limitation
- No independent expansion logic

**Other Views:**
- Week view dynamically resizes based on overlaps
- No artificial limit or expansion logic needed (events are scaled smaller)
- Day view shows all events for that day (no overflow issue)

---

## Requirements Breakdown

### Feature 1: Click-to-Edit Events Across All Views

#### US-1.1: Click Events in Month View

**As a** user viewing my calendar in month view,
**I want** to click on any event in a day cell to open its details for editing,
**So that** I can quickly access and modify event information without switching views.

**Acceptance Criteria:**
- Every event displayed in a month view day cell is clickable
- Clicking an event opens EventModal with `mode="edit"`
- Modal pre-populates with event: id, title, location, color, starts_at, ends_at
- Event styling indicates interactivity (cursor pointer, hover effect)
- Keyboard support: Tab to event, Enter/Space to open modal
- Works for regular events, recurring series masters, and overrides
- Works for all-day events (if displayed in month view)
- Modal close returns to month view without navigation
- Clicking the "+ more…" area does NOT open modal (handled in Feature 2)

**Edge Cases to Handle:**
- Multi-day events (should be clickable on each visible day)
- All-day events (if implemented for month view in future)
- Recurring event instances (click opens base series or override?)
- Performance: 30+ events in a single day cell should remain responsive

**Technical Notes:**
- MonthGrid.tsx needs `onEditEvent` callback prop (match WeekGrid signature)
- Must wrap event elements with role="button", tabIndex, aria-label
- Color styles from existing EventCard/AllDayEventBanner components
- Pass event data to modal same format as WeekGrid

**Definition of Done:**
- All events in month view are clickable
- Modal opens with correct event data
- No regression in week/day view functionality
- Accessibility audit passes (keyboard nav, ARIA labels)
- Manual testing: click 5 different events in month view, verify modal content

---

#### US-1.2: Click Events in Year View

**As a** user viewing my calendar in year view (12 mini-months),
**I want** to click on any event to edit it, even in the small month cards,
**So that** I can manage events from a high-level yearly perspective.

**Acceptance Criteria:**
- Every event in each month card is clickable
- Same behavior as US-1.1 (opens EventModal with event data)
- All 12 months' events are interactive, not just visible ones
- Keyboard accessible from all month cards
- Smooth transition: click event → modal opens → close modal → return to year view
- Year view canvas stays in place (no navigation on close)
- Performance: All 365+ events in year should load quickly

**Edge Cases to Handle:**
- User clicks event in December, then navigates month view forward—doesn't break
- Very long event titles in small month cards (truncation works properly)
- Events spanning multiple months (visible on multiple month cards)

**Technical Notes:**
- YearGrid currently maps 12 MonthGrid instances
- Each MonthGrid instance needs onEditEvent passed down
- Monthly cursor position should not change on event click

**Definition of Done:**
- Click event in any month card → modal opens
- Modal displays correct event details
- No regression in other view modes
- Year view can display events for full year without layout breaking

---

#### US-1.3: Modal Integration & Consistency

**As a** product owner,
**I want** all click-to-edit flows (week, month, year, day) to use the same EventModal component with consistent data passing,
**So that** the codebase is DRY and user experience is uniform.

**Acceptance Criteria:**
- EventModal receives event data in identical format from all views
- Modal callback signatures match across all view components
- No custom modal variants per view (use single EventModal)
- Save/Delete from modal works identically regardless of origin view
- After edit, refetch triggers realtime update (existing mechanism)

**Technical Notes:**
- Callback signature in all views: `onEditEvent(id: string, initDraft: EventDraft)`
- EventDraft type already defined in EventModal.tsx
- Calendar page passes same callbacks to all view components

**Definition of Done:**
- WeekGrid, MonthGrid, YearGrid all accept onEditEvent callback
- CalendarPage passes callbacks consistently
- Modal close/save/delete works from all views

---

### Feature 2: Expandable Day View for Event Overflow

#### US-2.1: "+ More" Button Interactivity in Month View

**As a** user viewing a busy day in month view,
**I want** to click on the "+ more…" text to expand and see all events for that day,
**So that** I don't have to switch to week view to discover hidden events.

**Acceptance Criteria:**
- When a day has 4+ events, "+ more…" button is displayed below the 3 visible events
- "+ more…" button is clickable and keyboard accessible
- Clicking "+ more…" opens an **expandable overlay** or **modal** showing all events for that day
- Overlay/modal lists all events (title, time, location if available)
- Each event in the overlay is clickable to edit (reuses EventModal)
- Overlay/modal has clear close button or click-outside-to-close behavior
- Keyboard accessible: Tab through all events, Enter to edit
- Visual indication that "+ more…" is interactive (cursor pointer, hover effect)
- Clicking "+ more…" does NOT count as "clicking the day cell" (no date selection)

**Edge Cases to Handle:**
- Day has exactly 3 events: no "+ more…" shown
- Day has exactly 4 events: show "+ more…" (1 item)
- Day has 50+ events: overflow modal should scroll
- Clicking "+ more…" then clicking outside overlay: return to month view
- User clicks "+ more…" → edits an event → saves → overlay closes, month view refreshes

**Technical Notes:**
- Current limit is hardcoded: `slice(0, 3)` in MonthGrid line 18
- "+ more…" text is hardcoded at line 44, not interactive
- Need new component: `DayOverflowModal` or reuse existing modal
- Overlay should display:
  - All events for selected day
  - Formatted start/end times
  - Location (if available)
  - Color indicator
  - Click to edit link for each event
- Click handler needed on "+ more…" text

**Implementation Approach:**
1. Add state to MonthGrid: `expandedDay` (null or date string)
2. When expandedDay is set, render overlay component
3. Overlay shows all events for that day (remove 3-event limit for overlay)
4. Clicking event in overlay calls onEditEvent (reuses existing modal)
5. Closing overlay clears expandedDay state

**Definition of Done:**
- "+ more…" button appears when 4+ events in a day
- Click "+ more…" opens overlay showing all events
- All events in overlay are clickable
- Edit any event from overlay (modal opens)
- Close overlay → return to month view
- No regression in month view layout

---

#### US-2.2: Expandable Day View in Year View

**As a** user viewing the year grid,
**I want** to click "+ more…" on any month card to see all events for an overflowing day,
**So that** I can explore event details without leaving year view.

**Acceptance Criteria:**
- "+ more…" buttons in mini-month cards are clickable
- Same behavior as US-2.1 (opens overlay with all events for that day)
- Overlay shows complete event list with times and details
- Each event in overlay can be edited
- Closing overlay returns to year view without navigation
- Year view state (selected year) is preserved after expanding

**Edge Cases to Handle:**
- User expands day in Dec, then navigates to next year—previous overlay is closed
- Multiple months showing same day number (Dec 5 vs Jan 5)—correct day is expanded
- Overlay close does not trigger year navigation

**Technical Notes:**
- YearGrid renders 12 MonthGrid instances
- Each MonthGrid needs independent expandedDay state
- Or: Lift expandedDay state to YearGrid, manage which month's day is expanded
- Pass expandedDay and setExpandedDay as props to MonthGrid

**Definition of Done:**
- Click "+ more…" in any month card → overlay appears
- Overlay shows all events for that day
- All events clickable to edit
- Close overlay → year view restored
- No memory leaks (state cleanup on unmount)

---

#### US-2.3: Event Overflow Styling & Visual Hierarchy

**As a** designer/user,
**I want** the "+ more…" indicator to be visually distinct and indicate that it's interactive,
**So that** users don't miss hidden events.

**Acceptance Criteria:**
- "+ more…" text is styled as a clickable button (not plain text)
- Hover effect indicates interactivity (color change, brightness, underline, etc.)
- Color contrasts meet WCAG AA standard
- Icon or visual indicator (e.g., "▼" or "↓") suggests expandability
- On focus (keyboard nav), clear focus ring appears
- Mobile: + more…" has adequate touch target size (min 44px)
- Styling is consistent across month and year views

**Edge Cases to Handle:**
- Very long event titles that push "+ more…" off screen
- Responsive design: "+ more…" remains visible on mobile
- Light/dark theme compatibility (if applicable)

**Technical Notes:**
- Reuse color mapping from AllDayEventBanner or EventCard
- Add new CSS classes for button styling
- Ensure focus state visible with `focus-visible` or similar

**Definition of Done:**
- "+ more…" is styled as clear, clickable button
- Hover/focus states are visually distinct
- Accessibility audit: keyboard navigation works, focus visible
- Mobile tested: touch target adequate

---

#### US-2.4: Event Overflow Display Options (Configuration)

**As a** developer,
**I want** to configure the event display limit per calendar view (e.g., 3 in month, 5 in week preview),
**So that** the design can be adjusted without code changes.

**Acceptance Criteria:**
- Event limit is configurable via component props or constants
- MonthGrid accepts maxEventsPerDay prop (default 3)
- YearGrid respects maxEventsPerDay per month card
- Constants defined in lib or config file (not hardcoded in component)
- Display limit is applied before "+ more…" threshold

**Technical Notes:**
- Define constant: `MAX_EVENTS_PER_DAY_MONTH_VIEW = 3`
- MonthGrid prop: `maxEventsPerDay?: number` (default 3)
- Easy to adjust in future for different UX experiments

**Definition of Done:**
- Props and constants properly set up
- Default behavior unchanged (3 events + "+ more…")
- Can adjust limit without touching JSX

---

## Cross-Feature Dependencies

### Dependency Graph

```
Feature 1 (Click-to-Edit)
├── Requires: EventModal component (existing, no changes)
├── Requires: onEditEvent callback interface (consistent across views)
└── Enables: US-2.1 (clicking events in overflow modal)

Feature 2 (Event Overflow)
├── Requires: Feature 1 (to make overflow events clickable)
├── Requires: New overlay/modal component (or EventModal reuse)
├── Requires: State management (expandedDay, setExpandedDay)
└── Depends on: MonthGrid click handler from Feature 1
```

### Implementation Order

1. **Phase 1 (Feature 1): Click-to-Edit Foundation**
   - US-1.3: Create consistent onEditEvent callback interface
   - US-1.1: Implement MonthGrid click handlers
   - US-1.2: Extend to YearGrid
   - All features benefit from this infrastructure

2. **Phase 2 (Feature 2): Event Overflow**
   - US-2.4: Configure display limits
   - US-2.1: Create day overflow modal/overlay
   - US-2.3: Style "+ more…" button
   - US-2.2: Extend to YearGrid

3. **Integration:**
   - Test clicking events in month overflow modal
   - Test year view cascading expansions
   - Accessibility end-to-end

---

## Success Criteria (Overall)

### Functional Success

- [ ] All events across all 4 views (day, week, month, year) are clickable
- [ ] Clicking any event opens consistent EventModal with correct data
- [ ] Clicking "+ more…" opens overlay showing hidden events for that day
- [ ] All events in overflow overlay are editable
- [ ] Saving/deleting event from any origin view triggers realtime refresh
- [ ] No view state is lost when opening/closing modals

### User Experience Success

- [ ] Users report easier event discovery in month/year views
- [ ] No increase in support tickets for "I can't click events in month view"
- [ ] Modal opens within 200ms of click (perceived performance)
- [ ] Overflow overlay doesn't cause layout shift

### Performance Success

- [ ] Month view with 100+ events renders in < 1 second
- [ ] Year view with 365+ events renders in < 2 seconds
- [ ] Opening/closing modals doesn't cause jank (60 FPS)
- [ ] No memory leaks when toggling between views repeatedly

### Accessibility Success

- [ ] Keyboard navigation works across all views (Tab, Enter, Space)
- [ ] All events have aria-labels with title and time
- [ ] Focus indicators are visible on all interactive elements
- [ ] Lighthouse accessibility score: 90+
- [ ] WCAG AA compliance verified

### Code Quality Success

- [ ] No code duplication (single EventModal, single callback pattern)
- [ ] Type safety: no `any` types, full TypeScript coverage
- [ ] Test coverage: 80%+ for new components
- [ ] No regression in existing functionality

---

## Priority & Sequencing

### Must-Have (MVP)

1. **US-1.1** - Month view click-to-edit (high impact, blocks US-2.1)
2. **US-1.3** - Consistent callback interface (foundation for all views)
3. **US-2.1** - "+ more…" button interactivity (core UX improvement)

**Effort:** 2-3 sprints
**Impact:** Solves primary user pain point (discovery in month view)

### Should-Have (Sprint 2)

4. **US-1.2** - Year view click-to-edit
5. **US-2.3** - Visual styling for "+ more…"
6. **US-2.4** - Configuration (future-proofing)

**Effort:** 1-2 sprints
**Impact:** Complete feature parity across all views

### Nice-to-Have (Future)

- Bulk event operations from overflow modal
- Event preview popover on hover (similar to EventPopover)
- Animated expansion/collapse transitions
- Multi-select events in overflow modal for batch operations

---

## Edge Cases & Scenarios

### Event Recurrence Considerations

**Scenario 1: Click a recurring event instance in month view**
- Current behavior: Series master is edited (all occurrences)
- Should behavior change: Edit single occurrence?
- Recommendation: Keep current behavior (click series master), let EventModal handle "this event only" option

**Scenario 2: Expand day with 5 recurring instances**
- All 5 instances appear in overlay
- User clicks one instance → EventModal opens
- Modal shows option to edit "this event only" or "entire series"
- Existing functionality handles this correctly

### All-Day Event Considerations

**Scenario 3: Month view with mix of all-day and timed events**
- If all-day events are rendered in month view (future feature)
- All-day events in day cell should be clickable
- Overflow logic counts both all-day and timed events
- Implementation: apply same click handler to all event types

**Scenario 4: Year view with multi-day all-day events**
- Event spans multiple days (e.g., conference over 3 days)
- Each day shows the same event
- Clicking any instance opens same event modal
- User sees full date range in modal

### Performance Considerations

**Scenario 5: Month with 50+ events (edge case)**
- All 50 are displayed when expanded
- Overlay should be scrollable
- Virtual scrolling optional (perf optimization for future)
- Recommendation: Keep simple at first, optimize if needed

**Scenario 6: Year view rendering 12 months with 30 events each**
- Total 360 events
- Each month card shows 3, "+ more…" for 27 hidden
- All 360 clickable without loading delay
- Benefit of event data already fetched by CalendarPage

### Accessibility Considerations

**Scenario 7: Keyboard-only user navigating month view**
- Tab to event → Enter to open modal
- Tab to "+ more…" → Enter to expand overlay
- Tab through events in overlay
- All interactive elements have focus indicators
- ARIA labels read correctly with screen reader

**Scenario 8: Touch user on mobile (small screen)**
- Events are tap targets (min 44x44px)
- "+ more…" is adequate tap target
- Overlay modal scales to mobile viewport
- Dismissing overlay doesn't require precise clicks

---

## User Stories with Technical Acceptance Criteria

### Story Template

```
US-X.Y: [Feature Name]

User Story
As a [user type],
I want [action/capability],
So that [benefit/goal].

Acceptance Criteria
- [ ] Criterion 1 (testable)
- [ ] Criterion 2 (testable)
- [ ] Criterion 3 (testable)

Technical Acceptance Criteria
- [ ] Component receives correct props
- [ ] Event handlers called with correct data
- [ ] No TypeScript errors
- [ ] Accessibility check passed
- [ ] Performance within budget

Definition of Done
- Code reviewed
- Tests passing (unit + E2E)
- Manual testing completed
- No regressions in other views
- Accessibility audit passed
```

### Detailed Story Breakdown

All stories use the template above. See sections US-1.1 through US-2.4 for full details.

---

## Implementation Notes

### Code Locations

**Files to Modify:**
- `src/components/calendar/MonthGrid.tsx` - Add click handlers, overlay state
- `src/components/calendar/YearGrid.tsx` - Pass callbacks, state management
- `src/app/calendar/page.tsx` - Pass callbacks to MonthGrid, YearGrid
- `src/components/calendar/EventModal.tsx` - Possibly extract to DayOverflowModal

**Files to Create:**
- `src/components/calendar/DayOverflowModal.tsx` - New overlay for hidden events (optional, could reuse EventModal)
- `src/lib/calendar/event-display.ts` - Constants for MAX_EVENTS_PER_DAY

**Files to Review (No Changes):**
- `src/components/calendar/WeekGrid.tsx` - Already implements click-to-edit (reference)
- `src/components/ui/EventCard.tsx` - Reuse styling
- `src/hooks/useEvents.ts` - Realtime already works

### Callback Interface

```typescript
// Week Grid (existing pattern)
export type OnEditEvent = (id: string, init: {
  id: string;
  calendar_id: string;
  title: string;
  location?: string;
  color?: string;
  starts_at: string;
  ends_at: string;
}) => void;

// Month Grid (same signature)
onEditEvent?: OnEditEvent;

// Year Grid (pass through)
onEditEvent?: OnEditEvent;

// Calendar Page (unchanged, passes to all)
const openEdit = useCallback((_id: string, initDraft: EventDraft) => { ... }, []);
```

### State Management

**MonthGrid (Minimal State):**
```typescript
const [expandedDay, setExpandedDay] = useState<string | null>(null); // date string like "2025-11-19"

const handleMoreClick = (day: Date) => {
  setExpandedDay(day.toISOString().split('T')[0]);
}
```

**YearGrid (Lift State or Local Per Month):**
Option A: Lift to YearGrid
```typescript
const [expandedDay, setExpandedDay] = useState<{ month: number; day: number } | null>(null);
<MonthGrid expandedDay={expandedDay} setExpandedDay={setExpandedDay} />
```

Option B: Keep local per MonthGrid (simpler, no cross-month conflicts)
```typescript
// No change needed, MonthGrid manages its own state
```

### Styling Approach

**Current**: MonthGrid uses Tailwind CSS classes
**Approach**: Extend existing color mapping from AllDayEventBanner

```typescript
const colorMap: Record<string, string> = {
  rose: 'bg-rose-500/20 border-rose-500/40 text-rose-200',
  // ...
};
```

**New "+ more…" button styling**:
```typescript
// Option 1: Standalone button
<button
  onClick={() => handleMoreClick(day)}
  className="text-[10px] opacity-70 hover:opacity-100 hover:text-blue-300 cursor-pointer transition-all font-medium"
>
  ↓ {hiddenCount} more…
</button>

// Option 2: Pill-shaped button
<button
  className="text-[10px] rounded-full bg-white/10 hover:bg-white/20 px-2 py-1 cursor-pointer transition-all"
>
  +{hiddenCount}
</button>
```

---

## Risks & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Modal doesn't open from month view | Low | High | Test all view origins early, reuse WeekGrid pattern |
| Performance degrades with many events | Medium | High | Profile with 100+ event day, optimize queries if needed |
| Keyboard nav breaks in overlay | Medium | Medium | Manual accessibility testing, add aria-labels |
| State conflicts between month cards in year view | Low | Medium | Keep expandedDay state local to MonthGrid, not global |
| "+more…" tooltip cutoff on mobile | Medium | Low | Use toast or center overlay instead of tooltip |
| Realtime refetch after edit doesn't close modal | Low | Medium | Test edit + save, verify modal close flow |

---

## Testing Strategy

### Unit Tests

- MonthGrid: Events render as clickable elements
- MonthGrid: "+ more…" appears when 4+ events
- MonthGrid: Click event calls onEditEvent with correct data
- MonthGrid: Click "+ more…" opens overlay
- Overlay: All events listed and clickable
- YearGrid: Callback passed to all MonthGrid instances

### Integration Tests

- CalendarPage: Click event in month view → EventModal opens
- CalendarPage: Edit event from month view → modal saves → view updates
- CalendarPage: Click "+ more…" → overlay shows all events
- CalendarPage: Click event in overlay → EventModal opens
- Cross-view: Same event clickable in week and month view

### E2E Tests (Cypress/Playwright)

```typescript
// Test 1: Month view click event
cy.visit('/calendar')
cy.contains('Month').click()
cy.get('[role="button"][aria-label*="Event Title"]').first().click()
cy.get('h2').should('contain', 'Event Title')

// Test 2: Expand day with "+more"
cy.get('text:contains("+more")').click()
cy.get('[role="dialog"]').should('be.visible')
cy.get('[role="dialog"] [role="button"]').should('have.length.greaterThan', 3)

// Test 3: Keyboard navigation
cy.get('[role="button"]').first().focus()
cy.realPress('Enter')
cy.get('h2').should('contain', 'Event Title')
```

### Accessibility Tests

- axe-core audit (Lighthouse)
- Manual WCAG AA checklist
- Screen reader testing (NVDA, JAWS)
- Keyboard-only navigation

### Performance Tests

- Month view with 100 events: < 1s FPS stable
- Year view with 365 events: < 2s render time
- Modal open/close: no jank

---

## Documentation & Handoff

### Developer Guide (to write post-implementation)

- How to add click handlers to new views
- How to use onEditEvent callback
- How to style event displays consistently
- How to test accessibility

### User Guide (product team)

- "Discovering Hidden Events" section in help docs
- "Editing Events in Month View" quick tip
- Screenshot showing "+more…" button

### API Documentation

- Callback interface: onEditEvent
- Overlay component props (if new component created)
- Constants (MAX_EVENTS_PER_DAY)

---

## Appendix: Current Component Architecture

### WeekGrid
- File: `src/components/calendar/WeekGrid.tsx`
- Implements click-to-edit for timed and all-day events
- Callback: `onEditEvent?: OnEditEvent`
- Overlay: Uses EventPopover (right-click), not click-to-edit

### MonthGrid
- File: `src/components/calendar/MonthGrid.tsx`
- Renders 6-week grid (42 days)
- Shows max 3 events per day
- No click handlers
- Callback: None (needs adding)
- Status: 52 lines, simple component

### YearGrid
- File: `src/components/calendar/YearGrid.tsx`
- Renders 12 MonthGrid instances
- Delegates all behavior to MonthGrid
- Status: 23 lines, wrapper component

### EventModal
- File: `src/components/calendar/EventModal.tsx`
- Handles create and edit modes
- Integrates with API for save/delete
- Currently opened from CalendarPage and WeekGrid

### CalendarPage
- File: `src/app/calendar/page.tsx`
- Manages mode state (day, week, month, year)
- Fetches events, passes to views
- Passes callbacks: openCreate, openEdit

---

## Sign-Off & Approval

**Requirements Analyst:** Claude Code
**Date:** 2025-11-19
**Status:** READY FOR DEVELOPMENT

**Recommended Review By:**
- Product Manager (scope & UX priorities)
- Lead Developer (technical feasibility)
- Designer (styling consistency)
- QA Lead (test plan adequacy)

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2025-11-19 | Initial requirements analysis | Claude Code |

---
