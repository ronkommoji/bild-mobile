import { useEffect } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppProvider, useApp } from '../context/AppContext';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { ActivityIndicator, View, StyleSheet } from 'react-native';

function RootLayoutNav() {
  const { session, authLoading } = useApp();
  const { colors, isDark } = useTheme();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (authLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)/tasks');
    }
  }, [session, authLoading, segments]);

  if (authLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Slot />
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <AppProvider>
          <RootLayoutNav />
        </AppProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
