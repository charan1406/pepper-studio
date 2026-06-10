"""Rock-paper-scissors mini-game (Tier 1: simultaneous reveal, human scores).

Pepper commits to a RANDOM move *before* the person throws (no cheating) and
reveals it on "shoot" — closing its fist for rock, opening its hand for paper,
and announcing scissors out loud (the hand is a single open/close joint and
can't form two fingers). The person throws at the same time and calls the
result; Pepper reacts in the following conversational turn.
"""
import random

RPS_MOVES = ["rock", "paper", "scissors"]

RPS_TOOL = {
    "type": "function",
    "function": {
        "name": "play_rps",
        "description": (
            "Play one round of rock-paper-scissors with the person. Pepper throws a "
            "random move and reveals it at the same moment the person throws; the "
            "person then says who won. Use when the person wants to play rock paper "
            "scissors."
        ),
        "parameters": {"type": "object", "properties": {}},
    },
}

RPS_NAMES = {"play_rps"}

# Pepper's hand is one open/close joint: rock = closed fist, paper/scissors = open.
_HAND = {"rock": 0.0, "paper": 1.0, "scissors": 1.0}


def play_rps(client):
    """Throw a random move, set the matching hand pose, return the reveal line."""
    move = random.choice(RPS_MOVES)
    try:
        client.set_joints(["RHand"], [_HAND[move]])
    except Exception as e:
        print(f"[rps] hand failed: {e}")
    return f"Rock, paper, scissors, shoot! I threw {move}. Did you beat me?"
