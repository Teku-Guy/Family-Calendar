# Infinite Scroll Implementation Plan

## Overview
Implement seamless infinite vertical scrolling for the daily time grid view, allowing users to scroll continuously through 24-hour periods without reaching an "end".

## Current State
- **WeekGrid** shows full 24-hour view (12am-11pm)
- Fixed scroll container with 1440px height (24 hours * 60px/hour)
- No looping mechanism

## Goals
1. **Seamless Looping**: When scrolling past 11pm, loop back to 12am smoothly
2. **No Visual Jumps**: User should not perceive any discontinuity
3. **Preserve Functionality**: All existing features must continue working
4. **Performance**: Maintain 60fps scrolling with minimal re-renders

## Implementation Strategy

### Option 1: Virtual Scrolling with Three Pages (Recommended)

**Concept:**
- Render 3 "virtual pages" of 24 hours each (72 hours total height)
- Middle page (hours 24-48) displays the actual current day
- Top and bottom pages are clones for seamless transitions
- When user crosses a threshold, reposition scroll without visible jump

**Implementation Steps:**

1. **Create Virtual Container**
   ```typescript
   const HOUR_HEIGHT = 60; // pixels
   const HOURS_PER_PAGE = 24;
   const TOTAL_PAGES = 3;
   const VIRTUAL_HEIGHT = HOUR_HEIGHT * HOURS_PER_PAGE * TOTAL_PAGES; // 4320px
   ```

2. **Triple the Content**
   ```typescript
   // Render time grid 3 times
   <div style={{ height: VIRTUAL_HEIGHT }}>
     {/* Top page: Clone of day (for scrolling up) */}
     <DayContent offset={0} />

     {/* Middle page: Actual day */}
     <DayContent offset={PAGE_HEIGHT} />

     {/* Bottom page: Clone of day (for scrolling down) */}
     <DayContent offset={PAGE_HEIGHT * 2} />
   </div>
   ```

3. **Initialize Scroll Position**
   ```typescript
   useEffect(() => {
     if (containerRef.current) {
       // Start at middle page, scroll to current time
       const now = new Date();
       const currentOffset = (now.getHours() * 60 + now.getMinutes());
       containerRef.current.scrollTop = PAGE_HEIGHT + currentOffset - 120; // Center current time
     }
   }, []);
   ```

4. **Handle Scroll Boundaries**
   ```typescript
   const handleScroll = useCallback(() => {
     if (!containerRef.current || isScrollingProgrammatically.current) return;

     const scrollTop = containerRef.current.scrollTop;
     const threshold = PAGE_HEIGHT * 0.1; // 10% buffer

     // Near top boundary - loop to bottom
     if (scrollTop < threshold) {
       isScrollingProgrammatically.current = true;
       containerRef.current.scrollTop = scrollTop + PAGE_HEIGHT;
       requestAnimationFrame(() => {
         isScrollingProgrammatically.current = false;
       });
     }
     // Near bottom boundary - loop to top
     else if (scrollTop > PAGE_HEIGHT * 2 - threshold) {
       isScrollingProgrammatically.current = true;
       containerRef.current.scrollTop = scrollTop - PAGE_HEIGHT;
       requestAnimationFrame(() => {
         isScrollingProgrammatically.current = false;
       });
     }
   }, []);
   ```

5. **Render Events Across Pages**
   ```typescript
   // For each event, determine which page(s) it appears on
   const renderEventAcrossPages = (event: CalendarEvent) => {
     const startHour = new Date(event.start).getHours();
     const endHour = new Date(event.end).getHours();

     // Render on middle page (always)
     const middlePageEvent = {
       ...event,
       offsetTop: PAGE_HEIGHT + (startHour * HOUR_HEIGHT)
     };

     // If event crosses midnight, also render on adjacent pages
     const events = [middlePageEvent];

     if (startHour > endHour) {
       // Crosses midnight - render on bottom page too
       events.push({
         ...event,
         offsetTop: (PAGE_HEIGHT * 2) + (startHour * HOUR_HEIGHT)
       });
     }

     return events;
   };
   ```

6. **Update Current Time Indicator**
   ```typescript
   // Calculate position across all 3 pages
   const getCurrentTimePosition = () => {
     const now = new Date();
     const minutesSinceMidnight = now.getHours() * 60 + now.getMinutes();

     return [
       minutesSinceMidnight, // Top page
       PAGE_HEIGHT + minutesSinceMidnight, // Middle page
       (PAGE_HEIGHT * 2) + minutesSinceMidnight, // Bottom page
     ];
   };
   ```

**Pros:**
- Truly seamless looping
- No jarring jumps
- Works well with existing event rendering

**Cons:**
- More complex state management
- Higher memory usage (3x content)
- Need to carefully handle event click handlers across clones

### Option 2: CSS Transform-Based Approach

**Concept:**
- Single 24-hour grid
- Use CSS transforms to reposition when scrolling past boundaries
- Simpler than virtual pages but may have visual artifacts

**Implementation:**
```typescript
const handleScroll = () => {
  const scrollTop = containerRef.current.scrollTop;
  const maxScroll = PAGE_HEIGHT;

  if (scrollTop < 0) {
    // Scrolled past top - wrap to bottom
    containerRef.current.scrollTop = maxScroll + scrollTop;
  } else if (scrollTop > maxScroll) {
    // Scrolled past bottom - wrap to top
    containerRef.current.scrollTop = scrollTop - maxScroll;
  }
};
```

**Pros:**
- Simpler implementation
- Lower memory usage

**Cons:**
- May have visible jumps
- Harder to handle events near boundaries
- Browser compatibility issues

### Option 3: Hybrid Approach (Pragmatic)

**Concept:**
- Show 24-hour view (current implementation)
- Add "scroll to top" and "scroll to bottom" buttons when near edges
- Optionally: When scrolling past end, smoothly animate back with CSS

**Implementation:**
- Keep current 24-hour grid as-is
- Add floating buttons:
  - "↑ Back to Top" (appears when scrolled down)
  - "↓ Back to Start of Day" (appears when scrolled to bottom)
- Use smooth scroll behavior for better UX

**Pros:**
- Minimal code changes
- No complexity
- Clear UX pattern users understand

**Cons:**
- Not truly "infinite" scroll
- Requires manual user action

## Recommendation

**Start with Option 3 (Hybrid Approach)**
- Quick to implement
- Low risk of breaking existing features
- Good enough for MVP

**Plan to upgrade to Option 1 later**
- Once core features are stable
- If user feedback indicates need for true infinite scroll
- Allocate dedicated sprint for implementation

## Technical Considerations

### Performance
- **Virtualization**: Consider using `react-window` or custom virtualization for rendering only visible hours
- **Debouncing**: Debounce scroll event handlers to avoid excessive re-renders
- **Memoization**: Memoize event rendering logic to prevent recalculations

### Accessibility
- **Keyboard Navigation**: Ensure Tab/Shift+Tab works across all pages
- **Screen Readers**: Announce time labels correctly
- **Focus Management**: Maintain focus when content repositions

### Event Handling
- **Drag-to-Create**: Must work seamlessly across page boundaries
- **Event Clicks**: Clicking an event in a cloned page should trigger the same action
- **Time Indicator**: Should appear on all 3 pages when rendering current day

### State Management
- Track current "virtual offset" (which iteration of the day we're showing)
- Update event queries to account for virtual offset
- Sync scroll position with virtual offset

## Testing Strategy

1. **Manual Testing**
   - Scroll rapidly up and down
   - Create events near midnight
   - Drag-to-create across boundaries
   - Test on mobile devices (touch scrolling)

2. **Automated Testing**
   - Unit tests for scroll boundary calculations
   - Integration tests for event rendering
   - E2E tests for user workflows

3. **Performance Testing**
   - Measure FPS during scrolling
   - Check memory usage with many events
   - Test on low-end devices

## Migration Path

### Phase 1: Foundation (Current)
- 24-hour view implemented ✅
- All existing features working

### Phase 2: Hybrid UX (Quick Win)
- Add scroll-to-top/bottom buttons
- Improve scroll animations
- ~2-4 hours work

### Phase 3: True Infinite Scroll (Future)
- Implement Option 1 (Virtual Pages)
- Full testing across all features
- ~2-3 days work

## References
- [CSS Scroll Behavior](https://developer.mozilla.org/en-US/docs/Web/CSS/scroll-behavior)
- [IntersectionObserver API](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API)
- [React Window](https://github.com/bvaughn/react-window) - Virtualization library
- Google Calendar infinite scroll (inspiration)

## Open Questions
1. Should infinite scroll work in week view too, or only day view?
2. How to handle events that span multiple days in infinite scroll?
3. Should we show visual indicators when user is at "unusual" times (e.g., 3am)?
4. Performance target: 60fps on what device specs?
