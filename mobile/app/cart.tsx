import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useCart } from "../src/hooks/useCart";
import {
  clampQuantity,
  formatPrice,
  formatPriceWhole,
  FREE_SHIPPING_THRESHOLD_AMOUNT,
  MAX_QUANTITY,
} from "../src/shared";
import { absoluteImageUrl, useTheme } from "../src/theme";

const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL;

/**
 * The cart, as the website holds it.
 *
 * Every line here came from the server and is priced from the live catalog, so a
 * price change reaches this screen rather than sitting stale in a stored total.
 * Changes reconcile back to the server and arrive from the website over Realtime,
 * so a quantity changed in a browser shows up here without a refresh.
 */
export default function CartScreen() {
  const router = useRouter();
  const theme = useTheme();
  const cart = useCart();

  if (!cart.ready) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.muted} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.page}
    >
      {cart.error ? (
        <Text accessibilityRole="alert" style={[styles.error, { color: theme.danger }]}>
          {cart.error}
        </Text>
      ) : null}

      {cart.lines.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: theme.foreground }]}>
            Your cart is empty
          </Text>
          <Text style={[styles.emptyBody, { color: theme.muted }]}>
            Add something from the collection and it will show up here — and on the
            website, on the same account.
          </Text>
          <Pressable
            onPress={() => router.replace("/")}
            accessibilityRole="button"
            style={[styles.browse, { backgroundColor: theme.foreground }]}
          >
            <Text style={[styles.browseText, { color: theme.background }]}>
              Shop all products
            </Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.lines}>
            {cart.lines.map((line) => (
              <CartRow
                key={line.productId}
                line={line}
                onSetQuantity={(quantity) => cart.setQuantity(line.productId, quantity)}
                onRemove={() => cart.removeItem(line.productId)}
              />
            ))}
          </View>

          <View style={[styles.summary, { borderColor: theme.border }]}>
            <SummaryRow label="Subtotal" value={formatPrice(cart.subtotalAmount)} />
            <SummaryRow
              label="Shipping"
              value={
                cart.shippingAmount === 0
                  ? "Free"
                  : formatPrice(cart.shippingAmount)
              }
            />
            <SummaryRow
              label="Total"
              value={formatPrice(cart.totalAmount)}
              emphasis
            />
            <Text style={[styles.shipNote, { color: theme.faint }]}>
              {cart.shippingAmount === 0
                ? "Shipping is free on this order."
                : `Free shipping on orders over ${formatPriceWhole(FREE_SHIPPING_THRESHOLD_AMOUNT)}.`}
            </Text>
          </View>

          {/*
            Checkout is deliberately absent. Paying stays on the website, where the
            Paystack hand-off, the signed webhook and the idempotent fulfillment all
            already are. Adding a second payment path to the app would mean two
            places where money moves.
          */}
          <Text style={[styles.checkoutNote, { color: theme.muted }]}>
            Ready to buy? Complete checkout on the website — your cart is already
            there, waiting for you.
          </Text>
        </>
      )}
    </ScrollView>
  );
}

function CartRow({
  line,
  onSetQuantity,
  onRemove,
}: {
  line: {
    productId: string;
    name: string;
    slug?: string;
    priceAmount: number;
    imageUrl: string | null;
    variantTitle?: string;
    quantity: number;
  };
  onSetQuantity: (quantity: number) => void;
  onRemove: () => void;
}) {
  const theme = useTheme();
  const image = absoluteImageUrl(line.imageUrl, SITE_URL);

  return (
    <View style={[styles.line, { borderColor: theme.border }]}>
      <View style={[styles.thumb, { backgroundColor: theme.placeholder }]}>
        {image ? <Image source={{ uri: image }} style={styles.thumbImage} resizeMode="cover" /> : null}
      </View>

      <View style={styles.lineBody}>
        <Text style={[styles.lineName, { color: theme.foreground }]} numberOfLines={2}>
          {line.name}
        </Text>
        {line.variantTitle ? (
          <Text style={[styles.lineVariant, { color: theme.muted }]}>{line.variantTitle}</Text>
        ) : null}
        <Text style={[styles.linePrice, { color: theme.foreground }]}>
          {formatPrice(line.priceAmount)}
        </Text>

        <View style={styles.lineControls}>
          <View style={[styles.stepper, { borderColor: theme.border }]}>
            <Pressable
              onPress={() => onSetQuantity(line.quantity - 1)}
              accessibilityRole="button"
              accessibilityLabel="Decrease quantity"
              style={styles.stepperButton}
            >
              <Text style={[styles.stepperGlyph, { color: theme.foreground }]}>−</Text>
            </Pressable>
            <Text style={[styles.lineQuantity, { color: theme.foreground }]}>
              {line.quantity}
            </Text>
            <Pressable
              onPress={() => onSetQuantity(clampQuantity(line.quantity + 1))}
              disabled={line.quantity >= MAX_QUANTITY}
              accessibilityRole="button"
              accessibilityLabel="Increase quantity"
              style={[
                styles.stepperButton,
                line.quantity >= MAX_QUANTITY ? styles.disabled : null,
              ]}
            >
              <Text style={[styles.stepperGlyph, { color: theme.foreground }]}>+</Text>
            </Pressable>
          </View>

          <Pressable
            onPress={onRemove}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${line.name}`}
            style={styles.remove}
          >
            <Text style={[styles.removeText, { color: theme.muted }]}>Remove</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function SummaryRow({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={styles.summaryRow}>
      <Text
        style={[
          styles.summaryLabel,
          { color: emphasis ? theme.foreground : theme.muted },
          emphasis ? styles.summaryStrong : null,
        ]}
      >
        {label}
      </Text>
      <Text
        style={[
          styles.summaryValue,
          { color: theme.foreground },
          emphasis ? styles.summaryStrong : null,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 48, gap: 14 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  error: { fontSize: 13 },
  empty: { gap: 10, paddingVertical: 40 },
  emptyTitle: { fontSize: 18, fontWeight: "600" },
  emptyBody: { fontSize: 14, lineHeight: 21 },
  browse: {
    height: 48,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    alignSelf: "flex-start",
    paddingHorizontal: 24,
  },
  browseText: { fontSize: 15, fontWeight: "700" },
  lines: { gap: 14 },
  line: { flexDirection: "row", gap: 12, borderBottomWidth: 1, paddingBottom: 14 },
  thumb: { width: 76, height: 76, borderRadius: 12, overflow: "hidden" },
  thumbImage: { width: "100%", height: "100%" },
  lineBody: { flex: 1, gap: 2 },
  lineName: { fontSize: 15, fontWeight: "600" },
  lineVariant: { fontSize: 12 },
  linePrice: { fontSize: 14, fontWeight: "600" },
  lineControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginTop: 8,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 999,
  },
  stepperButton: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  stepperGlyph: { fontSize: 18, fontWeight: "600", lineHeight: 22 },
  lineQuantity: {
    fontSize: 15,
    fontWeight: "600",
    minWidth: 24,
    textAlign: "center",
  },
  disabled: { opacity: 0.35 },
  remove: { paddingVertical: 8 },
  removeText: { fontSize: 13, textDecorationLine: "underline" },
  summary: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 10 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between" },
  summaryLabel: { fontSize: 14 },
  summaryValue: { fontSize: 14 },
  summaryStrong: { fontSize: 17, fontWeight: "700" },
  shipNote: { fontSize: 12 },
  checkoutNote: { fontSize: 13, lineHeight: 19 },
});