"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { storageKey } from "@/config/storage";
import { sampleWorkspace } from "./sample";
import { fromJson, toJson, type Workspace } from "./workspace";

/*
 * The visitor's workspace, kept in this browser only (localStorage) and shared by the workspace, vesting and transfer pages.
 * A missing, blocked or unreadable store falls back to the sample company. Nothing is sent anywhere.
 */
const KEY = storageKey("workspace", "v1");
const listeners = new Set<() => void>();
let cache: { raw: string | null } | null = null;

function readRaw(): string | null {
  if (cache) return cache.raw;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    raw = null;
  }
  cache = { raw };
  return raw;
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    cache = null;
    fn();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", onStorage);
  };
}

export function useWorkspace() {
  const raw = useSyncExternalStore(subscribe, readRaw, () => null);
  const workspace = useMemo<Workspace>(() => {
    if (!raw) return sampleWorkspace();
    try {
      return fromJson(raw);
    } catch {
      return sampleWorkspace();
    }
  }, [raw]);
  const save = useCallback((next: Workspace | null) => {
    const text = next ? toJson(next) : null;
    try {
      if (text === null) window.localStorage.removeItem(KEY);
      else window.localStorage.setItem(KEY, text);
    } catch {
      // storage blocked: the change still applies for this page view
    }
    cache = { raw: text };
    for (const l of listeners) l();
  }, []);
  return { workspace, save, reset: () => save(null), stored: raw !== null };
}
