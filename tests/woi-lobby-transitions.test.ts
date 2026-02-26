import assert from "node:assert/strict";
import test from "node:test";

import {
  areAllPlayerSeatsFilled,
  areSeatClaimsAllowed,
  isViewerJoinAllowedForStatus,
  normalizeViewerJoinErrorMessage,
  resolveManualStartTransition,
  resolveCreateWithSlotsLifecycle,
  resolveCurrentPlayerOnStart,
  resolveViewerIdentity,
  type LobbyRuleSlot,
} from "../lib/woi-lobby-rules.ts";

function slot(input: Partial<LobbyRuleSlot> & Pick<LobbyRuleSlot, "slotIndex">): LobbyRuleSlot {
  return {
    slotIndex: input.slotIndex,
    seatType: input.seatType ?? "human",
    state: input.state ?? "open",
    assignedUserId: input.assignedUserId ?? null,
  };
}

test("create-with-slots lifecycle defaults to lobby and unlocked claims", () => {
  const lifecycle = resolveCreateWithSlotsLifecycle();
  assert.equal(lifecycle.status, "lobby");
  assert.equal(lifecycle.seatClaimsLocked, false);
  assert.equal(
    areSeatClaimsAllowed({
      status: lifecycle.status,
      seatClaimsLocked: lifecycle.seatClaimsLocked,
    }),
    true,
  );
});

test("all player seats filled when all human and ai seats are filled", () => {
  const seats: LobbyRuleSlot[] = [
    slot({ slotIndex: 1, seatType: "human", state: "filled", assignedUserId: "u1" }),
    slot({ slotIndex: 2, seatType: "human", state: "filled", assignedUserId: "u2" }),
    slot({ slotIndex: 3, seatType: "ai", state: "filled" }),
  ];

  assert.equal(areAllPlayerSeatsFilled(seats), true);
});

test("unfilled human seat blocks start eligibility", () => {
  const seats: LobbyRuleSlot[] = [
    slot({ slotIndex: 1, seatType: "human", state: "filled", assignedUserId: "u1" }),
    slot({ slotIndex: 2, seatType: "human", state: "invited" }),
    slot({ slotIndex: 3, seatType: "ai", state: "filled" }),
  ];

  assert.equal(areAllPlayerSeatsFilled(seats), false);
});

test("start transition keeps existing current player if already set", () => {
  const seats: LobbyRuleSlot[] = [
    slot({ slotIndex: 1, seatType: "human", state: "filled", assignedUserId: "u1" }),
    slot({ slotIndex: 2, seatType: "human", state: "filled", assignedUserId: "u2" }),
  ];

  const current = resolveCurrentPlayerOnStart({
    slots: seats,
    currentPlayerId: "u2",
  });

  assert.equal(current, "u2");
});

test("start transition picks first filled human seat when current player is missing", () => {
  const seats: LobbyRuleSlot[] = [
    slot({ slotIndex: 2, seatType: "human", state: "filled", assignedUserId: "u2" }),
    slot({ slotIndex: 1, seatType: "human", state: "filled", assignedUserId: "u1" }),
  ];

  const current = resolveCurrentPlayerOnStart({
    slots: seats,
    currentPlayerId: null,
  });

  assert.equal(current, "u1");
});

test("ai-only game start transition can keep null current player", () => {
  const seats: LobbyRuleSlot[] = [
    slot({ slotIndex: 1, seatType: "ai", state: "filled" }),
    slot({ slotIndex: 2, seatType: "ai", state: "filled" }),
  ];

  const current = resolveCurrentPlayerOnStart({
    slots: seats,
    currentPlayerId: null,
  });

  assert.equal(current, null);
});

test("create -> lobby -> manual start transition resolves in_play and locks claims", () => {
  const lifecycle = resolveCreateWithSlotsLifecycle();
  const seats: LobbyRuleSlot[] = [
    slot({ slotIndex: 1, seatType: "human", state: "filled", assignedUserId: "u1" }),
    slot({ slotIndex: 2, seatType: "human", state: "filled", assignedUserId: "u2" }),
  ];

  const transition = resolveManualStartTransition({
    status: lifecycle.status,
    seatClaimsLocked: lifecycle.seatClaimsLocked,
    slots: seats,
    currentPlayerId: null,
  });

  assert.equal(transition.ok, true);
  if (!transition.ok) {
    assert.fail("Expected successful manual start transition");
  }
  assert.equal(transition.status, "in_play");
  assert.equal(transition.seatClaimsLocked, true);
  assert.equal(transition.currentPlayerId, "u1");
  assert.equal(
    areSeatClaimsAllowed({
      status: transition.status,
      seatClaimsLocked: transition.seatClaimsLocked,
    }),
    false,
  );
});

test("manual start transition rejects when any player seat is unfilled", () => {
  const transition = resolveManualStartTransition({
    status: "lobby",
    seatClaimsLocked: false,
    slots: [
      slot({ slotIndex: 1, seatType: "human", state: "filled", assignedUserId: "u1" }),
      slot({ slotIndex: 2, seatType: "human", state: "open" }),
    ],
    currentPlayerId: null,
  });

  assert.equal(transition.ok, false);
  if (transition.ok) {
    assert.fail("Expected start rejection when seats are unfilled");
  }
  assert.equal(transition.code, "PLAYER_SEATS_UNFILLED");
});

test("viewer joins remain allowed before start, after start, and after finish", () => {
  assert.equal(isViewerJoinAllowedForStatus("lobby"), true);
  assert.equal(isViewerJoinAllowedForStatus("in_play"), true);
  assert.equal(isViewerJoinAllowedForStatus("finished"), true);
});

test("anon viewer identity resolves with generated fallback when no session id is provided", () => {
  const resolved = resolveViewerIdentity({
    actorId: null,
    anonSessionId: null,
    fallbackAnonSessionId: "generated-anon-id",
  });

  assert.equal(resolved.actorId, null);
  assert.equal(resolved.anonSessionId, "generated-anon-id");
  assert.equal(resolved.isAnonymous, true);
});

test("viewer identity prefers authenticated actor over anon session", () => {
  const resolved = resolveViewerIdentity({
    actorId: "user-1",
    anonSessionId: "existing-anon-id",
    fallbackAnonSessionId: "generated-anon-id",
  });

  assert.equal(resolved.actorId, "user-1");
  assert.equal(resolved.anonSessionId, null);
  assert.equal(resolved.isAnonymous, false);
});

test("room-full errors map to generic room is full message", () => {
  assert.equal(
    normalizeViewerJoinErrorMessage({
      code: "ROOM_FULL",
      message: "viewer capacity reached",
    }),
    "room is full",
  );

  assert.equal(
    normalizeViewerJoinErrorMessage({
      message: "Room is full for now",
    }),
    "room is full",
  );

  assert.equal(
    normalizeViewerJoinErrorMessage({
      code: "NETWORK_ERROR",
      message: "Timed out",
    }),
    "Timed out",
  );
});
