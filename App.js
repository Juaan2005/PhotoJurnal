import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import * as Linking from "expo-linking";
import * as Location from "expo-location";
import { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const JOURNAL_KEY = "@photo_journal";

const formatDate = () =>
  new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const WEATHER_CODES = {
  0: { label: "Cerah", emoji: "☀️" },
  1: { label: "Sebagian Cerah", emoji: "🌤️" },
  2: { label: "Berawan", emoji: "⛅" },
  3: { label: "Mendung", emoji: "☁️" },
  45: { label: "Berkabut", emoji: "🌫️" },
  51: { label: "Gerimis", emoji: "🌦️" },
  61: { label: "Hujan Ringan", emoji: "🌧️" },
  63: { label: "Hujan Sedang", emoji: "🌧️" },
  65: { label: "Hujan Lebat", emoji: "🌧️" },
  80: { label: "Hujan Lokal", emoji: "🌦️" },
  95: { label: "Badai Petir", emoji: "⛈️" },
};

const getWeather = (code) =>
  WEATHER_CODES[code] || { label: "Tidak Diketahui", emoji: "🌡️" };

const MOODS = ["😊", "😢", "😡", "😴", "🤩", "😰"];

export default function App() {
  const [entries, setEntries] = useState([]);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [mood, setMood] = useState("😊");
  const [photo, setPhoto] = useState(null);
  const [location, setLocation] = useState(null);
  const [placeName, setPlaceName] = useState("");
  const [weather, setWeather] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [search, setSearch] = useState("");
  const [editId, setEditId] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const raw = await AsyncStorage.getItem(JOURNAL_KEY);
        if (raw) setEntries(JSON.parse(raw));
      } catch (err) {
        console.error("Gagal load:", err);
      }
    };
    load();
  }, []);

  const saveEntries = async (data) => {
    try {
      await AsyncStorage.setItem(JOURNAL_KEY, JSON.stringify(data));
    } catch (err) {
      console.error("Gagal simpan:", err);
    }
  };

  const resetForm = () => {
    setTitle("");
    setNote("");
    setMood("😊");
    setPhoto(null);
    setLocation(null);
    setPlaceName("");
    setWeather(null);
    setEditId(null);
    setShowForm(false);
  };

  // PICK PHOTO
  const handlePickPhoto = () => {
    Alert.alert("Pilih Foto", "Ambil dari mana?", [
      {
        text: "📷 Kamera",
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== "granted") {
            Alert.alert("Izin Ditolak", "Kamera tidak bisa diakses.", [
              { text: "Buka Pengaturan", onPress: () => Linking.openSettings() },
              { text: "Batal", style: "cancel" },
            ]);
            return;
          }
          const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.7,
          });
          if (!result.canceled) setPhoto(result.assets[0].uri);
        },
      },
      {
        text: "🖼️ Galeri",
        onPress: async () => {
          const { status } =
            await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== "granted") {
            Alert.alert("Izin Ditolak", "Galeri tidak bisa diakses.", [
              { text: "Buka Pengaturan", onPress: () => Linking.openSettings() },
              { text: "Batal", style: "cancel" },
            ]);
            return;
          }
          const result = await ImagePicker.launchImageLibraryAsync({
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.7,
          });
          if (!result.canceled) setPhoto(result.assets[0].uri);
        },
      },
      { text: "Batal", style: "cancel" },
    ]);
  };

  // GET LOCATION
  const handleGetLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Izin Ditolak", "Lokasi tidak bisa diakses.", [
        { text: "Buka Pengaturan", onPress: () => Linking.openSettings() },
        { text: "Batal", style: "cancel" },
      ]);
      return;
    }
    setLoadingLocation(true);
    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = loc.coords;
      setLocation({ latitude, longitude });

      const geo = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (geo.length > 0) {
        const g = geo[0];
        setPlaceName(`${g.subregion || g.city || ""}, ${g.region || ""}`);
      }

      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`
      );
      const data = await res.json();
      setWeather(data.current_weather);
    } catch {
      Alert.alert("Gagal", "Tidak bisa mengambil lokasi atau cuaca.");
    } finally {
      setLoadingLocation(false);
    }
  };

  const openMaps = (lat, lng) => {
    Linking.openURL(`https://www.google.com/maps?q=${lat},${lng}`);
  };

  // CREATE / UPDATE
  const handleSave = () => {
    if (!title.trim()) {
      Alert.alert("Oops!", "Judul tidak boleh kosong.");
      return;
    }

    let updated;
    if (editId) {
      updated = entries.map((e) =>
        e.id === editId
          ? { ...e, title: title.trim(), note: note.trim(), mood, photo, location, placeName, weather }
          : e
      );
    } else {
      const newEntry = {
        id: Date.now().toString(),
        title: title.trim(),
        note: note.trim(),
        mood,
        photo,
        location,
        placeName,
        weather,
        date: formatDate(),
      };
      updated = [newEntry, ...entries];
    }

    setEntries(updated);
    saveEntries(updated);
    resetForm();
  };

  // EDIT
  const handleEdit = (entry) => {
    setTitle(entry.title);
    setNote(entry.note || "");
    setMood(entry.mood || "😊");
    setPhoto(entry.photo || null);
    setLocation(entry.location || null);
    setPlaceName(entry.placeName || "");
    setWeather(entry.weather || null);
    setEditId(entry.id);
    setShowForm(true);
  };

  // DELETE
  const handleDelete = (id) => {
    Alert.alert("Hapus Entri?", "Entri ini akan dihapus permanen.", [
      { text: "Batal", style: "cancel" },
      {
        text: "Hapus",
        style: "destructive",
        onPress: () => {
          const updated = entries.filter((e) => e.id !== id);
          setEntries(updated);
          saveEntries(updated);
        },
      },
    ]);
  };

  const filtered = entries.filter(
    (e) =>
      e.title.toLowerCase().includes(search.toLowerCase()) ||
      (e.note && e.note.toLowerCase().includes(search.toLowerCase()))
  );

  const renderItem = ({ item }) => {
    const w = item.weather ? getWeather(item.weather.weathercode) : null;
    return (
      <View style={styles.card}>
        {item.photo && (
          <Image source={{ uri: item.photo }} style={styles.cardPhoto} />
        )}
        <View style={styles.cardBody}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardMood}>{item.mood || "😊"}</Text>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
            <TouchableOpacity onPress={() => handleEdit(item)} style={styles.iconBtn}>
              <Text style={styles.iconText}>✏️</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.iconBtn}>
              <Text style={styles.iconText}>🗑️</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.cardDate}>{item.date}</Text>
          {item.note ? (
            <Text style={styles.cardNote} numberOfLines={3}>{item.note}</Text>
          ) : null}
          {item.placeName || item.location ? (
            <TouchableOpacity
              style={styles.locationRow}
              onPress={() =>
                item.location &&
                openMaps(item.location.latitude, item.location.longitude)
              }
            >
              <Text style={styles.locationText} numberOfLines={1}>
                📍 {item.placeName || `${item.location?.latitude?.toFixed(4)}, ${item.location?.longitude?.toFixed(4)}`}
              </Text>
              {item.location && (
                <Text style={styles.mapsLink}>🗺️ Maps</Text>
              )}
            </TouchableOpacity>
          ) : null}
          {w && item.weather && (
            <Text style={styles.weatherText}>
              {w.emoji} {w.label} · {item.weather.temperature}°C
            </Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Photo Journal 📸</Text>
        <Text style={styles.headerSub}>{entries.length} kenangan tersimpan</Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
        >
          {/* Search */}
          <View style={styles.searchWrap}>
            <TextInput
              style={styles.searchInput}
              placeholder="Cari jurnal..."
              placeholderTextColor="#BBBBBB"
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch("")}>
                <Text style={styles.clearBtn}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Statistik */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{entries.length}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{filtered.length}</Text>
              <Text style={styles.statLabel}>Hasil Cari</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {entries.filter((e) => e.photo).length}
              </Text>
              <Text style={styles.statLabel}>Punya Foto</Text>
            </View>
          </View>

          {/* Tombol Tambah */}
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => {
              if (showForm && editId) resetForm();
              else setShowForm(!showForm);
            }}
          >
            <Text style={styles.addBtnText}>
              {showForm ? "✕ Tutup" : "+ Tambah Kenangan"}
            </Text>
          </TouchableOpacity>

          {/* Form */}
          {showForm && (
            <View style={styles.formCard}>
              <Text style={styles.formLabel}>JUDUL</Text>
              <TextInput
                style={styles.input}
                placeholder="Judul kenangan..."
                placeholderTextColor="#BBBBBB"
                value={title}
                onChangeText={setTitle}
              />

              <Text style={styles.formLabel}>CATATAN</Text>
              <TextInput
                style={[styles.input, styles.inputMulti]}
                placeholder="Ceritakan momenmu..."
                placeholderTextColor="#BBBBBB"
                value={note}
                onChangeText={setNote}
                multiline
                numberOfLines={3}
              />

              <Text style={styles.formLabel}>MOOD</Text>
              <View style={styles.moodRow}>
                {MOODS.map((m) => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.moodBtn, mood === m && styles.moodBtnActive]}
                    onPress={() => setMood(m)}
                  >
                    <Text style={styles.moodEmoji}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Foto */}
              <Text style={styles.formLabel}>FOTO</Text>
              <TouchableOpacity style={styles.photoBtn} onPress={handlePickPhoto}>
                {photo ? (
                  <Image source={{ uri: photo }} style={styles.photoPreview} />
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <Text style={styles.photoPlaceholderText}>📷 Tambah Foto</Text>
                    <Text style={styles.photoPlaceholderSub}>Tap untuk pilih dari Kamera atau Galeri</Text>
                  </View>
                )}
              </TouchableOpacity>
              {photo && (
                <TouchableOpacity
                  style={styles.removePhotoBtn}
                  onPress={() => setPhoto(null)}
                >
                  <Text style={styles.removePhotoBtnText}>✕ Hapus Foto</Text>
                </TouchableOpacity>
              )}

              {/* Lokasi + Cuaca */}
              <TouchableOpacity
                style={[
                  styles.locationBtn,
                  loadingLocation && styles.locationBtnLoading,
                  location && styles.locationBtnDone,
                ]}
                onPress={handleGetLocation}
                disabled={loadingLocation}
              >
                <Text style={styles.locationBtnText}>
                  {loadingLocation
                    ? "⏳ Mengambil lokasi..."
                    : location
                    ? "✓ Lokasi & Cuaca Didapat"
                    : "📍 Ambil Lokasi & Cuaca"}
                </Text>
              </TouchableOpacity>

              {location && (
                <View style={styles.locationPreview}>
                  <Text style={styles.locationPreviewText}>
                    📍 {placeName || `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`}
                  </Text>
                  {weather && (
                    <Text style={styles.locationPreviewText}>
                      {getWeather(weather.weathercode).emoji}{" "}
                      {getWeather(weather.weathercode).label} ·{" "}
                      {weather.temperature}°C
                    </Text>
                  )}
                </View>
              )}

              <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                <Text style={styles.saveBtnText}>
                  {editId ? "💾 Simpan Perubahan" : "💾 Simpan Kenangan"}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* List */}
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            scrollEnabled={false}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyEmoji}>📷</Text>
                <Text style={styles.emptyTitle}>
                  {search ? "Tidak ditemukan" : "Belum ada kenangan"}
                </Text>
                <Text style={styles.emptyHint}>
                  {search
                    ? "Coba kata kunci lain"
                    : "Tambah kenangan pertamamu!"}
                </Text>
              </View>
            }
          />

          {entries.length > 0 && (
            <TouchableOpacity
              style={styles.clearAllBtn}
              onPress={() =>
                Alert.alert("Hapus Semua?", "Semua entri akan dihapus.", [
                  { text: "Batal", style: "cancel" },
                  {
                    text: "Hapus",
                    style: "destructive",
                    onPress: async () => {
                      setEntries([]);
                      await AsyncStorage.removeItem(JOURNAL_KEY);
                    },
                  },
                ])
              }
            >
              <Text style={styles.clearAllBtnText}>🗑️ Hapus Semua Entri</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F5F5" },
  scrollContent: { padding: 16, paddingBottom: 40 },

  header: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE",
  },
  headerTitle: { fontSize: 24, fontWeight: "900", color: "#111111" },
  headerSub: { fontSize: 12, color: "#AAAAAA", marginTop: 2 },

  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: "#EEEEEE",
    marginBottom: 12,
  },
  searchInput: { flex: 1, fontSize: 14, color: "#111111" },
  clearBtn: { fontSize: 14, color: "#AAAAAA", paddingLeft: 8 },

  statsRow: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#EEEEEE",
    marginBottom: 12,
  },
  statItem: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 22, fontWeight: "900", color: "#6C63FF" },
  statLabel: { fontSize: 11, color: "#AAAAAA", marginTop: 2 },
  statDivider: { width: 1, backgroundColor: "#EEEEEE", marginHorizontal: 8 },

  addBtn: {
    backgroundColor: "#111111",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 12,
  },
  addBtnText: { color: "#FFFFFF", fontWeight: "800", fontSize: 15 },

  formCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 4,
  },
  formLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#AAAAAA",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    backgroundColor: "#F9F9F9",
    borderWidth: 1.5,
    borderColor: "#EEEEEE",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#111111",
    marginBottom: 4,
  },
  inputMulti: { height: 90, textAlignVertical: "top" },

  moodRow: { flexDirection: "row", gap: 8, marginBottom: 4 },
  moodBtn: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: "#F5F5F5",
    justifyContent: "center",
    alignItems: "center",
  },
  moodBtnActive: {
    backgroundColor: "#6C63FF22",
    borderWidth: 2,
    borderColor: "#6C63FF",
  },
  moodEmoji: { fontSize: 24 },

  photoBtn: { marginTop: 4, borderRadius: 14, overflow: "hidden", marginBottom: 8 },
  photoPreview: { width: "100%", height: 180, borderRadius: 14 },
  photoPlaceholder: {
    backgroundColor: "#F5F5F5",
    height: 120,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#EEEEEE",
    borderStyle: "dashed",
  },
  photoPlaceholderText: { fontSize: 16, fontWeight: "700", color: "#888888" },
  photoPlaceholderSub: { fontSize: 11, color: "#AAAAAA", marginTop: 4 },
  removePhotoBtn: { alignItems: "center", marginBottom: 8 },
  removePhotoBtnText: { color: "#EF5350", fontSize: 12, fontWeight: "700" },

  locationBtn: {
    backgroundColor: "#E8F5E9",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
    marginBottom: 8,
  },
  locationBtnLoading: { backgroundColor: "#F5F5F5" },
  locationBtnDone: { backgroundColor: "#C8E6C9" },
  locationBtnText: { color: "#2E7D32", fontWeight: "700", fontSize: 14 },
  locationPreview: {
    backgroundColor: "#F5F5F5",
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    gap: 4,
  },
  locationPreviewText: { fontSize: 12, color: "#555555", fontWeight: "600" },

  saveBtn: {
    backgroundColor: "#111111",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
  },
  saveBtnText: { color: "#FFFFFF", fontWeight: "800", fontSize: 15 },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    marginBottom: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardPhoto: { width: "100%", height: 180 },
  cardBody: { padding: 14 },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
    gap: 6,
  },
  cardMood: { fontSize: 22 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#111111", flex: 1 },
  iconBtn: { padding: 4 },
  iconText: { fontSize: 16 },
  cardDate: { fontSize: 11, color: "#AAAAAA", marginBottom: 6 },
  cardNote: { fontSize: 13, color: "#555555", lineHeight: 20, marginBottom: 8 },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
    padding: 8,
    marginBottom: 6,
  },
  locationText: { fontSize: 12, color: "#555555", flex: 1 },
  mapsLink: { fontSize: 12, color: "#1976D2", fontWeight: "700" },
  weatherText: { fontSize: 12, color: "#2E7D32", fontWeight: "600" },

  emptyWrap: { alignItems: "center", paddingTop: 48 },
  emptyEmoji: { fontSize: 52, marginBottom: 14 },
  emptyTitle: { fontSize: 17, fontWeight: "800", color: "#111111", marginBottom: 6 },
  emptyHint: { fontSize: 13, color: "#AAAAAA" },

  clearAllBtn: {
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#EF5350",
  },
  clearAllBtnText: { color: "#EF5350", fontWeight: "700", fontSize: 13 },
});