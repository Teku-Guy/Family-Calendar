# Development Guide

## Quick Start

### Prerequisites

- Node.js 18+ and npm/yarn/bun
- Supabase account ([sign up](https://supabase.com))
- Google Cloud Console account ([sign up](https://console.cloud.google.com))

### Setup Steps

1. **Clone and install dependencies**
   ```bash
   git clone <repo-url>
   cd family-calendar
   npm install  # or: bun install
   ```

2. **Set up Supabase**
   - Create a new project at [supabase.com](https://supabase.com/dashboard)
   - Go to Settings → API to get your URL and anon key
   - Run the SQL schema from `SUPABASE_SETUP.md` in the SQL Editor

3. **Configure Google OAuth**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing
   - Enable **Google Calendar API**
   - Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
   - Configure OAuth consent screen (add your email as test user)
   - Create credentials:
     - Application type: **Web application**
     - Authorized redirect URIs:
       ```
       http://localhost:3000/api/google/oauth/callback
       https://your-domain.com/api/google/oauth/callback
       ```
   - Copy Client ID and Client Secret

4. **Enable Google Sign-In in Supabase**
   - Supabase Dashboard → **Authentication** → **Providers** → **Google**
   - Toggle **Enable Sign in with Google**
   - Paste your Google Client ID and Client Secret
   - Note the callback URL: `https://<your-project-ref>.supabase.co/auth/v1/callback`
   - Add this URL to Google Cloud Console → OAuth 2.0 Client IDs → Authorized redirect URIs

5. **Configure environment variables**
   ```bash
   cp .env.local.example .env.local
   ```

   Edit `.env.local`:
   ```bash
   # Supabase (from Settings → API)
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...

   # Google OAuth (from Cloud Console → Credentials)
   GOOGLE_CLIENT_ID=1234567890-abcdef.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx

   # App URL (use localhost for dev, your domain for prod)
   NEXT_PUBLIC_APP_URL=http://localhost:3000

   # Generate encryption secret
   ENCRYPTION_SECRET=$(openssl rand -hex 32)
   ```

6. **Run development server**
   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000)

7. **Verify setup**
   - Visit `/api/diagnostics/auth` to check configuration
   - All environment variables should show as set (not `NOT_SET`)
   - `ok: true` means you're ready to go

---

## Common Pitfalls & Fixes

### 1. "Unsupported provider: provider is not enabled"

**Cause**: Google provider not enabled in Supabase or redirect URIs don't match.

**Fix**:
- Go to Supabase Dashboard → Authentication → Providers → Google
- Ensure toggle is **ON**
- Verify redirect URI in Google Cloud Console matches:
  - Supabase Auth: `https://<project-ref>.supabase.co/auth/v1/callback`
  - Calendar OAuth: `http://localhost:3000/api/google/oauth/callback`

**Debug**:
```bash
# Check diagnostics endpoint
curl http://localhost:3000/api/diagnostics/auth | jq

# Look for warnings about missing env vars or mismatched URLs
```

### 2. "Failed to fetch events" or 401 Unauthorized

**Cause**: User not signed in or RLS policies blocking access.

**Fix**:
- Sign in at `/signin`
- Check if profile/family/calendar were created:
  ```sql
  SELECT * FROM profiles WHERE id = auth.uid();
  SELECT * FROM families WHERE id IN (
    SELECT family_id FROM family_members WHERE user_id = auth.uid()
  );
  ```

**Debug**:
- Open browser DevTools → Network tab
- Look for `/api/events` request
- Check response body for error details

### 3. Google Calendar sync fails with "No valid Google access token"

**Cause**: User hasn't connected Google Calendar (separate from sign-in).

**Fix**:
- Click the 📅 icon in calendar toolbar
- Authorize Google Calendar access
- Should see 🔄 icon after successful connection

**Verify**:
```sql
SELECT user_id, expires_at FROM google_accounts WHERE user_id = auth.uid();
```

### 4. Events don't appear after sync

**Cause**: Primary calendar not found or events outside time window.

**Fix**:
- Check primary calendar exists:
  ```sql
  SELECT id FROM calendars WHERE is_primary = true;
  ```
- Verify events were imported:
  ```sql
  SELECT COUNT(*) FROM events WHERE source = 'google';
  ```
- Check time window (sync only imports next 30 days)

### 5. TypeScript errors after pulling changes

**Fix**:
```bash
rm -rf .next node_modules
npm install
npx tsc --noEmit
```

### 6. Middleware redirect loop

**Cause**: Middleware redirecting authenticated users back to signin.

**Fix**:
- Clear cookies/localStorage
- Check middleware logic in `src/middleware.ts`
- Ensure `matcher` config excludes `/api/*` and static files

---

## Development Workflow

### Code Style

```bash
# Run linter
npm run lint

# Auto-fix issues
npm run lint -- --fix

# Type check
npx tsc --noEmit
```

### Database Migrations

When changing schema:

1. Update SQL in `SUPABASE_SETUP.md`
2. Run in Supabase SQL Editor
3. Update TypeScript types in `src/lib/events.ts`
4. Regenerate Supabase types (optional):
   ```bash
   npx supabase gen types typescript --project-id <project-ref> > src/lib/database.types.ts
   ```

### Adding New API Endpoints

Example: Create `/api/events/:id` for single event fetch

1. **Create route file**:
   ```typescript
   // src/app/api/events/[id]/route.ts
   import { NextResponse } from 'next/server';
   import { supabaseServer } from '@/lib/supabase/server';

   export async function GET(
     request: Request,
     { params }: { params: { id: string } }
   ) {
     const sb = await supabaseServer();
     const { data, error } = await sb
       .from('events')
       .select('*')
       .eq('id', params.id)
       .single();

     if (error) {
       return NextResponse.json({ error: error.message }, { status: 404 });
     }

     return NextResponse.json({ event: data });
   }
   ```

2. **Add to data layer** (optional):
   ```typescript
   // src/lib/events.ts
   export async function getEvent(id: string) {
     const sb = await supabaseServer();
     const { data, error } = await sb
       .from('events')
       .select('*')
       .eq('id', id)
       .single();

     if (error) throw new Error(error.message);
     return data;
   }
   ```

3. **Test**:
   ```bash
   curl http://localhost:3000/api/events/<uuid>
   ```

### Adding UI Components

Example: Create an EventEditModal

1. **Create component**:
   ```typescript
   // src/components/calendar/EventEditModal.tsx
   'use client';

   import { useState } from 'react';

   type Props = {
     event: { id: string; title: string; starts_at: string; ends_at: string };
     onClose: () => void;
     onSave: (updates: Partial<Props['event']>) => Promise<void>;
   };

   export default function EventEditModal({ event, onClose, onSave }: Props) {
     const [title, setTitle] = useState(event.title);
     const [saving, setSaving] = useState(false);

     const handleSave = async () => {
       setSaving(true);
       try {
         await onSave({ title });
         onClose();
       } catch (error) {
         alert('Failed to save');
       } finally {
         setSaving(false);
       }
     };

     return (
       <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
         <div className="bg-white/10 rounded-lg p-6 max-w-md w-full">
           <h2 className="text-xl font-bold mb-4">Edit Event</h2>
           <input
             type="text"
             value={title}
             onChange={(e) => setTitle(e.target.value)}
             className="w-full px-3 py-2 rounded bg-white/5 border border-white/10"
           />
           <div className="mt-4 flex justify-end gap-2">
             <button onClick={onClose} className="px-4 py-2 rounded">
               Cancel
             </button>
             <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded bg-blue-500">
               {saving ? 'Saving...' : 'Save'}
             </button>
           </div>
         </div>
       </div>
     );
   }
   ```

2. **Use in calendar page**:
   ```typescript
   const [editingEvent, setEditingEvent] = useState<Event | null>(null);

   const handleSaveEvent = async (updates: Partial<Event>) => {
     await fetch(`/api/events/${editingEvent!.id}`, {
       method: 'PATCH',
       body: JSON.stringify(updates),
     });
     // Refetch events...
   };

   return (
     <>
       {/* ... calendar grid ... */}
       {editingEvent && (
         <EventEditModal
           event={editingEvent}
           onClose={() => setEditingEvent(null)}
           onSave={handleSaveEvent}
         />
       )}
     </>
   );
   ```

### Real-time Updates

To subscribe to table changes:

```typescript
useEffect(() => {
  const supabase = supabaseBrowser();
  const channel = supabase
    .channel('table-updates')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'events' },
      (payload) => {
        console.log('Change received!', payload);
        refetchEvents();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, []);
```

---

## Feature Wishlist & Implementation Guides

### 1. Recurring Events UI

**Goal**: Allow users to create repeating events (e.g., "Weekly standup")

**Implementation**:
1. Install `rrule` library:
   ```bash
   npm install rrule
   ```

2. Add recurrence UI in EventEditModal:
   ```typescript
   import { RRule } from 'rrule';

   const [recurrence, setRecurrence] = useState<'none' | 'daily' | 'weekly' | 'monthly'>('none');

   const rrule = recurrence === 'weekly'
     ? new RRule({
         freq: RRule.WEEKLY,
         dtstart: new Date(event.starts_at),
       }).toString()
     : null;
   ```

3. Update event creation:
   ```typescript
   await fetch('/api/events', {
     method: 'POST',
     body: JSON.stringify({
       ...eventData,
       rrule: rrule,
     }),
   });
   ```

4. Expand recurring events in UI:
   ```typescript
   import { rrulestr } from 'rrule';

   function expandRecurringEvent(event, start, end) {
     if (!event.rrule) return [event];

     const rule = rrulestr(event.rrule);
     const instances = rule.between(start, end);

     return instances.map((date) => ({
       ...event,
       id: `${event.id}-${date.toISOString()}`,
       starts_at: date.toISOString(),
       ends_at: new Date(date.getTime() + eventDuration).toISOString(),
     }));
   }
   ```

**Difficulty**: Medium
**Time estimate**: 4-6 hours

### 2. Two-Way Google Calendar Sync

**Goal**: Write local events back to Google Calendar

**Implementation**:
1. Add `POST` handler in `src/app/api/google/sync/route.ts`:
   ```typescript
   export async function POST() {
     // ... (existing import logic)

     // Export local events to Google
     const localEvents = await sb
       .from('events')
       .select('*')
       .is('source', null)  // Only local events
       .gte('starts_at', now.toISOString());

     for (const event of localEvents) {
       await googleFetch(
         `${GOOGLE_CALENDAR_API}/calendars/primary/events`,
         {
           method: 'POST',
           body: JSON.stringify({
             summary: event.title,
             location: event.location,
             start: { dateTime: event.starts_at },
             end: { dateTime: event.ends_at },
           }),
         }
       );

       // Update with source metadata
       await sb
         .from('events')
         .update({ source: 'google', source_id: googleEvent.id })
         .eq('id', event.id);
     }
   }
   ```

**Difficulty**: Medium
**Time estimate**: 3-4 hours

### 3. Kiosk Mode (Read-Only Display)

**Goal**: Full-screen calendar for TV/tablet in shared spaces

**Implementation**:
1. Create `/kiosk` route:
   ```typescript
   // src/app/kiosk/page.tsx
   'use client';

   export default function KioskPage() {
     const [now, setNow] = useState(new Date());

     useEffect(() => {
       const interval = setInterval(() => setNow(new Date()), 60000);
       return () => clearInterval(interval);
     }, []);

     return (
       <div className="h-screen overflow-hidden">
         <WeekGrid
           mode="week"
           weekStart={startOfWeek(now)}
           events={events}
           readOnly
         />
       </div>
     );
   }
   ```

2. Add full-screen styling:
   ```css
   .kiosk-mode {
     font-size: clamp(1rem, 2vw, 1.5rem);
     /* Larger touch targets */
   }
   ```

3. Auto-advance weeks:
   ```typescript
   useEffect(() => {
     const interval = setInterval(() => {
       setWeekStart(addDays(weekStart, 7));
     }, 300000);  // Every 5 minutes
     return () => clearInterval(interval);
   }, [weekStart]);
   ```

**Difficulty**: Easy
**Time estimate**: 2-3 hours

### 4. Multiple Calendar Views

**Goal**: Show/hide calendars by color

**Implementation**:
1. Add calendar selector to toolbar:
   ```typescript
   const [visibleCalendars, setVisibleCalendars] = useState<Set<string>>(new Set());

   <div className="flex gap-2">
     {calendars.map(cal => (
       <button
         key={cal.id}
         onClick={() => toggleCalendar(cal.id)}
         className={visibleCalendars.has(cal.id) ? 'opacity-100' : 'opacity-30'}
       >
         <span style={{ color: cal.color }}>●</span> {cal.name}
       </button>
     ))}
   </div>
   ```

2. Filter events:
   ```typescript
   const filteredEvents = events.filter(e =>
     visibleCalendars.has(e.calendar_id)
   );
   ```

**Difficulty**: Easy
**Time estimate**: 1-2 hours

### 5. Conflict Detection

**Goal**: Warn when events overlap

**Implementation**:
1. Check for overlaps when creating event:
   ```typescript
   const { data: conflicts } = await sb
     .from('events')
     .select('id, title')
     .eq('calendar_id', calendar_id)
     .lt('starts_at', ends_at)
     .gt('ends_at', starts_at);

   if (conflicts.length > 0) {
     return NextResponse.json({
       error: 'Conflicts with existing events',
       conflicts,
     }, { status: 409 });
   }
   ```

2. Show warning in UI:
   ```typescript
   if (response.status === 409) {
     const { conflicts } = await response.json();
     const proceed = confirm(
       `This event conflicts with: ${conflicts.map(c => c.title).join(', ')}. Create anyway?`
     );
     if (!proceed) return;
     // Retry with ?force=true param
   }
   ```

**Difficulty**: Easy
**Time estimate**: 1-2 hours

---

## Debugging

### Enable Verbose Logging

```typescript
// src/lib/supabase/client.ts
export function supabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        debug: process.env.NODE_ENV === 'development',
      },
    }
  );
}
```

### Inspect RLS Policies

```sql
-- Check if query would pass RLS
EXPLAIN (ANALYZE, VERBOSE)
SELECT * FROM events WHERE calendar_id = 'xxx';

-- Temporarily disable RLS (DANGER: dev only!)
ALTER TABLE events DISABLE ROW LEVEL SECURITY;
```

### Test Token Encryption

```typescript
// src/lib/crypto.test.ts
import { encrypt, decrypt } from './crypto';

const original = 'my-secret-token';
const encrypted = await encrypt(original);
const decrypted = await decrypt(encrypted);

console.assert(decrypted === original, 'Roundtrip failed!');
```

### Monitor Real-time Subscriptions

```typescript
supabase
  .channel('debug')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, (payload) => {
    console.log('Real-time event:', payload);
  })
  .subscribe((status) => {
    console.log('Subscription status:', status);
  });
```

---

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import project in Vercel dashboard
3. Add environment variables (same as `.env.local`)
4. Update `NEXT_PUBLIC_APP_URL` to production domain
5. Add production redirect URIs to Google Cloud Console:
   - `https://your-domain.com/auth/callback`
   - `https://your-domain.com/api/google/oauth/callback`

### Docker (Self-Hosted)

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
```

```bash
docker build -t family-calendar .
docker run -p 3000:3000 --env-file .env.local family-calendar
```

---

## Getting Help

- **Bug reports**: [GitHub Issues](https://github.com/your-repo/issues)
- **Questions**: [Discussions](https://github.com/your-repo/discussions)
- **Supabase help**: [Supabase Discord](https://discord.supabase.com)
- **Next.js help**: [Next.js Discord](https://nextjs.org/discord)

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Run tests: `npm test` (when tests exist)
4. Commit with conventional commits: `git commit -m "feat: add conflict detection"`
5. Push and open a pull request

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

**Examples**:
- `feat(calendar): add recurring event support`
- `fix(auth): handle token refresh failure`
- `docs: update setup instructions`
