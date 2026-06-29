/** @type {(config: any) => import('@bacons/apple-targets').Config} */
module.exports = (config) => ({
  type: "widget",
  // Must match IOS_WIDGET_KIND in src/config.ts and the Swift `kind`.
  name: "HabitsWidget",
  deploymentTarget: "17.0",
  // App Groups are synced from the main app target automatically (the "widget"
  // target type sets appGroupsByDefault), giving the widget access to the same
  // UserDefaults suite the app writes the snapshot into.
});
