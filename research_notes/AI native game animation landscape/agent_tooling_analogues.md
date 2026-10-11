# Agent-native tooling landscape and code-first animation analogues (state as of 2026-10-11)

_Provenance: researched 2026-10-11. GitHub star/fork counts were pulled the same day from the ungh.cc GitHub mirror API (`https://ungh.cc/repos/{owner}/{repo}`) because direct GitHub API access was blocked in this sandbox. npm figures are weekly downloads for 2026-10-03 to 2026-10-09 from `https://api.npmjs.org/downloads/point/last-week/{pkg}`. Status tags: **[Shipped]** = generally available and documented; **[Beta]/[Experimental]/[Preview]** = vendor-labelled pre-GA; **[Research]** = paper or prototype; **[Claim]** = marketing or secondary claim not independently verified. The shared web-search budget ran out near the end of the research (200 searches per turn across all agents), so a few items are listed under Gaps instead of being verified._

## 1. MCP servers for 3D, animation and game engines: what they expose, adoption, limitations

### Takeaway
By October 2026 every major engine has an MCP path. Unity (open beta, May 2026), Epic (experimental in UE 5.8) and Roblox (built into Studio) all ship **official** servers, and Blender's community server is the most-starred 3D MCP at about 30.4k stars. **None of them exposes first-class animation operations** (clips, keyframes, retargeting, Animator/AnimationTree graphs) in its core toolset. Animation is done by having the agent write engine scripts (Python, C#, Luau, GDScript) through a generic "execute code" tool, or through optional community extensions. The most useful precedents for an agent-first animation package are the **observation tools**: blender-mcp's `look` (which includes an animation frame-strip mode), Roblox's camera-parameterised `screen_capture`, Unity-MCP's isolated-GameObject render, and play-mode or input-simulation tools.

### Cited Findings

**Blender: "MCP for Blender" (formerly blender-mcp)** [Shipped, community]
- The repo now resolves to `ahujasid/mcp-for-blender` ("Community plugin to control Blender 3D with any LLM of your choice. Not affiliated with the official Blender Foundation."). It had 30,420 stars and 2,753 forks on 2026-10-11, was created 2025-03-07 and last pushed 2026-10-06. — [ungh.cc mirror](https://ungh.cc/repos/ahujasid/blender-mcp); [GitHub](https://github.com/ahujasid/blender-mcp) (page showed 30.4k stars / 2.8k forks)
- It exposes nine tools: `execute_blender_code` (runs Python in the live session); `look`, which returns viewport, camera, angles, or **`frames` (animation strip)** views in solid, material, rendered, wireframe or xray shading, or shows a render or image file; `get_scene_info` (one line per object); `generate_3d` (Tripo, Hunyuan3D, Hyper3D Rodin); `search_assets`/`import_asset` (Poly Haven, Sketchfab, Poly Pizza); `get_addon_status`; `disable_telemetry`; and `record_trajectory_feedback`. — [GitHub README](https://github.com/ahujasid/blender-mcp)
- **There are no dedicated animation or rigging tools.** The README says the AI writes Blender Python for "modelling, layout, materials, animation, rigging and retopology". — [GitHub README](https://github.com/ahujasid/blender-mcp)
- Documented limitations:
  - `execute_blender_code` "can be powerful but potentially dangerous" ("ALWAYS save your work"). Safe mode is **off by default**.
  - The addon socket "has no authentication or encryption" (keep it on localhost or tunnel over SSH).
  - Complex requests should be broken into smaller steps, and timeouts are handled by simplifying requests.
  - Asset downloads run on Blender's main thread and freeze the UI.
  - Only one MCP client may connect at a time.
  - Telemetry is on by default. Opt-in data "may be used ... to train AI models". — [GitHub README](https://github.com/ahujasid/blender-mcp)

**Unity**
- **Official Unity MCP server** [Beta, announced 2026-05-11]:
  - It ships inside the AI Assistant package (`com.unity.ai.assistant`) and requires Unity 6 (6000.0)+, a project connected to Unity Cloud, and an active trial or subscription to Unity's AI beta.
  - Capabilities: scene hierarchy and GameObject create/modify/delete, C# script create/read/modify, console logs, component read/write, build settings, and **custom C# MCP tools** registered by developers.
  - Clients: Claude Code, Cursor, Windsurf, Claude Desktop, VS Code Copilot, Kiro, Codex, Gemini.
  - The first connection triggers a "Pending Connection" accept dialog in the Editor.
  - The blog post mentions **no screenshot, play-mode, animation, Animator or Timeline tools**, and carries a beta disclaimer that features "may change, be limited, or be discontinued". — [Unity blog](https://unity.com/blog/unity-ai-mcp-how-to-get-started); docs exist at [Unity MCP overview](https://docs.unity3d.com/Packages/com.unity.ai.assistant@2.0/manual/unity-mcp-overview.html)
- One secondary source says Unity AI credits are not consumed by MCP use. — [gamedev.net](https://gamedev.net/news/4376-unity-ai-open-beta-how-to-get-started-with-mcp/) (secondary)
- **CoplayDev/unity-mcp** (originally justinpbarnett/unity-mcp, which now redirects) [Shipped, community]:
  - 14,824 stars, created 2025-03-18, pushed 2026-10-08.
  - Advertises "50 focused MCP tool entrypoints" in tool groups that include "vfx / animation / ui / testing".
  - Latest listed release is v10.3.0 (2026-10-04). Supports Unity 2021.3 LTS to 6.x, runs on Python 3.10+ via uv, and offers a remote-hosted server option with auth. — [ungh.cc](https://ungh.cc/repos/CoplayDev/unity-mcp); [GitHub](https://github.com/CoplayDev/unity-mcp)
- **IvanMurzak/Unity-MCP** ("AI Skills, MCP Tools, and CLI for Unity Engine") [Shipped, community]:
  - 4,416 stars. Has "70+ built-in tools".
  - **Four screenshot tools** (camera, Game View, **isolated GameObject render**, Scene View), play-mode start/stop/pause, and `tests-run` for EditMode and PlayMode tests.
  - Animation is an **optional "AI Animation" extension**. Other extensions cover Cinemachine, Timeline, Splines and more.
  - It **generates AI skills** tailored to OS, Unity version and installed packages, ships a CLI (`unity-mcp-cli`), and can run **inside a compiled game** (`UnityMcpPluginRuntime.Initialize`) so LLMs can drive NPCs or debugging at runtime. Apache-2.0. — [GitHub](https://github.com/IvanMurzak/Unity-MCP); [ungh.cc](https://ungh.cc/repos/IvanMurzak/Unity-MCP)
- **CoderGamester/mcp-unity**: 1,925 stars, pushed 2026-09-03. — [ungh.cc](https://ungh.cc/repos/CoderGamester/mcp-unity)

**Godot** (no official server found)
- **Coding-Solo/godot-mcp**: 6,001 stars, last push 2026-04-16. Its 14 tools are `launch_editor`, `run_project`, `get_debug_output`, `stop_project`, `get_godot_version`, `list_projects`, `get_project_info`, `create_scene`, `add_node`, `load_sprite`, `export_mesh_library`, `save_scene`, `get_uid` and `update_project_uids`. It works through the Godot CLI plus a bundled `godot_operations.gd`. **There are no screenshot or animation tools.** — [GitHub](https://github.com/Coding-Solo/godot-mcp); [ungh.cc](https://ungh.cc/repos/Coding-Solo/godot-mcp)
- **GDAI MCP** (3ddelano/gdai-mcp-plugin-godot, 101 stars) runs inside the editor and automatically screenshots the editor and the running game. — [GitHub](https://github.com/3ddelano/gdai-mcp-plugin-godot)
- The "Godot MCP Bridge" Glama listing claims AnimationPlayer create/list/remove, adding tracks, setting keyframes, viewport screenshots and executing GDScript. — [Glama](https://glama.ai/mcp/servers/fgw4xgj4s4)
- An "AI animation" extension adds AnimationPlayer authoring to the base `godot_mcp` plugin (Godot 4.3+). — [ai-game.dev docs](https://ai-game.dev/docs/extensions/godot/animation)
- Older servers have gone stale. ee0pdt/Godot-MCP has 618 stars but no push since 2025-03-19. — [ungh.cc](https://ungh.cc/repos/ee0pdt/Godot-MCP)

**Unreal Engine**
- **Epic's official "Unreal MCP"** [Experimental, UE 5.8]:
  - The plugin "embeds an MCP server inside the Unreal Editor process". It speaks HTTP/SSE only (no stdio or WebSocket) on `http://127.0.0.1:8000/mcp`. It is loopback-only, has **no authentication layer**, and "is not safe to expose beyond the local machine".
  - Tools come from separate toolset plugins (AllToolsets): SceneTools, ActorTools, MaterialInstanceTools and ObjectTools. GASToolsets ships disabled.
  - Custom tools can be written in Python (`@toolset_registry.tool_call`) or C++ (`UFUNCTION(meta=(AICallable))`).
  - Limits: "many features are incomplete or missing", no MCP resources or prompts, Live Coding cannot add tools (an editor restart is needed), and **tool calls run serially on the game thread**, so clients should not overlap calls.
  - The doc does not mention animation, Sequencer, Control Rig, IK Retargeter or viewport-capture tools. — [Epic docs](https://dev.epicgames.com/documentation/unreal-engine/unreal-mcp-in-unreal-editor?lang=en-US); [UE 5.8 release notes](https://dev.epicgames.com/documentation/unreal-engine/unreal-engine-5-8-release-notes?lang=en-US)
- A UEFN MCP documentation page also exists for Fortnite's editor. — [Epic UEFN MCP](https://dev.epicgames.com/documentation/fortnite/uefn-mcp)
- A community ecosystem is forming on the 5.8 stack. Examples include a Fab "Unreal MCP Setup Assistant" plugin and the CodeFizz Editor Agent forum post ("615 commands, UE 5.6 to 5.8"). — [Fab listing](https://www.fab.com/listings/651ed47d-db10-4dfa-9a6c-b8080d0d6b8e); [UE forums](https://forums.unrealengine.com/t/codefizz-editor-agent-drive-the-unreal-editor-from-claude-cursor-or-any-mcp-client-615-commands-ue-5-6-to-5-8/2736419)
- A vendor blog claims Epic called MCP core infrastructure it intends to carry into UE6. — [StraySpark](https://www.strayspark.studio/blog/epic-official-mcp-plugin-ue5-8-vs-third-party) [Claim, vendor]
- Earlier community servers have stalled:
  - chongdashu/unreal-mcp: 2,092 stars, last push 2025-04-22.
  - flopperam/unreal-engine-mcp: 1,097 stars. Its description says "This MCP is now owned by Aura!", a commercial agent.
  - kvick-games/UnrealMCP: 613 stars, last push 2025-06-22. — [ungh.cc chongdashu](https://ungh.cc/repos/chongdashu/unreal-mcp); [ungh.cc flopperam](https://ungh.cc/repos/flopperam/unreal-engine-mcp); [ungh.cc kvick](https://ungh.cc/repos/kvick-games/UnrealMCP)

**Roblox Studio: built-in MCP server** [Shipped]
- It is enabled in Studio under Assistant > Manage MCP Servers. It uses stdio transport, with quick-connect for Antigravity, Codex CLI, Claude Code, Claude Desktop, Cursor, Gemini CLI and VS Code. — [Roblox docs](https://create.roblox.com/docs/studio/mcp)
- It exposes roughly 27 tools, including:
  - `execute_luau` (in Edit, Client or Server datamodel)
  - `multi_edit` and `script_grep`
  - `start_stop_play` and `get_console_output`
  - **`screen_capture`** (viewport screenshot with an optional camera position and look-at target)
  - player input simulation: `character_navigation`, `user_keyboard_input`, `user_mouse_input`
  - generation tools: `generate_mesh`, `generate_material`, `generate_procedural_model`
  - a **`subagent`** tool (explore and playtest subagents)
  - a **`skill`** tool that serves best-practice reference material
  - `list_roblox_studios`; every call needs a `studio_id`.

  **No Animator, KeyframeSequence or animation-generation tools are listed.** — [Roblox docs](https://create.roblox.com/docs/studio/mcp)
- An earlier official standalone repo, Roblox/studio-rust-mcp-server, has 496 stars (created 2025-05-09). The community boshyxd/robloxstudio-mcp has 493 stars. — [ungh.cc Roblox](https://ungh.cc/repos/Roblox/studio-rust-mcp-server); [ungh.cc boshyxd](https://ungh.cc/repos/boshyxd/robloxstudio-mcp)

**three.js and web 3D** (no official three.js server)
- **threejs-devtools-mcp** (DmitriyGolub; 118 stars, created 2026-03-15) inspects and edits live three.js scenes, materials, shaders and lights over stdio (v0.2.1). Registry listings label it "Official", but that refers to the registry entry, not the three.js project. — [ungh.cc](https://ungh.cc/repos/DmitriyGolub/threejs-devtools-mcp); [LobeHub listing](https://lobehub.com/mcp/dmitriygolub-threejs-devtools-mcp)
- locchung/three-js-mcp has 29 stars, describes itself as "only basic function", and has not been pushed since 2025-03-23. — [ungh.cc](https://ungh.cc/repos/locchung/three-js-mcp)
- PlayCanvas has an official editor MCP server: playcanvas/editor-mcp-server, 137 stars, pushed 2026-09-09. — [ungh.cc](https://ungh.cc/repos/playcanvas/editor-mcp-server)
- Community three.js agent skills exist, e.g. CloudAI-X/threejs-skills, referenced by skill directories. — [Skillselion listing](https://skillselion.com/skills/nexu-io/open-design/threejs)

**Animation-specific MCPs**
- **Cascadeur**: no MCP server or official agent integration found. Its ML tools (AutoPosing, Inbetweening, AutoInterpolation, Video Mocap) run locally. — [Cascadeur help](https://cascadeur.com/help/category/285)
- **Mixamo**: community servers only, and they automate the website with a browser.
  - V1xel/mixamo-mcp has 4 stars (created 2026-04-05) and needs a saved browser session cookie. It searches animations, uploads characters for auto-rigging and downloads rigged FBX/GLTF.
  - A Playwright-based variant exposes in-place, mirror, overdrive, arm-space and trim parameters.
  - These are fragile by construction. — [Glama listing](https://glama.ai/mcp/servers/V1xel/mixamo-mcp); [LobeHub](https://lobehub.com/mcp/v1xel-mixamo-mcp); [ungh.cc](https://ungh.cc/repos/V1xel/mixamo-mcp)
- **LottieFiles: Lottie Creator MCP** [Shipped, 2026-04-15 blog]. It connects Claude, Cursor or Codex to Lottie Creator through a local bridge. It can generate an animation from a prompt and return a dotLottie file, create layers, adjust timing, generate variations and run accessibility checks. — [LottieFiles blog](https://lottiefiles.com/blog/working-with-lottie-animations/your-ai-can-now-control-lottie-creator-heres-what-that-actually-means); [LottieFiles docs](https://docs.lottiefiles.com/en/creator/13_ai-tools/lottie-creator-mcp)
- **Motion: Motion Studio MCP** [Shipped, paid Motion+]. It gives an LLM the latest Motion docs, the source of 330+ examples and the user's saved transitions. Motion says the reason is that LLMs "are trained on out-of-date information" (e.g. the old `framer-motion` import) and "can't visualise timing or easing curves". — [Motion docs](https://motion.dev/docs/studio-llm-documentation); [Motion AI Kit](https://motion.dev/docs/ai-kit)

**Adoption snapshot (stars on 2026-10-11, via ungh.cc)**

| Server | Owner type | Stars | Last push | Source |
|---|---|---|---|---|
| ahujasid/mcp-for-blender (blender-mcp) | community | 30,420 | 2026-10-06 | [link](https://ungh.cc/repos/ahujasid/blender-mcp) |
| CoplayDev/unity-mcp | community | 14,824 | 2026-10-08 | [link](https://ungh.cc/repos/CoplayDev/unity-mcp) |
| Coding-Solo/godot-mcp | community | 6,001 | 2026-04-16 | [link](https://ungh.cc/repos/Coding-Solo/godot-mcp) |
| IvanMurzak/Unity-MCP | community | 4,416 | 2026-10-10 | [link](https://ungh.cc/repos/IvanMurzak/Unity-MCP) |
| chongdashu/unreal-mcp | community | 2,092 | 2025-04-22 | [link](https://ungh.cc/repos/chongdashu/unreal-mcp) |
| CoderGamester/mcp-unity | community | 1,925 | 2026-09-03 | [link](https://ungh.cc/repos/CoderGamester/mcp-unity) |
| flopperam/unreal-engine-mcp | community, now commercial (Aura) | 1,097 | 2026-06-26 | [link](https://ungh.cc/repos/flopperam/unreal-engine-mcp) |
| Roblox/studio-rust-mcp-server | official (superseded by built-in) | 496 | 2026-04-03 | [link](https://ungh.cc/repos/Roblox/studio-rust-mcp-server) |
| playcanvas/editor-mcp-server | official | 137 | 2026-09-09 | [link](https://ungh.cc/repos/playcanvas/editor-mcp-server) |
| DmitriyGolub/threejs-devtools-mcp | community | 118 | 2026-04-07 | [link](https://ungh.cc/repos/DmitriyGolub/threejs-devtools-mcp) |
| V1xel/mixamo-mcp | community | 4 | 2026-04-05 | [link](https://ungh.cc/repos/V1xel/mixamo-mcp) |

### Inferences
- The vendors' pattern is "retrofit the existing editor with an MCP bridge plus generic script execution". No engine exposes an animation-domain vocabulary (clip, pose, contact, retarget, blend) as tools. An agent-first animation package would fill a real gap rather than duplicate an existing tool surface.
- Observation tools are the most transferable precedent:
  - blender-mcp `look` with a `frames` strip
  - Roblox `screen_capture` with explicit camera and look-at
  - Unity-MCP "isolated GameObject render"
  - Roblox input simulation and playtest subagents

  A headless "contact sheet / frame strip / metrics" toolset is a natural and differentiated extension of these, especially because none of them returns numeric motion metrics.
- Security posture in shipped servers is weak for a remote "ground station" model:
  - Unreal MCP: loopback-only, no auth.
  - Blender socket: no auth or encryption.
  - Roblox: "connect only trusted clients".

  A package meant for remote QA needs an authenticated transport by design.
- Unreal's serial game-thread execution and Roblox's per-call `studio_id` show that **stateful engine sessions are a recurring pain point**. This matches MCP 2026-07-28's move to stateless requests plus explicit server-minted handles (see Q2).
- Community engine MCPs churn fast: several 2025 leaders went stale within months, and one was absorbed into a commercial product. Adoption depends on an active maintainer and on following engine releases.

### Gaps
- I did not obtain the full tool catalog of Unity's official server from its docs (the blog lists categories only), nor the CoplayDev tool reference (the URL returned 404). Whether either exposes AnimationClip, Animator or Timeline editing is unverified.
- I could not confirm UE 5.8's exact release date. A re-uploaded video claims June 17, which is unverified.
- No evidence was found of any MCP for Cascadeur, DeepMotion, Rokoko, Plask or Meshy animation. These were not exhaustively searched after the search budget ran out.
- A Glama-listed "GDotMCP" reportedly includes a pixel-by-pixel screenshot-compare tool. I could not pin down its URL, so treat it as unverified.
- I did not review issue trackers such as blender-mcp's for animation-specific failure reports.

## 2. Agent interface standards and practice (MCP versions and Registry, Agent Skills, llms.txt, WebMCP, AGENTS.md, tool-design guidance)

### Takeaway
MCP is now foundation-governed (Agentic AI Foundation, Linux Foundation, since 2025-12-09). The current `latest` spec, **2026-07-28**, makes the protocol **stateless**, moves tasks into an extension and adds cache hints. The official Registry is **still a preview** (API frozen at v0.1). **Agent Skills** (Anthropic, 2025-10-16; open standard 2025-12-18) became the de facto way to ship domain knowledge to agents: 46 clients are listed on agentskills.io, and anthropics/skills has about 180k stars. Practitioner evidence favours **CLI + skills over large MCP tool schemas** for coding agents because of context cost. llms.txt is widely published but rarely fetched. WebMCP is an experimental Chrome origin trial built on a CG draft that has already changed API shape (`document.modelContext`).

### Cited Findings

**MCP specification versions**
- The `latest` changelog lists changes "since the previous revision, 2025-11-25" and links throughout to `/specification/2026-07-28/`. Major changes in 2026-07-28:
  - Protocol-level sessions and `Mcp-Session-Id` are removed. "Servers that need cross-call state use **explicit, server-minted handles passed as ordinary tool arguments**" (SEP-2567).
  - The `initialize` handshake is removed. Every request carries protocol version and capabilities in `_meta` (SEP-2575).
  - A new `server/discover` RPC.
  - `subscriptions/listen` replaces GET streams and resource subscribe.
  - Tasks move into an official extension (`io.modelcontextprotocol/tasks`) with polling via `tasks/get` (SEP-2663).
  - The Multi Round-Trip Requests pattern (`resultType: "input_required"`) replaces server-initiated sampling, elicitation and roots requests (SEP-2322).
  - SSE resumability is removed. — [MCP changelog (latest)](https://modelcontextprotocol.io/specification/latest/changelog)
- Minor changes in the same revision:
  - Servers "SHOULD return tools from `tools/list` in a deterministic order to ... improve LLM prompt cache hit rates".
  - `ttlMs`/`cacheScope` on list results (SEP-2549).
  - `inputSchema`/`outputSchema` loosened to any JSON Schema 2020-12, and `structuredContent` may be any JSON value (SEP-2106).
  - Roots, Sampling and Logging are deprecated (SEP-2577).
  - Dynamic Client Registration is deprecated in favour of Client ID Metadata Documents.
  - A feature-lifecycle policy with a minimum 12-month deprecation window (SEP-2596). — [MCP changelog (latest)](https://modelcontextprotocol.io/specification/latest/changelog)
- The **2025-11-25** revision introduced experimental Tasks (call-now, fetch-later), icons metadata (SEP-973), incremental scope consent (SEP-835), tool calling in sampling (SEP-1577), URL-mode elicitation (SEP-1036) and OpenID Connect Discovery support. — [MCP 2025-11-25 changelog](https://modelcontextprotocol.io/specification/2025-11-25/changelog); [WorkOS summary](https://workos.com/blog/mcp-2025-11-25-spec-update)

**Governance and adoption**
- MCP, goose (Block) and AGENTS.md (OpenAI) were donated to the new **Agentic AI Foundation**, a directed fund under the Linux Foundation, announced 2025-12-09. Anthropic cited **>10,000 active public MCP servers** and adoption by ChatGPT, Cursor, Gemini, Microsoft Copilot and VS Code. — [Anthropic announcement](https://www.anthropic.com/news/donating-the-model-context-protocol-and-establishing-of-the-agentic-ai-foundation); [SD Times](https://sdtimes.com/ai/linux-foundation-forms-agentic-ai-foundation-to-be-new-home-for-mcp-goose-and-agents-md/)
- A "97M monthly SDK downloads" figure circulates only in a secondary summary. — [feedbagel](https://feedbagel.com/post/anthropic-donates-model-context-protocol-to-agentic-ai-foundation-under-linux-fo) [Claim]
- The npm package `@modelcontextprotocol/sdk` had **66,130,762 downloads in the week 2026-10-03 to 10-09**. — [npm API](https://api.npmjs.org/downloads/point/last-week/@modelcontextprotocol/sdk)
- Stars on 2026-10-11: modelcontextprotocol/servers 91,129; spec repo 9,425; registry 7,333. — [ungh servers](https://ungh.cc/repos/modelcontextprotocol/servers); [ungh spec](https://ungh.cc/repos/modelcontextprotocol/modelcontextprotocol); [ungh registry](https://ungh.cc/repos/modelcontextprotocol/registry)

**Official MCP Registry** [Preview]
- It launched in preview on 2025-09-08, and the API was frozen at v0.1 on 2025-10-24. The README fetched 2026-10-11 still says it "is still a preview release and breaking changes or data resets may occur". v1 is intended for GA.
- Publishing uses the `mcp-publisher` CLI with namespace verification via GitHub OAuth, GitHub OIDC, DNS or HTTP challenge (e.g. `io.github.<user>/...`). — [Registry README](https://github.com/modelcontextprotocol/registry)
- A secondary guide says it hosts "nearly 2,000 servers". — [QVeris](https://qveris.ai/guides/mcp-registry/) [Claim]

**Anthropic Agent Skills**
- Published 2025-10-16. A skill is a folder with `SKILL.md` (`name` and `description` frontmatter) plus optional scripts and references.
- Progressive disclosure has three levels: metadata at startup, then the full SKILL.md when relevant, then linked files only when needed. Bundled context is "effectively unbounded".
- On bundling code: "sorting a list via token generation is far more expensive than simply running a sorting algorithm", and "many applications require the deterministic reliability that only code can provide".
- An update dated **2025-12-18** says Agent Skills was published "as an open standard for cross-platform portability". — [Anthropic engineering](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills)
- agentskills.io (fetched 2026-10-11) lists **46 client logos**, including Claude Code, Claude, "ChatGPT & Codex", Gemini CLI, Cursor, GitHub Copilot, VS Code, JetBrains Junie, OpenCode, OpenHands, Amp, Goose, Factory, Kiro, Roo Code, Mistral Vibe, TRAE, Spring AI, Databricks Genie Code, Snowflake Cortex Code, Tabnine and Laravel Boost. — [agentskills.io](https://agentskills.io)
- Stars on 2026-10-11:
  - anthropics/skills: **180,304** (created 2025-09-22)
  - agentskills/agentskills (spec): 26,027 (created 2025-12-16)
  - vercel-labs/skills (`npx skills` installer): 33,671 (created 2026-01-14) — [ungh anthropics/skills](https://ungh.cc/repos/anthropics/skills); [ungh agentskills](https://ungh.cc/repos/agentskills/agentskills); [ungh vercel-labs/skills](https://ungh.cc/repos/vercel-labs/skills)
- Skills are already used to ship **animation domain knowledge**:
  - Remotion ships 12 official skills (see Q3).
  - Roblox's MCP has a `skill` tool.
  - IvanMurzak's Unity-MCP generates skills per project. — [Remotion docs](https://www.remotion.dev/docs/ai/skills); [Roblox docs](https://create.roblox.com/docs/studio/mcp); [Unity-MCP](https://github.com/IvanMurzak/Unity-MCP)
- Supply-chain risk is an active research topic, e.g. "MalSkills: Detecting Malicious Skills in the Agentic Supply Chain" and "Formal Analysis and Supply Chain Security for Agentic AI Skills" (both 2026). — [arXiv 2603.27204](https://arxiv.org/pdf/2603.27204); [arXiv 2603.00195](https://arxiv.org/pdf/2603.00195)

**llms.txt**
- Adoption figures:
  - 8.7% of the top 1,000 sites served a valid llms.txt in June 2026, up from 0.3% in June 2025. — [Rankability tracker](https://www.rankability.com/data/llms-txt-adoption/)
  - 5.86% of the top 10k domains (586 valid files out of 1,606 HTTP-200 responses) in May 2026. — [Thunderbit](https://www.thunderbit.com/de/blog/llms-txt-website-trend)
  - Instances grew 8.8x, from 4,088 to 36,120, between June 2025 and May 2026. — [PPC Land, citing Originality.ai](https://ppc.land/llms-txt-adoption-rises-8-8x-but-97-of-files-get-zero-ai-requests/)
- Usage is minimal: an Ahrefs study found **97% of llms.txt files got zero requests in May 2026**, and AI retrieval bots made only 1.1% of requests to them. — [PPC Land](https://ppc.land/llms-txt-adoption-rises-8-8x-but-97-of-files-get-zero-ai-requests/)
- Agent-facing docs use it as an index pointer. Pages fetched for this research from modelcontextprotocol.io, agentskills.io and code.claude.com all begin with "Fetch the complete documentation index at: …/llms.txt". — [MCP changelog page](https://modelcontextprotocol.io/specification/latest/changelog); [agentskills.io](https://agentskills.io); [Claude Code docs](https://code.claude.com/docs/en/chrome)
- Motion publishes `llms.motion.dev`. — [Motion AI quick start](https://motion.dev/docs/ai-quick-start)
- AnswerDotAI/llms-txt: 2,656 stars. — [ungh](https://ungh.cc/repos/AnswerDotAI/llms-txt)

**WebMCP**
- The spec is a **Draft Community Group Report dated 9 October 2026** from the W3C Web Machine Learning CG. It is "not a W3C Standard" and not on the Standards Track. Editors are from Microsoft and Google.
- API: **`document.modelContext`** with `registerTool()`, `getTools()` and `executeTool()`. Tools have `name`, `title`, `description`, `inputSchema`, `execute` and `annotations` (`readOnlyHint`, `untrustedContentHint`, `consequentialHint`). Registration options include `exposedTo` and an abort `signal`.
- The spec describes a UA-provided "browser agent" that may expose tools "via Model Context Protocol, other proprietary 'function calling' methods". — [WebMCP spec](https://webmachinelearning.github.io/webmcp/)
- Chrome timeline:
  - Early preview program around Feb 2026 (then reported as `navigator.modelContext`). — [eWeek](https://www.eweek.com/de/news/google-webmcp-chrome-ai-web-standard-preview/); [Chrome EPP blog](https://developer.chrome.com/blog/webmcp-epp)
  - **Origin trial in Chrome 149** (blog dated 2026-06-09). — [Chrome blog](https://developer.chrome.com/blog/ai-webmcp-origin-trial)
  - Blink approval "LGTM to experiment from M149 to M156 inclusive", with a TAG review before shipping. — [blink-dev Intent to Experiment](https://groups.google.com/a/chromium.org/g/blink-dev/c/gmYffo5WOE8/m/OJxuQRP3AAAJ)
- Third-party blogs report that `provideContext()`/`clearContext()` were dropped in March 2026 and that `navigator.modelContext` was deprecated in Chrome 150. — [dev.to](https://dev.to/jangwook_kim_e31e7291ad98/webmcps-origin-trial-providecontext-is-already-gone-54j8); [MCP Playground blog](https://mcpplaygroundonline.com/blog/what-is-webmcp) [unverified against Chrome docs]
- Stars: webmachinelearning/webmcp 4,528. The earlier community polyfill MiguelsPizza/WebMCP has 1,104 stars and has not been pushed since 2025-10-07. — [ungh webmcp](https://ungh.cc/repos/webmachinelearning/webmcp); [ungh MiguelsPizza](https://ungh.cc/repos/MiguelsPizza/WebMCP)

**AGENTS.md**
- The repo now lives at `agentsmd/agents.md` (formerly openai/agents.md): 24,864 stars, created 2025-08-19. It was donated by OpenAI to the AAIF on 2025-12-09. — [ungh](https://ungh.cc/repos/openai/agents.md); [SD Times](https://sdtimes.com/ai/linux-foundation-forms-agentic-ai-foundation-to-be-new-home-for-mcp-goose-and-agents-md/)
- InfoQ credits both OpenAI and Anthropic for AGENTS.md. The press releases credit OpenAI. — [InfoQ](https://infoq.com/news/2025/12/agentic-ai-foundation/) (conflicting)

**Designing tools agents use well**
- Anthropic, "Writing effective tools for agents" (2025-09-11):
  - "More tools don't always lead to better outcomes". Consolidate workflows, e.g. `schedule_event` instead of separate `list_users`/`list_events`/`create_event`, and `search_logs` instead of `read_logs`.
  - Namespace tools (`asana_search`).
  - Return names rather than UUIDs.
  - Offer a `response_format` enum: in the article's example, DETAILED cost 206 tokens versus 72 for CONCISE.
  - Paginate, filter and truncate with sensible defaults. "For Claude Code, we restrict tool responses to 25,000 tokens by default."
  - Errors should "clearly communicate specific and actionable improvements".
  - Use unambiguous parameter names (`user_id`).
  - Evaluate with realistic multi-call tasks that have verifiable outcomes, tracking tool errors and token use. — [Anthropic engineering](https://www.anthropic.com/engineering/writing-tools-for-agents)
- **Playwright MCP's own README** says coding agents "might benefit from using the CLI+SKILLS instead" because CLI workflows "avoid loading large tool schemas and verbose accessibility trees". MCP "remains relevant for specialized agentic loops" with persistent state. — [Playwright MCP](https://github.com/microsoft/playwright-mcp)
- Claude Code docs: enabling Chrome by default "increases context usage since the browser tools and their instructions are always loaded". — [Claude Code docs](https://code.claude.com/docs/en/chrome)
- Unity-MCP markets "Efficient token usage" and finding things "in 1-2 steps" without measurements. — [Unity-MCP](https://github.com/IvanMurzak/Unity-MCP) [Claim]

### Inferences
- For an animation package, the evidence favours a **layered interface**:
  1. A deterministic library and CLI as the ground truth.
  2. Agent Skills (SKILL.md plus bundled scripts) to teach the motion format and verification workflow cheaply.
  3. A thin, consolidated MCP server (a few high-level tools with concise/detailed output modes) for clients without shell access or for remote ground-station use.
- MCP 2026-07-28's statelessness and "server-minted handles as ordinary tool arguments" fit an animation API well, e.g. `clip_id`, `rig_id` or `render_job_id` handles plus task-extension polling for long renders. Deterministic `tools/list` ordering and `ttlMs` matter for prompt-cache cost.
- Agent Skills' scale (46 listed clients, about 180k stars on the reference repo) makes SKILL.md the most portable way to distribute "how to animate with this library" knowledge. Skills supply-chain research shows that a community-contributed animation library needs provenance and validation (signing, CI checks) from day one. The Registry's namespace verification (GitHub OIDC, DNS) is a usable model.
- llms.txt is cheap to publish and is used by agent-facing doc sites, but there is no evidence AI crawlers rely on it. Treat it as a minor convenience, not a distribution channel.
- WebMCP could later let an in-browser runtime expose "console handles" (e.g. `registerTool('pose_at_frame', …)`) to browser agents. However, it is Chrome-only, origin-trial (M149–M156), and has changed API shape twice, so it is not a foundation to build on in 2026.

### Gaps
- I did not re-fetch the 2025-06-18 spec changelog this session, so its specific features are not re-verified here. (The 2026-07-28 changelog confirms `outputSchema`/`structuredContent` exist, since it loosens them.)
- I could not confirm the formal release announcement of 2026-07-28. Evidence that it is final is that the `latest` alias points to it. The page still contains one phrase ("introduced in this draft") that may be residual wording.
- Registry server count: only a secondary "nearly 2,000" figure.
- AGENTS.md adoption counts (repos using it) were not verified.
- Other browser vendors' positions on WebMCP (Mozilla, WebKit) were not found.

## 3. Code-first animation systems LLMs already succeed with, and why; is there a 3D character-animation analogue?

### Takeaway
Code-first 2D, motion-graphics and video systems have measurable agent success. Manim theorem videos reach 93.8% success with agentic planning, verification-loop motion graphics go from 58.8% to 93.6% correct, and Remotion, Motion and LottieFiles have shipped official agent skills or MCP servers. The common ingredients are text source, deterministic rendering, fast preview/render CLIs, up-to-date docs packaged for agents, and an automated check loop. Residual failures are visual layout errors, timing/"visual-logic drift" and hallucinated or outdated APIs. **There is no LLM-first text standard for 3D character animation.** glTF/VRMA are binary-buffer interchange formats, and the one LLM-keyframe paper found had to invent a compressed text encoding.

### Cited Findings

**Manim and LLM-generated math video**
- Stars on 2026-10-11: 3b1b/manim 94,859; ManimCommunity/manim 41,387; Generative Manim 932; TIGER-AI-Lab/TheoremExplainAgent 1,511. — [ungh 3b1b](https://ungh.cc/repos/3b1b/manim); [ungh community](https://ungh.cc/repos/ManimCommunity/manim); [ungh generative-manim](https://ungh.cc/repos/marcelo-earth/generative-manim); [ungh TEA](https://ungh.cc/repos/TIGER-AI-Lab/TheoremExplainAgent)
- **TheoremExplainAgent** (ACL 2025) generates videos longer than 5 minutes with Manim. On TheoremExplainBench (240 theorems, 5 automated metrics), the o3-mini agent reached a **93.8% success rate** and an overall score of 0.77. "Agentic planning is necessary". Yet "most of the videos produced exhibit minor issues with visual element layout". — [arXiv 2502.19400](https://arxiv.org/abs/2502.19400)
- **ManiBench** (Feb 2026, pilot) targets two Manim-specific failure modes:
  - "Syntactic Hallucinations": valid Python that references non-existent or deprecated Manim APIs, made worse by version conflicts.
  - "Visual-Logic Drift": visuals diverge from intent through timing errors or missing causal links.

  Metrics are Executability, Version-Conflict Error Rate, Alignment and Coverage. — [arXiv 2603.13251](https://arxiv.org/abs/2603.13251)
- Related benchmarks:
  - JanusCoder's DTVBench includes 102 Manim visualization tasks drawn from 3Blue1Brown code. — [arXiv 2510.23538](https://arxiv.org/pdf/2510.23538)
  - A "ManimBench" study evaluated 17 open sub-30B LLMs, with a Qwen 3 Coder 30B setup best. — [deeplearn.org summary](https://deeplearn.org/arxiv/815516/training-and-agentic-inference-strategies-for-llm-based-manim-animation-generation)
- Other agent pipelines on Manim: Manimator (paper to visual explanation) and PhysicsSolutionAgent. — [arXiv 2507.14306](https://arxiv.org/pdf/2507.14306); [arXiv 2601.13453](https://arxiv.org/pdf/2601.13453)

**Verification-in-the-loop for motion graphics (closest research precedent)**
- **MoVer** (Ma and Agrawala, Stanford; ACM TOG/SIGGRAPH Aug 2025) is a first-order-logic DSL whose predicates encode spatio-temporal properties (motion direction, timing, relative position) and run on any SVG animation.
- Failed-predicate reports are fed back to the LLM.
- On 5,600 synthetic prompts, the pipeline produced correct animations for **58.8% without iteration and 93.6% with up to 50 correction iterations**. The authors note that LLM animations "regularly fail to include all spatio-temporal properties described in the prompt". — [arXiv 2502.13372](https://www.arxiv.org/abs/2502.13372); [PyPI mover](https://pypi.org/project/mover/)
- **Keyframer** (Apple, Feb 2024) used GPT-4 to generate **CSS keyframe animation code** for SVGs.
  - Because the output is code, users "can directly edit animation properties" and keep iterating through prompts or edits.
  - The study combined formative interviews with 9 professionals and a 13-user exploratory study.
  - The repo now sits at apple-aiml-research/ml-keyframer with 76 stars. — [arXiv 2402.06071](https://arxiv.org/html/2402.06071v2); [ungh](https://ungh.cc/repos/apple/ml-keyframer)

**Remotion** (React video)
- remotion-dev/remotion: 63,066 stars. npm `remotion`: **2,077,970 weekly downloads**. — [ungh](https://ungh.cc/repos/remotion-dev/remotion); [npm API](https://api.npmjs.org/downloads/point/last-week/remotion)
- **Official Agent Skills** are installed with `npx skills add remotion-dev/skills` (also offered by `bun create video`) and aimed at Claude Code, Codex, Kimi Code and Cursor. There are 12 skills: `/remotion-best-practices`, `/remotion-create`, `/remotion-markup` (animations, layout, timing), `/remotion-studio` (preview), `/remotion-render` (render video or still), `/remotion-maps`, `/remotion-captions`, `/remotion-saas`, `/remotion-interactivity`, `/remotion-docs` (fetch docs as Markdown), `/remotion-upgrade` and `/remotion-multimedia`. — [Remotion docs](https://www.remotion.dev/docs/ai/skills)
- remotion-dev/skills: 5,011 stars, created 2026-01-19. — [ungh](https://ungh.cc/repos/remotion-dev/skills)

**Other web animation systems (agent features and status)**
- **GSAP**: "now 100% free for all users, thanks to Webflow's support", including formerly paid plugins such as SplitText and MorphSVG. The footer reads "A Webflow Product". 28,995 stars; 5,919,624 weekly npm downloads. — [GSAP pricing](https://gsap.com/pricing/); [ungh](https://ungh.cc/repos/greensock/GSAP); [npm](https://api.npmjs.org/downloads/point/last-week/gsap)
- **Motion** (formerly Framer Motion): motiondivision/motion has 33,950 stars. Weekly downloads: `motion` 24,733,397 and `framer-motion` 50,694,014. Its AI tooling (Motion Studio MCP, AI Kit with "transition visualisation" and "CSS spring generation") exists because LLMs "can't visualise timing or easing curves". — [ungh](https://ungh.cc/repos/motiondivision/motion); [npm motion](https://api.npmjs.org/downloads/point/last-week/motion); [npm framer-motion](https://api.npmjs.org/downloads/point/last-week/framer-motion); [Motion AI Kit](https://motion.dev/docs/ai-kit)
- **Rive**:
  - Scripting in **Luau** plus an in-editor **AI Coding Agent** launched 2026-01-13 (generate code, inline diffs, build layouts and view models). Five script types: Converter, Node, Layout, Test, PathEffect.
  - Scripting and the AI Agent are marked **early access**. The State Machine is a separate built-in feature, and no source shows the agent authoring state machines.
  - Luau was chosen for "a gradual type system, a first-class type checker, and richer static analysis" (Nov 2025).
  - Runtimes: rive-runtime 1,201 stars, rive-wasm 973. `@rive-app/canvas`: 1,168,387 weekly downloads. — [Rive blog: scripting live](https://rive.app/blog/scripting-is-live-in-rive); [Rive blog: AI agent](https://rive.app/blog/scripting-with-the-ai-coding-agent); [Rive: why Luau](https://rive.app/blog/why-scripting-runs-on-luau); [Rive features](https://rive.app/features); [npm](https://api.npmjs.org/downloads/point/last-week/@rive-app/canvas)
- **Lottie / dotLottie**:
  - airbnb/lottie-web: 32,194 stars, last push 2025-09-01; 6,266,291 weekly downloads.
  - LottieFiles/dotlottie-web: 893 stars; 1,652,160 weekly downloads.
  - Lottie Creator MCP for prompt-to-animation (2026-04-15). — [ungh lottie-web](https://ungh.cc/repos/airbnb/lottie-web); [ungh dotlottie-web](https://ungh.cc/repos/LottieFiles/dotlottie-web); [npm lottie-web](https://api.npmjs.org/downloads/point/last-week/lottie-web); [LottieFiles blog](https://lottiefiles.com/blog/working-with-lottie-animations/your-ai-can-now-control-lottie-creator-heres-what-that-actually-means)
- **Motion Canvas**: 19,268 stars, last push 2026-07-02. `@motion-canvas/core` has only 5,462 weekly downloads. Its fork Revideo (now midrender/revideo) has 4,094 stars. No official agent tooling was found. — [ungh](https://ungh.cc/repos/motion-canvas/motion-canvas); [npm](https://api.npmjs.org/downloads/point/last-week/@motion-canvas/core); [ungh revideo](https://ungh.cc/repos/redotvideo/revideo)
- **Theatre.js**:
  - 12,741 stars, but the last public push was 2024-08-14. The README says development moved to a private repo.
  - Snyk rates the npm package "inactive". `@theatre/core` has 18,654 weekly downloads.
  - Split licence: Apache-2.0 core, AGPL-3.0 studio. — [ungh](https://ungh.cc/repos/theatre-js/theatre); [Snyk](https://snyk.io/advisor/npm-package/theatre); [Theatre docs](https://docs.theatrejs.com/); [npm](https://api.npmjs.org/downloads/point/last-week/@theatre/core)
- **p5.js**: 24,111 stars; `p5` has 91,796 weekly npm downloads (it is mostly used via CDN or the web editor, so npm undercounts). — [ungh](https://ungh.cc/repos/processing/p5.js); [npm](https://api.npmjs.org/downloads/point/last-week/p5)
- **Reference points** for the "three.js/Rapier-like" positioning (stars on 2026-10-11; npm figures are weekly downloads):

  | Project | Stars | npm weekly downloads |
  |---|---|---|
  | mrdoob/three.js | 116,213 | 20,521,334 (`three`) |
  | pmndrs/react-three-fiber | 32,845 | not checked |
  | BabylonJS/Babylon.js | 26,150 | not checked |
  | dimforge/rapier | 5,838 | not checked |

  — [ungh three](https://ungh.cc/repos/mrdoob/three.js); [npm three](https://api.npmjs.org/downloads/point/last-week/three); [ungh r3f](https://ungh.cc/repos/pmndrs/react-three-fiber); [ungh babylon](https://ungh.cc/repos/BabylonJS/Babylon.js); [ungh rapier](https://ungh.cc/repos/dimforge/rapier)

**Is there a 3D character-animation analogue?**
- **VRM Animation (.vrma)** is the closest open "humanoid animation" standard. It is stored as **glTF** with the `VRMC_vrm_animation` extension, which maps glTF nodes to humanoid bones. One .vrma can drive any VRM model, retargeting is "left to the importing implementation", and it can also carry facial-expression animation. UniVRM supports import and export. — [vrm.dev VRMA](https://vrm.dev/en/vrma/)
- The one LLM-keyframe paper found (GPT-4 driving rigged characters in Unity) **had to invent a text encoding**: "structured strings containing joint names followed by time-stamped vectors (quaternions ... and 3D coordinates for root position)". "To manage LLM token limits, data is compressed by outputting only keyframes and truncating floating-point numbers to a single significant figure." The LLM is framed as a "drafting" tool. — [arXiv 2310.17838](https://arxiv.org/pdf/2310.17838)
- A 2025 survey of generative character animation covers learned text-to-motion models (MDM, MotionGPT) evaluated with FID, R-Precision and Diversity on HumanML3D, not code or text authoring. — [arXiv 2504.19056](https://arxiv.org/html/2504.19056v1)

### Inferences
- **Why these systems work with LLMs** (synthesising the above):
  1. **Text source in a mainstream language** (Python, TS/React, CSS, Luau) that models have seen at scale.
  2. **Deterministic render to frames or stills**, enabling repeatable checks (Remotion's `/remotion-render`, Manim scenes).
  3. **Fast preview and render CLIs** (`remotion-studio`, `remotion-render`).
  4. **Composable primitives** (tweens, timelines, springs).
  5. **Vendor-maintained agent docs and skills**, which counter stale-API hallucination (Motion's `framer-motion` example; ManiBench's version-conflict failure class).
  6. **Machine-checkable specs**: MoVer raised correctness from 58.8% to 93.6% purely via verifier feedback.

  An agent-first 3D animation package should copy all six, and items 2 and 6 matter most.
- The persistent residual failures, layout in TheoremExplainAgent and timing/"visual-logic drift" in ManiBench, are exactly the class that needs **visual or metric verification**. For 3D character motion this argues for numeric checks (contact, foot-slide distance, joint limits, penetration) rather than relying on the LLM's "eye".
- No 3D character-animation equivalent of "Remotion for agents" was found. Existing standards (glTF, VRMA) are interchange formats with binary accessors and importer-defined retargeting, not authoring formats designed for diffs, review and LLM editing. That leaves room for an LLM-first textual motion format that compiles to glTF/VRMA.
- Adoption scale matters for positioning. Motion and GSAP have tens of millions of weekly installs and Remotion about 2M, while Motion Canvas and Theatre.js are small or dormant despite strong star counts. Stars are a weak proxy, and active maintenance plus agent tooling seem to track real usage.

### Gaps
- No quantitative studies were found of LLM success rates for GSAP, Motion, p5.js or raw Lottie JSON generation.
- Remotion's determinism guarantees (frame as a pure function) were not fetched from its docs this session, so they are stated as inference.
- BVH or USD skeletal-animation text formats were not researched after the search budget ran out.
- No evidence was found on how well LLMs write VRMA/glTF animation directly.
- Generative Manim usage numbers beyond stars were not available.

## 4. "AI-native" or "agent-first" game engines and animation tools (2025–2026)

### Takeaway
"AI-native" game creation in 2025–26 takes four shapes:
- hosted prompt-to-game platforms (Rosebud)
- generative asset or "4D" object pipelines inside incumbent platforms (Roblox Cube)
- research world models that generate pixels rather than run game state (Genie 3, Microsoft Muse/WHAM)
- incumbents bolting on MCP (Unity, Unreal, Roblox)

Open-source "agent-first" projects are young tooling and research layers (OpenGame, Agent Game Forge), not engines. **No library positioning itself as an AI-native or LLM-native character animation library or standard was found.**

### Cited Findings
- **Roblox Cube**:
  - Cube 3D was open-sourced as Roblox/cube (1,270 stars, created 2025-03-11). — [ungh](https://ungh.cc/repos/Roblox/cube)
  - **4D generation launched 2026-02-05** (open beta) on the Cube Foundation Model, with two schemas at launch: "Car-5" (body plus four wheels) and "Body-1" (single mesh). Players can drive or fly the generated objects.
  - Players generated over 160,000 objects during early access, which began in November 2025.
  - Roblox plans custom schemas, image-to-3D, and "real-time dreaming" (world-model research). **I found no evidence of character-animation generation.** — [Roblox newsroom](https://about.roblox.com/de/newsroom/2026/02/accelerating-creation-powered-roblox-cube-foundation-model); [Outlook Respawn](https://respawn.outlookindia.com/gaming/gaming-news/cube-3d-powers-robloxs-new-4d-interactive-object-tools); [Cinevva](https://app.cinevva.com/news/2026-03-01-roblox-4d-ai-creation)
  - A 64% playtime uplift figure comes from a single developer's account. — [Cinevva](https://app.cinevva.com/news/2026-03-01-roblox-4d-ai-creation) [Claim]
  - Roblox's MCP exposes `generate_mesh`, `generate_material` and `generate_procedural_model` to agents. — [Roblox docs](https://create.roblox.com/docs/studio/mcp)
- **Rosebud AI**: a browser platform for prompt-driven 2D/3D games with a remixable gallery. A late-2024 $25M Series A is reported. — [B12 directory](https://www.b12.io/ai-directory/rosebud-ai/); [NeuronFeed](https://neuronfeed.com/startups/rosebud-ai)
  - Claims of "70,000 creators and 1 million+ games" are marketing and unverified. — [Rosebud blog](https://lab.rosebud.ai/blog/how-to-make-a-minecraft-game-2026) [Claim]
- **Genie 3** (Google DeepMind, Aug 2025) [Research preview]:
  - 720p at 24 fps.
  - Worlds stay consistent for "a few minutes", and memory of specific interactions reaches about a minute.
  - "Inaccuracies tend to increase the longer the world is actively generated", and multi-agent interaction is still a research challenge.
  - Offered as a limited research preview. — [DeepMind Genie](https://deepmind.google/genie); [The Decoder](https://the-decoder.com/google-deepminds-genie-3-generates-interactive-3d-worlds-that-stay-consistent-for-multiple-minutes/)
  - Analysts note its consistency is emergent rather than enforced by an explicit 3D representation. — [BD TechTalks](https://bdtechtalks.com/2025/08/07/deepmind-genie-3/)
  - Coverage of a GDC talk quotes a DeepMind presenter: "We're not at all in a stage where we can just, say, make a game with it." — reported in search-result coverage; candidate source [gamedev.net](https://gamedev.net/news/2083/) (exact outlet not pinned down)
- **Microsoft Muse / WHAM** (Feb 2025) [Research/demo]:
  - Output is 300×180 px and stays consistent for up to about 2 minutes.
  - The WHAMM Quake II demo ran at 640×360 and 10 fps (versus WHAM's 1 fps).
  - Microsoft notes enemies "often appear fuzzy", combat damage "can be incorrect", and the model forgets off-screen objects after about 1 second. It calls the model a "generative approximation". — [Microsoft Research blog](https://www.microsoft.com/en-us/research/?p=1135867); [HotHardware](https://hothardware.com/news/microsoft-shows-off-gen-ai-built-quake-ii); [Laptop Mag](https://www.laptopmag.com/ai/microsoft-muse)
- **Open-source "agent-first" game tooling**:
  - **OpenGame** (arXiv 2604.18394; leigest519/OpenGame, **2,978 stars**, created 2026-04-20) is an agentic framework for end-to-end web game creation on Phaser, built on qwen-code. — [arXiv](https://arxiv.org/html/2604.18394v1); [ungh](https://ungh.cc/repos/leigest519/OpenGame)
  - **Agent Game Forge** (211 stars, created 2026-05-02) is a local-first 2D game IDE where Codex or Claude Code drives development, with a visual editor for fixing what the agent gets wrong. Godot and Unity are on the roadmap. — [GitHub](https://github.com/0x0funky/agent-game-forge); [ungh](https://ungh.cc/repos/0x0funky/agent-game-forge)
  - gamestudio-subagents is a set of agent prompts for multiple engines. — [GitHub](https://github.com/pamirtuna/gamestudio-subagents)
- **"AI-native animation library" searches**: no matching library was found. The closest items are:
  - "polyfork", a library of programmatic three.js assets whose site is designed to be agent-readable (one X post, self-reported usage by "dozens"). — [X post](https://x.com/lucas_martinic/status/2084552722439659700)
  - IgnitionAI, whose planned React Three Fiber agent environments are marked "coming soon". — [Hugging Face](https://huggingface.co/IgnitionAI)
  - MCP servers that manipulate three.js, A-Frame or Babylon scenes. — [Glama three.js integrations](https://glama.ai/mcp/servers/integrations/threejs)
- **Learned skeletal motion generators**, adjacent but not code- or LLM-authored: UniMate (SIGGRAPH Asia 2026, "One Unified Model to Animate Diverse Skeletons") and SkelMo (universal skeletal motion for rigged shapes). They report MPJPE, Chamfer Distance and FID. — [arXiv 2609.05415](https://arxiv.org/html/2609.05415); [arXiv 2606.01518](https://arxiv.org/html/2606.01518)

### Inferences
- **World models are not engines.** Each frame is generated by a network, so there is no explicit authoritative state, no deterministic rules, no addressable assets, and no API to author or edit a walk cycle. State is lost after minutes (Genie 3) or seconds off-screen (WHAMM), and combat or physics consistency is unreliable. They cannot replace a runtime animation library and are irrelevant to a code-and-text pipeline except as a future source of reference footage.
- The market gap is real but narrow. Incumbents are agent-accessible through generic MCP bridges, generation platforms focus on assets or objects, and no one ships an open, LLM-first character-animation format, runtime and verification toolchain. The nearest analogues (Remotion, Lottie Creator MCP, Rive's AI agent) are all 2D or motion-graphics.
- Agent Game Forge's "visual editor for fixing what the agent gets wrong" and Unity's connection-approval prompt are early examples of the human-in-the-loop "ground station" role. Both are local, not remote.

### Gaps
- Project Genie (the consumer rollout of Genie 3) details were not retrieved.
- Whether Roblox Cube supports character or skeletal animation generation (a "4D characters" schema) is unconfirmed.
- Rosebud usage metrics are unverified.
- The "agent-first engine" search was a single extended query. Smaller GitHub projects describing themselves as "LLM-native animation" may exist that the search did not surface.

## 5. What LLMs and VLMs can and cannot do: keyframe/procedural authoring, VLM judgment of motion and physics, image/video token cost, failure modes

### Takeaway
There is **no benchmark of frontier LLMs authoring or editing skeletal keyframes**. The evidence is indirect:
- LLMs draft simple keyframes or animation code with heavy compression.
- They do well on 2D motion graphics when a verifier closes the loop.
- They struggle even with simple 3D-scene code edits (BlenderGym).

VLMs are weak judges of motion and physics:
- PhysBench: best about 49%, average about 40% (2025 models).
- MotionBench: most models below 60%.
- Frame-order and arrow-of-time tests: near chance for some models.
- Spatial left/right: 56% versus 99% for humans in What'sUp.

The newer motion benchmarks compute foot sliding and penetration **geometrically, not by VLM**. Images cost about 1.3k tokens per megapixel on Claude, and Gemini video costs 66–258 tokens per frame but samples at 1 fps by default, which is too coarse for gait.

### Cited Findings

**LLM authoring of animation**
- GPT-4 has been used to produce Unity C# animation state logic and keyframes encoded as text, compressed to keyframes only with 1-significant-figure floats. It is described as a drafting tool, and no quantitative evaluation was found. — [arXiv 2310.17838](https://arxiv.org/pdf/2310.17838)
- GPT-3.5 has been queried for parameters driving facial blend shapes and body motion for story characters (2024). — [Normoyle et al. 2024](https://alinen.net/research/normoyle24LLMAnimation.pdf)
- **BlenderGym** (CVPR 2025) has 245 start/goal scene pairs across object placement, lighting, procedural materials, **blend shapes** and procedural geometry, scored on code-based reconstruction.
  - "Even the strongest" VLM system struggled with tasks Blender users find fairly easy.
  - Verifier quality improves with extra inference compute, and compute is best split between generation and verification. — [arXiv 2504.01786](https://arxiv.org/abs/2504.01786v1); [CVPR open access](https://openaccess.thecvf.com/content/CVPR2025/html/Gu_BlenderGym_Benchmarking_Foundational_Model_Systems_for_Graphics_Editing_CVPR_2025_paper.html)
- 2D motion graphics: MoVer goes from 58.8% to 93.6% with verifier feedback, and TheoremExplainAgent reaches 93.8% success with layout issues. — [arXiv 2502.13372](https://www.arxiv.org/abs/2502.13372); [arXiv 2502.19400](https://arxiv.org/abs/2502.19400)
- An extended search found **no standard benchmark** for judging LLM-generated keyframe code on foot sliding, joint limits or human-rated quality. — [search synthesis; closest works: arXiv 2310.17838](https://arxiv.org/pdf/2310.17838), [arXiv 2504.19056](https://arxiv.org/html/2504.19056v1)

**VLM physical and motion understanding**
- **PhysBench** (ICLR 2025):
  - 10,002 interleaved video-image-text entries across 4 domains and 19 subclasses; 75 VLMs tested.
  - Average accuracy is about 40%, and the best (GPT-4o) reaches **49.49%**.
  - Errors are attributed to missing physical knowledge and perceptual inaccuracies. The PhysAgent framework improved GPT-4o by 18.4%. — [arXiv 2501.16411](https://arxiv.org/pdf/2501.16411)
- **MotionBench** (CVPR 2025):
  - 5,385 videos and 8,052 QAs across six categories: Motion Recognition, Location-related Motion, Action Order, Repetition Count, Motion-related Objects, Camera Motion.
  - "Most state-of-the-art models can only achieve accuracy lower than 60%". The best existing model was Qwen2VL-72B at 0.57/0.58 (dev/test).
  - Many models accept only 16–64 frames, i.e. about 0.2 fps for a 5-minute video. Higher frame rates help. — [arXiv 2501.02955 (HTML)](https://arxiv.org/html/2501.02955v1)
- **VideoPhy-2** (ICLR 2026) evaluates physical commonsense of video *generators* with human raters.
  - The best model's joint score on the hard subset is 47.7% (22% in the v1 preprint), and models "particularly struggle with conservation laws like mass and momentum".
  - It ships an automatic evaluator, VideoPhy-2-Autoeval. — [arXiv 2503.06800](https://arxiv.org/pdf/2503.06800); [ICLR 2026](https://iclr.cc/virtual/2026/poster/10010425)
- **Temporal order**:
  - In TemporalVQA, GPT-4o reached only **49.1%** consistent accuracy on "which frame came first" and 70% on time-lapse estimation. — [arXiv 2501.10674](https://arxiv.org/abs/2501.10674v2)
  - Strong VLMs show "minimal or no performance degradation when frames are shuffled or reversed" on standard temporal benchmarks, which suggests context shortcuts.
  - On arrow-of-time judgments (AoT-PsyPhyBENCH), prompting and fine-tuning gains are "minimal and inconsistent". — [arXiv 2510.26241](https://arxiv.org/pdf/2510.26241)
  - EGO-FLIGHT frame-ordering results are "substantially below the human baseline". — [ICLR 2026](https://iclr.cc/virtual/2026/10018040)
- **Left/right and spatial relations**: in What'sUp (EMNLP 2023), all 18 VLMs "perform poorly" on left/right/up/down. BLIP-VQAv2 scored 56% versus 99% for humans, which the authors attribute to scarce spatial supervision in corpora like LAION-2B. — [arXiv 2310.19785](https://arxiv.org/abs/2310.19785)
- **Foot sliding, floating and penetration**:
  - MBench uses a VLM only for semantic metrics (generalizability, condition consistency) and computes **foot floating, sliding and body penetration with physics-based metrics**. — [arXiv 2510.26794](https://arxiv.org/pdf/2510.26794); [MBench leaderboard](https://wruisi-mbench-leaderboard.hf.space)
  - HumanScore tried foot-ground contact detection from SMPL fits plus depth and dropped it because scores were "quasi-binary" with low discriminative power. — [arXiv 2604.20157](https://arxiv.org/pdf/2604.20157)
  - Common geometric definitions: penetration is the fraction of frames where a toe intersects the ground, and sliding is toe travel while below a height threshold. — [UniMoGen arXiv 2505.21837](https://arxiv.org/pdf/2505.21837)
  - A survey notes "a lack of a standardized metric for quantifying physical plausibility". — [arXiv 2307.10894](https://arxiv.org/pdf/2307.10894)

**Token cost of images and video**
- **Claude**:
  - An image costs `⌈width/28⌉ × ⌈height/28⌉` visual tokens.
  - Standard tier: max 1,568 px long edge and 1,568 tokens. High-resolution tier (Claude 4.7 and later): max 2,576 px and 4,784 tokens.
  - Examples: 1000×1000 costs **1,296 tokens**; 1092×1092 costs 1,521; 1920×1080 costs 1,560 (standard, downscaled) or 2,691 (high-res).
  - Up to 600 images per request (100 for 200k-context models). Above 20 images, a stricter per-image limit applies (keep each image ≤2,000 px). The request limit is 32 MB.
  - "**Animations are unsupported, and only the first frame is used**" (GIF).
  - The docs' cost example: at Opus 5's $5 per million tokens, a 1000×1000 image costs about $6.48 per thousand images.
  - Listed limitations include approximate spatial reasoning and localisation, imprecise counting, and errors on images under 200 px. — [Claude vision docs](https://platform.claude.com/docs/en/build-with-claude/vision)
- **Gemini**:
  - Video frames are extracted at **1 FPS** by default, at **258 tokens per frame** or 66 at low media resolution. Audio adds 32 tokens/s, for about 300 tokens/s (high) or about 100 tokens/s (low).
  - Up to 1 hour (high) or 3 hours (low) of video fits in a 1M context.
  - Custom `fps` and clipping are supported in "static" mode. The docs warn that "fast action sequences might lose detail due to the 1 FPS sampling rate".
  - An "agentic" video mode on some Flash models uses "up to 88% fewer tokens" for long content. — [Gemini video understanding docs](https://ai.google.dev/gemini-api/docs/video-understanding)

### Inferences
- **Computed token budgets** (from the Claude formula and the Gemini rates above):
  - Claude contact sheet: a 1024×1024 sheet is 37×37 = 1,369 tokens, e.g. 16 frames at 256 px each, about $0.007 at $5/M.
  - Claude tier limits for square sheets: standard-tier models cap at about 1092×1092 (1,521 tokens), and larger sheets are downscaled, shrinking each tile. High-res models fit about 1,932×1,932 (69×69 = 4,761 tokens), e.g. a 6×6 grid of 320 px tiles.
  - Claude separate frames: sixty separate 256×256 frames cost about 6,000 tokens and trip the more-than-20-images rule, so **tiling into contact sheets is strictly better** than sending frame sequences. Animated GIFs are useless because only the first frame is read.
  - Gemini 2-second clip: at the default 1 fps it yields only 2 sampled frames, useless for a walk cycle. Sampling 30 fps would cost about 60 × 258 = 15,480 tokens (or 3,960 at low resolution).
- **Division of labour.** VLMs should judge coarse semantics ("does this read as a confident walk", "is the pose silhouette clear", "did the character face the wrong way"). Subtle physics and contact errors should be **numeric**: foot-slide distance per contact, penetration depth, joint-limit violations, root-velocity continuity, left/right contact timeline. This mirrors MBench's split and the HumanScore negative result.
- Left/right confusion and weak temporal ordering argue for **labelled visuals**: annotate L/R limbs with colour plus text, number the frames on the sheet, and add ground-contact markers. Tools should also return a **text metric report alongside images**, so the agent is not inferring direction or timing from pixels alone.
- MoVer and BlenderGym together suggest the winning loop is "LLM proposes, deterministic verifier reports failed predicates, LLM repairs", with compute deliberately allocated to verification. An animation package should treat a predicate/metric DSL ("left_foot planted frames 10–18; slide < 1 cm") as a first-class feature.

### Gaps
- OpenAI GPT-5-class image token pricing was not verified this session (search budget exhausted).
- No 2026 frontier-model (Claude 4.x/5, GPT-5.x, Gemini 3.x) scores on PhysBench or MotionBench were found. The cited numbers are mostly 2025-era models, and current models are likely better but unmeasured here.
- No study was found measuring frontier LLMs editing skeletal keyframes (quaternions/Euler curves) directly, or comparing keyframe-data editing with procedural-code authoring.
- No validated VLM judge for foot sliding or interpenetration was found; the evidence points the other way.

## 6. How agent harnesses do visual verification (Playwright MCP, Chrome DevTools MCP, headless WebGPU/SwiftShader, GPU-less sandboxes, screenshot diffs) and the practical limits

### Takeaway
Agents verify UI work through browser tooling:
- Playwright MCP (accessibility-tree first, screenshots read-only)
- Chrome DevTools MCP
- Vercel's agent-browser
- Claude Code's Chrome integration (visible, headed Chrome)
- Cursor's built-in browser

For **3D/WebGPU content**, there are hard practical limits:
- Cloud sandboxes typically have **no GPU**. This research container had none.
- Software rendering needs explicit SwiftShader/Vulkan flags and drivers.
- **Linux headless Chrome cannot screenshot WebGPU canvases upstream**, so headed Chrome plus Xvfb is required.
- Failures are often **silent**: a black or blank canvas, or three.js silently falling back to WebGL2.
- SwiftShader is a CPU rasterizer, so heavy scenes drop to single-digit FPS.

An agent-first animation package should render its own verification images deterministically (offscreen readback or CPU/headless paths) rather than depend on screenshotting a live canvas.

### Cited Findings

**Browser MCPs and CLIs**
- **Playwright MCP** (microsoft/playwright-mcp, **38,005 stars**; `@playwright/mcp` 6,607,817 weekly downloads):
  - It "uses Playwright's accessibility tree, not pixel-based input". `browser_take_screenshot` warns "You can't perform actions based on the screenshot".
  - Opt-in `--caps=vision` adds coordinate tools. `devtools` adds tracing, video and recording, and `testing` adds `browser_verify_*` assertions.
  - `--headless` and `--isolated` modes. The Docker image is headless Chromium only.
  - It recommends CLI+skills for coding agents on token grounds. — [GitHub](https://github.com/microsoft/playwright-mcp); [ungh](https://ungh.cc/repos/microsoft/playwright-mcp); [npm](https://api.npmjs.org/downloads/point/last-week/@playwright/mcp)
  - A practitioner write-up notes accessibility snapshots are cheap in tokens but weak on **animation**, layout precision and responsive breakpoints. — [Daniel Vaughan, 2026-08-14](https://codex.danielvaughan.com/2026/08/14/codex-cli-playwright-mcp-browser-automation-accessibility-snapshots-testing/)
- **Chrome DevTools MCP** ("Chrome DevTools for coding agents"; **53,248 stars**, created 2025-09-11; `chrome-devtools-mcp` 1,038,102 weekly downloads):
  - `--headless`, `--isolated` and `--slim` modes.
  - Performance tools may send trace URLs to the CrUX API (`--no-performance-crux` disables this).
  - Officially supports only Chrome and Chrome for Testing. Usage statistics are on by default. — [GitHub](https://github.com/ChromeDevTools/chrome-devtools-mcp); [ungh](https://ungh.cc/repos/ChromeDevTools/chrome-devtools-mcp); [npm](https://api.npmjs.org/downloads/point/last-week/chrome-devtools-mcp)
- **agent-browser** (vercel-labs; "Browser automation CLI for AI agents"; **43,779 stars**, created 2026-01-11). — [ungh](https://ungh.cc/repos/vercel-labs/agent-browser)
- **Claude Code + Chrome** (`claude --chrome`, via the Claude in Chrome extension):
  - "Browser actions run in a visible Chrome window in real time".
  - Capabilities: read console errors and DOM, "design verification" against a Figma mock, "check for visual regressions", record GIFs, save screenshots to disk.
  - Requires a direct Anthropic plan and `/login` auth. Not supported in WSL or through Bedrock, Vertex or Foundry.
  - Default-on increases context usage. — [Claude Code docs](https://code.claude.com/docs/en/chrome)
- **Cursor** (2.0, around Oct 2025): the agent "can open a browser, navigate web pages, click elements, fill forms, and take screenshots". — [Cursor help](https://cursor.com/help/ai-features/browser); [Shuttle blog](https://www.shuttle.dev/blog/2025/10/31/cursor-2.0)
  - Forum reports describe the screenshot tool going missing in some builds (fixed in 2.2.36 per one user) and "browser tools not found" in 2.3.18+ and Early Access builds. — [Cursor forum](https://forum.cursor.com/t/browser-screenshot-tool-now-missing/145855); [Cursor forum](https://forum.cursor.com/t/ai-can-not-found-the-browser-tools/149307)
- **OpenAI Codex**: cloud tasks run in isolated containers with network access off by default, and the agent can install dependencies and run Playwright tests. — [OpenAI Codex docs (llms-full)](https://developers.openai.com/codex/llms-full.txt); [TestDino guide](https://www.testdino.com/blog/playwright-tests-with-codex)
  - A third-party guide says Codex "can't see a live app the way MCP-based tools can". — [TestDino](https://www.testdino.com/blog/playwright-tests-with-codex) [Claim]
- **Engine-side capture tools** (alternatives to the browser): Roblox `screen_capture` with camera parameters; IvanMurzak Unity-MCP camera, Game View, isolated-object and Scene View captures; blender-mcp `look` with `frames`; GDAI automatic editor and game screenshots. — [Roblox docs](https://create.roblox.com/docs/studio/mcp); [Unity-MCP](https://github.com/IvanMurzak/Unity-MCP); [blender-mcp](https://github.com/ahujasid/blender-mcp); [GDAI](https://github.com/3ddelano/gdai-mcp-plugin-godot)

**Headless WebGL/WebGPU without a GPU**
- agent-browser's WebGPU guide:
  - Flags: `--enable-unsafe-webgpu`, plus SwiftShader software-Vulkan flags on Linux.
  - Without `libvulkan1` and `mesa-vulkan-drivers`, `requestAdapter()` returns `null`.
  - **Linux headless WebGPU screenshots are "not supported headless upstream"**: use `--headed` with an auto-started Xvfb. Windows headless captures come out black. macOS (Metal) works headless.
  - Early screenshots can show a blank canvas with no error.
  - "three.js `WebGPURenderer` switches to WebGL2 without an error when no adapter is available".
  - `drawImage` on a WebGPU canvas can read transparent black; use `copyTextureToBuffer` plus `mapAsync` for pixel readback.
  - "SwiftShader is a CPU rasterizer ... heavy scenes can drop to single-digit FPS".
  - `agent-browser doctor --webgpu` runs pixel-based render and screenshot checks. — [agent-browser WebGPU docs](https://agent-browser.dev/webgpu)
- Chromium's documented WebGL software path is `--use-gl=angle --use-angle=swiftshader-webgl --enable-unsafe-swiftshader`. SwiftShader is supported for headless or GPU-less testing "by opting in but is not intended for running untrusted content". — [Chromium SwiftShader doc](https://chromium.googlesource.com/chromium/src/+/da170c2267b2201954efe1c8fa5d2d89ab09f7bf/docs/gpu/swiftshader.md)
- A chromedp commit notes "in Chromium 139+, falling back to Swiftshader will be opt in". — [chromedp commit](https://chromium.googlesource.com/external/github.com/chromedp/chromedp/+/refs/tags/v0.14.1)
- Emscripten's WebGPU test config uses `--enable-unsafe-webgpu --use-webgpu-adapter=swiftshader --enable-features=Vulkan`. — [Emscripten test change](https://chromium.googlesource.com/external/github.com/kripken/emscripten/+/refs/heads/webgpu_testing%5E%21/)
- One project found `--disable-gpu` breaks WebGL on Chrome 130+. A write-up warns GL rendering may need an X display even when headless and can silently degrade, so CI must check output, not exit codes. — [Microlink blog](https://microlink.io/blog/webgl-without-a-gpu)

**GPU-less cloud sandboxes** (first-hand observation, no URL)
- In this research session's Claude Code cloud container on 2026-10-11: no `nvidia-smi`, no `/dev/dri`, no GPU listed, 4 vCPUs, about 15 GB RAM, and no Chrome/Chromium or Playwright browsers preinstalled. Direct GitHub API calls were restricted to session-bound repositories. — first-hand check in this session (shell commands `nvidia-smi`, `ls /dev/dri`, `nproc`, `free -g`)

### Inferences
- **Do not make verification depend on screenshotting a live GPU canvas.** Agents commonly run in GPU-less Linux containers where headless WebGPU capture is unsupported upstream and failures are silent. The package's verification tools should render deterministically to buffers (offscreen render target, then readback, or a CPU/software path), write PNG contact sheets and strips to disk, and **assert non-blank output** (pixel-variance check and backend reporting WebGPU vs WebGL2 vs software) as part of every tool result.
- Numeric metrics (contacts, slide, penetration, joint limits) can and should be computed **without rendering at all**, from the skeleton and pose data. This makes the core QA loop GPU-independent and cheap, and leaves images for human or VLM gestalt checks.
- Pixel-diff regression (golden contact sheets per clip and rig) is the natural "screenshot-diff workflow" for an animation library. It needs fixed cameras, lighting, resolution and renderer backend to be deterministic across CPU/GPU paths, so software-rendered goldens may be the safer CI baseline.
- The harness landscape is fragmented:
  - Claude Code's Chrome integration is headed and local.
  - Cursor's browser is IDE-bound and has had reliability regressions.
  - Codex cloud is containerised with network off by default.
  - Playwright and DevTools MCP are portable but token-heavy.

  A CLI that emits files plus short JSON summaries works in all of them. MCP is an optional adapter.

### Gaps
- No official documentation was found stating GPU availability (or absence) in OpenAI Codex cloud, Cursor background agents, Claude Code on the web or Gemini CLI cloud environments. Only the first-hand check of this one container supports the "no GPU" claim.
- Gemini CLI's specific visual-verification workflow (e.g. Chrome DevTools MCP extension usage) was not fetched.
- The Chrome DevTools MCP full tool reference (names like `take_screenshot` or `performance_start_trace`) was not confirmed; the README links to a separate reference.
- No published measurements were found of screenshot-diff reliability for WebGL/WebGPU across SwiftShader and hardware backends, which is relevant for golden-image CI of an animation library.
