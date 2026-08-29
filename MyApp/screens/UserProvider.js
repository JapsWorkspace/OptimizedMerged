// screens/UserProvider.js

import { useState, useEffect, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { UserContext } from "./UserContext";
import api from "../lib/api";

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // ✅ CRITICAL: prevent re-initialization loops
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const loadUser = async () => {
      try {
        const storedUser = await AsyncStorage.getItem("user");

        if (!storedUser) {
          setUser(null);
          return;
        }

        const parsedUser = JSON.parse(storedUser);

        if (!parsedUser?._id) {
          await AsyncStorage.removeItem("user");
          setUser(null);
          return;
        }

        setUser(parsedUser);
        setLoading(false);

        api
          .get(`/user/${parsedUser._id}`)
          .then(async (res) => {
            const refreshedUser = res?.data;
            if (!refreshedUser?._id) return;
            if (JSON.stringify(refreshedUser) === JSON.stringify(parsedUser)) return;
            setUser(refreshedUser);
            await AsyncStorage.setItem("user", JSON.stringify(refreshedUser));
          })
          .catch(async (err) => {
            if ([404, 410].includes(err?.response?.status)) {
              await AsyncStorage.removeItem("user");
              setUser(null);
              return;
            }
            if (__DEV__) console.log("[startup] background user refresh failed:", err?.message);
          });

        return;

        // ✅ only update state if user actually changed
      } catch (err) {
        console.error("Failed to refresh user:", err);
        await AsyncStorage.removeItem("user");
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, []);

  const updateUser = async (data, options = {}) => {
    const persist = options.persist !== false;

    if (data) {
      setUser(data);
      if (persist) {
        await AsyncStorage.setItem("user", JSON.stringify(data));
      } else {
        await AsyncStorage.removeItem("user");
      }
    } else {
      setUser(null);
      await AsyncStorage.removeItem("user");
    }
  };

  if (loading) return null; // splash

  return (
    <UserContext.Provider value={{ user, setUser: updateUser }}>
      {children}
    </UserContext.Provider>
  );
};
