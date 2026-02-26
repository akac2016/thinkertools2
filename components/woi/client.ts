"use client";

import {
  isApiRequestError,
  apiFetch,
  parseArray,
  parseObject,
  parseString,
  setWoiAnonSessionId,
} from "@/components/quipx/client";
import { normalizeViewerJoinErrorMessage } from "@/lib/woi-lobby-rules";

export type WoiUser = {
  id: string;
  name: string;
  username?: string | null;
  color: string | null;
};

export type WoiTemplateSummary = {
  id: string;
  name: string;
  category: string | null;
  objective?: string;
  isPublic?: boolean;
  moves?: WoiTemplateMoveOption[];
  rules?: WoiTemplateRuleOption[];
};

export type WoiGameSummary = {
  id: string;
  question: string;
  description: string;
  status: string;
  isPublic: boolean;
  teamId: string;
  updatedAt: string;
  creator: WoiUser | null;
  currentPlayer: WoiUser | null;
  template: WoiTemplateSummary | null;
};

export type WoiLobbyGameSummary = {
  id: string;
  question: string;
  description: string;
  status: string;
  updatedAt: string;
  openHumanSeats: number;
  seatClaimsLocked: boolean;
  joinLinkEnabled: boolean;
  alreadyJoinedAsPlayer: boolean;
  creator: WoiUser | null;
  template: WoiTemplateSummary | null;
};

export type WoiSeatClaimResult = {
  gameId: string;
  slotId: string;
  alreadyClaimed: boolean;
  remainingOpenHumanSeats: number;
};

export type WoiViewerJoinResult = {
  gameId: string;
  anonSessionId: string | null;
  wasExistingSession: boolean;
};

export type WoiJoinByLinkResult = {
  gameId: string;
  joinedAs: "player" | "viewer";
  anonSessionId: string | null;
  alreadyClaimed: boolean | null;
};

export type WoiLevel = {
  index: number;
  name: string;
  objective: string;
};

export type WoiTurn = {
  id: string;
  content: string;
  levelIndex: number | null;
  player: WoiUser | null;
  moveLabel: string;
  ruleLabel: string;
  createdAt: string;
};

export type WoiGameDetail = WoiGameSummary & {
  turns: WoiTurn[];
  levels: WoiLevel[];
  players: WoiUser[];
};

export type WoiTemplateMoveOption = {
  id: string;
  label: string;
  orderIndex: number | null;
};

export type WoiTemplateRuleOption = {
  id: string;
  label: string;
  orderIndex: number | null;
};

export type WoiTeamSummary = {
  id: string;
  name: string;
};

export type WoiUserSearchResult = WoiUser & {
  email: string | null;
};

export type WoiHumanSeatInstructionInput =
  | {
      mode: "platform_user";
      invitedUserId: string;
    }
  | {
      mode: "email";
      invitedEmail: string;
    }
  | {
      mode: "open";
    };

export type WoiRosterPresetSlot = {
  mode: "platform_user" | "email" | "open";
  invitedUserId?: string;
  invitedEmail?: string;
  userName?: string;
  userEmail?: string | null;
};

export type WoiRosterPreset = {
  id: string;
  name: string;
  teamId: string | null;
  sourceGameId: string | null;
  createdAt: string;
  updatedAt: string;
  slots: WoiRosterPresetSlot[];
};

export type WoiCreateWithSlotsInput = {
  templateId: string;
  teamId?: string;
  question: string;
  description: string;
  isPublic: boolean;
  totalPlayerSlots: number;
  aiPlayerSlots: number;
  creatorRole: "player" | "viewer";
  humanSeats: WoiHumanSeatInstructionInput[];
  opponents?: WoiGeneratedOpponent[];
  presetId?: string;
  lobbyVisibility?: "hidden" | "listed";
  joinLinkEnabled?: boolean;
};

export type WoiCreateWithSlotsResult = {
  game: WoiGameSummary;
  status: string;
  slots: Array<{
    id: string;
    slotIndex: number;
    seatType: "human" | "ai";
    state: "open" | "invited" | "filled" | "released" | "locked";
    assignedUserId: string | null;
    aiProfile: Record<string, unknown> | null;
    invite: {
      id: string;
      channel: "platform_search" | "email" | "join_link";
      status: string;
      invitedUserId: string | null;
      invitedEmail: string | null;
    } | null;
  }>;
  inviteSummary: {
    total: number;
    pending: number;
  };
  viewerSummary: {
    activeCount: number;
  };
  joinLink: {
    enabled: boolean;
    id?: string;
    status?: "active" | "revoked" | "expired" | "unavailable";
    token?: string | null;
    shareUrl?: string | null;
  };
  presetId: string | null;
};

export type WoiStartLobbyGameResult = {
  game: WoiGameSummary;
  startedAt: string;
};

export type WoiGeneratedOpponent = {
  codename: string;
  narrative: string;
  intelligence: "novice" | "analytical" | "strategic" | "expert";
  difficulty: "easy" | "medium" | "hard" | "adaptive";
  imageUrl: string;
  appearance: {
    skinToneBucket: string | null;
    featureProfile: string | null;
    hairProfile: string | null;
  } | null;
};

export type WoiSubjectQuestion = {
  subject: string;
  question: string;
};

export type WoiTemplateCatalogEntry = {
  id: string;
  name: string;
  category: string | null;
  objective: string;
  isPublic: boolean;
};

export type PublicGameSummary = {
  id: string;
  question: string;
  description: string;
  updatedAt: string;
  templateName: string;
  creator: WoiUser | null;
};

export type PublicGamesResult = {
  query: string;
  games: PublicGameSummary[];
};

export type ContextComment = {
  id: string;
  body: string;
  createdAt: string;
  author: WoiUser | null;
};

export type WoiSpinnerTile = {
  id: string;
  label: string;
  imageUrl: string;
  orderIndex: number | null;
  levelIndex: number | null;
  objective: string | null;
};

export type WoiAiPlayer = {
  userId: string;
  displayName: string;
  baseName: string;
  isHuman: boolean;
  isCurrent: boolean;
  turnOffset: number | null;
  persona: string | null;
  narrative: string | null;
  imageUrl: string | null;
  intelligence: "novice" | "analytical" | "strategic" | "expert" | null;
  difficulty: "easy" | "medium" | "hard" | "adaptive" | null;
};

export type WoiGameAiPack = {
  topic: string;
  rules: string[];
  aiPlayers: WoiAiPlayer[];
  turnForecast: {
    turnsUntilHuman: number | null;
  };
  spinner: {
    levels: WoiSpinnerTile[];
    moves: WoiSpinnerTile[];
    rules: WoiSpinnerTile[];
  };
  generatedAt: string;
  imageSource: string;
  rosterSource: string;
  rosterModel: string;
};

function readValue(record: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (key in record) {
      return record[key];
    }
  }

  return undefined;
}

function readObject(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const found = parseObject(record[key]);
    if (found) {
      return found;
    }
  }

  return null;
}

function readArray(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (key in record) {
      const values = parseArray(record[key]);
      if (values.length > 0) {
        return values;
      }

      if (Array.isArray(record[key])) {
        return values;
      }
    }
  }

  return null as unknown[] | null;
}

function readStringValue(
  record: Record<string, unknown>,
  keys: string[],
  fallback = "",
): string {
  const raw = readValue(record, keys);
  if (typeof raw === "string") {
    return raw.trim() || fallback;
  }

  if (typeof raw === "number") {
    return String(raw);
  }

  return fallback;
}

function readNullableStringValue(record: Record<string, unknown>, keys: string[]) {
  const value = readStringValue(record, keys, "");
  return value ? value : null;
}

function readBooleanValue(
  record: Record<string, unknown>,
  keys: string[],
  fallback = false,
): boolean {
  const raw = readValue(record, keys);
  if (typeof raw === "boolean") {
    return raw;
  }

  if (typeof raw === "string") {
    if (raw === "true") {
      return true;
    }
    if (raw === "false") {
      return false;
    }
  }

  return fallback;
}

function readNumberValue(record: Record<string, unknown>, keys: string[]): number | null {
  const raw = readValue(record, keys);
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw;
  }

  if (typeof raw === "string") {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function normalizeUser(value: unknown): WoiUser | null {
  if (typeof value === "string" && value.trim()) {
    const id = value.trim();
    return { id, name: id, username: null, color: null };
  }

  const record = parseObject(value);
  if (!record) {
    return null;
  }

  const id = readStringValue(record, ["id", "user_id", "player_id", "author_id"]);
  if (!id) {
    return null;
  }

  const name =
    readStringValue(record, ["name", "username", "display_name"], "") || id;

  return {
    id,
    name,
    username: readNullableStringValue(record, ["username", "user_name"]),
    color: readNullableStringValue(record, ["color", "fontcolor"]),
  };
}

function normalizeTemplate(value: unknown): WoiTemplateSummary | null {
  const record = parseObject(value);
  if (!record) {
    return null;
  }

  const id = readStringValue(record, ["id", "template_id"]);
  if (!id) {
    return null;
  }

  return {
    id,
    name: readStringValue(record, ["name", "template_name"], "Untitled template"),
    category: readNullableStringValue(record, ["category"]),
    objective: readStringValue(record, ["objective"], ""),
    isPublic: readBooleanValue(record, ["is_public", "isPublic"], false),
  };
}

function normalizeTemplateMoveOption(value: unknown): WoiTemplateMoveOption | null {
  const record = parseObject(value);
  if (!record) {
    return null;
  }

  const id = readStringValue(record, ["id", "move_id"]);
  if (!id) {
    return null;
  }

  return {
    id,
    label: readStringValue(record, ["move_text", "label", "name"], "Untitled move"),
    orderIndex: readNumberValue(record, ["order_index", "orderIndex"]),
  };
}

function normalizeTemplateRuleOption(value: unknown): WoiTemplateRuleOption | null {
  const record = parseObject(value);
  if (!record) {
    return null;
  }

  const id = readStringValue(record, ["id", "rule_id"]);
  if (!id) {
    return null;
  }

  return {
    id,
    label: readStringValue(record, ["rule_text", "label", "name"], "Untitled rule"),
    orderIndex: readNumberValue(record, ["order_index", "orderIndex"]),
  };
}

function normalizeTeamSummary(value: unknown): WoiTeamSummary | null {
  const record = parseObject(value);
  if (!record) {
    return null;
  }

  const id = readStringValue(record, ["id", "team_id"]);
  if (!id) {
    return null;
  }

  return {
    id,
    name: readStringValue(record, ["name", "team_name"], id),
  };
}

function normalizeUserSearchResult(value: unknown): WoiUserSearchResult | null {
  const user = normalizeUser(value);
  if (!user) {
    return null;
  }

  const record = parseObject(value) ?? {};
  return {
    ...user,
    email: readNullableStringValue(record, ["email"]),
  };
}

function normalizeRosterPresetSlot(value: unknown): WoiRosterPresetSlot | null {
  const record = parseObject(value);
  if (!record) {
    return null;
  }

  const rawMode = readStringValue(record, ["mode", "channel", "inviteMode"], "");
  if (rawMode === "platform_user" || rawMode === "platform_search") {
    const invitedUserId = readStringValue(
      record,
      ["invitedUserId", "invited_user_id", "userId", "user_id"],
      "",
    );
    if (!invitedUserId) {
      return null;
    }
    return {
      mode: "platform_user",
      invitedUserId,
      userName: readStringValue(record, ["userName", "user_name"], ""),
      userEmail: readNullableStringValue(record, ["userEmail", "user_email"]),
    };
  }

  if (rawMode === "email") {
    const invitedEmail = readStringValue(
      record,
      ["invitedEmail", "invited_email", "email"],
      "",
    );
    if (!invitedEmail) {
      return null;
    }
    return {
      mode: "email",
      invitedEmail,
    };
  }

  if (rawMode === "open" || rawMode === "open_lobby" || rawMode === "join_link") {
    return {
      mode: "open",
    };
  }

  return null;
}

function normalizeRosterPreset(value: unknown, index: number): WoiRosterPreset {
  const record = parseObject(value) ?? {};

  return {
    id: readStringValue(record, ["id"], `preset-${index + 1}`),
    name: readStringValue(record, ["name"], `Preset ${index + 1}`),
    teamId: readNullableStringValue(record, ["teamId", "team_id"]),
    sourceGameId: readNullableStringValue(record, ["sourceGameId", "source_game_id"]),
    createdAt: readStringValue(record, ["createdAt", "created_at"], ""),
    updatedAt: readStringValue(record, ["updatedAt", "updated_at"], ""),
    slots: (readArray(record, ["slots", "entries"]) ?? [])
      .map((slot) => normalizeRosterPresetSlot(slot))
      .filter((slot): slot is WoiRosterPresetSlot => Boolean(slot)),
  };
}

function normalizeTemplateCatalogEntry(value: unknown): WoiTemplateCatalogEntry | null {
  const template = normalizeTemplate(value);
  if (!template) {
    return null;
  }

  return {
    id: template.id,
    name: template.name,
    category: template.category,
    objective: template.objective ?? "",
    isPublic: template.isPublic ?? false,
  };
}

function normalizeGameSummary(value: unknown, index: number): WoiGameSummary {
  const record = parseObject(value) ?? {};

  const creator =
    normalizeUser(readObject(record, ["creator"])) ??
    normalizeUser(readStringValue(record, ["creator_id"], ""));
  const currentPlayer =
    normalizeUser(readObject(record, ["currentPlayer", "current_player"])) ??
    normalizeUser(readStringValue(record, ["current_player_id"], ""));

  return {
    id: readStringValue(record, ["id", "game_id"], `game-${index + 1}`),
    question: readStringValue(record, ["question", "game_name"], "Untitled game"),
    description: readStringValue(record, ["description", "game_description"], ""),
    status: readStringValue(record, ["status"], "in_play"),
    isPublic: readBooleanValue(record, ["is_public", "isPublic"], false),
    teamId: readStringValue(record, ["team_id", "teamId"], ""),
    updatedAt: readStringValue(record, ["updated_at", "updatedAt", "created_at"], ""),
    creator,
    currentPlayer,
    template: normalizeTemplate(readObject(record, ["template"])),
  };
}

function normalizeLobbyGameSummary(value: unknown, index: number): WoiLobbyGameSummary {
  const record = parseObject(value) ?? {};

  return {
    id: readStringValue(record, ["id", "game_id"], `lobby-game-${index + 1}`),
    question: readStringValue(record, ["question", "game_name"], "Untitled game"),
    description: readStringValue(record, ["description", "game_description"], ""),
    status: readStringValue(record, ["status"], "lobby"),
    updatedAt: readStringValue(record, ["updatedAt", "updated_at", "created_at"], ""),
    openHumanSeats:
      readNumberValue(record, ["openHumanSeats", "open_human_seats"]) ?? 0,
    seatClaimsLocked: readBooleanValue(
      record,
      ["seatClaimsLocked", "seat_claims_locked", "playerClaimsLocked"],
      false,
    ),
    joinLinkEnabled: readBooleanValue(
      record,
      ["joinLinkEnabled", "join_link_enabled"],
      false,
    ),
    alreadyJoinedAsPlayer: readBooleanValue(
      record,
      ["alreadyJoinedAsPlayer", "already_joined_as_player"],
      false,
    ),
    creator:
      normalizeUser(readObject(record, ["creator"])) ??
      normalizeUser(readStringValue(record, ["creator_id"], "")),
    template:
      normalizeTemplate(readObject(record, ["template"])) ??
      normalizeTemplate(readObject(record, ["woi_templates"])),
  };
}

function normalizeLevel(value: unknown, index: number): WoiLevel {
  const record = parseObject(value) ?? {};
  const levelIndex =
    readNumberValue(record, ["index", "level_index", "order_index", "level_order"]) ?? index;

  return {
    index: levelIndex,
    name: readStringValue(record, ["name", "level_name", "label"], `Level ${levelIndex + 1}`),
    objective: readStringValue(record, ["objective", "level_objective", "level_object"], ""),
  };
}

function normalizeTurn(value: unknown, index: number): WoiTurn {
  const record = parseObject(value) ?? {};

  const player =
    normalizeUser(readObject(record, ["player", "user", "author"])) ??
    normalizeUser(readStringValue(record, ["player_id", "user_id"], ""));

  return {
    id: readStringValue(record, ["id", "turn_id"], `turn-${index + 1}`),
    content: readStringValue(
      record,
      ["content", "content_html", "contentHtml", "turn_text", "text", "body"],
      "",
    ),
    levelIndex: readNumberValue(record, ["level_index", "levelIndex", "level", "level_id"]),
    player,
    moveLabel: readStringValue(record, ["move", "move_text", "move_name", "moveLabel"], ""),
    ruleLabel: readStringValue(record, ["rule", "rule_text", "rule_name", "ruleLabel"], ""),
    createdAt: readStringValue(record, ["created_at", "createdAt", "turn_time"], ""),
  };
}

function normalizeGameDetail(value: unknown): WoiGameDetail {
  const root = parseObject(value) ?? {};
  const gameRecord = parseObject(root.game) ?? root;

  const turnsSource =
    readArray(root, ["turns", "entries"]) ??
    readArray(gameRecord, ["turns", "entries"]) ??
    [];

  const templateRecord =
    readObject(root, ["template"]) ?? readObject(gameRecord, ["template"]) ?? {};

  const levelsSource =
    readArray(root, ["levels", "template_levels"]) ??
    readArray(templateRecord, ["levels", "template_levels"]) ??
    [];

  const playersSource =
    readArray(root, ["players", "members", "teamMembers", "turnOrder"]) ??
    readArray(gameRecord, ["players", "members"]) ??
    [];

  const levels = levelsSource.map((entry, index) => normalizeLevel(entry, index));
  const templateMoves = (readArray(templateRecord, ["moves", "template_moves"]) ?? [])
    .map((entry) => normalizeTemplateMoveOption(entry))
    .filter((entry): entry is WoiTemplateMoveOption => Boolean(entry))
    .sort(
      (left, right) => (left.orderIndex ?? Number.MAX_SAFE_INTEGER) - (right.orderIndex ?? Number.MAX_SAFE_INTEGER),
    );
  const templateRules = (readArray(templateRecord, ["rules", "template_rules"]) ?? [])
    .map((entry) => normalizeTemplateRuleOption(entry))
    .filter((entry): entry is WoiTemplateRuleOption => Boolean(entry))
    .sort(
      (left, right) => (left.orderIndex ?? Number.MAX_SAFE_INTEGER) - (right.orderIndex ?? Number.MAX_SAFE_INTEGER),
    );
  const players = playersSource
    .map((entry) => normalizeUser(entry))
    .filter((entry): entry is WoiUser => Boolean(entry));

  const summary = normalizeGameSummary(gameRecord, 0);

  const currentPlayerId = readStringValue(gameRecord, ["current_player_id"], "");
  const explicitCurrentPlayer =
    normalizeUser(readObject(root, ["currentPlayer", "current_player"])) ??
    normalizeUser(readObject(gameRecord, ["currentPlayer", "current_player"]));

  const currentPlayer =
    explicitCurrentPlayer ??
    players.find((player) => player.id === currentPlayerId) ??
    (currentPlayerId ? { id: currentPlayerId, name: currentPlayerId, color: null } : null);

  return {
    ...summary,
    currentPlayer,
    template: {
      ...(summary.template ??
        normalizeTemplate(templateRecord) ?? {
          id: "unknown-template",
          name: "Unknown template",
          category: null,
          objective: "",
          isPublic: false,
        }),
      moves: templateMoves,
      rules: templateRules,
    },
    turns: turnsSource.map((entry, index) => normalizeTurn(entry, index)),
    levels,
    players,
  };
}

function coerceListPayload(value: unknown, keys: string[]): unknown[] {
  const record = parseObject(value);
  if (!record) {
    return parseArray(value);
  }

  for (const key of keys) {
    if (key in record) {
      return parseArray(record[key]);
    }
  }

  return [];
}

export function getViewerJoinErrorMessage(error: unknown, fallbackMessage?: string) {
  if (isApiRequestError(error)) {
    return normalizeViewerJoinErrorMessage({
      code: error.code,
      message: error.message,
      fallbackMessage,
    });
  }

  return normalizeViewerJoinErrorMessage({
    message: error instanceof Error ? error.message : null,
    fallbackMessage,
  });
}

export async function fetchTeamGames(teamId: string): Promise<WoiGameSummary[]> {
  const params = new URLSearchParams({ teamId });
  const payload = await apiFetch<unknown>(`/api/woi/games?${params.toString()}`);

  const games = coerceListPayload(payload, ["games", "items"]);
  return games.map((entry, index) => normalizeGameSummary(entry, index));
}

export async function fetchLobbyGames(): Promise<WoiLobbyGameSummary[]> {
  const payload = await apiFetch<unknown>("/api/woi/lobby/games");

  const games = coerceListPayload(payload, ["games", "items", "results"]);
  return games.map((entry, index) => normalizeLobbyGameSummary(entry, index));
}

export async function claimLobbySeat(gameId: string): Promise<WoiSeatClaimResult> {
  const payload = await apiFetch<unknown>(
    `/api/woi/games/${encodeURIComponent(gameId)}/claim-slot`,
    {
      method: "POST",
      body: JSON.stringify({}),
    },
  );

  const root = parseObject(payload) ?? {};
  const slotRecord = readObject(root, ["slot"]) ?? {};

  return {
    gameId: readStringValue(root, ["gameId", "game_id"], gameId),
    slotId: readStringValue(slotRecord, ["id", "slot_id"], ""),
    alreadyClaimed: readBooleanValue(root, ["alreadyClaimed", "already_claimed"], false),
    remainingOpenHumanSeats:
      readNumberValue(root, ["remainingOpenHumanSeats", "remaining_open_human_seats"]) ?? 0,
  };
}

export async function startLobbyGame(gameId: string): Promise<WoiStartLobbyGameResult> {
  const payload = await apiFetch<unknown>(
    `/api/woi/games/${encodeURIComponent(gameId)}/start`,
    {
      method: "POST",
      body: JSON.stringify({}),
    },
  );

  const root = parseObject(payload) ?? {};
  const gameRecord = parseObject(root.game) ?? {};

  return {
    game: normalizeGameSummary(gameRecord, 0),
    startedAt: readStringValue(root, ["startedAt", "started_at"], ""),
  };
}

export async function joinGameAsViewer(input: {
  gameId: string;
  source?: "lobby" | "join_link" | "public_url" | "manual";
}): Promise<WoiViewerJoinResult> {
  const payload = await apiFetch<unknown>(
    `/api/woi/games/${encodeURIComponent(input.gameId)}/join-as-viewer`,
    {
      method: "POST",
      body: JSON.stringify({
        source: input.source ?? "manual",
      }),
    },
  );

  const root = parseObject(payload) ?? {};
  const anonSessionId =
    readNullableStringValue(root, ["anonSessionId", "anon_session_id"]) ?? null;
  if (anonSessionId) {
    setWoiAnonSessionId(anonSessionId);
  }

  return {
    gameId: readStringValue(root, ["gameId", "game_id"], input.gameId),
    anonSessionId,
    wasExistingSession: readBooleanValue(
      root,
      ["wasExistingSession", "was_existing_session"],
      false,
    ),
  };
}

export async function joinGameByLink(input: {
  gameId: string;
  token: string;
  joinAs: "player" | "viewer";
}): Promise<WoiJoinByLinkResult> {
  const payload = await apiFetch<unknown>(
    `/api/woi/games/${encodeURIComponent(input.gameId)}/join-by-link`,
    {
      method: "POST",
      body: JSON.stringify({
        token: input.token.trim(),
        joinAs: input.joinAs,
      }),
    },
  );

  const root = parseObject(payload) ?? {};
  const joinedAsRaw = readStringValue(root, ["joinedAs", "joined_as"], input.joinAs);
  const joinedAs = (joinedAsRaw === "player" ? "player" : "viewer") as
    | "player"
    | "viewer";

  const anonSessionId =
    readNullableStringValue(root, ["anonSessionId", "anon_session_id"]) ?? null;
  if (joinedAs === "viewer" && anonSessionId) {
    setWoiAnonSessionId(anonSessionId);
  }

  return {
    gameId: readStringValue(root, ["gameId", "game_id"], input.gameId),
    joinedAs,
    anonSessionId,
    alreadyClaimed:
      joinedAs === "player"
        ? readBooleanValue(root, ["alreadyClaimed", "already_claimed"], false)
        : null,
  };
}

export async function createGame(input: {
  templateId: string;
  teamId: string;
  question: string;
  description: string;
  isPublic: boolean;
}) {
  const payload = await apiFetch<unknown>("/api/woi/games", {
    method: "POST",
    body: JSON.stringify(input),
  });

  const root = parseObject(payload) ?? {};
  const gameRecord = parseObject(root.game) ?? root;
  return normalizeGameSummary(gameRecord, 0);
}

export async function createQuickstartGame(input: {
  prompt?: string;
  teamId?: string;
  isPublic?: boolean;
  aiPlayerCount?: number;
  opponents?: WoiGeneratedOpponent[];
}) {
  const payload = await apiFetch<unknown>("/api/woi/games/quickstart", {
    method: "POST",
    body: JSON.stringify({
      prompt: input.prompt?.trim() || undefined,
      teamId: input.teamId?.trim() || undefined,
      isPublic: input.isPublic ?? false,
      aiPlayerCount:
        typeof input.aiPlayerCount === "number" && Number.isFinite(input.aiPlayerCount)
          ? Math.max(0, Math.floor(input.aiPlayerCount))
          : undefined,
      opponents: (input.opponents ?? []).map((opponent) => ({
        codename: opponent.codename,
        narrative: opponent.narrative,
        intelligence: opponent.intelligence,
        difficulty: opponent.difficulty,
        imageUrl: opponent.imageUrl,
      })),
    }),
  });

  const root = parseObject(payload) ?? {};
  const gameRecord = parseObject(root.game) ?? root;
  return normalizeGameSummary(gameRecord, 0);
}

export async function createGameWithSlots(
  input: WoiCreateWithSlotsInput,
): Promise<WoiCreateWithSlotsResult> {
  const payload = await apiFetch<unknown>("/api/woi/games/create-with-slots", {
    method: "POST",
    body: JSON.stringify({
      templateId: input.templateId.trim(),
      teamId: input.teamId?.trim() || undefined,
      question: input.question.trim(),
      description: input.description.trim(),
      isPublic: input.isPublic,
      totalPlayerSlots: Math.max(1, Math.min(20, Math.floor(input.totalPlayerSlots))),
      aiPlayerSlots: Math.max(0, Math.min(4, Math.floor(input.aiPlayerSlots))),
      creatorRole: input.creatorRole,
      humanSeats: (input.humanSeats ?? []).map((seat) => {
        if (seat.mode === "platform_user") {
          return {
            mode: "platform_user",
            userId: seat.invitedUserId,
          };
        }
        if (seat.mode === "email") {
          return {
            mode: "email",
            email: seat.invitedEmail,
          };
        }
        return {
          mode: "open",
        };
      }),
      opponents: (input.opponents ?? [])
        .slice(0, Math.max(0, Math.min(4, Math.floor(input.aiPlayerSlots))))
        .map((opponent) => ({
          codename: opponent.codename,
          narrative: opponent.narrative,
          intelligence: opponent.intelligence,
          difficulty: opponent.difficulty,
          imageUrl: opponent.imageUrl,
        })),
      presetId: input.presetId?.trim() || undefined,
      lobbyVisibility: input.lobbyVisibility,
      joinLinkEnabled: input.joinLinkEnabled,
    }),
  });

  const root = parseObject(payload) ?? {};
  const gameRecord = parseObject(root.game) ?? root;
  const slots = (readArray(root, ["slots"]) ?? []).map((entry, index): WoiCreateWithSlotsResult["slots"][number] => {
    const record = parseObject(entry) ?? {};
    const inviteRecord = parseObject(record.invite);
    const seatTypeRaw = readStringValue(record, ["seatType", "seat_type"], "human");
    const stateRaw = readStringValue(record, ["state"], "open");

    return {
      id: readStringValue(record, ["id"], `slot-${index + 1}`),
      slotIndex: readNumberValue(record, ["slotIndex", "slot_index"]) ?? index + 1,
      seatType: seatTypeRaw === "ai" ? "ai" : "human",
      state:
        stateRaw === "invited"
        || stateRaw === "filled"
        || stateRaw === "released"
        || stateRaw === "locked"
          ? stateRaw
          : "open",
      assignedUserId: readNullableStringValue(record, ["assignedUserId", "assigned_user_id"]),
      aiProfile: parseObject(record.aiProfile ?? record.ai_profile),
      invite: inviteRecord
        ? {
            id: readStringValue(inviteRecord, ["id"], ""),
            channel: (() => {
              const raw = readStringValue(inviteRecord, ["channel"], "platform_search");
              return raw === "email" || raw === "join_link" ? raw : "platform_search";
            })(),
            status: readStringValue(inviteRecord, ["status"], "pending"),
            invitedUserId: readNullableStringValue(inviteRecord, ["invitedUserId", "invited_user_id"]),
            invitedEmail: readNullableStringValue(inviteRecord, ["invitedEmail", "invited_email"]),
          }
        : null,
    };
  });

  const inviteSummaryRecord = parseObject(root.inviteSummary) ?? {};
  const joinLinkRecord = parseObject(root.joinLink) ?? {};
  const viewerSummaryRecord = parseObject(root.viewerSummary) ?? {};
  const joinLinkStatusRaw = readStringValue(joinLinkRecord, ["status"], "");
  const normalizedJoinStatus =
    joinLinkStatusRaw === "active"
    || joinLinkStatusRaw === "revoked"
    || joinLinkStatusRaw === "expired"
    || joinLinkStatusRaw === "unavailable"
      ? joinLinkStatusRaw
      : undefined;

  return {
    game: normalizeGameSummary(gameRecord, 0),
    status: readStringValue(root, ["status"], "lobby"),
    slots,
    inviteSummary: {
      total: readNumberValue(inviteSummaryRecord, ["total"]) ?? 0,
      pending: readNumberValue(inviteSummaryRecord, ["pending"]) ?? 0,
    },
    viewerSummary: {
      activeCount: readNumberValue(viewerSummaryRecord, ["activeCount", "active_count"]) ?? 0,
    },
    joinLink: {
      enabled: readBooleanValue(
        gameRecord,
        ["joinLinkEnabled", "join_link_enabled"],
        Boolean(joinLinkRecord && Object.keys(joinLinkRecord).length > 0),
      ),
      id: readNullableStringValue(joinLinkRecord, ["id"]) ?? undefined,
      status: normalizedJoinStatus,
      token: readNullableStringValue(joinLinkRecord, ["token"]),
      shareUrl: readNullableStringValue(joinLinkRecord, ["shareUrl", "share_url"]),
    },
    presetId: readNullableStringValue(root, ["appliedPresetId", "presetId", "preset_id"]),
  };
}

function normalizeGeneratedOpponent(value: unknown, index: number): WoiGeneratedOpponent {
  const record = parseObject(value) ?? {};
  const appearanceRecord = readObject(record, ["appearance"]) ?? {};
  const intelligenceRaw = readStringValue(record, ["intelligence"], "analytical");
  const difficultyRaw = readStringValue(record, ["difficulty"], "medium");
  const intelligence = (
    intelligenceRaw === "novice" ||
    intelligenceRaw === "analytical" ||
    intelligenceRaw === "strategic" ||
    intelligenceRaw === "expert"
      ? intelligenceRaw
      : "analytical"
  ) as WoiGeneratedOpponent["intelligence"];
  const difficulty = (
    difficultyRaw === "easy" ||
    difficultyRaw === "medium" ||
    difficultyRaw === "hard" ||
    difficultyRaw === "adaptive"
      ? difficultyRaw
      : "medium"
  ) as WoiGeneratedOpponent["difficulty"];
  const skinToneBucket =
    readNullableStringValue(appearanceRecord, ["skinToneBucket", "skin_tone_bucket"]) ??
    readNullableStringValue(record, ["skinToneBucket", "skin_tone_bucket"]);
  const featureProfile =
    readNullableStringValue(appearanceRecord, ["featureProfile", "feature_profile"]) ??
    readNullableStringValue(record, ["featureProfile", "feature_profile"]);
  const hairProfile =
    readNullableStringValue(appearanceRecord, ["hairProfile", "hair_profile"]) ??
    readNullableStringValue(record, ["hairProfile", "hair_profile"]);
  const appearance =
    skinToneBucket || featureProfile || hairProfile
      ? {
          skinToneBucket,
          featureProfile,
          hairProfile,
        }
      : null;

  return {
    codename: readStringValue(record, ["codename"], `Opponent ${index + 1}`),
    narrative: readStringValue(
      record,
      ["narrative", "personality"],
      "This opponent plays with a balanced style and keeps pressure steady while adapting to the board state.",
    ),
    intelligence,
    difficulty,
    imageUrl: readStringValue(record, ["imageUrl", "image_url"], ""),
    appearance,
  };
}

export async function generateAiOpponents(input: {
  count: number;
  prompt?: string;
  regenerateNonce?: string;
  usedAppearance?: {
    skinToneBuckets?: string[];
    featureProfiles?: string[];
    hairProfiles?: string[];
  };
}): Promise<WoiGeneratedOpponent[]> {
  const toUniqueStrings = (values: string[] | undefined) =>
    Array.from(
      new Set(
        (values ?? [])
          .map((value) => value.trim())
          .filter((value) => value.length > 0),
      ),
    );
  const skinToneBuckets = toUniqueStrings(input.usedAppearance?.skinToneBuckets);
  const featureProfiles = toUniqueStrings(input.usedAppearance?.featureProfiles);
  const hairProfiles = toUniqueStrings(input.usedAppearance?.hairProfiles);
  const usedAppearance =
    skinToneBuckets.length || featureProfiles.length || hairProfiles.length
      ? {
          skinToneBuckets,
          featureProfiles,
          hairProfiles,
        }
      : undefined;

  const payload = await apiFetch<unknown>("/api/woi/opponents", {
    method: "POST",
    body: JSON.stringify({
      count: Math.max(0, Math.min(4, Math.floor(input.count))),
      prompt: input.prompt?.trim() || undefined,
      regenerateNonce: input.regenerateNonce?.trim() || undefined,
      usedAppearance,
    }),
  });

  const root = parseObject(payload) ?? {};
  const opponents = (readArray(root, ["opponents"]) ?? []).map((entry, index) =>
    normalizeGeneratedOpponent(entry, index),
  );
  return opponents;
}

export async function generateLearningSubjects(input: {
  hint?: string;
  count?: number;
}): Promise<string[]> {
  const payload = await apiFetch<unknown>("/api/woi/subjects", {
    method: "POST",
    body: JSON.stringify({
      mode: "subjects",
      hint: input.hint?.trim() || undefined,
      count:
        typeof input.count === "number" && Number.isFinite(input.count)
          ? Math.max(3, Math.min(8, Math.floor(input.count)))
          : undefined,
    }),
  });

  const root = parseObject(payload) ?? {};
  return (readArray(root, ["subjects"]) ?? [])
    .map((entry) => parseString(entry))
    .filter((entry): entry is string => Boolean(entry?.trim()))
    .map((entry) => entry.trim());
}

export async function generateLearningQuestion(input: {
  subject: string;
}): Promise<WoiSubjectQuestion> {
  const payload = await apiFetch<unknown>("/api/woi/subjects", {
    method: "POST",
    body: JSON.stringify({
      mode: "question",
      subject: input.subject.trim(),
    }),
  });

  const root = parseObject(payload) ?? {};
  return {
    subject: readStringValue(root, ["subject"], input.subject.trim()),
    question: readStringValue(root, ["question"], `What should we learn first about ${input.subject.trim()}?`),
  };
}

export async function fetchGameDetail(gameId: string): Promise<WoiGameDetail> {
  const payload = await apiFetch<unknown>(`/api/woi/games/${encodeURIComponent(gameId)}`);
  return normalizeGameDetail(payload);
}

export async function submitTurn(
  gameId: string,
  input: {
    content: string;
    levelIndex: number | null;
    moveId: string;
    ruleId: string;
  },
) {
  return apiFetch<unknown>(`/api/woi/games/${encodeURIComponent(gameId)}/turns`, {
    method: "POST",
    body: JSON.stringify({
      content: input.content,
      contentHtml: input.content,
      levelIndex: input.levelIndex,
      moveId: input.moveId || undefined,
      ruleId: input.ruleId || undefined,
    }),
  });
}

function normalizePublicGame(value: unknown, index: number): PublicGameSummary {
  const record = parseObject(value) ?? {};

  const templateName =
    readStringValue(record, ["templateName", "template_name"], "") ||
    readStringValue(parseObject(record.template) ?? {}, ["name", "template_name"], "");

  return {
    id: readStringValue(record, ["id", "game_id"], `public-game-${index + 1}`),
    question: readStringValue(record, ["question", "game_name"], "Untitled game"),
    description: readStringValue(record, ["description", "game_description"], ""),
    updatedAt: readStringValue(record, ["updated_at", "updatedAt", "created_at"], ""),
    templateName: templateName || "Unknown template",
    creator:
      normalizeUser(readObject(record, ["creator", "author"])) ??
      normalizeUser(readStringValue(record, ["creator_id"], "")),
  };
}

export async function fetchPublicGames(query: string): Promise<PublicGamesResult> {
  const params = new URLSearchParams();
  if (query.trim()) {
    params.set("q", query.trim());
  }

  const suffix = params.toString() ? `?${params.toString()}` : "";
  const payload = await apiFetch<unknown>(`/api/library/public-games${suffix}`);
  const root = parseObject(payload) ?? {};
  const resolvedQuery = readStringValue(root, ["query"], query.trim());

  const games = coerceListPayload(payload, ["games", "items", "results"]);
  return {
    query: resolvedQuery,
    games: games.map((entry, index) => normalizePublicGame(entry, index)),
  };
}

export async function fetchActorTeams(): Promise<WoiTeamSummary[]> {
  const payload = await apiFetch<unknown>("/api/woi/teams");
  const teams = coerceListPayload(payload, ["teams", "items", "results"]);
  return teams
    .map((entry) => normalizeTeamSummary(entry))
    .filter((entry): entry is WoiTeamSummary => Boolean(entry));
}

export async function fetchTeamMembers(teamId: string): Promise<WoiUserSearchResult[]> {
  const payload = await apiFetch<unknown>(
    `/api/woi/teams/${encodeURIComponent(teamId)}/members`,
  );
  const members = coerceListPayload(payload, ["members", "items", "results"]);

  return members
    .map((entry) => parseObject(entry))
    .map((entry) => normalizeUserSearchResult(entry?.user))
    .filter((entry): entry is WoiUserSearchResult => Boolean(entry));
}

export async function searchWoiUsers(
  input: {
    query: string;
    teamId?: string;
    limit?: number;
  },
): Promise<WoiUserSearchResult[]> {
  const query = input.query.trim();
  if (query.length < 2) {
    return [];
  }

  const params = new URLSearchParams();
  params.set("q", query);
  if (input.teamId?.trim()) {
    params.set("teamId", input.teamId.trim());
  }

  const payload = await apiFetch<unknown>(`/api/woi/users/search?${params.toString()}`);
  const users = coerceListPayload(payload, ["users", "items", "results"]);
  const limit =
    typeof input.limit === "number" && Number.isFinite(input.limit)
      ? Math.max(1, Math.min(20, Math.floor(input.limit)))
      : 8;

  return users
    .map((entry) => normalizeUserSearchResult(entry))
    .filter((entry): entry is WoiUserSearchResult => Boolean(entry))
    .slice(0, limit);
}

export async function fetchWoiRosterPresets(teamId?: string): Promise<WoiRosterPreset[]> {
  const params = new URLSearchParams();
  if (teamId?.trim()) {
    params.set("teamId", teamId.trim());
  }

  const suffix = params.toString() ? `?${params.toString()}` : "";
  const payload = await apiFetch<unknown>(`/api/woi/roster-presets${suffix}`);
  const presets = coerceListPayload(payload, ["presets", "items", "results"]);
  return presets.map((entry, index) => normalizeRosterPreset(entry, index));
}

export async function fetchTemplates(): Promise<WoiTemplateCatalogEntry[]> {
  const payload = await apiFetch<unknown>("/api/woi/templates");
  const templates = coerceListPayload(payload, ["templates", "items", "results"]);
  return templates
    .map((entry) => normalizeTemplateCatalogEntry(entry))
    .filter((entry): entry is WoiTemplateCatalogEntry => Boolean(entry));
}

function normalizeComment(value: unknown, index: number): ContextComment {
  const record = parseObject(value) ?? {};

  return {
    id: readStringValue(record, ["id", "comment_id"], `comment-${index + 1}`),
    body: readStringValue(record, ["body", "comment", "text"], ""),
    createdAt: readStringValue(record, ["created_at", "createdAt"], ""),
    author:
      normalizeUser(readObject(record, ["author", "user", "creator"])) ??
      normalizeUser(readStringValue(record, ["author_id", "user_id"], "")),
  };
}

function normalizeSpinnerTile(value: unknown, index: number): WoiSpinnerTile {
  const record = parseObject(value) ?? {};
  return {
    id: readStringValue(record, ["id"], `tile-${index + 1}`),
    label: readStringValue(record, ["label", "name"], "Untitled"),
    imageUrl: readStringValue(record, ["imageUrl", "image_url"], ""),
    orderIndex: readNumberValue(record, ["order_index", "orderIndex"]),
    levelIndex: readNumberValue(record, ["levelIndex", "level_index"]),
    objective: readNullableStringValue(record, ["objective"]),
  };
}

function normalizeAiPlayer(value: unknown, index: number): WoiAiPlayer {
  const record = parseObject(value) ?? {};
  const intelligenceRaw = readNullableStringValue(record, ["intelligence"]);
  const difficultyRaw = readNullableStringValue(record, ["difficulty"]);
  return {
    userId: readStringValue(record, ["userId", "user_id"], `player-${index + 1}`),
    displayName: readStringValue(record, ["displayName", "display_name"], `Player ${index + 1}`),
    baseName: readStringValue(record, ["baseName", "base_name"], `Player ${index + 1}`),
    isHuman: readBooleanValue(record, ["isHuman", "is_human"], false),
    isCurrent: readBooleanValue(record, ["isCurrent", "is_current"], false),
    turnOffset: readNumberValue(record, ["turnOffset", "turn_offset"]),
    persona: readNullableStringValue(record, ["persona"]),
    narrative: readNullableStringValue(record, ["narrative"]),
    imageUrl: readNullableStringValue(record, ["imageUrl", "image_url"]),
    intelligence:
      intelligenceRaw === "novice"
      || intelligenceRaw === "analytical"
      || intelligenceRaw === "strategic"
      || intelligenceRaw === "expert"
        ? intelligenceRaw
        : null,
    difficulty:
      difficultyRaw === "easy"
      || difficultyRaw === "medium"
      || difficultyRaw === "hard"
      || difficultyRaw === "adaptive"
        ? difficultyRaw
        : null,
  };
}

function normalizeGameAiPack(value: unknown): WoiGameAiPack {
  const root = parseObject(value) ?? {};
  const spinnerRecord = readObject(root, ["spinner"]) ?? {};
  const turnForecastRecord = readObject(root, ["turnForecast", "turn_forecast"]) ?? {};

  const levelTiles = (readArray(spinnerRecord, ["levels"]) ?? []).map((tile, index) =>
    normalizeSpinnerTile(tile, index),
  );
  const moveTiles = (readArray(spinnerRecord, ["moves"]) ?? []).map((tile, index) =>
    normalizeSpinnerTile(tile, index),
  );
  const ruleTiles = (readArray(spinnerRecord, ["rules"]) ?? []).map((tile, index) =>
    normalizeSpinnerTile(tile, index),
  );

  const rules = (readArray(root, ["rules"]) ?? []).map((entry) =>
    parseString(entry, "").trim(),
  ).filter(Boolean);
  const players = (readArray(root, ["aiPlayers", "players"]) ?? []).map((entry, index) =>
    normalizeAiPlayer(entry, index),
  );

  return {
    topic: readStringValue(root, ["topic"], ""),
    rules,
    aiPlayers: players,
    turnForecast: {
      turnsUntilHuman: readNumberValue(turnForecastRecord, ["turnsUntilHuman", "turns_until_human"]),
    },
    spinner: {
      levels: levelTiles,
      moves: moveTiles,
      rules: ruleTiles,
    },
    generatedAt: readStringValue(root, ["generatedAt", "generated_at"], ""),
    imageSource: readStringValue(root, ["imageSource", "image_source"], "fallback"),
    rosterSource: readStringValue(root, ["rosterSource", "roster_source"], "mock"),
    rosterModel: readStringValue(root, ["rosterModel", "roster_model"], "unknown"),
  };
}

export async function fetchComments(contextId: string): Promise<ContextComment[]> {
  const params = new URLSearchParams({
    contextType: "woi_game",
    contextId,
  });

  const payload = await apiFetch<unknown>(`/api/comments?${params.toString()}`);
  const comments = coerceListPayload(payload, ["comments", "items", "data"]);
  return comments.map((entry, index) => normalizeComment(entry, index));
}

export async function fetchGameAiPack(
  gameId: string,
  regenerateNonce?: string,
  aiPlayerCount?: number,
): Promise<WoiGameAiPack> {
  const payload = await apiFetch<unknown>(`/api/woi/games/${encodeURIComponent(gameId)}/ai-pack`, {
    method: "POST",
    body: JSON.stringify({
      regenerateNonce: regenerateNonce?.trim() || undefined,
      aiPlayerCount:
        typeof aiPlayerCount === "number" && Number.isFinite(aiPlayerCount)
          ? Math.max(0, Math.floor(aiPlayerCount))
          : undefined,
    }),
  });

  return normalizeGameAiPack(payload);
}

export async function postComment(contextId: string, body: string) {
  const payload = await apiFetch<unknown>("/api/comments", {
    method: "POST",
    body: JSON.stringify({
      contextType: "woi_game",
      contextId,
      body,
    }),
  });

  const root = parseObject(payload) ?? {};
  const created = parseObject(root.comment) ?? root;
  return normalizeComment(created, 0);
}

export function formatDateTime(isoLike: string): string {
  if (!isoLike) {
    return "Unknown time";
  }

  const parsed = new Date(isoLike);
  if (Number.isNaN(parsed.getTime())) {
    return parseString(isoLike, "Unknown time");
  }

  return parsed.toLocaleString();
}
