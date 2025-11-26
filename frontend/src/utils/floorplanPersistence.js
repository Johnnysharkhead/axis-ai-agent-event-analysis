import { useState } from 'react';

const SELECTED_ID_KEY = "axisSelectedFloorplan";
const FLOORPLAN_LIST_KEY = "axisFloorplanList";
const CACHE_DURATION = 900000;

function getStoredId() {
  try {
    const raw = localStorage.getItem(SELECTED_ID_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      return data.id;
    }
  } catch (err) {
    console.warn("Failed to retrieve floorplan selection:", err);
  }
  return null;
}

function saveStoredId(id) {
  try {
    localStorage.setItem(SELECTED_ID_KEY, JSON.stringify({ id }));
  } catch (err) {
    console.warn("Failed to save floorplan selection:", err);
  }
}

function getCachedFloorplans() {
  try {
    const raw = localStorage.getItem(FLOORPLAN_LIST_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      const age = Date.now() - data.timestamp;
      if (age < CACHE_DURATION) {
        return data.floorplans;
      }
    }
  } catch (err) {
    console.warn("Failed to retrieve cached floorplans:", err);
  }
  return null;
}

function cacheFloorplans(floorplans) {
  try {
    localStorage.setItem(FLOORPLAN_LIST_KEY, JSON.stringify({
      floorplans,
      timestamp: Date.now()
    }));
  } catch (err) {
    console.warn("Failed to cache floorplans:", err);
  }
}

export function usePersistedFloorplan() {
  const [selectedId, setSelectedId] = useState(() => getStoredId());

  const selectFloorplan = (id) => {
    const numId = id ? Number(id) : null;
    setSelectedId(numId);
    if (numId) {
      saveStoredId(numId);
    }
  };

  return [selectedId, selectFloorplan];
}

export function invalidateFloorplanCache() {
  try {
    localStorage.removeItem(FLOORPLAN_LIST_KEY);
  } catch (err) {
    console.warn("Failed to invalidate floorplan cache:", err);
  }
}

export { getCachedFloorplans, cacheFloorplans };
