# Tattoo Dice v1.3.4

Corrected build.

Changes:
- restored the original-feeling roll structure:
  - 1 word: Main
  - 2 words: Main + Detail
  - 3 words: Main + Detail + Effect
- uses the existing deck only; no new AI-suggested words added
- removed Star/Stars
- visible global counter in the footer: `xxxxx tattoo ideas rolled`
- counter text uses the same cream color as the header
- fixed the Roll button script ID
- fixed the counter script
- secret code `332211` shows `Keep drawing`
- hidden message does not count as a roll
- no duplicate families in one roll, e.g. Cat/Panther, Snake/Cobra, Skull/Pile of Skulls, Spider/Spider Web
