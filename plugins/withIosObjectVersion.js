const { withXcodeProject } = require("@expo/config-plugins");

// Expo SDK 56's iOS template writes `objectVersion = 70`, but the generated project uses the
// Xcode-16 synchronized-folder format (PBXFileSystemSynchronizedRootGroup). CocoaPods'
// bundled xcodeproj gem (<=1.27.0, the latest) has no compatibility mapping for 70 — it
// knows 63 (Xcode 15.3) and 77 (Xcode 16.0) but nothing between — so `pod install` aborts
// while parsing the project. 77 is the correct value for that format and is supported by the
// gem, so we normalize it here on every prebuild (local and EAS). See
// .claude/plans/got-this-issue-can-stateless-stallman.md for the full diagnosis.
module.exports = function withIosObjectVersion(config) {
  return withXcodeProject(config, (cfg) => {
    const proj = cfg.modResults;
    const current = Number(proj.hash?.project?.objectVersion);
    if (!Number.isNaN(current) && current < 77) {
      proj.hash.project.objectVersion = 77;
    }
    return cfg;
  });
};
