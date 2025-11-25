# Google Calendar Feature Recreation Plan

**Created:** 2024-11-19
**Project:** Family Calendar (Next.js 16 + Supabase)
**Goal:** Recreate Google Calendar's core UX while leveraging our existing architecture

---

## Executive Summary

This plan outlines how to transform Family Calendar into a Google Calendar-like experience by implementing 23 high-impact features across 6 categories. Our existing foundation (recurring events, real-time sync, click-to-edit) provides an excellent starting point.

**Implementation Timeline:** 8 weeks (Sprints 5-8)
**Estimated Effort:** ~160 hours
**Tech Stack:** Next.js 16, React 19, Tailwind CSS v4, Supabase, @dnd-kit, Fuse.js

---

## I. Feature Priority Matrix

| Feature | Impact | Effort | Priority | Sprint | Days |
|---------|--------|--------|----------|--------|------|
| Event Preview Popover | High | Medium | P0 | 5 | 3 |
| Enhanced Time Grid | High | Low | P0 | 5 | 2 |
| "+N more" Overflow | High | Low | P0 | 5 | 1 |
| Quick Add (Natural Language) | High | Medium | P0 | 5 | 2 |
| Drag-to-Reschedule | High | Medium | P0 | 5 | 4 |
| Mini Calendar Sidebar | Medium | Medium | P1 | 6 | 3 |
| Multi-Calendar Toggles | High | Medium | P1 | 6 | 3 |
| Keyboard Shortcuts | Medium | Low | P1 | 6 | 2 |
| Dark Mode | Medium | Low | P1 | 6 | 2 |
| Event Search/Filter | Medium | Medium | P1 | 7 | 3 |
| Agenda View | Medium | Medium | P2 | 7 | 3 |
| Resize Event Duration | Medium | Medium | P2 | 7 | 2 |
| Material Design 3 Polish | Low | Low | P2 | 7 | 2 |
| Event Reminders | High | High | P2 | 8 | 5 |
| Time Zone Display | Medium | High | P3 | 8 | 4 |

---

## II. Sprint Breakdown

### **Sprint 5: Core Interactions** (2 weeks)

#### 1. Event Preview Popover (3 days)
**Goal:** Show event details on hover/click without opening full modal

**Implementation:**
```typescript
// New files
src/components/calendar/EventPreview/
├── EventPreviewPopover.tsx       # Main popover (use @headlessui/react)
├── EventPreviewContent.tsx       # Event details layout
├── EventQuickActions.tsx         # Edit/Delete/Duplicate buttons
└── useEventPreview.ts            # State management hook

// Integration
EventCard.tsx - Add hover handler (500ms delay)
              - Single click = preview, double click = full edit
MonthGrid.tsx - Wire up preview for month view events
```

**Key Features:**
- Smart positioning (auto, flip, shift to avoid viewport edges)
- Color-coded header matching event
- Quick actions (Edit, Delete, Duplicate)
- ESC key to close, Tab navigation
- ARIA: `role="dialog"`, `aria-modal="false"`

**Dependencies:** `@headlessui/react` (already in use), `@floating-ui/react`

---

#### 2. Enhanced Time Grid (2 days)
**Goal:** Add current time indicator, working hours, zoom levels

**Implementation:**
```typescript
// New files
src/components/calendar/TimeGrid/
├── TimeGrid.tsx                  # Replaces WeekGrid's time column
├── CurrentTimeIndicator.tsx      # Red line at current time
├── WorkingHoursOverlay.tsx       # Highlight 9am-5pm
└── useTimeGrid.ts                # Zoom/interval state (localStorage)

// Features
- 30-minute vs 60-minute intervals toggle
- Zoom: 1x (48px/hour), 1.5x (72px/hour), 2x (96px/hour)
- Current time updates every minute
- Working hours configurable (default 9am-5pm)
```

**State Management:**
- Persisted in localStorage: `calendar-interval`, `calendar-zoom`, `calendar-working-hours`
- Server state: None (purely UI enhancement)

---

#### 3. "+N more" Overflow Button (1 day)
**Goal:** Show compact overflow indicator in month/year views

**Implementation:**
```typescript
// Modify existing
MonthGrid.tsx - Add maxEventsPerDay prop (default 3)
              - Show "+N more" button when events exceed limit
              - Click opens DayExpansionModal (already exists!)

// Logic
const visibleEvents = dayEvents.slice(0, maxEventsPerDay);
const hiddenCount = Math.max(0, dayEvents.length - maxEventsPerDay);
```

**Already 90% done!** Just need to wire up the button and modal integration.

---

#### 4. Quick Add (Natural Language) (2 days)
**Goal:** Parse "Lunch with Bob tomorrow at 2pm" into event

**Implementation:**
```typescript
// New files
src/lib/quick-add/
├── parser.ts                     # chrono-node integration
└── openai-fallback.ts            # Complex queries via OpenAI

// UI
FAB button - Show text input on click (instead of modal)
           - Parse on blur/enter
           - Open modal with pre-filled draft

// Libraries
- chrono-node (500KB) for date/time parsing
- OpenAI API for location/title extraction (fallback)
```

**Examples:**
- "Meeting tomorrow at 3pm" → `starts_at: tomorrow 3pm, ends_at: tomorrow 4pm`
- "Dinner with Sarah at Olive Garden Friday 7pm" → Full event object

---

#### 5. Drag-to-Reschedule Events (4 days)
**Goal:** Drag events to new time slots or days

**Implementation:**
```typescript
// Library: @dnd-kit (40KB, accessible, TypeScript)
npm install @dnd-kit/core @dnd-kit/modifiers

// New files
src/components/calendar/DragDrop/
├── DraggableEvent.tsx            # Wrapper for EventCard
├── DroppableTimeSlot.tsx         # Wrapper for grid cells
├── DragOverlay.tsx               # Ghost event during drag
└── useDragAndDrop.ts             # Validation, optimistic updates

// Features
- Snap to 15-minute intervals
- Visual feedback (ghost event, highlight drop zone)
- Validation: Cannot drag series masters, past events
- Mobile: Long-press + drag gesture
- Optimistic updates via useEvents.upsertLocal()
```

**Accessibility:**
- Keyboard: Space to pick up, Arrow keys to move, Space to drop, ESC to cancel
- Screen reader announcements: "Picked up Meeting at 3pm. Use arrow keys to move."

---

### **Sprint 6: Navigation & Organization** (2 weeks)

#### 6. Mini Calendar Sidebar (3 days)
**Goal:** Compact month-at-a-glance for quick date jumping

**Implementation:**
```typescript
// New files
src/components/calendar/MiniCalendar/
├── MiniCalendar.tsx              # Main sidebar container
├── MiniMonthGrid.tsx             # Compact month grid (7×6)
├── MonthNavigator.tsx            # Prev/Next buttons
└── useMiniCalendar.ts            # State + event count fetching

// Features
- Dot indicators on days with events
- Click date to jump main view
- Today button
- Syncs with main calendar selection
```

**API Enhancement:**
```typescript
// New endpoint for event counts
GET /api/events/counts?month=2024-11

// Response
{
  "2024-11-15": 3,
  "2024-11-20": 1,
  // ...
}
```

---

#### 7. Multi-Calendar Toggle (3 days)
**Goal:** Show/hide multiple calendars with checkboxes

**Implementation:**
```typescript
// New files
src/components/calendar/CalendarSelector/
├── CalendarSelector.tsx          # Checkbox list (sidebar or dropdown)
├── CalendarCheckbox.tsx          # Individual calendar row
└── useCalendarFilters.ts         # Visibility state (localStorage)

// Database (already exists!)
- calendars table has id, name, color
- Events have calendar_id foreign key

// UI
- Sidebar: Checkbox + color dot + calendar name
- Filter events: events.filter(e => visibleCalendarIds.has(e.calendar_id))
```

**Color Strategy:**
- Event has color → Use event color
- Event has no color → Use calendar color
- Calendar color picker (11 Google colors)

---

#### 8. Keyboard Shortcuts (2 days)
**Goal:** Navigate calendar without mouse

**Implementation:**
```typescript
// New hook
src/hooks/useCalendarHotkeys.ts

// Shortcuts
c/q       Create event
t         Jump to today
j/k       Previous/next period
d/w/m/y   Switch to Day/Week/Month/Year view
n/p       Next/previous event
/         Focus search
Shift+?   Show help modal

// Integration
CalendarPage - useCalendarHotkeys({ onCreateEvent, onGoToday, ... })
```

**Help Modal:**
```tsx
<Dialog>
  <DialogTitle>Keyboard Shortcuts</DialogTitle>
  <dl>
    <dt>C or Q</dt><dd>Create event</dd>
    <dt>T</dt><dd>Go to today</dd>
    ...
  </dl>
</Dialog>
```

---

#### 9. Dark Mode (2 days)
**Goal:** Full dark theme with automatic switching

**Implementation:**
```typescript
// Library: next-themes (4KB)
npm install next-themes

// Setup
app/layout.tsx - Wrap with <ThemeProvider>
tailwind.config.ts - darkMode: 'class'

// Components
- Add dark: variants to all components
- Test color contrast (WCAG AA: 4.5:1)
- Event colors need dark mode adjustments

// Toggle
<button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
  {theme === 'dark' ? '☀️' : '🌙'}
</button>
```

---

### **Sprint 7: Discovery & Refinement** (2 weeks)

#### 10. Event Search/Filter (3 days)
**Goal:** Find events across all time

**Implementation:**
```typescript
// Library: Fuse.js (fuzzy search, 15KB)
npm install fuse.js

// New files
src/components/calendar/Search/
├── SearchBar.tsx                 # Input with Cmd+K shortcut
├── SearchResults.tsx             # Combobox dropdown
├── SearchFilters.tsx             # Advanced filters panel
└── useSearch.ts                  # Fuse.js + filter logic

// Search keys
- title (weight: 2)
- location (weight: 1)
- description (weight: 0.5)

// Filters
- Date range
- Calendar IDs
- All-day vs timed
- Recurring vs one-time
- Color
```

**Performance:**
- Debounced search (300ms)
- Client-side (all events cached in memory)
- Virtualization for 1000+ results (@tanstack/react-virtual)

---

#### 11. Agenda View (3 days)
**Goal:** List-based chronological view

**Implementation:**
```typescript
// New component
src/components/calendar/AgendaView.tsx

// Features
- Fetch 30 days forward by default
- Group by date (collapsible sections)
- Infinite scroll for more dates
- Click event to preview/edit
- Better for dense calendars (no grid constraints)
```

**Benefits over Month View:**
- No "+N more" overflow issues
- Mobile-friendly (no complex grid)
- Easier scanning of many events

---

#### 12. Resize Event Duration (2 days)
**Goal:** Drag event bottom edge to change end time

**Implementation:**
```typescript
// Enhance EventCard.tsx
<div className="relative">
  {/* Event content */}

  {/* Resize handle (only show on hover) */}
  <div
    className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-white/20 opacity-0 hover:opacity-100"
    onMouseDown={handleResizeStart}
  />
</div>

// Logic
const handleResizeStart = (e) => {
  const initialY = e.clientY;
  const initialHeight = eventHeight;

  const handleMouseMove = (moveEvent) => {
    const deltaY = moveEvent.clientY - initialY;
    const newHeight = Math.max(30, initialHeight + deltaY); // Min 30px
    const newDuration = heightToMinutes(newHeight);

    // Snap to 15min intervals
    const snappedDuration = Math.round(newDuration / 15) * 15;
    setPreviewEndTime(addMinutes(event.starts_at, snappedDuration));
  };

  // Attach listeners, update on mouseup
};
```

---

#### 13. Material Design 3 Polish (2 days)
**Goal:** Match Google Calendar's 2024 design refresh

**Changes:**
```css
/* Rounded corners (more pronounced) */
.event-card { @apply rounded-lg; }       /* was rounded-md */
.day-cell { @apply rounded-xl; }         /* was rounded-lg */

/* Soft shadows */
.event-card {
  box-shadow: 0 1px 2px rgba(0,0,0,0.1), 0 1px 4px rgba(0,0,0,0.05);
}

/* Increased spacing */
.calendar-grid { @apply gap-4; }         /* was gap-2 */
.event-card { @apply px-4 py-3; }        /* was px-3 py-2 */
```

**Color System:**
```typescript
// 11 Google Calendar colors (match official palette)
const GOOGLE_COLORS = [
  '#D50000', // Tomato
  '#E67C73', // Flamingo
  '#F4511E', // Tangerine
  '#F6BF26', // Banana
  '#33B679', // Sage
  '#0B8043', // Basil
  '#039BE5', // Peacock
  '#3F51B5', // Blueberry
  '#7986CB', // Lavender
  '#8E24AA', // Grape
  '#616161', // Graphite
];
```

---

### **Sprint 8: Advanced Features** (2 weeks)

#### 14. Event Reminders (5 days)
**Goal:** Browser push notifications before events

**Implementation:**
```sql
-- New table
CREATE TABLE event_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  minutes_before INTEGER NOT NULL,  -- 10, 30, 60, 1440 (24h)
  method TEXT DEFAULT 'notification', -- 'notification' | 'email'
  sent BOOLEAN DEFAULT false
);
```

```typescript
// UI enhancement
EventModal.tsx - Add "Reminders" section
               - Dropdown: 10min, 30min, 1hr, 1 day before
               - Add multiple reminders

// Background worker (Supabase Edge Function)
- Cron job every minute
- Query upcoming events (starts_at BETWEEN now() AND now() + 1 day)
- Send unsent reminders
- Web Push API for browser notifications
```

**Permission Flow:**
1. User adds reminder → Request notification permission
2. Store permission grant in localStorage
3. Background worker sends push notification

---

#### 15. Time Zone Display (4 days)
**Goal:** Show events in their original time zone

**Implementation:**
```sql
-- Add column
ALTER TABLE events ADD COLUMN timezone TEXT DEFAULT 'UTC';
```

```typescript
// UI
EventModal.tsx - Add timezone picker (react-timezone-select)
EventCard.tsx  - Show both local and event timezone

// Display example
3:00 PM PST
6:00 PM EST (your time)

// Libraries
npm install date-fns-tz react-timezone-select
```

**Complexity:**
- All date calculations must be timezone-aware
- Google Calendar sync: Preserve `timeZone` field
- Daylight saving time transitions

---

## III. Database Schema Changes

### New Tables

```sql
-- Event counts cache (for mini calendar)
CREATE TABLE event_counts (
  date DATE PRIMARY KEY,
  calendar_id UUID REFERENCES calendars(id),
  count INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_event_counts_calendar ON event_counts(calendar_id);

-- Calendar visibility preferences
CREATE TABLE calendar_visibility (
  user_id UUID REFERENCES users(id),
  calendar_id UUID REFERENCES calendars(id),
  visible BOOLEAN DEFAULT true,
  PRIMARY KEY (user_id, calendar_id)
);

-- Event reminders
CREATE TABLE event_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  minutes_before INTEGER NOT NULL,
  method TEXT DEFAULT 'notification',
  sent BOOLEAN DEFAULT false
);
```

### Column Additions

```sql
-- Events table
ALTER TABLE events ADD COLUMN timezone TEXT DEFAULT 'UTC';
ALTER TABLE events ADD COLUMN reminder_minutes INTEGER; -- Quick reminder (legacy)

-- Calendars table
ALTER TABLE calendars ADD COLUMN color TEXT DEFAULT '#3F51B5';
ALTER TABLE calendars ADD COLUMN is_visible BOOLEAN DEFAULT true;
```

---

## IV. API Endpoints

### New Routes

```typescript
// Event counts for mini calendar
GET /api/events/counts?month=YYYY-MM
Response: { "2024-11-15": 3, "2024-11-20": 1 }

// Search events
GET /api/events/search?q=query&from=date&to=date&calendarIds=id1,id2
Response: { events: [...], total: 42 }

// Calendar management
POST /api/calendars              # Create calendar
PATCH /api/calendars/:id         # Update (rename, recolor)
DELETE /api/calendars/:id        # Delete calendar

// Reminder management
POST /api/events/:id/reminders   # Add reminder
DELETE /api/reminders/:id        # Remove reminder
```

### Enhanced Routes

```typescript
// Existing routes - add query params
GET /api/events?from=...&to=...&calendarIds=id1,id2  # Filter by calendars
GET /api/events?view=agenda&days=30                   # Agenda view optimization
```

---

## V. Component Architecture

### New Components (23 files)

```
src/components/calendar/
├── EventPreview/
│   ├── EventPreviewPopover.tsx
│   ├── EventPreviewContent.tsx
│   ├── EventQuickActions.tsx
│   └── useEventPreview.ts
├── TimeGrid/
│   ├── TimeGrid.tsx
│   ├── CurrentTimeIndicator.tsx
│   ├── WorkingHoursOverlay.tsx
│   └── useTimeGrid.ts
├── MiniCalendar/
│   ├── MiniCalendar.tsx
│   ├── MiniMonthGrid.tsx
│   └── useMiniCalendar.ts
├── CalendarSelector/
│   ├── CalendarSelector.tsx
│   ├── CalendarCheckbox.tsx
│   └── useCalendarFilters.ts
├── DragDrop/
│   ├── DraggableEvent.tsx
│   ├── DroppableTimeSlot.tsx
│   ├── DragOverlay.tsx
│   └── useDragAndDrop.ts
├── Search/
│   ├── SearchBar.tsx
│   ├── SearchResults.tsx
│   ├── SearchFilters.tsx
│   └── useSearch.ts
├── AgendaView.tsx
└── KeyboardShortcutsHelp.tsx
```

### Modified Components (6 files)

```
src/components/calendar/
├── EventCard.tsx         # Add resize handle, drag wrapper
├── MonthGrid.tsx         # Integrate overflow button
├── WeekGrid.tsx          # Replace time column with TimeGrid
├── EventModal.tsx        # Add timezone picker, reminders UI
└── CalendarPage.tsx      # Wire up all new features
```

---

## VI. Dependencies & Bundle Size Impact

### New Libraries

| Package | Size | Purpose |
|---------|------|---------|
| `@dnd-kit/core` | 40 KB | Drag-and-drop |
| `@dnd-kit/modifiers` | 5 KB | Drag constraints |
| `chrono-node` | 500 KB | Date parsing |
| `fuse.js` | 15 KB | Fuzzy search |
| `next-themes` | 4 KB | Dark mode |
| `date-fns-tz` | 50 KB | Timezone handling |
| `react-timezone-select` | 20 KB | Timezone picker |
| `@tanstack/react-virtual` | 12 KB | Virtualization |
| **Total** | **646 KB** | **gzipped ~180 KB** |

### Performance Budget

- Current bundle: ~300 KB (gzipped)
- After all features: ~480 KB (gzipped)
- **Still under 500 KB target** ✅

---

## VII. Accessibility Compliance

### WCAG 2.1 AA Checklist

- [x] Color contrast ≥ 4.5:1 (test with WebAIM Contrast Checker)
- [x] All interactive elements keyboard accessible
- [x] Focus indicators visible (2px ring)
- [x] ARIA labels on icon-only buttons
- [x] Live regions for dynamic updates
- [x] Screen reader announcements (drag-and-drop)
- [x] Semantic HTML (`<time>`, `<nav>`, `<main>`)
- [x] Focus trap in modals
- [x] Skip links for keyboard navigation

### Testing Tools

- axe DevTools (browser extension)
- NVDA screen reader (Windows)
- VoiceOver (macOS)
- Keyboard-only navigation test

---

## VIII. Testing Strategy

### Unit Tests (Jest + React Testing Library)

```typescript
// Example: SearchBar.test.tsx
describe('SearchBar', () => {
  it('debounces search input', async () => {
    const onSearch = jest.fn();
    render(<SearchBar onSearch={onSearch} />);

    const input = screen.getByRole('searchbox');
    userEvent.type(input, 'meeting');

    // Should not call immediately
    expect(onSearch).not.toHaveBeenCalled();

    // Should call after 300ms
    await waitFor(() => expect(onSearch).toHaveBeenCalledWith('meeting'), {
      timeout: 400,
    });
  });
});
```

### Integration Tests (Playwright)

```typescript
// Example: drag-and-drop.spec.ts
test('reschedule event via drag and drop', async ({ page }) => {
  await page.goto('/calendar?mode=week');

  // Drag event from Monday 9am to Tuesday 2pm
  const event = page.locator('[data-event-id="123"]');
  const targetSlot = page.locator('[data-datetime="2024-11-19T14:00:00"]');

  await event.dragTo(targetSlot);

  // Verify optimistic update
  await expect(targetSlot).toContainText('Team Meeting');

  // Verify server update
  await page.waitForResponse('/api/events/123');
  await page.reload();
  await expect(targetSlot).toContainText('Team Meeting');
});
```

---

## IX. Migration Guide

### Gradual Rollout

**Week 1-2 (Sprint 5):** Foundation features, no breaking changes
**Week 3-4 (Sprint 6):** Sidebar + navigation, layout changes
**Week 5-6 (Sprint 7):** Discovery features, optional enhancements
**Week 7-8 (Sprint 8):** Advanced features, opt-in

### Feature Flags

```typescript
// .env.local
NEXT_PUBLIC_FEATURE_DRAG_DROP=true
NEXT_PUBLIC_FEATURE_SEARCH=true
NEXT_PUBLIC_FEATURE_REMINDERS=false  # Wait for push notification approval
```

### Database Migrations

```bash
# Sprint 6: Calendar colors
supabase migration create add_calendar_colors

# Sprint 7: Event counts cache
supabase migration create add_event_counts_cache

# Sprint 8: Reminders
supabase migration create add_event_reminders
```

---

## X. Success Metrics

### User Engagement

- [ ] Time to create event: < 10 seconds (Quick Add)
- [ ] Events rescheduled per day: +50% (Drag & Drop)
- [ ] Search usage: 20% of users weekly
- [ ] Multi-calendar users: 30% enable 2+ calendars

### Performance

- [ ] Initial load: < 2 seconds
- [ ] Time to interactive: < 3 seconds
- [ ] Lighthouse score: > 90
- [ ] Bundle size: < 500 KB (gzipped)

### Accessibility

- [ ] Keyboard navigation: 100% coverage
- [ ] Screen reader: Zero critical errors (axe)
- [ ] Color contrast: WCAG AA compliant

---

## XI. Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Bundle size bloat | High | Tree-shaking, lazy loading, code splitting |
| Drag-and-drop mobile issues | Medium | Use @dnd-kit (touch support), extensive mobile testing |
| Timezone complexity | High | Use battle-tested date-fns-tz, thorough testing |
| Search performance (1000+ events) | Medium | Virtualization, debouncing, client-side caching |
| Google sync conflicts | Medium | Existing conflict resolution, add user confirmation |

---

## XII. Next Steps

1. **Review this plan** with team/stakeholders
2. **Set up Sprint 5 board** with tasks from section II
3. **Install dependencies** from section VI
4. **Create feature flags** from section IX
5. **Begin with Event Preview Popover** (highest ROI, 3 days)

---

## XIII. References

- [Google Calendar Web Interface](https://calendar.google.com)
- [Material Design 3 Guidelines](https://m3.material.io/)
- [@dnd-kit Documentation](https://docs.dndkit.com/)
- [Next.js 16 Docs](https://nextjs.org/docs)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)

---

**Questions? Feedback?** Update this document as we learn during implementation.
