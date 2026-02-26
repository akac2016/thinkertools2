export type LobbyRuleGameStatus = "lobby" | "in_play" | "reflect" | "finished";
export type LobbyRuleSeatType = "human" | "ai";
export type LobbyRuleSlotState = "open" | "invited" | "filled" | "released" | "locked";
export type LobbyStartRejectionCode =
  | "GAME_NOT_IN_LOBBY"
  | "PLAYER_CLAIMS_LOCKED"
  | "PLAYER_SEATS_UNFILLED";

export type LobbyRuleSlot = {
  slotIndex: number;
  seatType: LobbyRuleSeatType;
  state: LobbyRuleSlotState;
  assignedUserId: string | null;
};

export function resolveCreateWithSlotsLifecycle() {
  return {
    status: "lobby" as LobbyRuleGameStatus,
    seatClaimsLocked: false,
  };
}

export function areSeatClaimsAllowed(input: {
  status: LobbyRuleGameStatus;
  seatClaimsLocked: boolean;
}) {
  return input.status === "lobby" && !input.seatClaimsLocked;
}

export function getUnfilledPlayerSeats(slots: LobbyRuleSlot[]) {
  return slots.filter((slot) => {
    if (slot.seatType === "human") {
      return slot.state !== "filled" || !slot.assignedUserId;
    }

    return slot.state !== "filled";
  });
}

export function areAllPlayerSeatsFilled(slots: LobbyRuleSlot[]) {
  return getUnfilledPlayerSeats(slots).length === 0;
}

export function resolveCurrentPlayerOnStart(input: {
  slots: LobbyRuleSlot[];
  currentPlayerId: string | null;
}) {
  if (input.currentPlayerId) {
    return input.currentPlayerId;
  }

  const firstFilledHuman = [...input.slots]
    .filter((slot) => slot.seatType === "human" && slot.state === "filled" && slot.assignedUserId)
    .sort((left, right) => left.slotIndex - right.slotIndex)[0];

  return firstFilledHuman?.assignedUserId ?? null;
}

export function resolveManualStartTransition(input: {
  status: LobbyRuleGameStatus;
  seatClaimsLocked: boolean;
  slots: LobbyRuleSlot[];
  currentPlayerId: string | null;
}) {
  if (input.status !== "lobby") {
    return {
      ok: false as const,
      code: "GAME_NOT_IN_LOBBY" as LobbyStartRejectionCode,
    };
  }

  if (input.seatClaimsLocked) {
    return {
      ok: false as const,
      code: "PLAYER_CLAIMS_LOCKED" as LobbyStartRejectionCode,
    };
  }

  if (!areAllPlayerSeatsFilled(input.slots)) {
    return {
      ok: false as const,
      code: "PLAYER_SEATS_UNFILLED" as LobbyStartRejectionCode,
    };
  }

  return {
    ok: true as const,
    status: "in_play" as LobbyRuleGameStatus,
    seatClaimsLocked: true,
    currentPlayerId: resolveCurrentPlayerOnStart({
      slots: input.slots,
      currentPlayerId: input.currentPlayerId,
    }),
  };
}

export function isViewerJoinAllowedForStatus(status: LobbyRuleGameStatus) {
  switch (status) {
    case "lobby":
    case "in_play":
    case "reflect":
    case "finished":
      return true;
    default:
      return false;
  }
}

export function resolveViewerIdentity(input: {
  actorId: string | null;
  anonSessionId: string | null;
  fallbackAnonSessionId: string;
}) {
  if (input.actorId) {
    return {
      actorId: input.actorId,
      anonSessionId: null,
      isAnonymous: false,
    };
  }

  return {
    actorId: null,
    anonSessionId: input.anonSessionId ?? input.fallbackAnonSessionId,
    isAnonymous: true,
  };
}

export function normalizeViewerJoinErrorMessage(input: {
  code?: string | null;
  message?: string | null;
  fallbackMessage?: string;
}) {
  const fallback = input.fallbackMessage ?? "Failed to join as viewer";
  const code = input.code?.trim().toUpperCase() ?? "";
  const message = input.message?.trim() ?? "";

  if (code === "ROOM_FULL" || /room is full/i.test(message)) {
    return "room is full";
  }

  return message || fallback;
}
