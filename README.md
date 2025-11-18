# Family Calendar (Tailwind v4 + Supabase)

## Quickstart
```bash
# Create project
bunx create-next-app@latest family-calendar --ts --app --tailwind
cd family-calendar

# Install dependencies
bun i @supabase/supabase-js @supabase/ssr zod date-fns rrule jsonwebtoken googleapis

# Environment variables
cp .env.local.example .env.local
# Fill in your Supabase + Google credentials

# Database setup
# Go to Supabase SQL editor → paste schema.sql & rls.sql

# Run locally
bun run dev