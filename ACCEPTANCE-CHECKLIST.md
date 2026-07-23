# Tattoo Dice acceptance checklist

Implemented in this build:

- Working v3.6.4 application retained as the base.
- Startup always uses Random Main and three dice.
- Splash uses the large logo and green progress bar; no splash slogan and no Tap to Start.
- Splash background and logo transition run simultaneously, keeping one continuous visible logo until it matches the real header logo's measured position and size.
- Opening, Theme changes and Main changes use separate sequential drops: left, then right, then middle.
- Each drop starts above the physical viewport, travels vertically, uses no scale animation, and lands directly on the already-rendered final word and face.
- Drop shadows are independent layers: invisible while high, fading in near contact, then replaced by the stationary real shadow at landing.
- Normal Roll uses the original supplied roll motion and never uses the drop animation.
- Outcomes are created before Roll animation starts.
- With a fixed Main, the middle die and its shadow remain stationary; only left and right roll. Main lettering is green without a green die glow.
- Dice stay above the interface during drops.
- Number selectors are a responsive three-column row centered over Theme, Roll and Main, with square near-white dice and current UI colors.
- One-die mode remains visible but is disabled for a fixed Main. Selecting a fixed Main while one die is active automatically changes to two dice.
- Disabled notice: “1 die is unavailable while a fixed Main is selected.” (`die` is the correct singular of `dice`.)
- Existing fresh UI, gradient, header, footer order and smaller credits retained.
