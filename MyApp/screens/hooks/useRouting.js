import { useEffect, useRef, useState } from "react";
import axios from "axios";

const OSRM_BASE = "https://router.project-osrm.org";

/* =========================
   PROFILE + SPEED
========================= */

const OSRM_PROFILE_MAP = {
  walking: "foot",
  cycling: "bike",
  driving: "driving",
};

const SPEED_KMH = {
  walking: 4.5,
  cycling: 15,
  driving: 40,
};

const MAX_ROUTE_POINTS = 4000;
const MAX_ROUTE_ALTERNATIVES = 3;

function isValidCoordinate(latitude, longitude) {
  return Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude)) &&
    Number(latitude) >= -90 && Number(latitude) <= 90 &&
    Number(longitude) >= -180 && Number(longitude) <= 180;
}

function pointToSegmentDistanceMeters(point, start, end) {
  const latitudeScale = 111320;
  const longitudeScale = latitudeScale * Math.cos((point.latitude * Math.PI) / 180);
  const bx = (end.longitude - start.longitude) * longitudeScale;
  const by = (end.latitude - start.latitude) * latitudeScale;
  const px = (point.longitude - start.longitude) * longitudeScale;
  const py = (point.latitude - start.latitude) * latitudeScale;
  const lengthSquared = bx * bx + by * by;
  const fraction = lengthSquared > 0
    ? Math.max(0, Math.min(1, (px * bx + py * by) / lengthSquared))
    : 0;
  return Math.hypot(px - bx * fraction, py - by * fraction);
}

function simplifyRouteCoordinates(points, toleranceMeters) {
  if (points.length <= 2) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];

  while (stack.length) {
    const [startIndex, endIndex] = stack.pop();
    let maxDistance = 0;
    let splitIndex = -1;
    for (let index = startIndex + 1; index < endIndex; index += 1) {
      const currentDistance = pointToSegmentDistanceMeters(
        points[index],
        points[startIndex],
        points[endIndex]
      );
      if (currentDistance > maxDistance) {
        maxDistance = currentDistance;
        splitIndex = index;
      }
    }
    if (splitIndex > 0 && maxDistance > toleranceMeters) {
      keep[splitIndex] = 1;
      stack.push([startIndex, splitIndex], [splitIndex, endIndex]);
    }
  }

  return points.filter((_, index) => keep[index]);
}

function sanitizeRouteCoordinates(rawCoordinates) {
  const points = (Array.isArray(rawCoordinates) ? rawCoordinates : [])
    .map((coordinate) => {
      const longitude = Number(coordinate?.[0]);
      const latitude = Number(coordinate?.[1]);
      return isValidCoordinate(latitude, longitude) ? { latitude, longitude } : null;
    })
    .filter(Boolean);

  if (points.length <= MAX_ROUTE_POINTS) return points;

  // Geometry-aware simplification retains curves and intersections much more
  // faithfully than uniform sampling, especially on long navigation routes.
  let toleranceMeters = 1.5;
  let simplified = points;
  while (simplified.length > MAX_ROUTE_POINTS && toleranceMeters <= 96) {
    simplified = simplifyRouteCoordinates(points, toleranceMeters);
    toleranceMeters *= 1.75;
  }
  return simplified;
}

function formatDuration(totalMinutes) {
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (minutes === 0) return `${hours} hr`;
  return `${hours} hr ${minutes} min`;
}

/* =========================
   GEOMETRY
========================= */

function getDistanceMeters(lat1, lon1, lat2, lon2) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371000;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const INCIDENT_RADIUS = {
  low: 0,
  medium: 40,
  high: 80,
  critical: 150,
};

/* =========================
   INCIDENT ANALYSIS
========================= */

function analyzeRouteAgainstIncidents(routeCoords, incidents) {
  let dangerScore = 0;
  let hitPoints = 0;
  let isBlocked = false;
  let isRisky = false;

  if (!incidents || incidents.length === 0) {
    return { dangerScore, isBlocked, isRisky };
  }

  for (const point of routeCoords) {
    for (const incident of incidents) {
      const radius =
        INCIDENT_RADIUS[incident.level] ?? INCIDENT_RADIUS.high;

      const dist = getDistanceMeters(
        point.latitude,
        point.longitude,
        incident.latitude,
        incident.longitude
      );

      if (dist < radius) {
        hitPoints++;
        dangerScore += 1000;
      }
    }
  }

  const hitRatio = routeCoords.length
    ? hitPoints / routeCoords.length
    : 0;

  if (hitRatio > 0.2) isBlocked = true;
  else if (hitRatio > 0.04) isRisky = true;

  return { dangerScore, isBlocked, isRisky };
}

/* =========================
   INTERSECTION‑BASED DETOUR
========================= */

function findIntersectionWaypoint(route, incidents) {
  const steps = route.legs?.[0]?.steps ?? [];

  for (const step of steps) {
    for (const inter of step.intersections ?? []) {
      const [lng, lat] = inter.location;

      for (const inc of incidents) {
        if (inc.level !== "critical") continue;

        const dist = getDistanceMeters(
          lat,
          lng,
          inc.latitude,
          inc.longitude
        );

        if (dist > INCIDENT_RADIUS.critical * 1.2) {
          if (__DEV__) console.log("[evac-route] using an intersection safety detour");
          return { lat, lng };
        }
      }
    }
  }

  if (__DEV__) console.log("[evac-route] no intersection safety detour found");
  return null;
}

/* =========================
   FALLBACK: LATERAL DETOUR
========================= */

function pickLateralWaypoint(routeCoords, incidents) {
  if (!routeCoords.length) return null;

  const flood = incidents.find((i) => i.level === "critical");
  if (!flood) return null;

  const base = routeCoords.find(
    (p) =>
      getDistanceMeters(
        p.latitude,
        p.longitude,
        flood.latitude,
        flood.longitude
      ) < INCIDENT_RADIUS.critical
  );

  if (!base) return null;

  const LATERAL_THRESHOLD = 0.0004;

  for (const p of routeCoords) {
    const lateral =
      Math.abs(p.latitude - base.latitude) +
      Math.abs(p.longitude - base.longitude);

    if (lateral > LATERAL_THRESHOLD) {
      if (__DEV__) console.log("[evac-route] using a lateral safety detour");
      return { lat: p.latitude, lng: p.longitude };
    }
  }

  if (__DEV__) console.log("[evac-route] no lateral safety detour found");
  return null;
}

/* =========================
   HOOK
========================= */

export default function useRouting({
  enabled,
  from,
  to,
  mode = "driving",
  incidents = [],
  requestVersion = 0,
}) {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const lastKeyRef = useRef(null);
  const requestSequenceRef = useRef(0);

  /* ✅ TEMP DEBUG — FORCE CRITICAL INCIDENT AT ROUTE START */
  useEffect(() => {
    lastKeyRef.current = null;
  }, [mode, enabled, requestVersion]);

  useEffect(() => {
    if (!enabled || !from || !to) {
      // A location-source change can disable routing while an OSRM request is
      // active. Always leave the hook in a settled state after cancellation.
      setLoading(false);
      setRoutes([]);
      return undefined;
    }

    const fromLatitude = Number(from?.[0]);
    const fromLongitude = Number(from?.[1]);
    const toLatitude = Number(to?.lat);
    const toLongitude = Number(to?.lng);
    if (!isValidCoordinate(fromLatitude, fromLongitude) || !isValidCoordinate(toLatitude, toLongitude)) {
      setRoutes([]);
      setError(new Error("A valid current location and destination are required."));
      setLoading(false);
      return undefined;
    }

    const profile = OSRM_PROFILE_MAP[mode] || "driving";
    const key = `${profile}:${fromLatitude},${fromLongitude}->${toLatitude},${toLongitude}:${requestVersion}`;
    if (lastKeyRef.current === key) return undefined;
    lastKeyRef.current = key;
    const requestSequence = ++requestSequenceRef.current;
    let cancelled = false;
    const abortController = new AbortController();

    setLoading(true);
    setError(null);
    setRoutes([]);
    console.log("[evac-route] OSRM request started", { profile });

    const requestRoute = (wp) => {
      const coords = wp
        ? `${fromLongitude},${fromLatitude};${wp.lng},${wp.lat};${toLongitude},${toLatitude}`
        : `${fromLongitude},${fromLatitude};${toLongitude},${toLatitude}`;

      if (__DEV__) {
        console.log("[evac-route] requesting road route", {
          profile,
          includesSafetyWaypoint: Boolean(wp),
        });
      }

      return axios.get(
        `${OSRM_BASE}/route/v1/${profile}/${coords}`,
        {
          params: {
            overview: "full",
            geometries: "geojson",
            steps: true,
            alternatives: true,
          },
          timeout: 15000,
          signal: abortController.signal,
        }
      );
    };

    requestRoute()
      .then((res) => {
        const route = res.data.routes?.[0];
        if (!route) return res;

        let wp = findIntersectionWaypoint(route, incidents);

        if (!wp) {
          const coords = sanitizeRouteCoordinates(route?.geometry?.coordinates);
          wp = pickLateralWaypoint(coords, incidents);
        }

        return wp ? requestRoute(wp) : res;
      })
      .then((res) => {
        if (cancelled || requestSequence !== requestSequenceRef.current) return;
        const responseRoutes = Array.isArray(res?.data?.routes)
          ? res.data.routes.slice(0, MAX_ROUTE_ALTERNATIVES)
          : [];
        console.log("[evac-route] OSRM response received", {
          alternatives: responseRoutes.length,
        });
        const final = responseRoutes.map((r, i) => {
          const coords = sanitizeRouteCoordinates(r?.geometry?.coordinates);
          if (coords.length < 2) return null;
          const distance = Number(r?.distance);

          return {
            id: `${key}-${i}`,
            requestVersion,
            coords,
            distance: Number.isFinite(distance) ? distance : 0,
            steps: r.legs?.[0]?.steps || [],
            summary: {
              km: ((Number.isFinite(distance) ? distance : 0) / 1000).toFixed(1),
              minutes: Math.round(
                ((Number.isFinite(distance) ? distance : 0) / 1000 / SPEED_KMH[mode]) * 60
              ),
              displayTime: formatDuration(
                Math.round(
                  ((Number.isFinite(distance) ? distance : 0) / 1000 / SPEED_KMH[mode]) * 60
                )
              ),
            },
            ...analyzeRouteAgainstIncidents(coords, incidents),
          };
        }).filter(Boolean);

        if (!final.length) throw new Error("No usable route was returned. Please try again.");
        console.log("[evac-route] sanitized routes", {
          routes: final.length,
          firstRoutePoints: final[0]?.coords?.length || 0,
        });

        const safe = final.filter(
          (r) => !r.isBlocked && !r.isRisky
        );
        const risky = final.filter(
          (r) => !r.isBlocked && r.isRisky
        );

        let recommendedId = null;
        if (safe.length) recommendedId = safe[0].id;
        else if (risky.length) recommendedId = risky[0].id;

        if (!cancelled && requestSequence === requestSequenceRef.current) setRoutes(
          final.map((r) => ({
            ...r,
            isRecommended: r.id === recommendedId,
          }))
        );
      })
      .catch((requestError) => {
        if (!cancelled && requestSequence === requestSequenceRef.current && requestError?.code !== "ERR_CANCELED") {
          console.warn("[evac-route] route request failed", requestError?.message);
          setRoutes([]);
          setError(requestError);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      abortController.abort();
      setLoading(false);
    };
  }, [enabled, from?.[0], from?.[1], to?.lat, to?.lng, mode, incidents, requestVersion]);

  return { routes, loading, error };
}
