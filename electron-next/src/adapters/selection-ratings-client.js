// Reads the live configuration already decoded by XC.loadConfig_w; never downloads or selects.
module.exports = function createSelectionRatingsClient({ getLaya, getEngine, getGrades, getLoadState = () => null }) {
  const names = ['SelectGeneralWindow', 'SelectNewPaiWeiGeneralWindow', 'SelectGeneralHappyWindow',
    'SelectGeneralHappyNewWindow', 'SelectGeneralDdz2023Win', 'SelectGeneralNongMinWindow',
    'SelectDiZhuGeneralWindow', 'SelectCountryWarGeneralWindow'];
  let source = null, sourceLength = -1, grades = new Map();
  function index() {
    const next = getGrades();
    const length = Array.isArray(next) ? next.length : -1;
    if (next !== source || length !== sourceLength) {
      source = next; sourceLength = length; grades = new Map();
      for (const row of Array.isArray(next) ? next : []) {
        if (!(Number(row?.id) > 0)) continue;
        grades.set(Number(row.id), {
          values: Array.from({ length: 9 }, (_, n) => Number(row['Grade_' + (n + 1)])),
          present: Array.from({ length: 9 }, (_, n) => Object.prototype.hasOwnProperty.call(row, 'Grade_' + (n + 1))),
        });
      }
    }
    return grades;
  }
  function manager() { return getLaya()?.class?.('WindowManager'); }
  function usable(game) {
    if (!game || !['object', 'function'].includes(typeof game)) return false;
    return (typeof game.GetModeType === 'function' && typeof game.GetGroupID === 'function') ||
      typeof game.IsFigureMode === 'boolean' || typeof game.IsDouDuZhu2023 === 'boolean';
  }
  function context(win) {
    // Validate each realm independently. The facade's first truthy candidate can be the wrong object.
    try {
      const game = getLaya()?.class?.('GameContext');
      if (usable(game)) return { game, source: 'facade', nativeAvailable: true };
    } catch (_) {}
    try {
      const game = getEngine()?.Browser?.window?.GameContext;
      if (usable(game)) return { game, source: 'engine-export', nativeAvailable: true };
    } catch (_) {}
    if (!win || win.destroyed) return { game: null, source: 'none', nativeAvailable: false };
    const name = win.name;
    // qCs.InitUI creates figurePart only for identity rules; this also distinguishes 主公杀
    // from 斗地主2023, which share the same registered selection window.
    const identity = !!win.figurePart && !win.figurePart.destroyed &&
      ['SelectGeneralWindow', 'SelectGeneralDdz2023Win'].includes(name);
    const ddz = !identity && ['SelectGeneralDdz2023Win', 'SelectGeneralNongMinWindow', 'SelectDiZhuGeneralWindow'].includes(name);
    const countryWar = name === 'SelectCountryWarGeneralWindow';
    if (!identity && !ddz && !countryWar) return { game: null, source: 'none', nativeAvailable: false };
    const self = win.manager?.SelfSeat, windowRole = Number(win.selfFigure) || 0;
    const role = windowRole || Number(self?.Figure) || 0;
    return { source: 'selection-window', nativeAvailable: false, roleSource: windowRole ? 'window.selfFigure' : 'manager.SelfSeat.Figure',
      game: { SelfFigure: role, SelfSeat: self, Seats: win.manager?.Seats || [],
        IsFigureMode: identity, IsDouDuZhu2023: ddz, IsCountryWar: countryWar,
        IsViewer: self?.IsSelf === false } };
  }
  function dimension(game) {
    if (!game || game.IsViewer || game.IsMatchOB || game.IsViewerOrReplay?.()) return { key: 0, reason: 'no-self-scene' };
    const role = Number(game.SelfFigure || game.SelfSeat?.Figure || 0);
    if (game.IsPokerDDZ) return { key: 0, reason: 'unsupported-mode' };
    if (game.IsDouDuZhu2023 || game.IsDouDiZhu)
      return { key: role === 1 ? 8 : role === 3 ? 9 : 0, reason: 'ddz-role-' + role };
    if (game.IsCountryWar) return { key: 7, reason: 'country-war' };
    if (game.IsPaiwei || game.IsHappy) {
      const self = game.SelfSeat, seats = game.Seats;
      const ready = Number(self?.FixedViewId) > 0 && Array.isArray(seats) && seats.some(seat =>
        seat && seat !== self && Number(seat.FixedViewId) > 0 &&
        seat.FixedViewId !== self.FixedViewId && seat.IsLegalOperable);
      return ready && typeof game.FirstHand === 'boolean'
        ? { key: game.FirstHand ? 1 : 2, reason: game.FirstHand ? 'first-hand' : 'second-hand' }
        : { key: 0, reason: 'seat-order-pending' };
    }
    if (game.IsFigureMode)
      return { key: role >= 1 && role <= 4 ? role + 2 : 0, reason: 'figure-' + role };
    return { key: 0, reason: 'unsupported-mode' };
  }
  function read(win) {
    const table = index(), resolved = context(win), mode = dimension(resolved.game);
    // Team-mate previews and the separate lord portrait do not use the self player's rating.
    const own = new Set(win.generalUis || []);
    const peers = new Set(win.teamMateGeneralItems || []);
    const cards = Array.from(own).filter(card => card && !card.destroyed && card.parent &&
      card.visible !== false && !card.IsOtherSeat && !card.TeamMateCard && !card.teamMateCard &&
      !peers.has(card) && Number(card.Card?.CardId || card.CardID) > 0);
    const entries = cards.map(card => {
      const id = Number(card.Card?.CardId || card.CardID), row = table.get(id);
      const raw = mode.key && row ? row.values[mode.key - 1] : 0;
      const value = Number.isFinite(raw) && raw > 0 && raw <= 10 ? Math.ceil(raw) : 0;
      const reason = sourceLength < 0 ? 'source-missing' : !sourceLength ? 'source-empty' : !mode.key ? mode.reason :
        !row ? 'general-missing' : !row.present[mode.key - 1] ? 'grade-field-missing' : raw === 0 ? 'grade-zero' : !value ? 'grade-invalid' : 'ok';
      return { card, id, value, raw: Number.isFinite(raw) ? raw : null, reason };
    });
    return { entries, dimension: mode.key, reason: mode.reason, contextSource: resolved.source,
      rows: table.size, ready: sourceLength >= 0 };
  }
  function loadState() {
    const state = getLoadState();
    if (!state) return { phase: 'unreported' };
    // Only configuration progress and field names; never include a config/response/account dump.
    return { phase: state.phase, loadID: state.loadID, characterHasGrades: state.characterHasGrades,
      characterRows: state.characterRows, exportedRows: state.exportedRows, failedAt: state.failedAt,
      error: String(state.error || '').slice(0, 240), characterKeys: state.characterKeys?.slice(0, 16),
      ratingKeys: state.ratingKeys?.slice(0, 14) };
  }
  function diagnose(win) {
    const frame = win ? read(win) : (index(), { entries: [], dimension: 0, reason: 'no-selection-window' });
    const resolved = context(win), game = resolved.game, state = loadState();
    function scalar(object, key) {
      try { const value = object?.[key]; return value == null ? null : ['number', 'boolean', 'string'].includes(typeof value) ? value : typeof value; }
      catch (e) { return 'read-error:' + String(e.message).slice(0, 80); }
    }
    function call(name) { try { return typeof game?.[name] === 'function' ? game[name]() : null; } catch (_) { return null; } }
    return { source: { type: Array.isArray(source) ? 'array' : typeof source, rows: sourceLength,
        indexedRows: grades.size, sampleIDs: Array.from(grades.keys()).slice(0, 4),
        firstRowKeys: source?.[0] && typeof source[0] === 'object' ? Object.keys(source[0]).slice(0, 14) : [], load: state },
      game: { present: !!game, type: typeof game, contextSource: resolved.source, nativeAvailable: resolved.nativeAvailable,
        roleSource: resolved.roleSource || 'native.SelfFigure', hasIdentityPanel: !!win?.figurePart,
        modeID: call('GetModeType'), groupID: call('GetGroupID'), rule: call('GetRuleType'),
        selfFigure: scalar(game, 'SelfFigure'), seatFigure: scalar(game?.SelfSeat, 'Figure'), windowFigure: scalar(win, 'selfFigure'),
        figureMode: scalar(game, 'IsFigureMode'), ddz: scalar(game, 'IsDouDiZhu'), ddz2023: scalar(game, 'IsDouDuZhu2023'),
        poker: scalar(game, 'IsPokerDDZ'), countryWar: scalar(game, 'IsCountryWar'), paiwei: scalar(game, 'IsPaiwei'),
        happy: scalar(game, 'IsHappy'), viewer: scalar(game, 'IsViewer'), matchOB: scalar(game, 'IsMatchOB') },
      dimension: frame.dimension, reason: frame.reason,
      cards: frame.entries.slice(0, 12).map(entry => ({ id: entry.id, score: entry.value, raw: entry.raw, reason: entry.reason,
        grades: grades.get(entry.id)?.values.map(n => Number.isFinite(n) ? n : null) || null })) };
  }
  function createLabel() {
    const Engine = getEngine();
    if (typeof Engine?.Text !== 'function') return null;
    const text = new Engine.Text();
    text.name = 'xcSelectionRating'; text.font = 'Microsoft YaHei'; text.fontSize = 12;
    text.color = '#FFE1A0'; text.stroke = 2; text.strokeColor = '#17100A';
    text.bold = true; text.align = 'center'; text.valign = 'middle'; text.height = 16;
    text.mouseEnabled = false; text.mouseThrough = true; text.zOrder = 10000;
    return text;
  }
  function existing() {
    const m = manager();
    return names.map(name => ({ name, win: m?.GetWindowData?.(name) || m?.WindowInstanceDict?.get?.(name) }))
      .filter(entry => entry.win && !entry.win.destroyed);
  }
  return Object.freeze({ names: names.slice(), manager, read, existing, createLabel, loadState, diagnose });
};
