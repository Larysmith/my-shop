import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { fetchCatalog } from "../src/api/catalog";
import { useAuth } from "../src/hooks/useAuth";
import { useCart } from "../src/hooks/useCart";
import { formatPrice, queryCatalog, type Product, type SortKey } from "../src/shared";
import { absoluteImageUrl, useTheme } from "../src/theme";

const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL;

const SORTS: { label: string; value: SortKey }[] = [
  { label: "Featured", value: "featured" },
  { label: "Price ↑", value: "price-asc" },
  { label: "Price ↓", value: "price-desc" },
  { label: "A–Z", value: "name" },
];

/**
 * The catalog: search, category filter, sort, and a link into each product.
 *
 * Loaded once and filtered in memory, which is what the website's grid does too.
 * Typing in the search box must not cost a round trip — the catalog is eight
 * products now and is not going to be large enough for the server to matter.
 *
 * Categories come from the loaded data rather than a list in the source, so a new
 * category appears here without a code change.
 */
export default function CatalogScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { user, signOut } = useAuth();
  const cart = useCart();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState<SortKey>("featured");

  useEffect(() => {
    let active = true;

    fetchCatalog()
      .then((result) => {
        if (!active) return;
        setProducts(result);
        setLoadError(null);
      })
      .catch((problem: unknown) => {
        if (!active) return;
        setLoadError(
          problem instanceof Error ? problem.message : "Could not load the catalog.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const categories = [...new Set(products.map((product) => product.category))].sort();
  const visible = queryCatalog(products, { q: query, category, sort });

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.page}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: theme.foreground }]}>Lary Shop</Text>
          <Text style={[styles.subtitle, { color: theme.muted }]}>
            Modern essentials, made to last.
          </Text>
        </View>
        <Pressable
          onPress={() => router.push("/cart")}
          accessibilityRole="button"
          accessibilityLabel={`Cart, ${cart.itemCount} item${cart.itemCount === 1 ? "" : "s"}`}
          style={[styles.cartPill, { borderColor: theme.borderStrong }]}
        >
          <Text style={[styles.cartCount, { color: theme.foreground }]}>
            {cart.itemCount}
          </Text>
        </Pressable>
      </View>

      {user ? (
        <Text style={[styles.signedInAs, { color: theme.faint }]}>
          Signed in as {user.email}
        </Text>
      ) : null}

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search the collection"
        placeholderTextColor={theme.faint}
        accessibilityLabel="Search the collection"
        style={[
          styles.search,
          { color: theme.foreground, borderColor: theme.border, backgroundColor: theme.surface },
        ]}
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        {["all", ...categories].map((name) => {
          const selected = category === name;
          return (
            <Pressable
              key={name}
              onPress={() => setCategory(name)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={[
                styles.chip,
                {
                  backgroundColor: selected ? theme.foreground : "transparent",
                  borderColor: selected ? theme.foreground : theme.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: selected ? theme.background : theme.muted },
                ]}
              >
                {name === "all" ? "All" : name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.sorts}>
        {SORTS.map((option) => {
          const selected = sort === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => setSort(option.value)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <Text
                style={[
                  styles.sortText,
                  { color: selected ? theme.foreground : theme.faint },
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.muted} />
        </View>
      ) : loadError ? (
        <Text style={[styles.message, { color: theme.danger }]}>{loadError}</Text>
      ) : visible.length === 0 ? (
        <Text style={[styles.message, { color: theme.muted }]}>
          Nothing matches that search.
        </Text>
      ) : (
        <View style={styles.grid}>
          {visible.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onPress={() => router.push(`/product/${product.slug}`)}
            />
          ))}
        </View>
      )}

      <Pressable
        onPress={() => void signOut()}
        accessibilityRole="button"
        style={[styles.signOut, { borderColor: theme.border }]}
      >
        <Text style={[styles.signOutText, { color: theme.muted }]}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

function ProductCard({
  product,
  onPress,
}: {
  product: Product;
  onPress: () => void;
}) {
  const theme = useTheme();
  const image = absoluteImageUrl(product.imageUrl, SITE_URL);
  const soldOut = product.variants.every((variant) => variant.stock === 0);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={product.name}
      style={[styles.card, { borderColor: theme.border }]}
    >
      <View style={[styles.thumb, { backgroundColor: theme.placeholder }]}>
        {image ? (
          <Image source={{ uri: image }} style={styles.thumbImage} resizeMode="cover" />
        ) : null}
      </View>
      <View style={styles.cardBody}>
        <Text style={[styles.cardCategory, { color: theme.faint }]}>
          {product.category.toUpperCase()}
        </Text>
        <Text style={[styles.cardName, { color: theme.foreground }]} numberOfLines={2}>
          {product.name}
        </Text>
        <Text style={[styles.cardPrice, { color: theme.foreground }]}>
          {formatPrice(product.priceAmount)}
        </Text>
        {soldOut ? <Text style={[styles.cardSoldOut, { color: theme.danger }]}>Sold out</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 48, gap: 14 },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  headerText: { flex: 1, gap: 2 },
  title: { fontSize: 26, fontWeight: "600" },
  subtitle: { fontSize: 13 },
  cartPill: {
    minWidth: 44,
    height: 40,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  cartCount: { fontSize: 15, fontWeight: "600" },
  signedInAs: { fontSize: 12 },
  search: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  chips: { gap: 8, paddingVertical: 2 },
  chip: {
    paddingHorizontal: 16,
    height: 36,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  chipText: { fontSize: 13, fontWeight: "500" },
  sorts: { flexDirection: "row", justifyContent: "space-between" },
  sortText: { fontSize: 12, fontWeight: "500" },
  grid: { gap: 14 },
  card: { borderWidth: 1, borderRadius: 18, overflow: "hidden" },
  thumb: { width: "100%", aspectRatio: 1 },
  thumbImage: { width: "100%", height: "100%" },
  cardBody: { padding: 14, gap: 3 },
  cardCategory: { fontSize: 10, fontWeight: "600", letterSpacing: 1.2 },
  cardName: { fontSize: 15, fontWeight: "600" },
  cardPrice: { fontSize: 15, fontWeight: "600" },
  cardSoldOut: { fontSize: 12 },
  center: { paddingVertical: 48, alignItems: "center" },
  message: { fontSize: 14, paddingVertical: 24, textAlign: "center" },
  signOut: {
    marginTop: 12,
    height: 44,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  signOutText: { fontSize: 14, fontWeight: "600" },
});