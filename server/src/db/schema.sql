-- GPS Tracker — PostgreSQL + PostGIS Schema
-- Run: psql -U postgres -d gps_tracker -f schema.sql

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── DEVICES ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS devices (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL,
  name          VARCHAR(128),
  hardware_id   VARCHAR(64) UNIQUE NOT NULL,   -- u-blox serial / IMEI
  model         VARCHAR(64),                   -- e.g. NEO-M8N
  lte_module    VARCHAR(64),                   -- e.g. SIM7600
  firmware_ver  VARCHAR(32),
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_devices_user ON devices(user_id);
CREATE INDEX idx_devices_hardware ON devices(hardware_id);

-- ── LOCATIONS ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS locations (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id     UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL,
  session_id    UUID,
  geom          GEOMETRY(POINT, 4326) NOT NULL,  -- PostGIS point (lng, lat)
  altitude      FLOAT,
  accuracy      FLOAT,
  speed         FLOAT,
  heading       FLOAT,
  raw_payload   JSONB,                            -- full hardware-agnostic MQTT payload
  timestamp     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Spatial index for geo queries
CREATE INDEX idx_locations_geom    ON locations USING GIST(geom);
CREATE INDEX idx_locations_device  ON locations(device_id);
CREATE INDEX idx_locations_session ON locations(session_id);
CREATE INDEX idx_locations_ts      ON locations(timestamp DESC);

-- ── GEOFENCES ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS geofences (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id       UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  name            VARCHAR(128) NOT NULL,
  geometry        GEOMETRY(POLYGON, 4326) NOT NULL,  -- PostGIS polygon
  alert_on_enter  BOOLEAN NOT NULL DEFAULT TRUE,
  alert_on_exit   BOOLEAN NOT NULL DEFAULT TRUE,
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_geofences_geom   ON geofences USING GIST(geometry);
CREATE INDEX idx_geofences_device ON geofences(device_id);

-- ── ALERTS ────────────────────────────────────────────────────────────────────
CREATE TYPE alert_type AS ENUM ('ENTER', 'EXIT');

CREATE TABLE IF NOT EXISTS alerts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id       UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  geofence_id     UUID NOT NULL REFERENCES geofences(id) ON DELETE CASCADE,
  location_id     UUID REFERENCES locations(id),
  type            alert_type NOT NULL,
  triggered_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged    BOOLEAN NOT NULL DEFAULT FALSE,
  ack_at          TIMESTAMPTZ
);

CREATE INDEX idx_alerts_device    ON alerts(device_id);
CREATE INDEX idx_alerts_geofence  ON alerts(geofence_id);
CREATE INDEX idx_alerts_triggered ON alerts(triggered_at DESC);
CREATE INDEX idx_alerts_unacked   ON alerts(acknowledged) WHERE acknowledged = FALSE;

-- ── GEOFENCE CHECK FUNCTION ───────────────────────────────────────────────────
-- Called after each location insert to evaluate all active geofences for a device.
-- Returns rows for any ENTER/EXIT transitions that need alerting.
CREATE OR REPLACE FUNCTION check_geofence_transitions(
  p_device_id   UUID,
  p_location_id UUID,
  p_geom        GEOMETRY
) RETURNS TABLE(
  geofence_id UUID,
  alert_type  alert_type
) LANGUAGE plpgsql AS $$
DECLARE
  rec RECORD;
  prev_inside BOOLEAN;
  curr_inside BOOLEAN;
BEGIN
  FOR rec IN
    SELECT g.id, g.geometry, g.alert_on_enter, g.alert_on_exit
    FROM geofences g
    WHERE g.device_id = p_device_id AND g.active = TRUE
  LOOP
    curr_inside := ST_Within(p_geom, rec.geometry);

    -- Check the previous location for this device
    SELECT ST_Within(l.geom, rec.geometry)
    INTO prev_inside
    FROM locations l
    WHERE l.device_id = p_device_id
      AND l.id != p_location_id
    ORDER BY l.timestamp DESC
    LIMIT 1;

    prev_inside := COALESCE(prev_inside, FALSE);

    IF curr_inside AND NOT prev_inside AND rec.alert_on_enter THEN
      geofence_id := rec.id;
      alert_type  := 'ENTER';
      RETURN NEXT;
    ELSIF NOT curr_inside AND prev_inside AND rec.alert_on_exit THEN
      geofence_id := rec.id;
      alert_type  := 'EXIT';
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$$;
