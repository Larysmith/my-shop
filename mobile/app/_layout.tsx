import { Redirect, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../src/hooks/useAuth";
import { useTheme } from "../src/theme";

/**
 * Root layout and session gate.
 *
 * No provider tree here beyond what expo-router installs: the catalog screens fetch
 * on their own, and the cart hook owns its own synchronisation. With four screens a
 * shared data provider would be more indirection than it is worth.
 *
 * The gate sends anyone without a session to /login, and waits for the stored
 * session to be read first. Redirecting on the initial null would throw away a
 * signed-in shopper's session on every cold start, because reading it is async.
 */
export default function RootLayout() {
  const { user, loading, configError } = useAuth();
  const theme = useTheme();
  const isDark = theme.background === "#0b0b0c";

  if (loading) {
    return <View style={{ flex: 1, backgroundColor: theme.background }} />;
  }

  if (configError) {
    return <ConfigNotice message={configError} />;
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: theme.background },
        }}
      >
        <Stack.Screen name="index" options={{ title: "Lary Shop" }} />
        <Stack.Screen name="product/[slug]" options={{ title: "Product" }} />
        <Stack.Screen name="cart" options={{ title: "Your cart" }} />
        <Stack.Screen name="login" options={{ title: "Sign in" }} />
      </Stack>
    </>
  );
}

/**
 * Shown when the app has no Supabase URL or key.
 *
 * A blank screen would be indistinguishable from a broken build. This is a setup
 * problem with a known fix, so it names the variables rather than failing quietly.
 */
function ConfigNotice({ message }: { message: string }) {
  const theme = useTheme();

  return (
    <View style={[styles.notice, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.noticeBody}>
        <Text style={[styles.noticeTitle, { color: theme.foreground }]}>
          The app is not configured
        </Text>
        <Text style={[styles.noticeText, { color: theme.muted }]}>{message}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: { flex: 1 },
  noticeBody: { padding: 24, gap: 12, flexGrow: 1, justifyContent: "center" },
  noticeTitle: { fontSize: 20, fontWeight: "600" },
  noticeText: { fontSize: 14, lineHeight: 21 },
});