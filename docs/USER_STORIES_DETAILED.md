# User Stories: Click-to-Edit Events & Event Overflow Management

**Format:** Detailed user story cards with acceptance criteria, edge cases, and technical notes.

---

## Story US-1.1: Click-to-Edit Events in Month View

### Overview
- **Epic:** Click-to-Edit Events Across Calendar Views
- **Priority:** MUST-HAVE
- **Effort:** 2-3 days (5-8 story points)
- **Dependencies:** None
- **Blocks:** US-2.1

### User Story

As a **user viewing my family calendar in month view**,
I want **to click on any event in a day cell to open its details for editing**,
So that **I can quickly access and modify event information without switching to week view**.

### Acceptance Criteria

#### Basic Functionality
- [ ] Every event displayed in a month view day cell is clickable
- [ ] Clicking an event opens the EventModal component
- [ ] EventModal opens in `mode="edit"` (not create)
- [ ] Modal pre-populates with correct event data:
  - Event ID
  - Title
  - Location (if set)
  - Color
  - Start time (local datetime format)
  - End time (local datetime format)

#### Interaction & Feedback
- [ ] Mouse cursor changes to pointer when hovering over event
- [ ] Visual feedback on hover (color change, brightness increase, or border highlight)
- [ ] Click event → modal appears within 200ms
- [ ] Clicking outside modal closes it (existing behavior)
- [ ] After editing and saving, month view refreshes to show changes

#### Keyboard Accessibility
- [ ] Events are keyboard focusable (tabindex=0 or automatic from button element)
- [ ] Tab key navigates between events in day cell
- [ ] Enter key opens EventModal when event is focused
- [ ] Space key opens EventModal when event is focused
- [ ] Escape key closes modal (existing behavior)
- [ ] Focus ring visible on focused event (WCAG AA standard)

#### ARIA & Semantics
- [ ] Each event has role="button"
- [ ] Each event has descriptive aria-label (e.g., "Event Title, 2:00 PM")
- [ ] Event element is a proper button or semantic button equivalent
- [ ] Visually hidden text ".sr-only" for screen reader context if needed

#### Event Type Support
- [ ] Regular (non-recurring) events are clickable
- [ ] Recurring event series masters are clickable
- [ ] Recurring event overrides (single-instance edits) are clickable
- [ ] All-day events are clickable (if displayed in month view)

#### Data Integrity
- [ ] Clicking event retrieves fresh data from database (not stale)
- [ ] Event data passed to modal matches exactly what WeekGrid passes
- [ ] No data loss or corruption when clicking/editing from month view

#### Edge Cases
- [ ] Clicking event with very long title (truncated in display)
- [ ] Clicking event with no location (modal shows empty field)
- [ ] Clicking event with custom color
- [ ] Day with 1 event: clickable
- [ ] Day with 3 events: all clickable
- [ ] Day with 4+ events: visible 3 are clickable (hidden ones handled by US-2.1)

#### Visual Consistency
- [ ] Event styling matches week view (same color, text size, truncation)
- [ ] No layout shift when hovering over event
- [ ] Event appearance indicates it's interactive (visual affordance)

### Technical Acceptance Criteria

- [ ] MonthGrid component accepts `onEditEvent` prop (callback function)
- [ ] onEditEvent callback signature matches WeekGrid:
  ```typescript
  onEditEvent?: (id: string, init: EventDraft) => void
  ```
- [ ] Event wrapper elements have proper semantic HTML (button or role="button")
- [ ] Click handlers properly stop propagation to prevent cell-level click
- [ ] No TypeScript errors or warnings (`strict: true`)
- [ ] No console errors when opening/closing modal
- [ ] Event data transformation from DB format to modal format is correct
- [ ] Component re-renders correctly when events list changes

### Definition of Done

- [ ] Code is written and passes linting
- [ ] Unit tests written for new click handlers
- [ ] All acceptance criteria verified (manual testing)
- [ ] Keyboard navigation tested (Tab, Enter, Space, Escape)
- [ ] Accessibility audit passed (Lighthouse, axe-core)
- [ ] No regression in month view layout or existing functionality
- [ ] Week view click-to-edit still works (no breaking changes)
- [ ] Modal opens/closes smoothly with event from month view
- [ ] Code reviewed and approved by lead developer
- [ ] Product sign-off obtained

### Implementation Notes

**Files to Modify:**
- `src/components/calendar/MonthGrid.tsx` - Add click handlers, accept onEditEvent prop

**Files to Reference:**
- `src/components/calendar/WeekGrid.tsx` (lines 403-438) - Shows exact click handler pattern
- `src/app/calendar/page.tsx` (lines 222-226) - Shows how openEdit callback works

**Styling Approach:**
- Use Tailwind `cursor-pointer` for mouse affordance
- Add `hover:brightness-110` or `hover:bg-white/15` for visual feedback
- Reuse color classes from AllDayEventBanner if possible

**Event Wrapper HTML:**
```typescript
<button
  type="button"
  onClick={(e) => {
    e.stopPropagation();
    onEditEvent(String(ev.id), { /* event data */ });
  }}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onEditEvent(String(ev.id), { /* event data */ });
    }
  }}
  aria-label={`${ev.title}${ev.where ? ', ' + ev.where : ''}`}
  className="..." // existing event styling + cursor-pointer + hover effects
>
  {/* existing event content */}
</button>
```

**Data Transformation:**
```typescript
// From MonthGrid/eventsOnDay filter result
const ev = { id: string; start: string; end: string; title: string; color?: string };

// To EventDraft format for modal
{
  id: ev.id,
  calendar_id: primaryCalendarId,
  title: ev.title,
  location: ev.where,
  color: ev.color,
  starts_at: toLocalInputFormat(new Date(ev.start)),
  ends_at: toLocalInputFormat(new Date(ev.end)),
}
```

### Test Cases

**Unit Tests (Jest):**
```typescript
describe('MonthGrid click-to-edit', () => {
  it('should call onEditEvent when event is clicked', () => {
    const onEditEvent = jest.fn();
    const { getByRole } = render(<MonthGrid onEditEvent={onEditEvent} events={[...]} />);
    const event = getByRole('button', { name: /Event Title/ });
    fireEvent.click(event);
    expect(onEditEvent).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      title: 'Event Title',
    }));
  });

  it('should call onEditEvent with correct date format', () => {
    // Test that starts_at/ends_at are in local datetime format (YYYY-MM-DDTHH:mm)
  });

  it('should not propagate click to day cell', () => {
    // Test e.stopPropagation() prevents calendar-wide click handling
  });
});
```

**Integration Tests (Playwright/Cypress):**
```typescript
test('click event in month view opens edit modal', async ({ page }) => {
  await page.goto('/calendar?mode=month');
  const eventButton = page.getByRole('button', { name: /Event Title/ });
  await eventButton.click();

  // Modal should appear
  await expect(page.getByRole('dialog')).toBeVisible();

  // Modal title should match event title
  await expect(page.locator('h2')).toContainText('Event Title');

  // Can edit and save (existing modal functionality)
});

test('keyboard navigation to event and open with Enter', async ({ page }) => {
  await page.goto('/calendar?mode=month');
  await page.keyboard.press('Tab'); // Focus event
  await page.keyboard.press('Enter');

  await expect(page.getByRole('dialog')).toBeVisible();
});
```

**Accessibility Tests (axe-core):**
- All events have accessible names (aria-label)
- Buttons are properly identified
- No color contrast issues
- Focus indicators visible

### Questions / Clarifications

1. Should clicking an event scroll month view or change the centered date?
   - **Answer:** No, stay in month view, only open modal

2. Should the modal be a separate dialog overlay or could it be inline?
   - **Answer:** Use existing EventModal (dialog overlay)

3. What if event data is stale (edited elsewhere)?
   - **Answer:** Modal shows what was clicked; if stale, realtime will update month view

4. Should touch users have any special handling?
   - **Answer:** No; event should be tappable with adequate size (44x44px minimum)

---

## Story US-1.2: Click-to-Edit Events in Year View

### Overview
- **Epic:** Click-to-Edit Events Across Calendar Views
- **Priority:** SHOULD-HAVE
- **Effort:** 2-3 days (5-8 story points)
- **Dependencies:** US-1.1, US-1.3
- **Blocks:** US-2.2

### User Story

As a **user viewing my calendar in year view (12 mini-months)**,
I want **to click on any event in any month card to edit it**,
So that **I can manage events from a high-level yearly perspective without drilling down**.

### Acceptance Criteria

#### Basic Functionality
- [ ] Every event displayed in all 12 month cards is clickable
- [ ] Clicking any event opens EventModal in edit mode
- [ ] Modal pre-populates with correct event data (same format as US-1.1)
- [ ] Works consistently across all 12 months (Jan-Dec)

#### Interaction
- [ ] Visual affordance (cursor pointer, hover effect)
- [ ] Click → modal appears within 200ms
- [ ] Closing modal returns to year view without navigation
- [ ] Year view canvas position preserved (scrolling not affected)
- [ ] After save, year view shows updated event

#### Keyboard & Accessibility
- [ ] All events in all month cards are keyboard focusable
- [ ] Tab navigates through events across month boundaries
- [ ] Enter/Space opens modal when event is focused
- [ ] Focus indicators visible
- [ ] Screen reader can access all events

#### Edge Cases
- [ ] Event at month boundary (e.g., Dec 31) clickable
- [ ] Very long event titles in small month cards
- [ ] Events spanning multiple months (visible in multiple cards, edit same event)
- [ ] All-day events in year view
- [ ] Day with 3+ events (hidden ones need US-2.2 to be fully discoverable)

### Technical Acceptance Criteria

- [ ] YearGrid passes `onEditEvent` callback to each MonthGrid instance
- [ ] Each MonthGrid receives same callback signature as US-1.1
- [ ] No prop drilling issues (clean callback passing)
- [ ] Year view state (selected year) preserved after modal close
- [ ] No TypeScript errors

### Definition of Done

- [ ] onEditEvent prop added to MonthGrid and YearGrid props
- [ ] CalendarPage passes callback to YearGrid (no change needed, passes to all)
- [ ] Year view click-to-edit works end-to-end
- [ ] No regression in month view (US-1.1)
- [ ] Manual testing: click events in Jan, Jun, Dec month cards
- [ ] Code reviewed and approved

### Implementation Notes

**Files to Modify:**
- `src/components/calendar/YearGrid.tsx` - Add onEditEvent to MonthGrid props

**Code Pattern:**
```typescript
// In YearGrid.tsx
type Props = {
  cursor: Date;
  events: Event[];
  onEditEvent?: OnEditEvent; // ADD THIS
};

export default function YearGrid({ cursor, events, onEditEvent }: Props) {
  const months = Array.from({ length: 12 }, (_, i) => addMonths(new Date(cursor.getFullYear(), 0, 1), i));

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
      {months.map((m, i) => (
        <div key={i} className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="mb-2 text-sm font-semibold">
            {m.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
          </div>
          <MonthGrid
            cursor={m}
            events={events}
            onEditEvent={onEditEvent}  {/* PASS CALLBACK */}
          />
        </div>
      ))}
    </div>
  );
}
```

### Test Cases

**Integration Test:**
```typescript
test('click event in year view month card opens modal', async ({ page }) => {
  await page.goto('/calendar?mode=year');

  // Find event in June month card
  const juneEvent = page.getByRole('button', { name: /Event Title/ }).nth(5); // June is 6th month
  await juneEvent.click();

  // Modal opens with correct event
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('h2')).toContainText('Event Title');

  // After close, year view visible
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
});
```

---

## Story US-1.3: Consistent Event Edit Callback Interface

### Overview
- **Epic:** Click-to-Edit Events Across Calendar Views
- **Priority:** MUST-HAVE (Foundation)
- **Effort:** 1-2 days (2-3 story points)
- **Dependencies:** None
- **Blocks:** US-1.1, US-1.2, US-2.1, US-2.2

### User Story

As a **developer working on this feature**,
I want **all calendar views to use the same onEditEvent callback interface and data format**,
So that **the codebase is DRY, testable, and consistent across components**.

### Acceptance Criteria

#### Interface Consistency
- [ ] WeekGrid, MonthGrid, YearGrid all accept `onEditEvent` prop
- [ ] onEditEvent callback signature is identical across all views:
  ```typescript
  type OnEditEvent = (id: string, init: EventDraft) => void
  ```
- [ ] EventDraft type is exported from EventModal or types file
- [ ] All views pass event data in identical format to callback

#### Data Format
- [ ] Event data passed includes: id, calendar_id, title, location, color, starts_at, ends_at
- [ ] starts_at/ends_at are in local datetime format (YYYY-MM-DDTHH:mm), not ISO
- [ ] location is optional (null/undefined if not set)
- [ ] color is optional
- [ ] No extra fields or variations between views

#### Integration
- [ ] CalendarPage passes same openEdit callback to all views
- [ ] EventModal receives and handles data identically from all views
- [ ] No view-specific modal variants or custom wrappers

#### Type Safety
- [ ] EventDraft type is properly defined with all fields
- [ ] onEditEvent type is exported and reusable
- [ ] No `any` types
- [ ] TypeScript strict mode passes

### Technical Acceptance Criteria

- [ ] EventDraft type exists in a common location:
  ```typescript
  // File: src/types/events.ts or src/components/calendar/EventModal.tsx
  export type EventDraft = {
    id: string;
    calendar_id: string;
    title: string;
    location?: string;
    color?: string;
    starts_at: string; // local datetime format
    ends_at: string;
  };

  export type OnEditEvent = (id: string, init: EventDraft) => void;
  ```

- [ ] MonthGrid.tsx imports and uses OnEditEvent type
- [ ] YearGrid.tsx imports and uses OnEditEvent type
- [ ] WeekGrid.tsx already has this, verify consistency

### Definition of Done

- [ ] Type definitions created/verified
- [ ] All views import OnEditEvent type
- [ ] Callback signature documented in each component
- [ ] No TypeScript errors
- [ ] Manual verification: same data passed from week and month views
- [ ] Code reviewed

### Implementation Notes

**Type File Location:**
Choose one:
1. Export from `src/types/events.ts` (preferred if types file exists)
2. Define in `src/components/calendar/EventModal.tsx` and export
3. Create new `src/lib/calendar/types.ts`

**Recommended Implementation:**
```typescript
// src/types/events.ts (existing file)

export type EventDraft = {
  id: string;
  calendar_id: string;
  title: string;
  location?: string;
  color?: string;
  starts_at: string;  // "2025-11-19T14:30"
  ends_at: string;    // "2025-11-19T15:30"
};

export type OnEditEvent = (id: string, init: EventDraft) => void;
```

Then in each view component:
```typescript
import type { OnEditEvent } from '@/types/events';

type Props = {
  // ... other props
  onEditEvent?: OnEditEvent;
};
```

---

## Story US-2.1: Interactive "+ more…" Button in Month View

### Overview
- **Epic:** Expandable Day View for Event Overflow
- **Priority:** MUST-HAVE
- **Effort:** 3-4 days (8-13 story points)
- **Dependencies:** US-1.1, US-1.3
- **Blocks:** US-2.3, US-2.4

### User Story

As a **user viewing a busy day in month view**,
I want **to click on the "+ more…" indicator to expand and see all events for that day**,
So that **I can discover and edit hidden events without switching to week view**.

### Acceptance Criteria

#### Display & Trigger
- [ ] When a day cell has exactly 3 events: no "+ more…" shown
- [ ] When a day cell has exactly 4 events: "+ more…" shown (1 additional)
- [ ] When a day cell has 4+ events: "+ more…" shown (count of hidden)
- [ ] "+ more…" button is visually distinct (styled as button, not plain text)
- [ ] "+ more…" shows count of hidden events (e.g., "+ 5 more")
- [ ] Cursor changes to pointer on hover
- [ ] Visual feedback on hover (color/brightness change)

#### Expansion Behavior
- [ ] Clicking "+ more…" opens a modal/overlay showing ALL events for that day
- [ ] All events in overlay are clickable to edit
- [ ] Overlay includes events already shown in day cell (all events visible)
- [ ] Overlay displays event details:
  - Event title
  - Start time (formatted, e.g., "2:30 PM")
  - End time (formatted)
  - Location (if set)
  - Color indicator
- [ ] Overlay sorts events by start time (same as day view)
- [ ] Overlay has clear close button (X or "Done")
- [ ] Clicking outside overlay closes it (click-away)
- [ ] Pressing Escape closes overlay

#### User Interaction
- [ ] Clicking event in overlay opens EventModal (same as US-1.1)
- [ ] Editing event from overlay → save → overlay closes → month view refreshes
- [ ] Deleting event from overlay → overlay closes → month view refreshes
- [ ] After overlay close, month view returns to same position (no navigation)
- [ ] No page reload on overlay open/close

#### Keyboard & Accessibility
- [ ] "+ more…" button is keyboard focusable
- [ ] Enter/Space opens overlay when focused
- [ ] Tab navigates through all events in overlay
- [ ] Each event in overlay has aria-label
- [ ] Overlay has proper ARIA attributes (role="dialog", aria-label, etc.)
- [ ] Escape closes overlay
- [ ] Focus returns to "+ more…" button when overlay closes

#### Edge Cases
- [ ] Day with exactly 4 events: "+ more" shows (not "+ 1")
- [ ] Day with 50+ events: overlay scrollable, performance acceptable
- [ ] Overlay on mobile: scrollable within viewport
- [ ] Clicking "+ more…" on two different days: first overlay closes, second opens
- [ ] Rapid clicking "+ more…" multiple times: debounced or handled gracefully
- [ ] All-day events in day cell (future): included in count and overlay

### Technical Acceptance Criteria

- [ ] MonthGrid state: `const [expandedDay, setExpandedDay] = useState<string | null>(null)`
- [ ] Event limit constant: `MAX_EVENTS_PER_DAY = 3` (or from props)
- [ ] New component or logic to render overflow modal
- [ ] Modal receives:
  - `day: Date` - the expanded day
  - `events: Event[]` - all events for that day
  - `onClose: () => void` - callback to close
  - `onEditEvent: OnEditEvent` - callback to edit event
- [ ] Click handler on "+ more…" button:
  ```typescript
  onClick={(e) => {
    e.stopPropagation();
    setExpandedDay(day.toISOString().split('T')[0]); // "2025-11-19"
  }}
  ```
- [ ] No TypeScript errors
- [ ] Performance: Opening overlay < 200ms

### Definition of Done

- [ ] "+ more…" button appears and is interactive
- [ ] Modal/overlay component created or logic added
- [ ] All events in overlay are clickable
- [ ] Modal close returns to month view
- [ ] Editing events from overlay works end-to-end
- [ ] Keyboard navigation works
- [ ] Accessibility audit passes
- [ ] Manual testing: expand multiple days, edit events, close
- [ ] No regression in normal day cells (with <4 events)
- [ ] Code reviewed and approved

### Implementation Notes

**Approach 1: Inline Modal in MonthGrid**
```typescript
// In MonthGrid.tsx
const [expandedDay, setExpandedDay] = useState<string | null>(null);

// When rendering day cell:
{list.length >= MAX_EVENTS_PER_DAY && (
  <button
    onClick={(e) => {
      e.stopPropagation();
      setExpandedDay(day.toISOString().split('T')[0]);
    }}
    aria-label={`${hiddenCount} more events`}
    className="text-[10px] opacity-70 hover:opacity-100 cursor-pointer transition-all"
  >
    ↓ {hiddenCount} more…
  </button>
)}

// Outside grid, render modal:
{expandedDay && (
  <DayOverflowModal
    day={new Date(expandedDay)}
    events={eventsOnDay(new Date(expandedDay))}
    onClose={() => setExpandedDay(null)}
    onEditEvent={onEditEvent}
  />
)}
```

**Approach 2: Separate DayOverflowModal Component**
Create `src/components/calendar/DayOverflowModal.tsx`:
```typescript
interface Props {
  day: Date;
  events: Event[];
  onClose: () => void;
  onEditEvent: OnEditEvent;
}

export default function DayOverflowModal({ day, events, onClose, onEditEvent }: Props) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white/10 rounded-lg border border-white/20 p-4 max-h-96 overflow-y-auto max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">
            {day.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}
          </h2>
          <button onClick={onClose} aria-label="Close" className="text-xl">×</button>
        </div>

        <div className="space-y-2">
          {events.map(ev => (
            <button
              key={ev.id}
              onClick={(e) => {
                e.stopPropagation();
                onEditEvent(String(ev.id), { /* data */ });
                onClose(); // Close after opening edit modal? Or leave open?
              }}
              className="w-full text-left p-2 hover:bg-white/10 rounded transition-all"
              role="button"
              tabIndex={0}
            >
              <div className="font-semibold text-sm">{ev.title}</div>
              <div className="text-xs opacity-70">{fmtTime(ev.start)} - {fmtTime(ev.end)}</div>
              {ev.where && <div className="text-xs opacity-60">{ev.where}</div>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

**Integration Points:**
- Modal should use existing color mapping from EventCard
- Time formatting should use existing `fmtTime` utility
- Close behavior: should overlay close when user clicks to edit? (TBD with product)

### Test Cases

**Unit Tests:**
```typescript
test('shows "+ more" button when 4+ events', () => {
  const events = Array(5).fill(null).map((_, i) => ({ id: i, title: `Event ${i}`, ... }));
  const { getByText } = render(<MonthGrid events={events} />);

  expect(getByText('+ 2 more')).toBeInTheDocument();
});

test('clicking "+ more" opens overflow modal', async () => {
  const { getByText, getByRole } = render(<MonthGrid events={[...]} />);

  const moreButton = getByText('+ 2 more');
  fireEvent.click(moreButton);

  expect(getByRole('dialog')).toBeInTheDocument();
});
```

**Integration Test:**
```typescript
test('expand day, click event, edit, and save', async ({ page }) => {
  await page.goto('/calendar?mode=month');

  // Expand day with 5 events
  await page.getByText('+2 more').click();
  await expect(page.getByRole('dialog')).toBeVisible();

  // Click 4th event in overlay
  const events = page.locator('[role="dialog"] [role="button"]');
  await events.nth(3).click();

  // Edit modal opens
  await expect(page.locator('h2').filter({ hasText: 'Event 4' })).toBeVisible();

  // Edit and save
  await page.locator('input[placeholder="Title"]').fill('Updated Event');
  await page.locator('button').filter({ hasText: 'Save' }).click();

  // Overlay closes, month view refreshes
  await expect(page.getByRole('dialog')).not.toBeVisible();
});
```

### Questions / Clarifications

1. When user clicks event in overflow modal to edit, should overlay auto-close or stay open?
   - **Recommendation:** Auto-close (cleaner UX), leave open if needed

2. Should "+ more…" count include all-day events?
   - **Answer:** Yes, count both all-day and timed events together

3. What if user deletes an event from overlay?
   - **Answer:** Overlay closes, month view refreshes via realtime

---

## Story US-2.2: Expandable Day View in Year View

### Overview
- **Epic:** Expandable Day View for Event Overflow
- **Priority:** SHOULD-HAVE
- **Effort:** 2-3 days (5-8 story points)
- **Dependencies:** US-2.1, US-1.2
- **Blocks:** None

### User Story

As a **user viewing the year grid**,
I want **to click "+ more…" on any month card to expand and see all events for an overflowing day**,
So that **I can explore event details from a yearly perspective without leaving year view**.

### Acceptance Criteria

#### Basic Functionality
- [ ] "+ more…" buttons in all 12 mini-month cards are clickable
- [ ] Same behavior as US-2.1 (opens overlay with all events for that day)
- [ ] Overlay shows complete event list with times and details
- [ ] Each event in overlay can be edited (opens EventModal)
- [ ] Closing overlay returns to year view without navigation

#### State Management
- [ ] Year view state (selected year) is preserved after expanding
- [ ] Multiple month cards can expand independently (one at a time)
- [ ] Expanding day in Month B auto-closes expanded day in Month A
- [ ] Overlay position/size appropriate for desktop year view

#### Edge Cases
- [ ] User expands day in Dec, then navigates to next year → overlay closes gracefully
- [ ] Multiple months have day 31 (Jan 31, Mar 31, etc.) → correct day expands
- [ ] Overlay on mobile (year view is stacked) → scrollable within viewport

### Technical Acceptance Criteria

- [ ] YearGrid manages expandedDay state (or delegates to child)
- [ ] Each MonthGrid either:
  - Has own expandedDay state (recommended), or
  - Receives expandedDay and setExpandedDay as props
- [ ] MonthGrid passes DayOverflowModal same props as month view
- [ ] No prop drilling issues

### Definition of Done

- [ ] Click "+ more…" in any month card → overlay appears
- [ ] Overlay shows all events for that day
- [ ] All events clickable to edit
- [ ] Close overlay → year view restored
- [ ] Manual testing: expand days in Jan, Jun, Dec
- [ ] No memory leaks
- [ ] Code reviewed

### Implementation Notes

**Recommended State Approach (Local per MonthGrid):**
- Keep expandedDay state in MonthGrid (no change from US-2.1)
- Each month card manages its own expansion
- Simpler, less prop drilling
- Natural isolation between month cards

**No Code Changes to YearGrid Needed:**
```typescript
// YearGrid.tsx already renders MonthGrid
// If MonthGrid has expandedDay state, it just works
// Just ensure onEditEvent is passed (US-1.2)
```

---

## Story US-2.3: Visual Styling for "+ more…" Button

### Overview
- **Epic:** Expandable Day View for Event Overflow
- **Priority:** SHOULD-HAVE
- **Effort:** 1-2 days (2-3 story points)
- **Dependencies:** US-2.1
- **Blocks:** None

### User Story

As a **designer/user**,
I want **the "+ more…" indicator to be visually distinct and indicate interactivity**,
So that **users intuitively understand it's clickable and not miss hidden events**.

### Acceptance Criteria

#### Visual Design
- [ ] "+ more…" is styled as a clickable button (not plain text)
- [ ] Hover effect visually indicates interactivity:
  - Color change (lighter), OR
  - Brightness increase, OR
  - Underline or border bottom
- [ ] Smooth transition on hover (not jarring)
- [ ] Icon or visual indicator suggests expandability:
  - Downward arrow (↓), OR
  - Plus sign (+), OR
  - Chevron (▼)

#### Accessibility
- [ ] Color contrast meets WCAG AA standard (4.5:1 for text)
- [ ] Button is sufficiently visible on light and dark backgrounds
- [ ] Mobile: touch target at least 44x44px
- [ ] On focus: clear focus ring (2-3px outline) visible

#### Responsive Design
- [ ] "+ more…" visible and clickable on mobile (not cut off)
- [ ] Responsive text size (scales with viewport)
- [ ] Adequate padding/spacing around button
- [ ] No layout shift on hover

#### Consistency
- [ ] Styling consistent across all month cards (month and year views)
- [ ] Color palette matches existing EventCard/AllDayEventBanner
- [ ] Button text and icon align properly

### Technical Acceptance Criteria

- [ ] Tailwind CSS classes used for styling (consistent with codebase)
- [ ] No hardcoded colors (use existing color map if possible)
- [ ] Hover/focus states implemented with Tailwind
- [ ] Responsive classes for mobile (hidden text, smaller icon on mobile)

### Definition of Done

- [ ] "+ more…" button styled and visible
- [ ] Hover state working
- [ ] Focus state visible (keyboard nav)
- [ ] Accessibility audit passes (Lighthouse, axe-core)
- [ ] Mobile tested: touch target adequate
- [ ] Design review passed
- [ ] Code reviewed

### Implementation Notes

**Styling Options:**

**Option 1: Inline Text Button (Simple)**
```tsx
<button
  onClick={...}
  className="text-[10px] opacity-60 hover:opacity-100 hover:text-blue-300 cursor-pointer transition-all font-semibold"
>
  ↓ {hiddenCount} more…
</button>
```

**Option 2: Pill-Shaped Button (Modern)**
```tsx
<button
  onClick={...}
  className="text-[10px] rounded-full bg-white/10 hover:bg-white/15 px-2 py-1 cursor-pointer transition-all border border-white/10 hover:border-white/20"
>
  +{hiddenCount}
</button>
```

**Option 3: Badge Style**
```tsx
<div className="text-[10px] inline-flex items-center gap-1 bg-blue-500/20 border border-blue-500/40 rounded px-2 py-1 cursor-pointer hover:bg-blue-500/30 transition-all">
  <span>{hiddenCount} more…</span>
  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
  </svg>
</div>
```

**Recommended:** Option 2 (balance of visibility and integration with existing design)

---

## Story US-2.4: Configurable Event Display Limit

### Overview
- **Epic:** Expandable Day View for Event Overflow
- **Priority:** NICE-TO-HAVE
- **Effort:** 1 day (2-3 story points)
- **Dependencies:** US-2.1
- **Blocks:** None

### User Story

As a **developer**,
I want **to configure the event display limit per calendar view**,
So that **the design can be adjusted and A/B tested without code changes**.

### Acceptance Criteria

#### Configuration
- [ ] Event limit is configurable via component props
- [ ] MonthGrid accepts optional `maxEventsPerDay` prop
- [ ] Default value is 3 (current behavior)
- [ ] YearGrid passes prop to MonthGrid instances
- [ ] CalendarPage can override default if needed

#### Constants
- [ ] Constant defined in library file (not hardcoded in component)
- [ ] Export from `src/lib/calendar/constants.ts` or similar
- [ ] Easy to discover and adjust

#### Display Logic
- [ ] Show up to N events in day cell
- [ ] Show "+ more…" button if more than N events
- [ ] All events available in overflow modal

### Technical Acceptance Criteria

- [ ] Constant definition:
  ```typescript
  // src/lib/calendar/constants.ts
  export const MAX_EVENTS_PER_DAY_MONTH_VIEW = 3;
  ```

- [ ] MonthGrid prop:
  ```typescript
  type Props = {
    maxEventsPerDay?: number;
    // ... other props
  };
  ```

- [ ] Usage in eventsOnDay:
  ```typescript
  const limit = maxEventsPerDay ?? MAX_EVENTS_PER_DAY_MONTH_VIEW;
  return events.filter(...).slice(0, limit);
  ```

### Definition of Done

- [ ] Constant defined and exported
- [ ] MonthGrid accepts prop with default
- [ ] Can adjust limit without touching JSX
- [ ] No TypeScript errors
- [ ] Code reviewed

### Implementation Notes

**File Structure:**
```typescript
// src/lib/calendar/constants.ts (new file)
export const MAX_EVENTS_PER_DAY_MONTH_VIEW = 3;
export const MAX_EVENTS_PER_DAY_WEEK_VIEW = 10; // future
export const MAX_EVENTS_PER_DAY_YEAR_VIEW = 2; // future optimization
```

**Usage in MonthGrid:**
```typescript
import { MAX_EVENTS_PER_DAY_MONTH_VIEW } from '@/lib/calendar/constants';

function eventsOnDay(d: Date) {
  const limit = maxEventsPerDay ?? MAX_EVENTS_PER_DAY_MONTH_VIEW;
  return events.filter(...).slice(0, limit);
}
```

---

## Release Plan & Timeline

### Sprint 1: Click-to-Edit Foundation (2 weeks)

| Story | Effort | Status |
|-------|--------|--------|
| US-1.3 | 2 days | Week 1, Day 1-2 |
| US-1.1 | 3 days | Week 1, Day 3-5 |
| Testing & Review | 2 days | Week 2, Day 1-2 |

**Deliverable:** Month view click-to-edit fully functional

### Sprint 2: Event Overflow (2 weeks)

| Story | Effort | Status |
|-------|--------|--------|
| US-2.4 | 1 day | Week 1, Day 1 |
| US-2.1 | 4 days | Week 1, Day 2-5 |
| US-2.3 | 2 days | Week 2, Day 1-2 |
| Testing & Review | 2 days | Week 2, Day 3-4 |

**Deliverable:** Event overflow modal fully functional in month view

### Sprint 3: Complete (1-2 weeks)

| Story | Effort | Status |
|-------|--------|--------|
| US-1.2 | 2 days | Day 1-2 |
| US-2.2 | 2 days | Day 3-4 |
| Integration Testing | 2-3 days | Day 5+ |

**Deliverable:** All 4 views (day, week, month, year) fully interactive

---

**Document Version:** 1.0
**Last Updated:** 2025-11-19
**Status:** READY FOR DEVELOPMENT

