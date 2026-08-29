// screens/hooks/useHazardLayers.js

import { useMemo } from "react";
import { Polygon } from "react-native-maps";

// ✅ GeoJSON data (already in your architecture)
let floodDataCache = null;
let jaenDataCache = null;

function getFloodData() {
  if (!floodDataCache) {
    floodDataCache = {
      susceptible: require("../data/Susceptible_clean.json"),
      medium: require("../data/Medium.json"),
      safe: require("../data/Safe.json"),
    };
  }
  return floodDataCache;
}

function getJaenData() {
  if (!jaenDataCache) {
    jaenDataCache = require("../data/jaen.json");
  }
  return jaenDataCache;
}

/* =========================
   STYLES
========================= */

export const FLOOD_STYLES = {
  susceptible: {
    strokeColor: "rgba(75, 0, 130, 1)",
    fillColor: "rgba(75, 0, 130, 0.5)",
    strokeWidth: 1,
  },
  medium: {
    strokeColor: "rgba(128, 0, 128, 1)",
    fillColor: "rgba(128, 0, 128, 0.5)",
    strokeWidth: 1,
  },
  safe: {
    strokeColor: "rgba(135, 206, 235, 1)",
    fillColor: "rgba(135, 206, 235, 0.5)",
    strokeWidth: 1,
  },
};

const earthquakeStyle = {
  strokeColor: "rgba(255, 0, 0, 1)",
  fillColor: "rgba(255, 0, 0, 0.3)",
  strokeWidth: 2,
};

const jaenBoundaryStyle = {
  strokeColor: "rgba(8, 102, 31, 0.6)",
  strokeWidth: 2,
  fillColor: "rgba(0,0,0,0)",
};

/* =========================
   HELPERS
========================= */

function renderPolygons(geojson, style) {
  if (!geojson || !geojson.features) return null;

  return geojson.features.flatMap((feature, idx) => {
    const polygons =
      feature.geometry.type === "MultiPolygon"
        ? feature.geometry.coordinates
        : [feature.geometry.coordinates];

    return polygons.map((polygon, pIdx) => (
      <Polygon
        key={`${idx}-${pIdx}`}
        coordinates={polygon[0].map((coord) => ({
          latitude: coord[1],
          longitude: coord[0],
        }))}
        strokeColor={style.strokeColor}
        fillColor={style.fillColor}
        strokeWidth={style.strokeWidth}
        tappable={false}
      />
    ));
  });
}

/* =========================
   HOOK
========================= */

export default function useHazardLayers({
  showFloodMap,
  showEarthquakeHazard,
  showJaenBoundary,
}) {
  /* =========================
     MEMOIZED LAYERS
  ========================= */

  const floodLayers = useMemo(() => {
    if (!showFloodMap) return null;
    const floodData = getFloodData();

    return (
      <>
        {renderPolygons(floodData.susceptible, FLOOD_STYLES.susceptible)}
        {renderPolygons(floodData.medium, FLOOD_STYLES.medium)}
        {renderPolygons(floodData.safe, FLOOD_STYLES.safe)}
      </>
    );
  }, [showFloodMap]);

  const earthquakeLayer = useMemo(() => {
    if (!showEarthquakeHazard) return null;
    return renderPolygons(getJaenData(), earthquakeStyle);
  }, [showEarthquakeHazard]);

  const jaenBoundaryLayer = useMemo(() => {
    if (!showJaenBoundary) return null;
    return renderPolygons(getJaenData(), jaenBoundaryStyle);
  }, [showJaenBoundary]);

  return {
    floodLayers,
    earthquakeLayer,
    jaenBoundaryLayer,
  };
}
