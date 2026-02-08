import {
  borderRadius,
  darkTheme,
  fontSize,
  lightTheme,
  spacing,
  type ThemeType,
} from "@/constants/theme";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useColorScheme as useDeviceColorScheme } from "react-native";

const THEME_STORAGE_KEY = "app-theme-preference";

interface ThemeContextType {
  theme: ThemeType;
  isDark: boolean;
  isDarkMode: boolean;
  toggleTheme: () => void;
  borderRadius: typeof borderRadius;
  fontSize: typeof fontSize;
  spacing: typeof spacing;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const deviceColorScheme = useDeviceColorScheme();
  const [overrideTheme, setOverrideTheme] = useState<"light" | "dark" | null>(
    null,
  );
  const [isLoaded, setIsLoaded] = useState(false);

  // Load persisted theme preference on mount
  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((stored) => {
        if (stored === "light" || stored === "dark") {
          setOverrideTheme(stored);
        }
        setIsLoaded(true);
      })
      .catch(() => {
        setIsLoaded(true);
      });
  }, []);

  const isDark =
    overrideTheme !== null
      ? overrideTheme === "dark"
      : deviceColorScheme === "dark";

  const toggleTheme = () => {
    setOverrideTheme((prev) => {
      let newTheme: "light" | "dark";
      if (prev === null) {
        // If following system, switch to opposite of current
        newTheme = isDark ? "light" : "dark";
      } else {
        // If already overridden, toggle
        newTheme = prev === "dark" ? "light" : "dark";
      }
      // Persist the new theme preference
      AsyncStorage.setItem(THEME_STORAGE_KEY, newTheme).catch(console.error);
      return newTheme;
    });
  };

  const value = useMemo(
    () => ({
      theme: isDark ? darkTheme : lightTheme,
      isDark,
      isDarkMode: isDark,
      toggleTheme,
      borderRadius,
      fontSize,
      spacing,
    }),
    [isDark],
  );

  // Prevent flash by not rendering until theme is loaded
  if (!isLoaded) {
    return null;
  }

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

// Hook that returns theme colors for use in styles
export function useThemeColors() {
  const { theme } = useTheme();
  return theme;
}
