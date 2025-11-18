/**
 * Google Calendar Push API
 *
 * Pushes local event changes to Google Calendar (two-way sync)
 *
 * POST /api/google/push/[id]
 * Body: { op: 'create' | 'update' | 'delete' }
 */

import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import {
  googleInsert,
  googlePatch,
  googleDelete,
  googleGetEvent,
  fromGoogleResponse,
  retryWithBackoff,
  maybeSimulatePush,
} from '@/lib/google/push';

type PushOperation = 'create' | 'update' | 'delete';

interface PushRequest {
  op: PushOperation;
  googleCalendarId?: string; // Optional: specify which Google calendar to use
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventId } = await params;
    const body: PushRequest = await req.json();
    const { op, googleCalendarId = 'primary' } = body;

    if (!op || !['create', 'update', 'delete'].includes(op)) {
      return NextResponse.json(
        { error: 'Invalid operation. Must be create, update, or delete.' },
        { status: 400 }
      );
    }

    // Authenticate user
    const sb = await supabaseServer();
    const {
      data: { user },
      error: authError,
    } = await sb.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch the local event
    const { data: event, error: fetchError } = await sb
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (fetchError || !event) {
      return NextResponse.json(
        { error: `Event ${eventId} not found` },
        { status: 404 }
      );
    }

    // Only push events that are local-owned OR Google-owned
    if (event.external_source && event.external_source !== 'google') {
      return NextResponse.json(
        {
          error: `Cannot push event from external source: ${event.external_source}`,
        },
        { status: 400 }
      );
    }

    // Check if writes are enabled or simulate
    const simulation = await maybeSimulatePush(user.id, op, event);
    if (simulation) {
      console.log('[push] Simulating operation:', simulation);

      // Return simulated success without touching Google Calendar
      return NextResponse.json({
        success: true,
        operation: op,
        simulated: true,
        note: simulation.note,
        external_id: simulation.external_id,
        etag: simulation.external_etag,
      });
    }

    // Execute operation with retry (real Google API calls)
    let result: any;

    switch (op) {
      case 'create': {
        // Create new event on Google
        result = await retryWithBackoff(async () => {
          const googleEvent = await googleInsert(googleCalendarId, event);

          // Update local event with Google metadata
          const { error: updateError } = await sb
            .from('events')
            .update({
              external_id: googleEvent.id,
              external_etag: googleEvent.etag,
              external_updated_at: googleEvent.updated,
              external_source: 'google',
              updated_at: new Date().toISOString(),
            })
            .eq('id', eventId);

          if (updateError) {
            console.error('Failed to update local event with Google metadata:', updateError);
            throw new Error('Failed to update local metadata');
          }

          return {
            success: true,
            operation: 'create',
            external_id: googleEvent.id,
            etag: googleEvent.etag,
          };
        });

        break;
      }

      case 'update': {
        // Update existing event on Google
        if (!event.external_id) {
          return NextResponse.json(
            {
              error: 'Event has no external_id. Use create operation instead.',
            },
            { status: 400 }
          );
        }

        result = await retryWithBackoff(async () => {
          const googleEvent = await googlePatch(
            googleCalendarId,
            event.external_id,
            event,
            event.external_etag // Pass expected etag for conflict detection
          );

          // Handle conflict
          if (googleEvent.conflict) {
            return await handleConflict(
              sb,
              eventId,
              event,
              googleCalendarId,
              event.external_id
            );
          }

          // Update local event with new Google metadata
          const { error: updateError } = await sb
            .from('events')
            .update({
              external_etag: googleEvent.etag,
              external_updated_at: googleEvent.updated,
              updated_at: new Date().toISOString(),
            })
            .eq('id', eventId);

          if (updateError) {
            console.error('Failed to update local event with new etag:', updateError);
          }

          return {
            success: true,
            operation: 'update',
            external_id: googleEvent.id,
            etag: googleEvent.etag,
          };
        });

        break;
      }

      case 'delete': {
        // Delete event from Google
        if (event.external_id) {
          result = await retryWithBackoff(async () => {
            const deleteResult = await googleDelete(googleCalendarId, event.external_id);

            // Delete local event
            const { error: deleteError } = await sb
              .from('events')
              .delete()
              .eq('id', eventId);

            if (deleteError) {
              console.error('Failed to delete local event:', deleteError);
              throw new Error('Failed to delete local event');
            }

            return {
              success: true,
              operation: 'delete',
              external_id: event.external_id,
              notFound: deleteResult.notFound,
            };
          });
        } else {
          // No external_id - just delete locally
          const { error: deleteError } = await sb
            .from('events')
            .delete()
            .eq('id', eventId);

          if (deleteError) {
            console.error('Failed to delete local event:', deleteError);
            throw new Error('Failed to delete local event');
          }

          result = {
            success: true,
            operation: 'delete',
            local_only: true,
          };
        }

        break;
      }
    }

    // Trigger a pull sync to reconcile state
    try {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/google/sync`, {
        method: 'POST',
        headers: {
          Cookie: req.headers.get('cookie') || '',
        },
      });
    } catch (syncError) {
      console.warn('Failed to trigger pull sync after push:', syncError);
      // Don't fail the push operation if sync fails
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('POST /api/google/push/[id] error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Check for specific error types
    if (errorMessage.includes('No valid Google access token')) {
      return NextResponse.json(
        {
          error: 'Google Calendar not connected or token expired',
          action: 'reconnect',
        },
        { status: 401 }
      );
    }

    if (errorMessage.includes('429')) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded. Please try again later.',
        },
        { status: 429 }
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to sync with Google Calendar',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

/**
 * Handle conflict when Google event was modified concurrently
 *
 * Strategy: Last-writer-wins
 * 1. Pull latest from Google
 * 2. Overwrite local
 * 3. Re-apply user's intended changes
 * 4. Push again
 */
async function handleConflict(
  sb: any,
  eventId: string,
  localEvent: any,
  googleCalendarId: string,
  externalId: string
): Promise<any> {
  console.log(`[conflict] Detected for event ${eventId}, applying last-writer-wins...`);

  try {
    // 1. Pull latest from Google
    const latestGoogleEvent = await googleGetEvent(googleCalendarId, externalId);

    if (!latestGoogleEvent) {
      // Event was deleted on Google
      console.log(`[conflict] Event ${externalId} was deleted on Google`);

      // Delete locally
      await sb.from('events').delete().eq('id', eventId);

      return {
        success: true,
        operation: 'update',
        conflict: true,
        resolution: 'deleted_on_google',
      };
    }

    // 2. Update local with Google's version
    const googleData = fromGoogleResponse(latestGoogleEvent);

    await sb
      .from('events')
      .update({
        external_etag: googleData.external_etag,
        external_updated_at: googleData.external_updated_at,
        updated_at: new Date().toISOString(),
      })
      .eq('id', eventId);

    // 3. Re-apply user's changes and push again
    const retryResult = await googlePatch(
      googleCalendarId,
      externalId,
      localEvent,
      googleData.external_etag // Use new etag
    );

    if (retryResult.conflict) {
      // Still conflicting - give up and surface error
      console.error(`[conflict] Still conflicting after retry for event ${eventId}`);

      return {
        success: false,
        operation: 'update',
        conflict: true,
        resolution: 'failed_after_retry',
        error: 'Concurrent modification detected. Please refresh and try again.',
      };
    }

    // 4. Update local with final Google metadata
    await sb
      .from('events')
      .update({
        external_etag: retryResult.etag,
        external_updated_at: retryResult.updated,
        updated_at: new Date().toISOString(),
      })
      .eq('id', eventId);

    return {
      success: true,
      operation: 'update',
      conflict: true,
      resolution: 'last_writer_wins',
      external_id: retryResult.id,
      etag: retryResult.etag,
    };
  } catch (conflictError) {
    console.error('[conflict] Resolution failed:', conflictError);

    return {
      success: false,
      operation: 'update',
      conflict: true,
      resolution: 'failed',
      error: conflictError instanceof Error ? conflictError.message : 'Conflict resolution failed',
    };
  }
}
