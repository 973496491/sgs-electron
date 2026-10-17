// The owner injects its real, closure-local laya. Never resolve a page-global alias.
module.exports = function createHandCardsClient({ getLaya, isEnabled }) {
  function getScene() { return getLaya()?.gamescene || null; }
  function getContainer(scene = getScene()) {
    if (!scene) return null;
    return scene.SelfSeatUi?.cardContainer || getLaya().find(scene, "SelfSeatUi", "cardContainer");
  }
  function sort(mode = "CardNumber") {
    const key = { CardNumber: "CardNumber", CardFlower: "FlowerOnSeat" }[mode];
    const container = getContainer(), cards = container?.cardUis;
    if (!key || !Array.isArray(cards) || !cards.length ||
        typeof container.invalidateLayoutHandCard !== "function" ||
        cards.some(ui => !ui?.Card || ui.Card[key] == null || !Number.isFinite(Number(ui.Card[key])) ||
          typeof ui.clear !== "function" || typeof ui.Draw !== "function")) return false;
    cards.sort((a, b) => a.Card[key] - b.Card[key]);
    cards.forEach(ui => { ui.clear(false); ui.Draw(container); });
    container.invalidateLayoutHandCard();
    return true;
  }
  function getSelectionContext() {
    try {
      const scene = getScene(), container = getContainer(scene);
      let game;
      try { game = getLaya()?.class?.("GameContext"); } catch {}
      const context = container?.SelectContext || container?.selectCardContext;
      const selector = context?.CardSelector;
      if (!isEnabled() || !scene || game?.IsPokerDDZ ||
          (typeof game?.CanOperationInGame === "function" && !game.CanOperationInGame()) ||
          (container?.AreChoosingCard ?? container?.areChoosingCard) === false ||
          !Array.isArray(container?.cardUis) || !selector ||
          !Number.isFinite(selector.SelectCountMax) || !Number.isFinite(selector.SelectedCount)) return null;
      return { scene, container, context, selector };
    } catch { return null; }
  }
  return {
    getScene, getContainer, getSelectionContext, isEnabled, sort,
    isHandCard: ui => !!(ui?.Card?.IsInHand && !ui.Card.IsVirtualCard && typeof ui.CardUI_Click === "function"),
    click: ui => ui.CardUI_Click(),
  };
};
