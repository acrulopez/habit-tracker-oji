/** @type {(config: any) => import('@bacons/apple-targets').Config} */
module.exports = (config) => ({
  type: "widget",
  // Must match IOS_WIDGET_KIND in src/config.ts and the Swift `kind`.
  name: "HabitsWidget",
  deploymentTarget: "17.0",
  // The widget must join the same App Group as the app so it can read the
  // snapshot the app writes into the shared UserDefaults suite. The plugin only
  // emits a widget entitlements file when `entitlements` is defined here (its
  // auto-sync path is skipped when this key is absent), so mirror the main app's
  // App Group explicitly. Single source of truth is app.config.ts.
  entitlements: {
    "com.apple.security.application-groups":
      config.ios?.entitlements?.["com.apple.security.application-groups"] ?? [
        `group.${config.ios?.bundleIdentifier}`,
      ],
  },
});
