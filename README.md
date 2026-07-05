# Tattoo Dice v1.6.5 Score + Keep Drawing Check

Checks/fixes:
- Exact v1.5.3 deck copied back in.
- Score/puntentelling is present in classic.json.
- Every deck item is checked for score 0-3 on startup.
- Secret code remains 3,3,2,2,1,1 (`332211`).
- Keep Drawing appears in red over the dice as an overlay layer.
- Overlay z-index raised to 30 so it sits clearly above the WebGL dice.

Deck verification:
- Items: 86
- Score counts: {0: 14, 1: 26, 2: 15, 3: 31}
- Missing score: 0
- Invalid score: 0
