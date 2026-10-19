# B8-ten's known-good calls, as an agent types them: compile each of the ten recipes, send each clip it makes with
# who made it, read the queue (the workspace's checker, or the grader's, moves them on)
npx m3a recipe.compile Arms_V.json
npx m3a recipe.compile Arms_Wide.json
npx m3a recipe.compile Brow_Salute.json
npx m3a recipe.compile Dip_Bow.json
npx m3a recipe.compile Fist_Up.json
npx m3a recipe.compile Look_Back.json
npx m3a recipe.compile Look_Up.json
npx m3a recipe.compile Point_Ahead.json
npx m3a recipe.compile Shrug_Tilt.json
npx m3a recipe.compile Side_Lean.json
npx m3a library submit check-output/recipe.compile/Arms_V.clip.json --by "Claude, an AI agent (claude-opus-5-5), for the game's studio"
npx m3a library submit check-output/recipe.compile/Arms_Wide.clip.json --by "Claude, an AI agent (claude-opus-5-5), for the game's studio"
npx m3a library submit check-output/recipe.compile/Brow_Salute.clip.json --by "Claude, an AI agent (claude-opus-5-5), for the game's studio"
npx m3a library submit check-output/recipe.compile/Dip_Bow.clip.json --by "Claude, an AI agent (claude-opus-5-5), for the game's studio"
npx m3a library submit check-output/recipe.compile/Fist_Up.clip.json --by "Claude, an AI agent (claude-opus-5-5), for the game's studio"
npx m3a library submit check-output/recipe.compile/Look_Back.clip.json --by "Claude, an AI agent (claude-opus-5-5), for the game's studio"
npx m3a library submit check-output/recipe.compile/Look_Up.clip.json --by "Claude, an AI agent (claude-opus-5-5), for the game's studio"
npx m3a library submit check-output/recipe.compile/Point_Ahead.clip.json --by "Claude, an AI agent (claude-opus-5-5), for the game's studio"
npx m3a library submit check-output/recipe.compile/Shrug_Tilt.clip.json --by "Claude, an AI agent (claude-opus-5-5), for the game's studio"
npx m3a library submit check-output/recipe.compile/Side_Lean.clip.json --by "Claude, an AI agent (claude-opus-5-5), for the game's studio"
npx m3a library status
