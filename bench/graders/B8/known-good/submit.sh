# B8's known-good calls, as an agent types them: compile the recipe, send the clip it makes with who made it, read the
# queue (the workspace's checker, or the grader's, moves it on)
npx m3a recipe.compile emote.json
npx m3a library submit check-output/recipe.compile/Bow_Deep.clip.json --by "Claude, an AI agent (claude-opus-5-5), for the game's studio"
npx m3a library status
