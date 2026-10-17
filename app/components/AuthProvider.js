"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "@/lib/client";

const AuthContext = createContext({ me: null, loading: true, aiEnabled: false, voiceEnabled: false, refresh: () => {} });

export function AuthProvider({ children }) {
  const [state, setState] = useState({ me: null, loading: true, aiEnabled: false, voiceEnabled: false, error: "" });
  const refresh = useCallback(async () => {
    try {
      const data = await api("/api/auth/me");
      setState({ me: data.user, loading: false, aiEnabled: data.aiEnabled, voiceEnabled: Boolean(data.voiceEnabled), error: "" });
    } catch (err) {
      setState({ me: null, loading: false, aiEnabled: false, voiceEnabled: false, error: err.message });
    }
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);
  return <AuthContext.Provider value={{ ...state, refresh }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
