import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAuth } from "../src/hooks/useAuth";
import { useTheme } from "../src/theme";

/**
 * Email and password sign-in.
 *
 * The same form, and the same Supabase project, as the website — so one set of
 * credentials works in both places. That is the whole of the "same account"
 * requirement: both surfaces read one `auth.users` table.
 *
 * Google sign-in is not here. On a device it needs a stable redirect URI
 * registered in both Supabase and Google, which means a development build rather
 * than Expo Go, and it is out of scope for this version.
 */
export default function LoginScreen() {
  const theme = useTheme();
  const { signIn } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit() {
    if (pending) return;

    setPending(true);
    setError(null);

    const problem = await signIn(email, password);

    // On success the root layout swaps this screen out on its own, so there is no
    // navigation to do here.
    if (problem) {
      setError(problem);
      setPending(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[styles.page, { backgroundColor: theme.background }]}
    >
      <View style={styles.body}>
        <Text style={[styles.title, { color: theme.foreground }]}>Lary Shop</Text>
        <Text style={[styles.subtitle, { color: theme.muted }]}>
          Sign in with the account you use on the website. Your cart comes with you.
        </Text>

        <View style={styles.field}>
          <Text style={[styles.label, { color: theme.foreground }]}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={theme.faint}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            accessibilityLabel="Email"
            style={[input(theme), { color: theme.foreground }]}
          />
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: theme.foreground }]}>Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={theme.faint}
            secureTextEntry
            autoComplete="current-password"
            accessibilityLabel="Password"
            style={[input(theme), { color: theme.foreground }]}
          />
        </View>

        {error ? (
          <Text accessibilityRole="alert" style={[styles.error, { color: theme.danger }]}>
            {error}
          </Text>
        ) : null}

        <Pressable
          onPress={() => void handleSubmit()}
          disabled={pending}
          accessibilityRole="button"
          accessibilityLabel="Sign in"
          style={[styles.submit, { backgroundColor: theme.foreground, opacity: pending ? 0.6 : 1 }]}
        >
          {pending ? (
            <ActivityIndicator color={theme.background} />
          ) : (
            <Text style={[styles.submitText, { color: theme.background }]}>Sign in</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function input(theme: ReturnType<typeof useTheme>) {
  return {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    paddingHorizontal: 14,
    fontSize: 15,
    marginTop: 6,
  } as const;
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  body: { padding: 24, gap: 16, flexGrow: 1, justifyContent: "center" },
  title: { fontSize: 28, fontWeight: "600" },
  subtitle: { fontSize: 14, lineHeight: 20, marginBottom: 8 },
  field: { gap: 2 },
  label: { fontSize: 13, fontWeight: "600" },
  error: { fontSize: 13 },
  submit: {
    height: 48,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  submitText: { fontSize: 15, fontWeight: "700" },
});