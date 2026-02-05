"use client";

import { apiFetch, parseArray, parseObject, parseString } from "@/components/quipx/client";

export type WoiUser = {
  id: string;
  name: string;
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
    return { id, name: id, color: null };
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

export async function fetchTeamGames(teamId: string): Promise<WoiGameSummary[]> {
  const params = new URLSearchParams({ teamId });
  const payload = await apiFetch<unknown>(`/api/woi/games?${params.toString()}`);

  const games = coerceListPayload(payload, ["games", "items"]);
  return games.map((entry, index) => normalizeGameSummary(entry, index));
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

export async function fetchComments(contextId: string): Promise<ContextComment[]> {
  const params = new URLSearchParams({
    contextType: "woi_game",
    contextId,
  });

  const payload = await apiFetch<unknown>(`/api/comments?${params.toString()}`);
  const comments = coerceListPayload(payload, ["comments", "items", "data"]);
  return comments.map((entry, index) => normalizeComment(entry, index));
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
