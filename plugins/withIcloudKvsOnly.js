const { withEntitlementsPlist } = require("@expo/config-plugins");

// @nauverse/expo-cloud-settings injects icloud-services:[CloudKit] and an empty
// icloud-container-identifiers array alongside the ubiquity-kvstore-identifier it actually
// needs. The backup feature only uses NSUbiquitousKeyValueStore (no CloudKit, no container),
// so we strip the CloudKit keys. This matches the KVS-only design (HANDOFF.md) and lets the
// App ID provision with just the iCloud/Key-value-storage capability. Must run after
// @nauverse/expo-cloud-settings in the plugins array so it can delete what that plugin added.
module.exports = function withIcloudKvsOnly(config) {
  return withEntitlementsPlist(config, (cfg) => {
    delete cfg.modResults["com.apple.developer.icloud-services"];
    delete cfg.modResults["com.apple.developer.icloud-container-identifiers"];
    return cfg;
  });
};
