import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { eventUpdateSchema } from '@/lib/validation/events';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sb = await supabaseServer();
    const body = await req.json();
    const parsed = eventUpdateSchema.parse({ ...body, id });
    const { id: _, ...patch } = parsed;

    const { error } = await sb.from('events').update(patch).eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('PATCH /api/events/[id] error:', e);
    const msg = e?.issues
      ? e.issues.map((x: any) => x.message).join(', ')
      : String(e?.message || e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sb = await supabaseServer();
    const { error } = await sb.from('events').delete().eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('DELETE /api/events/[id] error:', e);
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
