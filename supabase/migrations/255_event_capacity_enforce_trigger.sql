-- Enforce event.max_attendees atomically on registration insert/update.
-- Prevents check-then-act oversell when two checkouts complete at once.

CREATE OR REPLACE FUNCTION public.registrations_enforce_event_capacity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_cap integer;
  v_occupied integer;
  v_new_qty integer;
  v_holds boolean;
BEGIN
  -- Only care about rows that hold a seat.
  v_holds := (
    NEW.cancelled_at IS NULL
    AND COALESCE(NEW.payment_status, '') <> 'Refunded'
    AND COALESCE(NEW.application_status, '') <> 'Denied'
  );

  -- No seat held after this change → nothing to enforce.
  IF NOT v_holds THEN
    RETURN NEW;
  END IF;

  v_new_qty := GREATEST(1, COALESCE(NEW.quantity, 1));

  -- Lock the event row so concurrent inserts serialize on the same venue.
  SELECT CASE
    WHEN max_attendees IS NULL OR max_attendees <= 0 THEN NULL
    ELSE floor(max_attendees)::integer
  END
  INTO v_cap
  FROM public.events
  WHERE id = NEW.event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'event_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_cap IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(GREATEST(1, COALESCE(quantity, 1))), 0)::integer
  INTO v_occupied
  FROM public.registrations
  WHERE event_id = NEW.event_id
    AND cancelled_at IS NULL
    AND COALESCE(payment_status, '') <> 'Refunded'
    AND COALESCE(application_status, '') <> 'Denied'
    AND id IS DISTINCT FROM NEW.id;

  IF v_occupied + v_new_qty > v_cap THEN
    RAISE EXCEPTION 'event_sold_out'
      USING ERRCODE = 'check_violation',
            HINT = 'Event capacity exceeded';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_registrations_event_capacity ON public.registrations;

CREATE TRIGGER trg_registrations_event_capacity
  BEFORE INSERT OR UPDATE OF quantity, cancelled_at, payment_status, application_status, event_id
  ON public.registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.registrations_enforce_event_capacity();

COMMENT ON FUNCTION public.registrations_enforce_event_capacity() IS
  'Serializes seat counts per event via FOR UPDATE; blocks inserts/updates that would exceed events.max_attendees.';
