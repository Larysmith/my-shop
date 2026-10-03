import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { fetchProduct } from "../../src/api/catalog";
import { useCart } from "../../src/hooks/useCart";
import { formatPrice, formatPriceWhole, FREE_SHIPPING_THRESHOLD_AMOUNT, type Product } from "../../src/shared";
import { absoluteImageUrl, useTheme } from "../../src/theme";

const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL;

/**
 * One product: photograph, variants, quantity, add to cart.
 *
 * The variant picker drives everything at once — the artwork tint, the price and
 * the SKU all move from the same selection. Splitting them would let the price on
 * screen disagree with the line that lands in the cart.
 */
export default function ProductScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const theme = useTheme();
  const cart = useCart();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (!slug) return;
    let active = true;

    fetchProduct(slug)
      .then((result) => {
        if (!active) return;
        setProduct(result ?? null);
        setSelectedId(result?.variants[0]?.id ?? null);
        setLoadError(result ? null : "That product is no longer available.");
      })
      .catch((problem: unknown) => {
        if (!active) return;
        setLoadError(problem instanceof Error ? problem.message : "Could not load this product.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [slug]);

  const selected =
    product?.variants.find((variant) => variant.id === selectedId) ?? product?.variants[0];

  const maxQuantity = selected ? Math.min(selected.stock, 10) : 1;
  const image = product ? absoluteImageUrl(product.imageUrl, SITE_URL) : null;

  function handleAdd() {
    if (!product || !selected) return;

    cart.addItem(
      {
        productId: product.id,
        slug: product.slug,
        name: product.name,
        priceAmount: selected.priceAmount,
        imageUrl: product.imageUrl,
        variantId: selected.id,
        variantTitle: selected.title,
        sku: selected.sku,
      },
      quantity,
    );

    router.push("/cart");
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.muted} />
      </View>
    );
  }

  if (loadError || !product || !selected) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={[styles.message, { color: theme.muted }]}>
          {loadError ?? "That product is no longer available."}
        </Text>
      </View>
    );
  }

  const soldOut = selected.stock === 0;

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.page}
    >
      <Stack.Screen options={{ title: product.name }} />

      <View style={[styles.hero, { backgroundColor: theme.placeholder }]}>
        {image ? <Image source={{ uri: image }} style={styles.heroImage} resizeMode="cover" /> : null}
      </View>

      <Text style={[styles.category, { color: theme.faint }]}>
        {product.category.toUpperCase()}
      </Text>
      <Text style={[styles.name, { color: theme.foreground }]}>{product.name}</Text>
      <Text style={[styles.price, { color: theme.foreground }]}>
        {formatPrice(selected.priceAmount)}
      </Text>
      <Text style={[styles.stock, { color: theme.muted }]}>
        {soldOut
          ? "Out of stock"
          : selected.stock <= 5
            ? `Only ${selected.stock} left`
            : "In stock"}{" "}
        · SKU {selected.sku}
      </Text>

      <Text style={[styles.body, { color: theme.muted }]}>{product.description}</Text>

      <View style={styles.field}>
        <Text style={[styles.label, { color: theme.foreground }]}>
          Option: <Text style={{ color: theme.muted }}>{selected.title}</Text>
        </Text>
        <View style={styles.variants}>
          {product.variants.map((variant) => {
            const isActive = variant.id === selected.id;
            const isOut = variant.stock === 0;
            return (
              <Pressable
                key={variant.id}
                onPress={() => {
                  setSelectedId(variant.id);
                  setQuantity(1);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive, disabled: isOut }}
                style={[
                  styles.variant,
                  {
                    borderColor: isActive ? theme.foreground : theme.border,
                    backgroundColor: isActive ? theme.foreground : "transparent",
                    opacity: isOut ? 0.45 : 1,
                  },
                ]}
              >
                <View
                  style={[
                    styles.swatch,
                    { backgroundColor: variant.swatch, opacity: isActive ? 1 : 0.9 },
                  ]}
                />
                <Text
                  style={[
                    styles.variantText,
                    { color: isActive ? theme.background : theme.muted },
                  ]}
                >
                  {variant.title}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.field}>
        <Text style={[styles.label, { color: theme.foreground }]}>Quantity</Text>
        <View style={styles.stepper}>
          <StepperButton
            label="−"
            onPress={() => setQuantity((value) => Math.max(1, value - 1))}
            disabled={quantity <= 1}
          />
          <Text style={[styles.quantity, { color: theme.foreground }]}>{quantity}</Text>
          <StepperButton
            label="+"
            onPress={() => setQuantity((value) => Math.min(maxQuantity, value + 1))}
            disabled={soldOut || quantity >= maxQuantity}
          />
        </View>
      </View>

      <Pressable
        onPress={handleAdd}
        disabled={soldOut}
        accessibilityRole="button"
        accessibilityLabel={soldOut ? "Sold out" : "Add to cart"}
        style={[
          styles.add,
          {
            backgroundColor: theme.foreground,
            opacity: soldOut ? 0.4 : 1,
          },
        ]}
      >
        <Text style={[styles.addText, { color: theme.background }]}>
          {soldOut ? "Sold out" : "Add to cart"}
        </Text>
      </Pressable>

      <View style={[styles.details, { borderTopColor: theme.border }]}>
        {product.details.map((detail) => (
          <Text key={detail} style={[styles.detailLine, { color: theme.muted }]}>
            · {detail}
          </Text>
        ))}
        <Text style={[styles.detailLine, { color: theme.muted }]}>
          · Free over {formatPriceWhole(FREE_SHIPPING_THRESHOLD_AMOUNT)}
        </Text>
      </View>
    </ScrollView>
  );
}

function StepperButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label === "+" ? "Increase quantity" : "Decrease quantity"}
      style={[styles.stepperButton, { borderColor: theme.border, opacity: disabled ? 0.4 : 1 }]}
    >
      <Text style={[styles.stepperGlyph, { color: theme.foreground }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 48, gap: 12 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  message: { fontSize: 14, textAlign: "center" },
  hero: { width: "100%", aspectRatio: 1, borderRadius: 18, overflow: "hidden" },
  heroImage: { width: "100%", height: "100%" },
  category: { fontSize: 10, fontWeight: "600", letterSpacing: 1.4, marginTop: 4 },
  name: { fontSize: 24, fontWeight: "600" },
  price: { fontSize: 19, fontWeight: "700" },
  stock: { fontSize: 12 },
  body: { fontSize: 15, lineHeight: 22, marginTop: 6 },
  field: { gap: 8, marginTop: 10 },
  label: { fontSize: 13, fontWeight: "600" },
  variants: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  variant: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    height: 40,
  },
  swatch: { width: 14, height: 14, borderRadius: 7 },
  variantText: { fontSize: 13, fontWeight: "500" },
  stepper: { flexDirection: "row", alignItems: "center", gap: 16 },
  stepperButton: {
    width: 44,
    height: 44,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperGlyph: { fontSize: 20, fontWeight: "600", lineHeight: 24 },
  quantity: { fontSize: 17, fontWeight: "600", minWidth: 28, textAlign: "center" },
  add: {
    height: 52,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  addText: { fontSize: 15, fontWeight: "700" },
  details: { borderTopWidth: 1, marginTop: 12, paddingTop: 14, gap: 6 },
  detailLine: { fontSize: 13, lineHeight: 19 },
});