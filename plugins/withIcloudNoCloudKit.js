const { withEntitlementsPlist } = require("@expo/config-plugins");

// @nauverse/expo-cloud-settings adds three entitlements: ubiquity-kvstore-identifier
// (the only one the backup feature needs), an empty icloud-container-identifiers array,
// and icloud-services:[CloudKit]. We keep icloud-container-identifiers because EAS uses
// that key to decide whether to enable the iCloud capability on the App ID (dropping it
// makes EAS log "Disabled: iCloud" and the ubiquity-kvstore entitlement then fails to
// provision). But we DELETE icloud-services: declaring CloudKit — with no real container —
// makes the App Store export inject an empty com.apple.developer.icloud-container-environment
// entitlement, which Apple rejects at upload ("value '' ... should be 'Production'"). The
// backup only uses NSUbiquitousKeyValueStore, so CloudKit is never used.
//
// Registered BEFORE @nauverse/expo-cloud-settings in app.config.ts on purpose: Expo runs
// entitlements mods LIFO (last-registered runs first), so registering this earlier makes its
// delete run AFTER @nauverse adds the keys.
module.exports = function withIcloudNoCloudKit(config) {
  return withEntitlementsPlist(config, (cfg) => {
    delete cfg.modResults["com.apple.developer.icloud-services"];
    return cfg;
  });
};
