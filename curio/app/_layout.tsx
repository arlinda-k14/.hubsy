import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../src/lib/auth";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="sign-in" options={{ presentation: "modal" }} />
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="onboarding/topics" options={{ presentation: "modal" }} />
            <Stack.Screen
              name="comments/[id]"
              options={{
                presentation: "transparentModal",
                animation: "slide_from_bottom",
                headerShown: false,
                contentStyle: { backgroundColor: "transparent" },
              }}
            />
          </Stack>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
