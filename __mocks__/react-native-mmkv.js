// Automatic Jest mock for react-native-mmkv (its v4 native/Nitro bindings can't
// load in a Node test environment). Provides an in-memory implementation with
// the same surface the app uses.
function createMMKV() {
  const store = new Map();
  return {
    getString: (key) => store.get(key),
    set: (key, value) => {
      store.set(key, String(value));
    },
    remove: (key) => {
      const had = store.has(key);
      store.delete(key);
      return had;
    },
    contains: (key) => store.has(key),
    getAllKeys: () => Array.from(store.keys()),
    getNumber: () => undefined,
    getBoolean: () => undefined,
    getBuffer: () => undefined,
    clearAll: () => store.clear(),
  };
}

module.exports = {
  createMMKV,
  useMMKV: () => createMMKV(),
};
