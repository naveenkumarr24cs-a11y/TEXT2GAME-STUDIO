
import { useState, useCallback, useEffect, useRef, useLayoutEffect } from 'react';
import { UndoRedoState } from '../types';

/**
 * A custom hook for managing state with undo/redo capabilities.
 * It tracks changes to the `present` state and allows navigating through `past` and `future` states.
 *
 * @param initialState The initial state value.
 * @param maxHistory The maximum number of past states to keep. Defaults to 20.
 * @returns An array containing:
 *   - `state`: The current (present) state.
 *   - `setState`: A function to update the state, which also records a new history entry.
 *   - `undo`: A function to revert to the previous state.
 *   - `redo`: A function to re-apply a previously undone state.
 *   - `canUndo`: A boolean indicating if undo is possible.
 *   - `canRedo`: A boolean indicating if redo is possible.
 *   - `clearHistory`: A function to clear all past and future history.
 *   - `initializeState`: A function to set the state and clear history, for external loading.
 */
export function useUndoRedo<T>(initialState: T, maxHistory: number = 20) {
  const [state, setStateInternal] = useState<UndoRedoState<T>>({
    past: [],
    present: initialState,
    future: [],
  });

  const stateRef = useRef(state.present);
  // Keep stateRef up-to-date with the latest present state
  useLayoutEffect(() => {
    stateRef.current = state.present;
  }, [state.present]);

  // Set initial state without adding to past if it's identical
  const initializeState = useCallback((newState: T) => {
    setStateInternal(prevState => {
      // Only set if different from current present, to avoid empty first undo
      // Also, perform a deep comparison for objects
      if (JSON.stringify(prevState.present) === JSON.stringify(newState)) {
        return prevState;
      }
      return {
        past: [],
        present: newState,
        future: [],
      };
    });
  }, []);

  // Update function that adds to history
  const setState = useCallback(
    (newPresent: T | ((prev: T) => T), recordHistory = true) => {
      setStateInternal((prevState) => {
        const nextPresent = typeof newPresent === 'function'
          ? (newPresent as (prev: T) => T)(prevState.present)
          : newPresent;

        // Don't record history if the state hasn't actually changed,
        // or if explicitly told not to record history.
        if (!recordHistory || JSON.stringify(prevState.present) === JSON.stringify(nextPresent)) {
          return { ...prevState, present: nextPresent };
        }

        const newPast = [...prevState.past, prevState.present];
        // Trim history if it exceeds maxHistory
        if (newPast.length > maxHistory) {
          newPast.shift(); // Remove the oldest past state
        }

        return {
          past: newPast,
          present: nextPresent,
          future: [], // Clear future on new state
        };
      });
    },
    [maxHistory]
  );

  const undo = useCallback(() => {
    setStateInternal((prevState) => {
      if (prevState.past.length === 0) return prevState;

      const newPast = [...prevState.past];
      const newPresent = newPast.pop()!; // Guaranteed to exist by check above
      return {
        past: newPast,
        present: newPresent,
        future: [prevState.present, ...prevState.future],
      };
    });
  }, []);

  const redo = useCallback(() => {
    setStateInternal((prevState) => {
      if (prevState.future.length === 0) return prevState;

      const newFuture = [...prevState.future];
      const newPresent = newFuture.shift()!; // Guaranteed to exist by check above
      return {
        past: [...prevState.past, prevState.present],
        present: newPresent,
        future: newFuture,
      };
    });
  }, []);

  const clearHistory = useCallback(() => {
    setStateInternal(prevState => ({
      past: [],
      present: prevState.present,
      future: [],
    }));
  }, []);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) { // Ctrl for Windows/Linux, Cmd for macOS
        if (event.key === 'z' && !event.shiftKey) {
          event.preventDefault();
          undo();
        } else if (event.key === 'y' || (event.key === 'z' && event.shiftKey)) {
          event.preventDefault();
          redo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [undo, redo]);

  return [
    state.present,
    setState,
    undo,
    redo,
    state.past.length > 0, // canUndo
    state.future.length > 0, // canRedo
    clearHistory,
    initializeState // Expose initializer for external loading
  ] as const;
}