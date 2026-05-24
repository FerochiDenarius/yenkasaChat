import { useEffect, useState } from "react";
import { fetchYmeInspectorOverview } from "./ymeApi";

export function useYmeInspector({ userId = "", query = "", limit = 30, refreshSignal = 0 } = {}) {
  const [state, setState] = useState({
    loading: true,
    error: "",
    data: null,
  });

  useEffect(() => {
    let active = true;

    setState((current) => ({
      ...current,
      loading: true,
      error: "",
    }));

    fetchYmeInspectorOverview({ userId, query, limit })
      .then((payload) => {
        if (!active) return;
        setState({
          loading: false,
          error: "",
          data: payload,
        });
      })
      .catch((error) => {
        if (!active) return;
        setState({
          loading: false,
          error: error.message || "Failed to load YME inspector data.",
          data: null,
        });
      });

    return () => {
      active = false;
    };
  }, [limit, query, refreshSignal, userId]);

  return {
    ...state,
    refresh: () => {
      setState((current) => ({ ...current, loading: true }));
    },
  };
}
