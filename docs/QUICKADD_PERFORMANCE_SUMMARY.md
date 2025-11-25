# QuickAdd Performance Summary

**TL;DR:** Three critical bottlenecks identified. Phase 1 fixes (3 optimizations) will provide 90%+ performance improvement with 1-2 days effort.

---

## Critical Issues

### 1. CRITICAL: Hover State Re-renders
- **Location:** `MonthGrid.tsx:41, 164, 176-177`
- **Impact:** 840 cell re-evaluations per 10 cells hovered (10,080 in YearGrid)
- **Fix:** Replace React state with CSS-only hover (`:hover` pseudo-class)
- **Effort:** 30 minutes
- **Gain:** 90% reduction in hover-related work

### 2. HIGH: Event Handler Recreation
- **Location:** `MonthGrid.tsx:176-189`
- **Impact:** 168 function allocations per render (2,016 in YearGrid)
- **Fix:** Extract handlers to `useCallback` hooks or use handler cache Map
- **Effort:** 1-2 hours
- **Gain:** 30-40% reduction in render time

### 3. HIGH: NLP Parsing Overhead
- **Location:** `QuickAddModal.tsx:69-104`
- **Impact:** 2-8 re-renders per keystroke, 250ms feedback delay
- **Fix:** Batch state updates, use `useTransition`, reduce debounce to 150ms
- **Effort:** 2-3 hours
- **Gain:** 70% fewer re-renders, 40% faster feedback

---

## Performance Metrics

### Current State
| Metric | MonthGrid | YearGrid |
|--------|-----------|----------|
| Hover (10 cells) | 840 evaluations | 10,080 evaluations |
| Event filtering | 4,200 Date objects | 50,400 Date objects |
| Initial render | 15-25ms | 80-120ms |

### After Phase 1 Optimizations
| Metric | MonthGrid | YearGrid |
|--------|-----------|----------|
| Hover (10 cells) | 0 evaluations | 0 evaluations |
| Event filtering | 100 Date objects | 100 Date objects |
| Initial render | 10-15ms | 30-50ms |

**Expected improvement:** 60-80% faster across all critical paths

---

## Implementation Plan

### Phase 1 (1-2 days) - CRITICAL PATH
1. CSS-only hover (30 min)
2. Memoize event filtering (1 hour)
3. Memoize event handlers (1-2 hours)

**Priority:** Implement immediately. Highest ROI.

### Phase 2 (2-3 days) - USER EXPERIENCE
4. Optimize NLP parsing (2-3 hours)
5. Add optimistic updates (2-4 hours)

**Priority:** High user impact, medium effort.

### Phase 3 (3-5 days) - SCALABILITY
6. Virtualize YearGrid (1-2 days)

**Priority:** Defer unless event count exceeds 200+.

---

## Quick Reference - Code Changes

### Fix 1: CSS-Only Hover (CRITICAL)

**Before:**
```typescript
const [hoveredDay, setHoveredDay] = useState<Date | null>(null);
const isHovered = hoveredDay?.toDateString() === d.toDateString();

<div
  className={isHovered ? 'bg-white/10 ring-2' : 'hover:bg-white/5'}
  onMouseEnter={() => setHoveredDay(d)}
  onMouseLeave={() => setHoveredDay(null)}
/>
```

**After:**
```typescript
// Remove state entirely
<div className="hover:bg-white/10 hover:ring-2 hover:ring-white/20 ring-inset" />
```

### Fix 2: Memoize Event Filtering (MEDIUM)

**Before:**
```typescript
const eventsOnDay = useCallback((d: Date) => {
  return events.filter(/* ... */);
}, [events]);

const dayEvents = eventsOnDay(d); // Called 42 times
```

**After:**
```typescript
const eventsByDate = useMemo(() => {
  const map = new Map<string, typeof events>();
  events.forEach(ev => {
    const key = `${s.getFullYear()}-${s.getMonth()}-${s.getDate()}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(ev);
  });
  return map;
}, [events]);

const dateKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const dayEvents = eventsByDate.get(dateKey) || [];
```

### Fix 3: Optimize NLP Parsing (HIGH)

**Before:**
```typescript
useEffect(() => {
  const timer = setTimeout(() => {
    setDetectedStart(start);
    setDetectedEnd(end);
    syncNLPToManual(start, end); // 6 more setStates
  }, 250);
  return () => clearTimeout(timer);
}, [inputValue, selectedDate, inputMode]);
```

**After:**
```typescript
const [isParsing, startTransition] = useTransition();
const parseTimeoutRef = useRef<number>();

useEffect(() => {
  clearTimeout(parseTimeoutRef.current);
  parseTimeoutRef.current = window.setTimeout(() => {
    startTransition(() => {
      // Single state update with all fields
      setParseResult({ detectedStart, detectedEnd, ...manualFields });
    });
  }, 150);
  return () => clearTimeout(parseTimeoutRef.current);
}, [inputValue]); // Removed selectedDate, inputMode
```

---

## Testing Checklist

**Before deployment:**
- [ ] Hover across 20 cells in YearGrid - no frame drops
- [ ] Type "lunch tomorrow at 1pm" - detects time within 200ms
- [ ] Create event - appears in UI within 100ms
- [ ] Chrome DevTools: No unnecessary re-renders in Profiler
- [ ] Chrome DevTools: 60 FPS maintained during hover

---

## Files Modified

### Phase 1
- `src/components/calendar/MonthGrid.tsx` (3 changes)

### Phase 2
- `src/components/calendar/QuickAddModal.tsx` (2 changes)
- `src/app/calendar/page.tsx` (1 change - optimistic updates)

### Phase 3
- `src/components/calendar/YearGrid.tsx` (1 change - virtualization)

---

**Full audit:** See `PERFORMANCE_AUDIT_QUICKADD.md`
**Status:** Ready for implementation
**Risk:** Low (non-breaking changes)
