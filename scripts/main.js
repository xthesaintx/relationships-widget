import { createRelationshipsWidget } from "./widgets/RelationshipsWidget.js";

Hooks.once("ready", async function () {
  const ccApi = game.modules.get('campaign-codex')?.api;
  if (!ccApi) {
    console.error("Relationships Widget | Campaign Codex API not found!");
    return;
  }

  const { CampaignCodexWidget, widgetManager } = ccApi;
  const RelationshipsWidget = createRelationshipsWidget(CampaignCodexWidget);

  widgetManager.registerWidget("relationships", RelationshipsWidget);

  console.log("Relationships Widget | Registered with Campaign Codex.");
});
