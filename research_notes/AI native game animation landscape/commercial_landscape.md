# Commercial landscape: AI-assisted character animation tools and services for game developers (state as of 2026-10-11)

Evidence tags: **[V]** = checked on the vendor's own docs, ToS, pricing, release or license page (pages fetched 2026-10-10/11 unless another date is given). **[P]** = press or trade coverage (CG Channel, 80.lv, AWN, GamesBeat, heise, Cartoon Brew and similar). **[M]** = vendor marketing claim, not independently checked. **[A]** = aggregator, directory, competitor blog or other third-party site; low confidence. **[U]** = user or forum anecdote. Several official pages refused automated fetches with HTTP 403: Adobe helpx (Mixamo FAQ), autodesk.com (Flow Studio), meshcapade.com, unrealengine.com (the 5.8 announcement) and support.rokoko.com. For those, findings come from search-engine snippets of the official page or from trade press, and are flagged as such. "My arithmetic" marks calculations I did myself.

## 1. Vendor profiles: access model, formats/rigs, pricing, output license, reputation, agent integration, company signals

### Takeaway
By October 2026 the tier of standalone "AI mocap / text-to-motion" startups has thinned sharply:
- **Shut down:** RADiCAL (Autodesk bought its IP; portal closed Jul 6, 2026), Ready Player Me (Netflix; closed Jan 31, 2026) and Unity Muse (retired Oct 1, 2025).
- **Absorbed:** Meshcapade went to Epic in Feb 2026 and its standalone service reportedly closed in April.
- **Pivoted:** Kinetix now calls itself a research lab and promotes an AI video model. Uthana dropped subscriptions in Aug 2026 and now pitches robotics and "physical AI".

The survivors fall into two groups:
- **Embedded in engines or DCCs:** Unity AI (its animation generator is powered by Uthana), Unreal Engine 5.8 (MCP plugin plus full-body MetaHuman Animator from a webcam), Maya MotionMaker, and Cascadeur, which now ships an MCP server.
- **Video-mocap SaaS:** Rokoko Create, Move.ai, Plask, QuickMagic and DeepMotion.

The new pressure comes from two directions. Open-weights text-to-motion models have arrived: NVIDIA Kimodo (commercial use allowed) and Tencent HY-Motion (restrictive license). And very well-funded 3D-generation platforms now sell rig-and-animate APIs: Tripo raised roughly $800M across 2026, and Meshy offers the same kind of API.

### Cited Findings

#### Status snapshot (details and further sources in the per-vendor notes below)
| Vendor / product | Status (Oct 2026) | Main access model | Key source |
|---|---|---|---|
| Uthana | Active. New subscriptions ended Aug 2026; now pay-as-you-go | Web app + GraphQL API; Blender/Maya plugins; animation provider inside Unity AI | [pricing](https://uthana.com/pricing), [Unity 3P AI terms](https://unity.com/legal/third-party-ai-terms) |
| Cascadeur (Nekki) | Active; 2026.2 released Aug 6, 2026 | Desktop app (Win/Linux/macOS), Python API, "simple" MCP server | [CG Channel](https://www.cgchannel.com/?p=177897), [plans](https://cascadeur.com/plans) |
| DeepMotion (Animate 3D, SayMotion) | Active; SayMotion API restricted to verified partners | Web app; REST API (partner-gated) | [SayMotion API](https://deepmotion.com/saymotion-api) |
| Adobe Mixamo | Online and free; no feature news found; June 2025 outage | Web app only (no official API found) | [Adobe Community FAQ](https://community.adobe.com/questions-696/mixamo-faq-licensing-royalties-ownership-eula-and-tos-589400) |
| Tencent HY-Motion 1.0 | Open weights, released Dec 30, 2025; custom restrictive license | Local CLI/Gradio; HF Space demo; no API | [GitHub](https://github.com/Tencent-Hunyuan/HY-Motion-1.0), [LICENSE](https://huggingface.co/tencent/HY-Motion-1.0/raw/main/LICENSE.txt) |
| Autodesk Flow Studio (ex-Wonder Dynamics) | Active; added Wonder 3D (Mar 2026) | Cloud web app, credits | [Autodesk compare](https://www.autodesk.com/products/flow-studio/compare) |
| Meshcapade | ACQUIRED by Epic (Feb 2026); standalone service reportedly closing Apr 2026 | (was web app + REST API) | [80.lv](https://80.lv/articles/ai-motion-capture-startup-meshcapade-now-part-of-epic-games) |
| Krikey AI | Active; consumer/edu video focus | Web app; FBX export on paid tiers; no public API found | [pricing](https://www.krikey.ai/pricing) |
| Plask | Active | Browser video mocap; in-tool "MoCap API" | [plask.ai](https://plask.ai/) |
| Move.ai | Active | iPhone app (Move One), multi-camera Move Pro | [Move help](https://help.move.ai/en/articles/8851451-move-one-pricing) |
| Rokoko | Active; Vision folded into "Rokoko Create" (Jul 2026) | Web Create (text-to-motion + video-to-motion), Studio desktop, Command API | [Vision 3.0](https://www.rokoko.com/insights/introducing-rokoko-vision-3-0), [pricing](https://www.rokoko.com/pricing) |
| RADiCAL | DISCONTINUED (portal closed Jul 6, 2026; IP to Autodesk) | — | [CG Channel](https://www.cgchannel.com/?p=175200) |
| Anything World | REBRANDED as Everything Universe | Web app, APIs, SDKs, DCC/engine plugins | [everythinguniver.se](https://everythinguniver.se/) |
| Kinetix | PIVOTED (research lab plus AI video model); emote SDK no longer promoted | — | [kinetix.tech](https://www.kinetix.tech/) |
| Unity Muse Animate | DISCONTINUED Oct 1, 2025 → Unity AI (6.2+) | In-Editor generators; Unity MCP | [Muse manual](https://docs.unity3d.com/Packages/com.unity.muse.animate@1.2/manual/index.html) |
| Unreal Engine (5.7/5.8) | Active; 5.8 (Jun 2026) adds an experimental MCP plugin | Engine features; MCP; Python | [GamesBeat](https://gamesbeat.com/epic-games-launches-unreal-engine-5-8/) |
| NVIDIA Audio2Face / Kimodo | Open-sourced (A2F Sept 2025); Kimodo open weights (Mar 2026) | SDKs/plugins; local models | [A2F GitHub](https://github.com/NVIDIA/Audio2Face-3D), [Kimodo HF](https://huggingface.co/nvidia/Kimodo-SOMA-SEED-v1.1) |
| Ready Player Me | DISCONTINUED (Jan 31, 2026, after Netflix acquisition) | — | [Avatar SDK blog](https://avatarsdk.com/blog/2026/07/07/ready-player-me-migration-guide/) |

#### Uthana (Los Angeles): text-to-motion, video-to-motion, locomotion, auto-rigging, retargeting
- [V] Pricing page (fetched 2026-10-11): "Uthana stopped offering new subscriptions in August 2026."
  - It is now "No subscription required" and "No minimum commitment" pay-as-you-go.
  - Text-to-motion v1.0 / 2.0 / 3.0 costs $0.02 / $0.03 / $0.10 per generated second. Video-to-motion v2.0/2.1 costs $0.05/s. Locomotion 1.0 costs $0.02/s. Stitching and looping 2.0 costs $0.01/s.
  - Auto-rigging costs $0.15 per rig; character generation costs $0.75 per character.
  - Also on the page: "Purchased credits do not expire" and "Download every motion you generate as many times as you need."
  - [Uthana pricing](https://uthana.com/pricing)
- [V] Same page: "The same account balance applies whether you create in the web app or call the GraphQL API." Also: "Paid usage includes commercial use of generated outputs, subject to Uthana's Terms of Use." Enterprise agreements may add a dedicated Slack channel and an uptime SLA. Datasets and simulation work are priced by scope. — [Uthana pricing](https://uthana.com/pricing)
- [A, historical] Before the August 2026 change, a search-indexed copy of Uthana's API blog described a free "Dreamer" plan (12 s of downloadable animation per month) and paid plans from $10 to $660/month, with the API on every tier. The live page now describes pay-as-you-go, so treat those tiers as superseded. — [Uthana API blog (search snippet)](https://uthana.com/blog/how-uthanas-api-speeds-up-text-to-motion-animation)
- [V] Terms of Use V1.1.0 (Dec 4, 2025):
  - §8.3, Paid Plans: "you own all right, title, and interest in and to the Customer Outputs generated under such Paid Plan, subject to Uthana's ownership of the Uthana IP and Third-Party Products." You also get "a non-exclusive, worldwide, perpetual, royalty-free license to use any Uthana IP and Third-Party Products" where these are "incorporated into and necessary for your use, reproduction, distribution, display" of outputs.
  - §8.4, Free Plans: "Uthana owns all right, title, and interest in and to the Customer Outputs generated under such Free Plan," but licenses them to you "under the Creative Commons Attribution 4.0 International License." The attribution line is "Animation generated with Uthana (uthana.com)."
  - §8.5: Uthana may train its models on Customer Data (excluding personal information) unless you are on a "no-training" paid tier.
  - The ToS says nothing specific about reselling animation packs, redistributing outputs in open-source projects, or using outputs to train other models.
  - [Uthana Terms](https://uthana.com/terms)
- [V/M] API:
  - One GraphQL endpoint with API-key auth. Code samples are given in shell, Python, TypeScript, React and C#.
  - It covers "motion generation, rigging, retargeting, asset management, and downloads." Calls are chained: generate a base motion, apply it to a character, then download.
  - Exports are FBX, GLB and BVH. Unrigged bipedal FBX/GLB characters can be auto-rigged, and motion is retargeted across bipedal rigs "without manual bone mapping."
  - Rate limits are negotiated. No MCP server is mentioned.
  - Sources: [Uthana API blog](https://uthana.com/blog/how-uthanas-api-speeds-up-text-to-motion-animation); [apis.io listing (GraphQL at uthana.com/graphql; REST downloads in FBX/GLB/BVH)](https://apis.io/providers/uthana/)
- [V] Unity's Third-Party AI Terms directory (Last Updated July 28, 2026) lists Uthana as Unity AI's only animation provider: "Uthana uses proprietary models to provide animations from prompts." — [Unity third-party AI terms](https://unity.com/legal/third-party-ai-terms)
- [M] Uthana's own announcement (undated, ©2026) says its text-to-motion ("as little as 3 seconds", "any bipedal character") and video-to-motion are live in Unity AI, with more animation and rigging capabilities planned. — [Uthana + Unity AI](https://uthana.com/blog/uthana-in-unity-ai)
- [M] Homepage (fetched 2026-10-11):
  - Taglines: "The AI platform for human motion"; "Models and data for embodied AI // robots, simulations, 3D characters"; "Built for physical AI and proven in gaming."
  - Target customers include "AI-native game platforms." Offers robot retargeting and datasets from a 120-camera studio ("1,000+ hours of data to license").
  - Claims "45,000+ characters animated", "1.7M+ seconds of motion generated" and "<50 ms to first motion token."
  - Blender and Maya plugins; logos for Unity AI, Replicate, Scenario, Sloyd and Nilo.
  - [Uthana home](https://uthana.com/)
- [P] Funding: a $4.3M seed was announced Mar 10, 2025, led by IA Ventures with a16z Speedrun, Acequia Capital, Cursor Capital and others. Uthana opened a public beta at the same time and described a natural-language-searchable library of 10,000+ motions. — [Pulse 2.0](https://pulse2.com/uthana-4-3-million-raised-to-transform-3d-character-animation-with-genai)
- [A] CB Insights counts $4.8M over 3 rounds, including a 2023 convertible note. — [CB Insights](https://www.cbinsights.com/company/uthana/financials)
- [A] Quality: I found no independent benchmark. One review site rates Uthana 8.5/10 and says it does not replace a skilled animator. — [AI Indigo review](https://aiindigo.com/blog/uthana-review-2026-text-to-animation-that-actually-works)

#### Cascadeur (Nekki): desktop keyframe animation app with AI and physics assists
- [P] Cascadeur 2026.2 was released Aug 6, 2026:
  - New: animation layers (alpha), easing for interpolation, BVH import, PySide custom UI, IntelliSense for the Python API, and Chinese/Japanese/Korean UI.
  - "Root Motion" was renamed "Motion Generation." Motion Generation and AI inbetweening now use models trained on larger datasets.
  - AutoPosing handles quadrupeds better and accounts for the environment when posing hands and feet. AutoPhysics turns a keyframe animation into a physically accurate version.
  - Exports FBX, Collada and USD. Runs on Windows 10+, Ubuntu 20.04+ and macOS 13.3+.
  - **It adds a "simple" MCP server so external AI tools (the example given is an LLM such as Claude) can control the software.** Its capabilities are not itemized.
  - [CG Channel, Aug 6 2026](https://www.cgchannel.com/?p=177897)
- [P] Cascadeur 2026.1 (April 2026) added AI inbetweening, which generates in-betweens from key poses using an existing animation as a style reference. It also added Collision Penetration Cleaning for self-collisions. — [CG Channel, Apr 9 2026 (search summary)](https://www.cgchannel.com/?p=175211)
- [V] Official plans (fetched 2026-10-11):
  - **Free:** "Only non-commercial use"; "Export to .casc format only. .fbx and .dae are not available"; capped at 300 frames and 120 joints per scene.
  - **Indie:** $19/mo, or $96/yr ($8/mo). "The revenue must be less than $100k per year." Exports .fbx/.dae/.usd/.gltf, with a perpetual license on the yearly plan.
  - **Pro:** $49/mo, or $396/yr. "Commercial use with no limits." Adds retargeting, environment interaction and quadruped autoposing; 14-day trial.
  - **Teams (2–6 seats):** $49/user/mo, or $33/user/mo billed annually; no perpetual license.
  - Education licenses also exist. The plans page does not mention MCP or the Python API.
  - [Cascadeur plans](https://cascadeur.com/plans)
- [P] CG Channel describes Indie and Pro as rent-to-own, with a perpetual license after one year. — [CG Channel](https://www.cgchannel.com/?p=177897)
- [A] Aggregator pricing that conflicts with the official page (free indie license, Pro at $25/mo) looks outdated. — [aisotools](https://aisotools.com/pricing/cascadeur)
- [V] Docs: AI inbetweening includes automatic foot cleanup, and a separate "Fulcrum Motion Cleaning" tool handles harder cases. The docs warn the setting "may produce motion with overstretched limbs in some specific cases." — [Cascadeur help](https://cascadeur.com/help/category/278)
- [P, biased source] MoCap Online, which sells mocap packs (Mar 17, 2026), recommends Cascadeur ("Use it") for action-game animation. It claims AutoPhysics cut secondary-motion work by 40–60% in its testing, but flags weak facial and emotional performance and manual export into engines. — [MoCap Online](https://mocaponline.com/blogs/mocap-news/ai-game-animation-tools-2026)

#### DeepMotion: Animate 3D (video-to-motion) and SayMotion (text-to-motion)
- [V] SayMotion API page (fetched 2026-10-11): "SayMotion API access is currently limited to verified partners. Please sign up for consideration!"
  - Features listed: text-to-3D animation, AI inpainting, multi-variant generation, custom character uploads.
  - Body animation only: hand and face animation, and mocap refinement, are "coming soon."
  - The page gives no endpoint or format details.
  - [DeepMotion SayMotion API](https://deepmotion.com/saymotion-api)
- [V] By contrast, in May 2024 DeepMotion announced the SayMotion API as available, with free trials. — [DeepMotion post](https://deepmotion.com/post/saymotion-api-now-available-for-free-trials)
- [V] Public GitHub REST docs: HTTP Basic auth using a Client ID and Secret issued by DeepMotion. The production base URL is given only on request. The changelog runs to Beta v1.5.0, which added a prompt-optimization endpoint. — [SayMotion REST API repo (search summary)](https://github.com/DeepMotion/SayMotion-REST-API)
- [A] Third-party listings say SayMotion exports FBX, GLB, BVH or MP4. I could not check this on DeepMotion's live pricing pages, which did not render for automated fetches. — [mybesh listing](https://mybesh.com/tool/deepmotion)
- [P] SayMotion launched in June 2024. During the beta, animations made with beta accounts were licensed for commercial projects. — [CG Channel, Jun 2024](https://www.cgchannel.com/2024/06/deepmotion-launches-ai-text-to-animation-service-saymotion)
- [V] Terms of Use (last updated Mar 30, 2025):
  - "We own all right, title, copyright, and other intellectual property rights and interest in the Products of the Site." "Products of the site are licensed, not sold."
  - The Freemium license is "exclusively for non-commercial purposes." "Commercial use is granted with a Paid Plan."
  - "You must not sell, license or otherwise provide access to the Products of Site." Outputs may not be used "in a way that allows others to use or access the Products as a stand-alone." "No sub-license or resale by you to others is allowed."
  - Uploads may be processed through ML models "for the sole purpose of improving the Site and services."
  - [DeepMotion Terms](https://www.deepmotion.com/terms-of-use)
- [A] The live pricing pages returned no tiers to automated fetches. A June 2026 directory lists a free tier (3 credits/month), paid tiers of about $9, $39 and $83/month billed annually, and separate business API plans. — [ToolMage](https://www.toolmage.com/zh-hant/tool/deepmotion/)
- [A] Company: CB Insights lists $2.75M raised over 6 rounds, the latest dated Mar 17, 2023. I found no 2025–2026 funding or layoff news. — [CB Insights](https://www.cbinsights.com/company/deepmotion-1/financials)
- [U] In a Reallusion forum thread from about 2022, users describe foot twitch and twisting limbs and torsos in DeepMotion and Plask output, fixed by hand on separate animation layers. — [Reallusion forum](https://forum.reallusion.com/PrintTopic519932.aspx)

#### Adobe Mixamo: free auto-rigger and mocap library
- [V, search snippet of the official page; direct fetch blocked] Adobe's Mixamo FAQ says characters and animations are "royalty free for personal, commercial, and non-profit projects," including video games. It also says "Mixamo is not available for Enterprise and Federated IDs." — [Adobe Mixamo FAQ (AU mirror)](https://helpx.adobe.com/au/creative-cloud/faq/mixamo-faq.html)
- [V, Adobe Community repost of the FAQ by "TylerG 3D", Sept 29, 2022]
  - The "NO, you cannot create" list includes:
    - "Blueprints, templates, or asset packages for video game engines which redistribute character or animation raw files"
    - "Packages for 3D stock or asset store websites where character or animation raw files will be sold or distrubuted" [sic]
    - "Any type of free distribution of character or animation raw files"
  - Further lines: "really the only thing you can't do is distribute the raw character and animation files"; "You may not distribute the files to customers or non-team members however"; "The only research application Mixamo content can't be used in is training machine-learning models."
  - The post calls Mixamo a "limited duration technology preview," free during the preview. A commenter asks whether this is still current, and gets no answer.
  - [Adobe Community Mixamo FAQ](https://community.adobe.com/questions-696/mixamo-faq-licensing-royalties-ownership-eula-and-tos-589400)
- [A] A guide published July 17, 2026 (updated Sep 20, 2026) says Mixamo is free with an Adobe ID and needs no Creative Cloud subscription. The auto-rigger and library are limited to bipedal humanoids. The guide explicitly declines to guess at maintenance status or a shutdown date. — [Cinevva guide](https://app.cinevva.com/guides/free-character-animations-rigging)
- [U] June 16–20, 2025 outage:
  - Forum users reported failed logins, hanging uploads and downloads, and 500 and "Too many requests" errors.
  - Support said the backend team was working on it but gave no ETA. Users reported it fixed around June 19–20.
  - Auto-rigging problems were reported into late August 2025.
  - A thread titled "Mixamo is not end of life, it's broken and fixable" captures user anxiety. I found no official Adobe status post.
  - [Adobe Community "Mixamo down"](https://community.adobe.com/t5/mixamo-discussions/mixamo-down/m-p/15377556); [Adobe Community thread](https://community.adobe.com/questions-696/mixamo-is-not-end-of-life-it-s-broken-and-fixable-589870)
- [M] Kinetix's site (May 18, 2026) says it "licensed and integrated our 3D animation models and technologies into Adobe Mixamo." I found no Adobe confirmation; the documented tie-up is a 2022 partnership. — [Kinetix](https://www.kinetix.tech/); [80.lv, 2022](https://80.lv/articles/kinetix-partnered-with-adobe-s-mixamo-and-released-an-update)
- [U] Godot forum threads (Godot 4.4–4.6 era) describe Mixamo retargeting pain:
  - Arms clip and hands close because of a T-pose vs A-pose rest-pose mismatch.
  - There is no root bone for root motion.
  - Hands twist when mixed with UE-style skeletons.
  - [Godot forum 1](https://forum.godotengine.org/t/retargeting-mixamo-animations-fails/39619); [Godot forum 2](https://forum.godotengine.org/t/mixamo-animation-retarget/137067); [Godot forum 3](https://forum.godotengine.org/t/ue-fbx-animations-work-on-ue-skeleton-but-break-on-mixamo-after-retargeting-in-godot/135712)

#### Tencent HY-Motion 1.0: open weights under a custom community license (not OSI open source)
- [V] Released Dec 30, 2025:
  - Inference code and weights for HY-Motion-1.0 (1.0B parameters) and HY-Motion-1.0-Lite (0.46B). Minimum VRAM is 26 GB and 24 GB respectively.
  - Runs locally via a CLI (local_infer.py) or a Gradio app. A hosted demo runs on a Hugging Face Space and at hunyuan.tencent.com/motion.
  - No API is documented. Evaluation code (SSAE) was added Jan 29, 2026. No v1.1 or 2.0 is listed.
  - [GitHub](https://github.com/Tencent-Hunyuan/HY-Motion-1.0)
- [V] The Hugging Face card lists the license as "tencent-hunyuan-community" and says "This model isn't deployed by any Inference Provider." — [HF model card](https://huggingface.co/tencent/HY-Motion-1.0)
- [V] LICENSE.txt, "TENCENT HY-MOTION 1.0 COMMUNITY LICENSE AGREEMENT":
  - **Territory:** "the worldwide territory, excluding the territory of the European Union, United Kingdom and South Korea." The agreement "DOES NOT APPLY IN THE EUROPEAN UNION, UNITED KINGDOM AND SOUTH KOREA," and use outside the Territory "is unlicensed and unauthorized."
  - **User threshold:** products with "greater than 1 million monthly active users in the preceding calendar month" must "request a license from Tencent."
  - **§5(b):** you may not use the Works or their Outputs "to improve any other AI model (other than Tencent HY-MOTION 1.0 or Model Derivatives thereof)."
  - **§6(d):** "Tencent claims no rights in Outputs You generate."
  - **Redistribution:** you must pass on the agreement and include a Notice file.
  - [HY-Motion LICENSE.txt](https://huggingface.co/tencent/HY-Motion-1.0/raw/main/LICENSE.txt)
- [P, conflicting] CGWorld (Jan 17, 2026) reported the carve-out as 100 million MAU. That contradicts the license file's 1 million MAU; rely on the license file. — [CGWorld](https://cgworld.jp/flashnews/01-202601-HY-Motion.html)
- [P] Architecture and training: Diffusion Transformer with flow matching; more than 3,000 h of pretraining, a 400 h high-quality fine-tune, then RLHF. LLM-based prompt rewriting. Humanoid only; no multi-person interaction, emotion or clothing. — [CGWorld](https://cgworld.jp/flashnews/01-202601-HY-Motion.html)
- [P] The paper covers 200+ motion categories across 6 classes. — [arXiv 2512.23464](https://arxiv.org/abs/2512.23464v1)
- [A] Community ComfyUI nodes export FBX or NPZ. — [RunComfy ComfyUI-HyMotion](https://www.runcomfy.com/comfyui-nodes/ComfyUI-HyMotion)

#### Autodesk: Flow Studio (ex-Wonder Dynamics), Maya MotionMaker, RADiCAL IP
- [P] Autodesk acquired Wonder Dynamics in May 2024. — [AWN](https://www.awn.com/news/autodesk-acquires-wonder-dynamics)
- [A] Wonder Studio was renamed Autodesk Flow Studio in March 2025. — [usagepricing](https://www.usagepricing.com/blueprint/wonder-dynamics)
- [V, snippet of the official compare page]
  - Monthly credits: Free 300, Lite 2,100, Standard 6,000, Pro 12,000, Enterprise 48,000.
  - Costs: live action or animation 20 credits/s; AI MoCap 10 credits/s; Clean Plate and Camera Track 7 credits/s.
  - Export resolution runs from 720p (Free) to 4K (Standard/Pro). Dollar prices failed to render on the page.
  - [Autodesk Flow Studio compare](https://www.autodesk.com/products/flow-studio/compare)
- [A] An aggregator gives prices of Lite $10, Standard $45 and Pro $95/month, and says an Aug 2025 repricing added the free tier and the Standard plan. — [usagepricing](https://www.usagepricing.com/blueprint/wonder-dynamics)
- My arithmetic: at 10 credits/s, Lite's 2,100 credits buy about 210 s of AI mocap a month.
- [P] Mar 5, 2026: "Wonder 3D" (text/image-to-3D generation) was added to Flow Studio. — [Digital Production](https://digitalproduction.com/2026/03/05/autodesk-adds-generative-3d-to-flow-studio/)
- [A] Aug 4, 2026: a browser-based 3D Editor and a node-based Canvas were added. — [usagepricing activity](https://usagepricing.com/blueprint/activity/wonder-dynamics-2026-08-04-launch)
- [P] Maya 2027 (released Mar 25/26, 2026): MotionMaker, Maya's AI motion generator (previously humans and wolf-like dogs), adds horses with a model trained on mocap. — [CG Channel](https://www.cgchannel.com/?p=174872)
- [P] Maya 2027.2 (Jul 22, 2026) adds "Bring Your Own Data": users can train custom MotionMaker models locally. — [CG Channel](https://www.cgchannel.com/2026/07/maya-2027-2-lets-you-train-your-own-ai-animation-models/); [Digital Production](https://digitalproduction.com/2026/07/24/maya-2027-2-trains-motionmaker/)
- [A] MotionMaker output is ordinary Maya keyframes on joints and controls. — [SuperRenders](https://superrendersfarm.com/article/whats-new-maya-2027)

#### Meshcapade (SMPL-based digital humans; MoCapade video mocap; text-to-motion): ACQUIRED by Epic; standalone service reportedly closed
- [P] Epic Games acquired Meshcapade (announced Feb 18, 2026; price not disclosed).
  - The team joins Epic's AI research group, working on Unreal Engine and MetaHuman. Epic is opening an office in Tübingen (Cyber Valley).
  - Epic CTO Kim Libreri said the aim is to lower the barriers to believable, expressive digital characters that work in real time.
  - [Max Planck Society](https://www.mpg.de/26082348/max-planck-spin-off-draws-epic-games-to-tuebingen); [heise](https://heise.de/-11182302); [MediaPost](https://www.mediapost.com/publications/article/412940/epic-games-acquires-firm-that-makes-3d-humans.html)
- [P] Feb 24, 2026: "Meshcapade is reportedly closing in April, and its tools will then become part of Epic Games." — [80.lv](https://80.lv/articles/ai-motion-capture-startup-meshcapade-now-part-of-epic-games)
- [M/A] Before the acquisition, Meshcapade offered "Motion from Text," MoCapade markerless video mocap (including fingers), a REST API, and Blender/Maya/UE integrations. It had raised $6M. — [Meshcapade animation page (search summary)](https://meshcapade.com/animation); [Pulse 2.0](https://pulse2.com/meshcapade-6-million-funding/); [CG Channel 2024](https://www.cgchannel.com/2024/08/tools-to-watch-in-fall-2024-meshcapade-me)

#### Krikey AI: consumer- and education-oriented AI animation and video maker
- [V] Pricing page (fetched 2026-10-11):
  - **Free:** $0, 20 one-time credits; text-to-animation and video mocap are "Limited"; no FBX.
  - **Pro:** $15/person/month, 165 credits/month.
  - **Teams:** $10/person/month, 200 credits/month each.
  - **EDU:** discount. **Enterprise:** custom (SOC2 Type 2).
  - Pro and Teams: "Export MP4, GIF, PNG, FBX files." Yearly billing: "Save from 16%."
  - The page mentions no API and has no commercial-license wording.
  - [Krikey pricing](https://www.krikey.ai/pricing)
- [M] Krikey's comparison page says paid plans include "commercial licensing." — [Krikey compare](https://www.krikey.ai/compare/animoto-alternatives)
- [A] An agent-readiness index (May 2026) found Krikey's API docs gated or absent. — [xpay](https://www.xpay.sh/agent-ready-index/krikey-ai/)

#### Plask (Korea): browser-based video mocap
- [V] plask.ai (©2026; banner reads "New: upgraded motion AI and rendering pipeline"):
  - Converts single-camera video into 3D animation. Credits cost 1 per frame for one person, 3 per frame for multi-person.
  - Plans: Freemium, Standard and Pro.
  - Imports GLB, FBX (7100+), VRM 0.0 and PMX up to 50 MB. Video uploads up to 100 MB and 9,000 frames.
  - A "Plask MoCap API" is described as a feature inside the tool (1–3 credits/frame); it is unclear whether developers can use it standalone. No text-to-motion.
  - [Plask](https://plask.ai/)
- [P] Plask launched its paid MoCap Pro tier in Aug 2022 (from $50/month). Backers include Naver, Samsung C-Lab and KT. — [AWN](https://www.awn.com/news/plask-launches-namesake-cloud-based-motion-capture-tool); [TechNode Global](https://technode.global/?p=27451)

#### Move.ai (London): markerless video mocap
- [V] Move One (iPhone app). Two help pages give conflicting versions:
  - One lists Starter at $15/mo or $144/yr (180 credits/mo) and Basic at $35/mo or $336/yr (480 credits/mo), with 1 credit = 1 person-second.
  - Another charges Gen 2 at 2 credits/s.
  - Teams overage is $0.17/credit.
  - [Move help center](https://help.move.ai/en/articles/8851451-move-one-pricing); [Move docs](https://docs.move.ai/knowledge/move-one-pricing)
- [V] Move Pro has custom pricing. A Move Pro 2.0 trial costs $995 for 30 days with 1,000 credits (about 1,000 s) and includes the m2 multi-camera Gen 2 model. — [Move docs](https://docs.move.ai/knowledge/move-pro-2.0-self-serve)
- [P] disguise sells "Invisible," a real-time markerless mocap bundle built with Move.ai that tracks up to two people. — [AWN](https://awn.com/news/disguise-and-moveai-release-invisible-real-time-markerless-mocap-bundle)
- [A] About $11.3M raised over 2 rounds, the last in Oct 2023; no 2026 funding found. — [Seedtable](https://seedtable.com/startups/move-ai)
- [P, biased source] MoCap Online: about 85–90% of optical accuracy for full-body locomotion; weak on fingers and contact-heavy actions; no facial capture. — [MoCap Online](https://mocaponline.com/blogs/mocap-news/ai-game-animation-tools-2026)

#### Rokoko: Vision → Rokoko Create, Studio, Motion Library
- [V] Vision 3.0 (Jul 16, 2026):
  - "A complete rebuild of our monocular AI motion capture pipeline." Processing runs in the cloud from any browser; direct webcam recording was removed.
  - "Vision 3.0 launches without finger tracking." Dual-camera capture was to be retired about 30 days later.
  - Rokoko Create bundles Text-to-Motion, Video-to-Motion, editing in Studio, a motion library, retargeting and "Export instantly in all standard formats."
  - Rokoko markets its plans as "clear, transparent," with no credit system, in a comparison table against Uthana and QuickMagic.
  - [Rokoko Vision 3.0](https://www.rokoko.com/insights/introducing-rokoko-vision-3-0)
- [V, snippet; direct fetch blocked] A support note says Vision was folded into Create, dual-camera and online webcam capture were retired Aug 16, 2026, and accounts and subscriptions carry over. — [Rokoko support (search summary)](https://support.rokoko.com/hc/en-us/articles/48823033216017-Rokoko-Vision-and-Rokoko-Create-What-you-need-to-know)
- [V] Pricing page (fetched 2026-10-11; the page contradicts itself in places):
  - **Free:** 30 s of Vision processing/mo; unlimited Text-to-Motion clips in Create; 5 Text-to-Motion imports/mo into Studio; FBX; retargeting to default meshes only.
  - **Basic:** $10/mo billed annually, $12 monthly. 600 s; FBX/BVH; custom characters.
  - **Plus:** $20 annual / $28 monthly. 3,000 s.
  - **Pro:** $50 annual / $70 monthly. 15,000 s; FBX/BVH/CSV; "Advanced command API, UDP triggers."
  - **Enterprise:** from $100 annual / $150 monthly.
  - Motion Library terms: "Export and use in any of your projects, including commercial ones."
  - No public REST API is described, only the Studio Command API.
  - [Rokoko pricing](https://www.rokoko.com/pricing)
- [P] The Motion Library opened as a marketplace in 2020, selling $3–$6 assets usable indefinitely across projects. — [AWN](https://www.awn.com/headline-news/rokoko-studio-opens-virtual-doors-its-motion-library)

#### RADiCAL: DISCONTINUED (web portal closed Jul 6, 2026)
- [P] In April 2026, Autodesk "fully acquired" RADiCAL's core technology and IP: Motion (which powered Radical Core and Live) and Canvas (its collaborative editor). The portal closed July 6, 2026. User data was not transferred to Autodesk, and annual subscribers were refunded the unused portion. — [CG Channel, Apr 9 2026 (search summary)](https://www.cgchannel.com/?p=175200)
- [P] Background: Autodesk invested in RADiCAL in 2022. Radical Live streamed animation into Blender, Maya, Unity and UE5. — [80.lv](https://80.lv/articles/autodesk-invests-in-3d-mocap-solution-radical); [80.lv](https://80.lv/articles/ai-motion-capture-firm-radical-releases-radical-live/)

#### Anything World: REBRANDED as Everything Universe
- [V] anything.world now redirects (301) to everythinguniver.se (Everything Universe Ltd.).
  - The site lists "Generate Anything" (3D generation), "Animate Anything" (rigging and animation), Game Ready SDKs, a 3D model library, and APIs with GitBook docs.
  - Plugins: Blender, Maya, 3ds Max, Unreal (v1.3.0.1EA), Roblox and Unity (Asset Store).
  - The homepage gives no prices or output-license terms.
  - [Everything Universe](https://everythinguniver.se/)
- [P] Its differentiator since 2023: an ML pipeline that rigs non-humanoids (scorpions, insects, birds, hippos), in contrast to humanoid-only Mixamo. Clients have included Ubisoft. — [Creative Bloq](https://www.creativebloq.com/news/anything-world-animate-anything-ai); [TNW, Oct 2 2023](https://thenextweb.com/news/anything-world-launches-ai-3d-animation-tool)

#### Kinetix: PIVOTED (research lab plus AI video; emote SDK no longer promoted)
- [V] Homepage (May 18, 2026):
  - Describes itself as a "research lab focused on 3D and human motion intelligence." It promotes Kamo-1, a 3D-conditioned AI video model (video.kinetix.tech). No SDK or API is listed.
  - It says its video-to-animation model was "natively integrated" into Unity Muse, powers the in-game Emote Creator in KRAFTON's OVERDARE, and was licensed into Adobe Mixamo.
  - [Kinetix](https://www.kinetix.tech/)
- [P] 2025: a $1M AI-UGC Fund (up to $75k per studio) and an embeddable AI Emote Creator offered via SDK or API. — [Startups Magazine](https://startupsmagazine.co.uk/article-kinetix-launches-1m-fund-accelerate-ai-ugc-gaming)
- [V] 2023: a free Emote SDK with 1,000+ cloud emotes and "Emote NFTs." — [Kinetix blog](https://www.kinetix.tech/blog/kinetix-announces-public-launch-of-emote-sdk)

#### Unity: Muse Animate → Unity AI
- [V] Muse Animate is DISCONTINUED: "Unity Muse will be retired on October 1, 2025." It is replaced by Unity AI in Unity 6.2 and later. — [Muse Animate manual](https://docs.unity3d.com/Packages/com.unity.muse.animate@1.2/manual/index.html)
- [U] Late Muse Animate builds had bugs that blocked animation preview. — [Unity Discussions](https://discussions.unity.com/t/unity-muse-animate-cannot-preview-animations-gameobject-can-only-be-in-one-layer-error/1624728)
- [P] Unity 6.2 (Aug 2025) introduced Unity AI, with generators for sprites, textures and animations. At launch it offered "Unity's own text-to-animation model" alongside Kinetix's video-to-animation model. — [CG Channel, Aug 19 2025](https://www.cgchannel.com/?p=169508)
- [V] Animation Generator (AI Assistant docs v2.6):
  - Text to Motion takes a prompt, a duration slider and an optional seed. Video to Motion takes an MP4 reference.
  - Results are saved as Unity `.anim` clips in Assets. A Trim tab adjusts direction, position and looping.
  - No FBX export or model names are documented.
  - [Unity docs](https://docs.unity3d.com/Packages/com.unity.ai.assistant@2.6/manual/Animation/animation-create.html)
- [V] Unity's Third-Party AI Terms (Jul 28, 2026) list Uthana as the only animation provider. — [Unity](https://unity.com/legal/third-party-ai-terms)
- [V] Unity AI Guiding Principles (last updated Aug 19, 2026; applies to Editor 6.7 and below):
  - "You own all your input and output data when using Unity's AI tools, regardless of the Partner Model that is used."
  - Partner Model providers "do not train their models with your Developer Data."
  - The in-editor Assistant uses Gemini, Claude, Kimi K3 and GLM models.
  - "It remains your responsibility to ensure you have the rights to use content in your final build."
  - [Unity AI Guiding Principles](https://unity.com/legal/unityai-guiding-principles)
- [P/A] Pricing is in credits (formerly "Unity Points," now "Unity Credits"). A Japanese guide reports that Personal users get a 14-day, 1,000-credit trial, then pay $10/month per 1,000 credits. It also says calls to external LLMs through the AI Gateway use no credits. An older Unity roadmap page described buying points per action. — [issoh.co.jp](https://www.issoh.co.jp/tech/details/8536/); [Unity roadmap](https://activation.unity3d.com/roadmap/official-pricing)
- [V] Unity MCP (AI Assistant 2.0 docs):
  - Connects LLM agents "such as Claude Code and Cursor" to the Editor.
  - Built-in tools cover "scene management, asset operations, script editing, and console access." Animation is not listed. Custom tools can be registered.
  - AI Gateway connections are approved automatically; external MCP clients need approval in Project Settings.
  - [Unity MCP overview](https://docs.unity3d.com/Packages/com.unity.ai.assistant@2.0/manual/unity-mcp-overview.html)
- [A] An Aug 31, 2026 blog says Unity moved MCP into the Unity CLI (`unity mcp configure <client>`). Unverified. — [MCP Playground](https://mcpplaygroundonline.com/blog/unity-mcp-server-guide.md)

#### Unreal Engine / Epic: Motion Matching, MetaHuman Animator, MCP
- [A] Motion Matching (Pose Search) became production-ready in UE 5.4. — [uhiyama-lab](https://uhiyama-lab.com/en/notes/ue/motion-matching-game-animation-sample/)
- [V] Epic's free Game Animation Sample ships 500+ animations on the UE5 Mannequin, with motion-matched locomotion. — [Epic blog](https://www.unrealengine.com/en-US/blog/game-animation-sample)
- [P] June 2025 (UE 5.6 era): Epic changed MetaHuman licensing so MetaHumans can be used and sold in any engine or DCC, including Unity and Godot. — [CG Channel, Jun 4 2025](https://www.cgchannel.com/2025/06/you-can-now-sell-metahumans-or-use-them-in-unity-or-godot/)
- [A, conflicting] An April 2026 studio blog says the MetaHuman EULA still ties shipped use to UE. — [StraySpark](https://www.strayspark.studio/blog/metahuman-2026-web-app-shutdown-migration-guide)
- [P] UE 5.7 (Nov 12, 2025) added an in-editor AI Assistant, MetaHuman Creator on Linux and macOS, Python/Blueprint batch automation of MetaHuman assets, and Live Link Face with external cameras. — [CG Channel](https://www.cgchannel.com/2025/11/unreal-engine-5-7-five-key-features-for-cg-artists/); [Inven Global](https://www.invenglobal.com/articles/19890/epic-games-launches-unreal-engine-57-with-major-upgrades-to-open-worlds-rendering-and-metahuman-tools); [MetaHuman 5.7 notes](https://dev.epicgames.com/documentation/metahuman/metahuman-5-7-release-notes)
- [P] UE 5.8 launched at Unreal Fest Chicago (week of Jun 17, 2026):
  - **An experimental MCP plugin.** GamesBeat paraphrases Epic: "The open standard plugin enables LLM systems" to connect to and understand the engine and project, and "you can use any model you want."
  - Animation tools: Control Rig Physics moves to Beta; a new Control Rig Dynamics solver; Direct Mesh Controls (Experimental); one-click automated animation baking; retargeting foot definitions and Retarget Override Sets.
  - Live Link Hub is production-ready.
  - **MetaHuman Animator can now capture full-body "head-to-toe" animation from a webcam**, using the Windows-only Markerless Motion Capture Plugin.
  - Also: MetaHuman Collections (crowds), and OpenRigLogic, which open-sources RigLogic and DNA under the MIT license.
  - [GamesBeat](https://gamesbeat.com/epic-games-launches-unreal-engine-5-8/)
- [A] Developers report that Unreal MCP exposes Blueprints, assets, levels, materials and meshes. Its HTTP server has no authentication layer, tool calls run one at a time on the game thread, and the default endpoint is http://127.0.0.1:8000/mcp. — [DEV Community](https://dev.to/gamedevtoollab/using-unreal-mcp-in-ue-58-from-codex-setup-toolsets-and-safe-editor-automation-4pon); [Fab listing](https://www.fab.com/listings/651ed47d-db10-4dfa-9a6c-b8080d0d6b8e)

#### NVIDIA: ACE / Audio2Face, Kimodo
- [P] In Sept 2025 NVIDIA open-sourced the Audio2Face models, SDK and training framework. Adopters include Codemasters, GSC Game World, NetEase and Perfect World. — [AWN](https://www.awn.com/news/nvidia-open-sources-audio2face-animation-model)
- [V] Licenses listed on GitHub:
  - Audio2Face-3D SDK: "MIT." Training Framework v1.0: "Apache." Maya ACE v2.0: "MIT." UE5 plugin v2.5 (UE 5.5/5.6): "MIT."
  - NIM container: "NVIDIA Software License Agreement and Product Specific Terms for AI Products."
  - Audio2Face-3D models (regression v2.3, diffusion v3.0): "Nvidia Open Model."
  - Audio2Emotion models: "Custom (use allowed with Audio2Face only)." Claire sample dataset: "Custom (evaluation only)."
  - [NVIDIA/Audio2Face-3D](https://github.com/NVIDIA/Audio2Face-3D)
- [V] Kimodo (released Mar 16, 2026; some outlets say Mar 28; v1.1 on Apr 10, 2026):
  - A controllable kinematic motion diffusion model. "This model is ready for commercial use" under the NVIDIA Open Model License.
  - The SOMA-SEED v1.1 checkpoint was trained on 288 h of the public Bones-SEED mocap dataset; the docs describe 700 h for the model family.
  - Uses a 30-joint SOMA skeleton. Other checkpoints target Unitree G1 and SMPL-X.
  - Inputs: text, duration up to 10 s at 30 fps, and frame-indexed constraints (joint positions, full-body rotations, 2D heading, 2D root path/waypoints). Output: root translation plus per-joint rotation matrices.
  - Stated limitations: realistic motion only (no cartoon motion), not aware of scene objects, "may show foot skating," one character per model.
  - [HF Kimodo-SOMA-SEED-v1.1](https://huggingface.co/nvidia/Kimodo-SOMA-SEED-v1.1); [Kimodo docs](https://research.nvidia.com/labs/sil/projects/kimodo/docs/); [NYU Shanghai RITS](https://rits.shanghai.nyu.edu/ai/nvidia-releases-kimodo-controllable-text-to-motion-for-characters-and-humanoid-robots/)
- [P/A] Kimodo also ships an interactive timeline authoring tool, a CLI and "Motion Format Conversion" docs. A third-party UE 5.7 plugin exists on Fab. A Japanese report says the license allows commercial use, derivative models and redistribution if its conditions are met. — [Kimodo docs](https://research.nvidia.com/labs/sil/projects/kimodo/docs/); [Fab listing](https://www.fab.com/listings/c2ac4d6d-b21e-4f44-bee3-e4a596c24711); [CGWorld](https://cgworld.jp/flashnews/01-202604-Kimodo.html)

#### Notable newcomers and adjacent well-funded players (2025–2026)
- **Tripo (VAST):**
  - [V] The rig-v2.0 API adds a skeleton and weights in one call: a 3D model goes in, a rigged GLB/FBX comes out in about 30 s.
    - Supports biped, quadruped, hexapod, octopod, avian, serpentine and aquatic bodies, with Tripo or Mixamo bone naming.
    - Costs 25 credits, after a free "Rig Check."
    - The animation endpoint applies presets (idle, walk, run, jump, slash and others), up to 5 per batch, as GLB/FBX, with an in-place option. Concurrency limit is 3.
    - [Tripo rig docs](https://developers.tripo3d.com/en/models/rig); [Tripo animation docs](https://developers.tripo3d.com/en/models/animation)
  - [P] Funding in 2026: a Series A+/A++ of about $200M (Jun 1; reported, attribution in the search summary unclear); a Series A3 of more than $150M (Jul 2; led by Geely Capital with game companies 4399, Tanwan and Giant Network); and a Series B/B+ of about $446M (early Sept; led by Matrix Partners China). — [Pulse 2.0](https://pulse2.com/tripo-ai-raises-over-150-million-in-series-a3-financing/amp/); [DealStreetAsia](https://www.dealstreetasia.com/?p=493956); [36Kr](https://eu.36kr.com/en/p/3964719241305607)
- **Meshy:**
  - [V] Rigging API `POST /openapi/v1/rigging`: takes a textured humanoid GLB by URL or Data URI and returns a rigged FBX/GLB plus walk and run clips, with an SSE progress stream. A separate Animation API applies further clips. API costs: Auto-Rigging 5 credits, Animation 3 credits. The docs say "programmatic rigging currently only works well with standard humanoid (bipedal) assets." — [Meshy docs](https://docs.meshy.ai/api/rigging-and-animation); [Meshy API pricing](https://docs.meshy.ai/api/pricing)
  - [V] Licensing: free-plan models are CC BY 4.0 (commercial use allowed with credit); paid plans keep private ownership. — [Meshy help](https://intercom.help/meshy/en/articles/16102098-can-i-use-meshy-assets-commercially)
  - [A] A library of 500+ or 600+ clips (unverified). fal.ai resells Meshy rigging at $0.20/request (+$0.12 with animation). — [Ludo comparison](https://ludo.ai/compare/meshy-alternatives); [fal.ai](https://fal.ai/models/fal-ai/meshy/rigging/llms.txt)
- **Cartwheel:**
  - [P] A $10M round (May 15, 2025; $15.6M total), led by Craft Ventures with WndrCo (Katzenberg), Tirta and Runway, plus Accel, Khosla and Human Ventures. Turns video, text and motion libraries into 3D character animation. — [Cartoon Brew](https://www.cartoonbrew.com/tech/jeffrey-katzenberg-backed-ai-animation-software-cartwheel-raises-10-million-247264.html)
  - [P] Left beta after a year of testing with 8,000 artists, including people at Pixar and DreamWorks. — [CO/AI](https://getcoai.com/news/ai-startup-cartwheel-secures-10m-for-character-animation-tools/)
  - [A] API and team plans, FBX with Blender/Maya presets, about $19.90/month. Unverified. — [aiwiki](https://aiwiki.ai/wiki/cartwheel_ai)
- **Motorica (Stockholm):**
  - [P] A €5M (about $5.4M) seed in 2025. A transformer motion-synthesis model trained on thousands of hours of proprietary mocap. Plans SDKs for engine integration and datasets for stylized and non-humanoid motion. — [CO/AI](https://getcoai.com/news/motorica-raises-5-4m-to-make-game-animation-200x-faster-with-ai/)
  - [M] Claims more than 90% cost reduction and 200× faster than mocap pipelines. — [CO/AI](https://getcoai.com/news/motorica-raises-5-4m-to-make-game-animation-200x-faster-with-ai/)
  - [A] Another database lists $5.8M in June 2025. — [VCBacked](https://www.vcbacked.co/company/motorica)
- **QuickMagic:** [A] freemium video mocap, paid from about $9.90–$14.90/month. Exports FBX, VMD and BIP, with engine presets including Unreal, Mixamo, Unity, iClone and Roblox. — [Dataconomy](https://dataconomy.com/tools/quickmagic/); [Uthana comparison (competitor page)](https://uthana.com/resources/best-ai-motion-capture-tools)
- **Roblox Cube:** [V/P] Launched Mar 2025 as a 3D/4D generative system, with a long-term goal that includes "rigging characters for animation." Object generation entered open beta in Feb 2026, with 1.8M objects generated. — [Roblox](https://corp.roblox.com/newsroom/2025/03/introducing-roblox-cube); [Outlook Respawn](https://respawn.outlookindia.com/gaming/gaming-news/cube-3d-powers-robloxs-new-4d-interactive-object-tools)
- **Ready Player Me (DISCONTINUED):** [A] Netflix's acquisition was announced Dec 19, 2025. The public services, hosted avatar creator and API went offline Jan 31, 2026, and users could not export their avatars. Both sources are vendor blogs selling alternatives. — [Avatar SDK](https://avatarsdk.com/blog/2026/07/07/ready-player-me-migration-guide/); [Genies](https://genies.com/blog/ready-player-me-shutdown)

### Inferences
- The center of gravity has moved from standalone startups to platform owners:
  - Unity, through its Uthana partnership.
  - Epic, through Meshcapade, the MCP plugin and full-body webcam MetaHuman Animator.
  - Autodesk, through Wonder Dynamics, RADiCAL's IP and MotionMaker's bring-your-own-data training.
- The timing suggests UE 5.8's webcam full-body capture may build on Meshcapade's work, but no source confirms it.
- Unity's generator apparently switched providers between launch (Aug 2025: Unity's own model plus Kinetix) and July 2026 (Uthana is the only listed provider). Engine vendors treat animation models as swappable suppliers.
- The surviving standalone vendors are hedging toward robotics and "physical AI": Uthana's homepage, robot retargeting and dataset sales; Rokoko's robotics/Device SDK section; Kinetix's video-model research. Games alone may not support these businesses.
- Quality reputation is mostly unmeasured in public. No independent benchmark compares Uthana, SayMotion, Unity AI, Kimodo and HY-Motion on game-ready criteria such as foot contact, loopability and retarget fidelity.

### Gaps
- Cascadeur's MCP server: capabilities and transport are undocumented. The only source is CG Channel; searches for official docs found nothing.
- Missing prices and terms: DeepMotion's live prices; Flow Studio's dollar prices and output license; whether Move.ai offers an API; Plask's current prices; Everything Universe (Anything World) pricing and license.
- Meshcapade: the actual closure date, customer migration, and who licenses SMPL commercially after the acquisition (meshcapade.com returned 403).
- Kinetix's claimed Mixamo integration has no Adobe confirmation.
- Not researched in depth: the UE ML Deformer and UE 5.5–5.6 AI animation features. I found no NVIDIA ACE updates for 2026.

## 2. Which offer a public API, SDK, MCP server or other agent integration? Request/response shape? Can an LLM agent drive them end to end?

### Takeaway
Self-serve programmatic generation exists:
- Uthana's GraphQL API, which also powers Unity AI's animation generator.
- Meshy's and Tripo's REST APIs for rigging plus preset animation.
- Local CLIs for Kimodo and HY-Motion.

The big editors now speak MCP: Unreal 5.8's experimental plugin, Unity MCP, Cascadeur 2026.2's "simple" server, and the community-built BlenderMCP.

But every pipeline ends in binary or engine-native assets (FBX, GLB, .anim, .casc). None exposes a semantic, text-native motion representation or headless quality checks. An LLM agent can request and download motion end to end today, but cannot meaningfully read, diff, edit or verify it without extra tooling.

### Cited Findings
| Product | Programmatic surface (Oct 2026) | Request → response shape | Agent / MCP | Source |
|---|---|---|---|---|
| Uthana | Self-serve GraphQL API with an API key; shares one balance with the web app; pay-as-you-go | Text prompt (plus optional character FBX/GLB to auto-rig) → base motion → retarget to character → download FBX/GLB/BVH; samples in shell/Python/TS/React/C# | No MCP documented; the animation provider inside Unity AI | [API blog](https://uthana.com/blog/how-uthanas-api-speeds-up-text-to-motion-animation), [pricing](https://uthana.com/pricing), [Unity terms](https://unity.com/legal/third-party-ai-terms) |
| DeepMotion SayMotion | REST (Basic auth with client ID/secret); "limited to verified partners" | Text prompt → body animation (FBX/GLB/BVH/MP4 per third-party listings) | None | [SayMotion API](https://deepmotion.com/saymotion-api), [GitHub](https://github.com/DeepMotion/SayMotion-REST-API) |
| Meshy | REST `/openapi/v1/rigging` plus Animation API; SSE progress stream | GLB URL → rigged FBX/GLB (+ walk/run) → apply animation clips | None documented; resold on fal.ai | [Meshy docs](https://docs.meshy.ai/api/rigging-and-animation), [fal.ai](https://fal.ai/models/fal-ai/meshy/rigging/llms.txt) |
| Tripo | REST rig-v2.0 and animation endpoints | 3D model → rigged GLB/FBX; up to 5 preset names → GLB/FBX clips | None documented | [rig](https://developers.tripo3d.com/en/models/rig), [animation](https://developers.tripo3d.com/en/models/animation) |
| Unity AI | In-Editor Animation Generator; Unity MCP | Prompt + duration + seed (or MP4) → `.anim` clip in Assets | Unity MCP for Claude Code/Cursor; built-in tools cover scene, assets, scripts and console (animation not listed) | [generator docs](https://docs.unity3d.com/Packages/com.unity.ai.assistant@2.6/manual/Animation/animation-create.html), [MCP docs](https://docs.unity3d.com/Packages/com.unity.ai.assistant@2.0/manual/unity-mcp-overview.html) |
| Unreal Engine 5.8 | Experimental MCP plugin | Editor operations on Blueprints, assets, levels, materials, meshes; extensible | MCP; "any model"; no auth; serial on the game thread | [GamesBeat](https://gamesbeat.com/epic-games-launches-unreal-engine-5-8/), [DEV](https://dev.to/gamedevtoollab/using-unreal-mcp-in-ue-58-from-codex-setup-toolsets-and-safe-editor-automation-4pon) |
| Cascadeur 2026.2 | Python API; "simple" MCP server | Editor control (scope not itemized) | MCP | [CG Channel](https://www.cgchannel.com/?p=177897) |
| Rokoko Studio/Create | Studio Command API, UDP triggers ("advanced" on Pro) | Studio operations; no public REST generation API | None | [Rokoko pricing](https://www.rokoko.com/pricing) |
| NVIDIA Kimodo | Local PyTorch, CLI, timeline UI | Text + frame-indexed constraints → root translation + 30-joint rotations (30 fps, ≤10 s) | None | [HF card](https://huggingface.co/nvidia/Kimodo-SOMA-SEED-v1.1), [docs](https://research.nvidia.com/labs/sil/projects/kimodo/docs/) |
| Tencent HY-Motion | Local CLI/Gradio; HF Space; "isn't deployed by any Inference Provider" | Text → skeleton animation (FBX/NPZ via community nodes) | None | [GitHub](https://github.com/Tencent-Hunyuan/HY-Motion-1.0), [HF](https://huggingface.co/tencent/HY-Motion-1.0) |
| Krikey | No public API found | — | — | [pricing](https://www.krikey.ai/pricing), [xpay](https://www.xpay.sh/agent-ready-index/krikey-ai/) |
| Plask | "MoCap API" inside the tool (1–3 credits/frame) | Video → pose + camera data | — | [plask.ai](https://plask.ai/) |
| Kinetix | SDK/API in 2023–2025; not promoted in 2026 | — | — | [docs](https://docs.kinetix.tech/~gitbook/pdf), [kinetix.tech](https://www.kinetix.tech/) |
| BlenderMCP (CommonSenseMachines, open source) | MCP server for Blender | Text prompt → animate a humanoid mesh from a fixed preset library (not generated motion) | MCP (Claude/Cursor) | [Blender Artists](https://blenderartists.org/t/open-source-blender-mcp-with-fast-3d-generation-search-and-instant-text-to-animation-auto-rigging/1589568), [CSM](https://csm.ai/academy/text-to-4d-with-blender-mcp) |
| unreal-animation-mcp (community) | MCP for animation assets in a running UE editor | — | MCP | [Glama](https://glama.ai/mcp/servers/d20xurs940) |

- [V] DeepMotion went from announcing a publicly available SayMotion API (May 2024) to partner-only access (page as of Oct 2026). — [DeepMotion 2024 post](https://deepmotion.com/post/saymotion-api-now-available-for-free-trials); [SayMotion API](https://deepmotion.com/saymotion-api)
- [P] RADiCAL's services (including Live streaming to engines) shut down Jul 6, 2026. [A] Ready Player Me's public API endpoints went offline Jan 31, 2026. — [CG Channel](https://www.cgchannel.com/?p=175200); [Avatar SDK](https://avatarsdk.com/blog/2026/07/07/ready-player-me-migration-guide/)
- [V] Unity auto-approves AI Gateway connections; direct external MCP clients need a user approval dialog. — [Unity MCP overview](https://docs.unity3d.com/Packages/com.unity.ai.assistant@2.0/manual/unity-mcp-overview.html)

### Inferences
- An agent can drive Uthana end to end today (prompt → retarget → download), and Meshy or Tripo for rigging plus presets. The artifacts it gets back are opaque, though.
- BVH (from Uthana, Rokoko Basic and up, and reportedly DeepMotion) is the only text format on offer. It is a low-level per-frame channel dump with Euler angles, not a semantic, diffable clip format. The agent "reads" numbers, not intent such as contacts, phases or loop points.
- The MCP bridges control editors; they are not motion-data APIs. None documents animation-specific tools: Unity lists scene, assets, scripts and console; Unreal lists Blueprints, assets, levels, materials and meshes. Agent workflows around animation still pass through binary engine assets.
- The best fit for an agent is a constraint-driven generator. Kimodo accepts keyframe, end-effector and path constraints that an agent could compute programmatically, which is a better match than prompt-only APIs.
- Platform risk is real for agent pipelines built on SaaS: DeepMotion's API is now gated, RADiCAL and Ready Player Me are gone, and Meshcapade is reportedly closing.

### Gaps
- I did not retrieve Uthana's GraphQL schema or mutation names (docs at uthana.com/docs/api were not fetched).
- Unknown whether Unity MCP tools can invoke the Animation Generator, what Cascadeur's MCP tools are, and whether Unreal MCP covers animation assets out of the box.
- Unknown whether Move.ai, Cartwheel or Motorica offer public APIs; only unverified third-party claims exist for Cartwheel.

## 3. Pricing tiers and output licenses: royalty-free? commercial? redistributable as editable data in an open-source repo?

### Takeaway
Commercial use inside a shipped game is standard on paid tiers. Redistributing raw or editable animation files is where vendors diverge sharply:
- **Mixamo** explicitly bans "any type of free distribution" of raw files, and (per its 2022 FAQ) training ML models on them.
- **DeepMotion** keeps ownership and bans resale, sublicensing and "stand-alone" access.
- **Uthana and Meshy** give paid users ownership, and license free-tier outputs as CC BY 4.0. These are the only commercial sources whose terms plausibly allow editable clips in an open repo, with attribution in the free case.

Open-weights models split the same way:
- **HY-Motion:** Tencent claims no rights in outputs, but the license excludes the EU, UK and South Korea and bans using outputs to improve other AI models.
- **Kimodo:** "ready for commercial use" under the NVIDIA Open Model License; I did not check its output clause.

### Cited Findings
| Vendor | Price (Oct 2026) | Commercial use in a game | Who owns outputs | Raw/editable redistribution | Source |
|---|---|---|---|---|---|
| Uthana | Pay-as-you-go: text-to-motion $0.02–$0.10/s; video $0.05/s; rig $0.15 | Paid: yes ("commercial use of generated outputs") | Paid: user owns (§8.3). Free: Uthana owns but licenses CC BY 4.0 (§8.4) | Not addressed explicitly; paid ownership and free CC BY 4.0 both point to "allowed" (verify) | [pricing](https://uthana.com/pricing), [terms](https://uthana.com/terms) |
| DeepMotion | Tiers not verifiable (about $9/$39/$83/mo per an aggregator) | Paid only; Freemium "exclusively for non-commercial purposes" | DeepMotion: "licensed, not sold" | Prohibited: "no sub-license or resale"; no "stand-alone" access | [terms](https://www.deepmotion.com/terms-of-use), [ToolMage](https://www.toolmage.com/zh-hant/tool/deepmotion/) |
| Adobe Mixamo | Free with Adobe ID (not Enterprise/Federated IDs) | "royalty free for personal, commercial, and non-profit projects" | Not stated | Prohibited: "Any type of free distribution of character or animation raw files"; no asset packs or templates; no ML training (2022 FAQ) | [community FAQ](https://community.adobe.com/questions-696/mixamo-faq-licensing-royalties-ownership-eula-and-tos-589400), [helpx snippet](https://helpx.adobe.com/au/creative-cloud/faq/mixamo-faq.html) |
| Cascadeur | Free; Indie $19/mo or $96/yr; Pro $49/mo or $396/yr; Teams | Free: no. Indie: under $100k/yr revenue. Pro: "no limits" | EULA not reviewed | EULA not reviewed | [plans](https://cascadeur.com/plans) |
| Rokoko | Free; Basic $10–12; Plus $20–28; Pro $50–70; Enterprise from $100 | Library: "including commercial ones" | Not stated | Not stated | [pricing](https://www.rokoko.com/pricing) |
| Meshy | API: Auto-Rigging 5 credits, Animation 3 credits | Yes; free tier requires credit | Free: CC BY 4.0. Paid: user owns | Free: CC BY allows it with attribution. Paid: owner's choice. Status of preset clips themselves unclear | [help](https://intercom.help/meshy/en/articles/16102098-can-i-use-meshy-assets-commercially), [API pricing](https://docs.meshy.ai/api/pricing) |
| Unity AI | Credits (secondary report: $10 per 1,000 for Personal) | Yes | "You own all your input and output data" | Not addressed; provider is Uthana, whose terms are linked | [principles](https://unity.com/legal/unityai-guiding-principles), [3P terms](https://unity.com/legal/third-party-ai-terms) |
| Krikey | Free; Pro $15/person/mo; Teams $10/person/mo | Claims "commercial licensing" on paid plans | Not stated | Not stated | [pricing](https://www.krikey.ai/pricing), [compare](https://www.krikey.ai/compare/animoto-alternatives) |
| Move One | Starter $15/mo; Basic $35/mo (Pro custom; $995 trial) | Terms not reviewed | — | — | [help](https://help.move.ai/en/articles/8851451-move-one-pricing) |
| Flow Studio | Credits 300 / 2,100 / 6,000 / 12,000 per month (aggregator prices $0 / $10 / $45 / $95) | Terms not reviewed | — | — | [compare](https://www.autodesk.com/products/flow-studio/compare) |
| Tripo | Rig 25 credits | Terms not reviewed | — | — | [rig docs](https://developers.tripo3d.com/en/models/rig) |
| HY-Motion (open weights) | Free | Yes, outside the EU/UK/South Korea and under 1M MAU | "Tencent claims no rights in Outputs" | Outputs may not be used "to improve any other AI model"; weights redistributable only with the agreement and Notice | [LICENSE.txt](https://huggingface.co/tencent/HY-Motion-1.0/raw/main/LICENSE.txt) |
| Kimodo (open weights) | Free | "ready for commercial use" (NVIDIA Open Model License) | Output clause not checked | Report: commercial use, derivatives and redistribution allowed if conditions are met | [HF](https://huggingface.co/nvidia/Kimodo-SOMA-SEED-v1.1), [CGWorld](https://cgworld.jp/flashnews/01-202604-Kimodo.html) |
| Audio2Face-3D | Free | SDK and plugins MIT; models "Nvidia Open Model"; Audio2Emotion only with A2F | — | Sample data "evaluation only" | [GitHub](https://github.com/NVIDIA/Audio2Face-3D) |
| Quaternius Universal Animation Library | Free portion plus paid tiers | CC0 | — | CC0 (no restrictions) | [Cinevva guide](https://app.cinevva.com/guides/free-character-animations-rigging) |

- [V] Uthana §8.5 lets Uthana train on Customer Data by default (except on a "no-training" paid tier). DeepMotion may process uploads through ML "for the sole purpose of improving the Site and services." — [Uthana terms](https://uthana.com/terms); [DeepMotion terms](https://www.deepmotion.com/terms-of-use)
- [V] Unity puts the burden on the developer: "it remains your responsibility to ensure you have the rights to use content in your final build." — [Unity AI Guiding Principles](https://unity.com/legal/unityai-guiding-principles)
- [A] The Cinevva guide warns that a tool being free to use does not by itself grant redistribution rights for every character or motion imported into it. — [Cinevva guide](https://app.cinevva.com/guides/free-character-animations-rigging)

### Inferences
- For an open repository of editable clips, contribution sources fall into three groups (my reading of the terms above; not legal advice):
  - **Likely safe:** CC0 (Quaternius); CC BY 4.0 outputs (Uthana free, Meshy free), with attribution kept; outputs owned by paid users (Uthana paid, Meshy paid, Unity AI subject to Uthana's terms); Kimodo outputs (once the NVIDIA Open Model License output terms are confirmed).
  - **Prohibited:** Mixamo and DeepMotion raw clips.
  - **Hazardous:** HY-Motion outputs. EU, UK and South Korean contributors and users are outside the license, and §5(b) conflicts with a library others may use to train models. Also Rokoko library clips, whose redistribution terms are unstated.
- An agent-contributed library therefore needs machine-readable provenance on every clip: generator, model version, ToS version and date, license, attribution string. It also needs automated rejection of tainted sources.
- Seeding cost is low (my arithmetic). 1,000 clips × 5 s through Uthana text-to-motion 3.0 = 5,000 s × $0.10 = $500; at v1.0 it is about $100, ignoring rejected generations. Kimodo is free but needs GPU hosting. Price is not the barrier; license and quality are.

### Gaps
- Not checked: the output clause of the NVIDIA Open Model License for Kimodo; Cascadeur's EULA on redistributing exported files; Rokoko Motion Library redistribution terms; redistribution of Meshy's and Tripo's preset animations; Flow Studio, Move.ai and Krikey output terms; whether Unity AI passes Uthana's ownership terms through.
- With subscriptions gone, it is unclear whether Uthana still offers a Free Plan, which is the tier whose outputs are CC BY 4.0.

## 4. Market signals 2024–2026 (funding, acquisitions, shutdowns, user counts) and developer complaints

### Takeaway
2024–2026 shows consolidation and a big funding gap:
- **Acquisitions:** Wonder Dynamics → Autodesk (2024); Ready Player Me → Netflix (Dec 2025); Meshcapade → Epic (Feb 2026); RADiCAL's IP → Autodesk (Apr 2026).
- **Shutdowns:** Unity Muse (Oct 2025); Ready Player Me (Jan 2026); Meshcapade's standalone service (reportedly Apr 2026); RADiCAL (Jul 2026).
- **Pivots:** Kinetix to research and video; Uthana to pay-as-you-go plus physical AI; Rokoko Vision into Create.
- **Funding:** 3D-generation platforms raised enormous sums (Tripo about $800M across three 2026 rounds), while animation-specific startups raised modest seeds (Uthana $4.3M, Cartwheel $10M, Motorica about €5M).

Developer sentiment toward generative AI is at a record low: 52% of respondents to GDC's 2026 survey see it as negative for the industry. The recurring technical complaints are foot sliding and skating, cleanup time, fingers and contact, and retargeting rest-pose mismatches. Lock-in became tangible when Ready Player Me users could not export their avatars.

### Cited Findings
- **Timeline (dated):**
  - 2024-05: Autodesk acquires Wonder Dynamics. — [AWN](https://www.awn.com/news/autodesk-acquires-wonder-dynamics)
  - 2024-05/06: DeepMotion makes the SayMotion API available (May) and launches SayMotion (June). — [DeepMotion](https://deepmotion.com/post/saymotion-api-now-available-for-free-trials); [CG Channel](https://www.cgchannel.com/2024/06/deepmotion-launches-ai-text-to-animation-service-saymotion)
  - 2025-03-10: Uthana $4.3M seed. — [Pulse 2.0](https://pulse2.com/uthana-4-3-million-raised-to-transform-3d-character-animation-with-genai)
  - 2025-03: Roblox Cube launched. — [Roblox](https://corp.roblox.com/newsroom/2025/03/introducing-roblox-cube)
  - 2025-05-15: Cartwheel $10M ($15.6M total). — [Cartoon Brew](https://www.cartoonbrew.com/tech/jeffrey-katzenberg-backed-ai-animation-software-cartwheel-raises-10-million-247264.html)
  - 2025 (June per VCBacked): Motorica seed of about €5M. — [CO/AI](https://getcoai.com/news/motorica-raises-5-4m-to-make-game-animation-200x-faster-with-ai/)
  - 2025-06-04: MetaHuman licensing opened to other engines (disputed by a 2026 blog). — [CG Channel](https://www.cgchannel.com/2025/06/you-can-now-sell-metahumans-or-use-them-in-unity-or-godot/)
  - 2025-06-16..20: Mixamo outage. — [Adobe Community](https://community.adobe.com/t5/mixamo-discussions/mixamo-down/m-p/15377556)
  - 2025-08: Unity 6.2 ships Unity AI. — [CG Channel](https://www.cgchannel.com/?p=169508)
  - 2025-09: NVIDIA open-sources Audio2Face. — [AWN](https://www.awn.com/news/nvidia-open-sources-audio2face-animation-model)
  - 2025-10-01: Unity Muse retired. — [Unity docs](https://docs.unity3d.com/Packages/com.unity.muse.animate@1.2/manual/index.html)
  - 2025-11-12: UE 5.7 with an AI Assistant. — [CG Channel](https://www.cgchannel.com/2025/11/unreal-engine-5-7-five-key-features-for-cg-artists/)
  - 2025-12-19 / 2026-01-31: Netflix acquires Ready Player Me, then shuts it down. — [Avatar SDK](https://avatarsdk.com/blog/2026/07/07/ready-player-me-migration-guide/)
  - 2025-12-30: Tencent HY-Motion 1.0. — [GitHub](https://github.com/Tencent-Hunyuan/HY-Motion-1.0)
  - 2026-02-18: Epic acquires Meshcapade; standalone closure reported for April. — [MPG](https://www.mpg.de/26082348/max-planck-spin-off-draws-epic-games-to-tuebingen); [80.lv](https://80.lv/articles/ai-motion-capture-startup-meshcapade-now-part-of-epic-games)
  - 2026-03-16 / 04-10: NVIDIA Kimodo, then v1.1. — [NYU RITS](https://rits.shanghai.nyu.edu/ai/nvidia-releases-kimodo-controllable-text-to-motion-for-characters-and-humanoid-robots/); [HF](https://huggingface.co/nvidia/Kimodo-SOMA-SEED-v1.1)
  - 2026-03-25: Maya 2027 (MotionMaker adds horses). 2026-07-22: Maya 2027.2 (bring-your-own-data training). — [CG Channel](https://www.cgchannel.com/?p=174872); [CG Channel](https://www.cgchannel.com/2026/07/maya-2027-2-lets-you-train-your-own-ai-animation-models/)
  - 2026-04: Autodesk acquires RADiCAL's IP; portal closes 2026-07-06. — [CG Channel](https://www.cgchannel.com/?p=175200)
  - 2026-04: Cascadeur 2026.1 (AI inbetweening with style reference). — [CG Channel](https://www.cgchannel.com/?p=175211)
  - 2026-06 to 2026-09: Tripo rounds of about $200M, more than $150M and about $446M. — [Pulse 2.0](https://pulse2.com/tripo-ai-raises-over-150-million-in-series-a3-financing/amp/); [DealStreetAsia](https://www.dealstreetasia.com/?p=493956)
  - 2026-06 (week of Jun 17): UE 5.8 with the experimental MCP plugin and webcam full-body MetaHuman Animator. — [GamesBeat](https://gamesbeat.com/epic-games-launches-unreal-engine-5-8/)
  - 2026-07-16: Rokoko Vision 3.0 and Create; dual-camera and webcam capture retired 2026-08-16. — [Rokoko](https://www.rokoko.com/insights/introducing-rokoko-vision-3-0)
  - 2026-07-28: Unity lists Uthana as its animation provider. — [Unity](https://unity.com/legal/third-party-ai-terms)
  - 2026-08: Uthana stops new subscriptions. — [Uthana pricing](https://uthana.com/pricing)
  - 2026-08-06: Cascadeur 2026.2 with an MCP server. — [CG Channel](https://www.cgchannel.com/?p=177897)
- **User and usage counts (sparse):**
  - [M] Uthana claims 45,000+ characters animated and 1.7M+ seconds of motion generated. — [Uthana](https://uthana.com/)
  - [P] Cartwheel says 8,000 artists tested it in beta. — [CO/AI](https://getcoai.com/news/ai-startup-cartwheel-secures-10m-for-character-animation-tools/)
  - [P] Roblox Cube has generated 1.8M objects. — [Outlook Respawn](https://respawn.outlookindia.com/gaming/gaming-news/cube-3d-powers-robloxs-new-4d-interactive-object-tools)
  - [P] In GDC's survey, 36% of game professionals say they use generative AI tools at work. — [GDC](https://gdconf.com/article/gdc-2026-state-of-the-game-industry-reveals-impact-of-layoffs-generative-ai-and-more/)
- **Sentiment:** [P] GDC 2026 State of the Game Industry (more than 2,300 respondents):
  - 52% say generative AI's impact on the industry is negative, up from 30% in 2025 and 18% in 2024.
  - The most negative groups: visual and technical art (64%), design and narrative (63%), programming (59%).
  - Only about 7% see it as positive.
  - [GDC](https://gdconf.com/article/gdc-2026-state-of-the-game-industry-reveals-impact-of-layoffs-generative-ai-and-more/); [TechSpot](https://www.techspot.com/news/111128-more-than-50-game-developers-generative-ai-harming.html)
- **Complaint: foot sliding and skating.**
  - [U/P] Opsive's early AI-generated walk cycles slid, and it added a post-process that matches travel distance to foot movement. — [Opsive](https://opsive.com/?p=27413)
  - [V] Kimodo's own model card says it "may show foot skating." — [HF](https://huggingface.co/nvidia/Kimodo-SOMA-SEED-v1.1)
  - [V] Cascadeur ships foot cleanup inside AI inbetweening, plus Fulcrum Motion Cleaning, and warns of overstretched limbs. — [Cascadeur help](https://cascadeur.com/help/category/278)
- **Complaint: cleanup time and consistency.**
  - [A, biased source] A mocap-pack seller claims AI clips "frequently contain foot-slip, joint drift, or weight errors" and that cleanup "can exceed the time saved." — [MoCap Online](https://mocaponline.com/pages/motion-capture-vs-ai-animation-tools)
  - [P, same publisher] It also cites unreliable fingers, inability to handle contact or grappling, and inconsistent style and weight across large AI-generated libraries. — [MoCap Online 2026](https://mocaponline.com/blogs/mocap-news/ai-game-animation-tools-2026)
  - [U] Users fought foot twitch and limb twisting in DeepMotion and Plask output. — [Reallusion forum](https://forum.reallusion.com/PrintTopic519932.aspx)
- **Complaint: retargeting.** [U] Godot users hit T-pose vs A-pose mismatches, missing root bones and twisted hands with Mixamo. — [Godot forum](https://forum.godotengine.org/t/retargeting-mixamo-animations-fails/39619)
- **Complaint: reliability, lock-in and feature regressions.**
  - [U] Mixamo outage with no ETA from support. — [Adobe Community](https://community.adobe.com/questions-696/mixamo-is-not-end-of-life-it-s-broken-and-fixable-589870)
  - [A] Ready Player Me users could not export their avatars. — [Genies](https://genies.com/blog/ready-player-me-shutdown)
  - [V] Rokoko Vision 3.0 launched without finger tracking and dropped webcam capture. — [Rokoko](https://www.rokoko.com/insights/introducing-rokoko-vision-3-0)
  - [V] DeepMotion's API became partner-only. — [DeepMotion](https://deepmotion.com/saymotion-api)

### Inferences
- Shutdown and lock-in risk is now concrete: RADiCAL, Ready Player Me and Meshcapade (standalone) are gone or closing, and DeepMotion's API is gated. A value proposition built on "open, self-hostable, vendor-neutral" has real evidence behind it.
- Investors are betting on general 3D generation and world models (Tripo) and on engine/DCC owners, not on standalone game-animation tools. A new commercial entrant in AI game animation would face a thin funding market; an open-source infrastructure play does not depend on it.
- Artists' hostility to generative AI (64% negative in visual and technical art) suggests positioning an open package as tooling for correctness, verification and licensed provenance, not as a replacement for animators.

### Gaps
- I retrieved no Reddit threads: searches restricted to reddit.com returned nothing. Reddit-specific sentiment (r/gamedev, r/Unity3D, r/unrealengine, r/blender) is unverified here; the anecdotes above come from Godot, Reallusion and Adobe forums.
- User counts for most vendors (Mixamo, DeepMotion, Rokoko, Move.ai, Cascadeur) are not public. Cascadeur and Move.ai funding for 2025–2026 was not found.

## 5. Is anyone positioning as an "AI-native" or "agent-native" animation library or standard? Open-source competitors?

### Takeaway
No commercial vendor I found positions itself as an "agent-native" animation library or as an open motion standard. The closest are:
- MCP bridges into editors: Unreal 5.8, Unity, Cascadeur, and the community BlenderMCP.
- Uthana's pitch as "The AI platform for human motion" for "AI-native game platforms" and robotics. It is a closed SaaS.

The open side is strong on models: NVIDIA Kimodo (commercially usable), Tencent HY-Motion (restricted) and the OpenT2M dataset. It is also strong on character-adjacent pieces: the Audio2Face SDK and Epic's OpenRigLogic, both MIT. It is weak on an agent-first format, runtime and verification stack. The only project I found where an agent orchestrates animation through a text scene format is a small 2D/video PyPI package.

### Cited Findings
- [M] Uthana: "Built for physical AI and proven in gaming"; targets "AI-native game platforms"; closed GraphQL API. — [Uthana](https://uthana.com/)
- [P] UE 5.8's experimental MCP plugin is described as an "open standard plugin" that works with "any model you want." — [GamesBeat](https://gamesbeat.com/epic-games-launches-unreal-engine-5-8/)
- [V] Unity MCP is built into AI Assistant. — [Unity docs](https://docs.unity3d.com/Packages/com.unity.ai.assistant@2.0/manual/unity-mcp-overview.html)
- [P] Cascadeur 2026.2 ships a "simple" MCP server. — [CG Channel](https://www.cgchannel.com/?p=177897)
- [A] Open-source BlenderMCP (CommonSenseMachines) can animate humanoid meshes from text prompts using a fixed preset library. — [Blender Artists](https://blenderartists.org/t/open-source-blender-mcp-with-fast-3d-generation-search-and-instant-text-to-animation-auto-rigging/1589568)
- [A] A community "unreal-animation-mcp" exposes animation assets in a running UE editor to agents. — [Glama](https://glama.ai/mcp/servers/d20xurs940)
- [V] NVIDIA Kimodo: commercial-use open weights with constraint-based control and an interactive timeline tool; a community UE 5.7 plugin exists. — [HF](https://huggingface.co/nvidia/Kimodo-SOMA-SEED-v1.1); [docs](https://research.nvidia.com/labs/sil/projects/kimodo/docs/); [Fab](https://www.fab.com/listings/c2ac4d6d-b21e-4f44-bee3-e4a596c24711)
- [V] Tencent HY-Motion: open weights under a restrictive license (territory exclusion, 1M MAU, ban on improving other models). Community ComfyUI nodes exist. — [LICENSE](https://huggingface.co/tencent/HY-Motion-1.0/raw/main/LICENSE.txt); [RunComfy](https://www.runcomfy.com/comfyui-nodes/ComfyUI-HyMotion)
- [P] OpenT2M (Mar 2026): an open, million-scale motion dataset with more than 2,800 hours of human motion, plus a model. — [arXiv 2603.18623](https://arxiv.org/pdf/2603.18623)
- [V/P] Open character tech from incumbents: Audio2Face SDK and plugins (MIT; models under the NVIDIA Open Model License) — [GitHub](https://github.com/NVIDIA/Audio2Face-3D); Epic's OpenRigLogic (RigLogic and DNA under MIT, "start of the MetaHuman Devkit") — [GamesBeat](https://gamesbeat.com/epic-games-launches-unreal-engine-5-8/)
- [A] "an" (PyPI, thorwhalen/an): AI-driven structured animation with a markdown scene format and a validated scene graph. An AI agent (Claude Opus 4.7) orchestrates existing executors (a custom 2D-cutout runtime, Manim, Remotion) and renders mp4. It is 2D and video only, early stage. — [PyPI](https://pypi.org/project/an/0.1.77/)
- [A] Free and open clip sources: Quaternius Universal Animation Library (CC0); Kenney Mini Characters (CC0). — [Cinevva guide](https://app.cinevva.com/guides/free-character-animations-rigging)
- [V] Epic's Game Animation Sample offers 500+ free animations, but it is UE-centric (license not checked). — [Epic blog](https://www.unrealengine.com/en-US/blog/game-animation-sample)

### Inferences
- The niche of an agent-native, open, web-first animation package (format plus runtime plus verification plus library plus MCP) appears unoccupied as of October 2026. Adjacent incumbents have the pieces to move in:
  - **Epic:** MCP, MetaHuman, Meshcapade's technology, and a demonstrated willingness to MIT-license RigLogic.
  - **NVIDIA:** Kimodo, the SOMA skeleton, and open model licenses.
  - **Uthana:** an API-first business that is already the motion supplier inside Unity.
- Kimodo is a plausible generation backend that an open agent stack could call or bundle, subject to confirming the NVIDIA Open Model License output terms. HY-Motion is a poor fit as a default backend for a global, open, possibly training-adjacent library because of its territory exclusion and §5(b).
- Existing MCP servers are editor remote controls. A motion-data MCP (generate, inspect, edit, verify, export) would complement them rather than compete, and could plug into Unity, Unreal and Blender bridges.

### Gaps
- I did not exhaustively survey GitHub for open, text-based motion DSLs or agent-oriented animation formats (JSON/YAML clip formats, VRMA, glTF extensions). Other researchers covering formats and standards should confirm.
- I did not check whether Kimodo's "Output Formats" and "Motion Format Conversion" docs define an interchange format that could become a de facto standard.

## 6. Where are the clear gaps an open, agent-first package could fill, and where would it collide head-on with well-funded players?

### Takeaway
**Open lanes:**
1. A text-native, diffable motion format that agents can read and edit. Commercial outputs are FBX, GLB, .anim and .casc; BVH is low-level.
2. Headless verification exposed through a CLI or MCP: foot skating, ground and self penetration, joint limits, loop seams. Today these fixes live inside GUIs.
3. A clip library with recorded provenance under clear licenses (CC0 or CC BY) and in editable form. Mixamo and DeepMotion terms forbid exactly this.
4. A web-first runtime with vendor-neutral retargeting across Mixamo, UE Mannequin, SMPL/SMPL-X, SOMA and VRM skeletons.
5. A backend-agnostic agent interface that can call Uthana, Kimodo, HY-Motion (where licensed), Meshy or Tripo.

**Head-on collisions to avoid:**
- Training generative models: Uthana, Epic plus Meshcapade, Autodesk, Tripo and Meshy (Tripo alone raised about $800M in 2026), NVIDIA, Tencent.
- In-engine tooling: UE motion matching, MetaHuman Animator, Unity AI.
- DCC keyframing: Cascadeur (now with MCP), Maya MotionMaker.
- Video mocap: Rokoko, Move.ai, QuickMagic, Plask, DeepMotion, Flow Studio.

### Cited Findings
- Outputs are binary or engine-specific:
  - [V] Unity AI saves `.anim` clips. — [Unity docs](https://docs.unity3d.com/Packages/com.unity.ai.assistant@2.6/manual/Animation/animation-create.html)
  - [V] Cascadeur Free exports only `.casc`. — [Cascadeur plans](https://cascadeur.com/plans)
  - [V/M] Uthana exports FBX/GLB/BVH. — [Uthana API blog](https://uthana.com/blog/how-uthanas-api-speeds-up-text-to-motion-animation)
  - [V] Meshy returns FBX/GLB. — [Meshy docs](https://docs.meshy.ai/api/rigging-and-animation)
  - [V] Tripo returns GLB/FBX. — [Tripo docs](https://developers.tripo3d.com/en/models/animation)
  - [V] Kimodo outputs raw root translation plus rotation matrices. — [HF](https://huggingface.co/nvidia/Kimodo-SOMA-SEED-v1.1)
- Quality fixes are embedded in GUIs or done ad hoc, not exposed as agent tools:
  - [V] Cascadeur foot cleanup and Fulcrum Motion Cleaning — [Cascadeur help](https://cascadeur.com/help/category/278); Collision Penetration Cleaning — [CG Channel](https://www.cgchannel.com/?p=175211)
  - [U/P] Opsive's post-process for foot sliding. — [Opsive](https://opsive.com/?p=27413)
  - [V] Kimodo admits foot skating. — [HF](https://huggingface.co/nvidia/Kimodo-SOMA-SEED-v1.1)
- [V] Redistribution bans: Mixamo ("Any type of free distribution of character or animation raw files") — [Adobe Community](https://community.adobe.com/questions-696/mixamo-faq-licensing-royalties-ownership-eula-and-tos-589400); DeepMotion ("no sub-license or resale by you to others is allowed") — [DeepMotion terms](https://www.deepmotion.com/terms-of-use)
- [V] Permissive exceptions: Uthana paid outputs owned by the user and free outputs CC BY 4.0 — [Uthana terms](https://uthana.com/terms); Meshy free CC BY 4.0, paid owned — [Meshy help](https://intercom.help/meshy/en/articles/16102098-can-i-use-meshy-assets-commercially)
- Agent bridges target editors:
  - [P] UE 5.8 MCP. — [GamesBeat](https://gamesbeat.com/epic-games-launches-unreal-engine-5-8/)
  - [V] Unity MCP tools are limited to scene, assets, scripts and console. — [Unity docs](https://docs.unity3d.com/Packages/com.unity.ai.assistant@2.0/manual/unity-mcp-overview.html)
  - [P] Cascadeur MCP. — [CG Channel](https://www.cgchannel.com/?p=177897)
- Retargeting is painful outside the big engines and is being productized inside them:
  - [U] Godot Mixamo retargeting threads. — [Godot forum](https://forum.godotengine.org/t/retargeting-mixamo-animations-fails/39619)
  - [M] Uthana markets retargeting "without manual bone mapping." — [Uthana API blog](https://uthana.com/blog/how-uthanas-api-speeds-up-text-to-motion-animation)
  - [P] UE 5.8 adds Retarget Override Sets. — [GamesBeat](https://gamesbeat.com/epic-games-launches-unreal-engine-5-8/)
- Capital and consolidation on the generation side:
  - [P] Tripo rounds. — [Pulse 2.0](https://pulse2.com/tripo-ai-raises-over-150-million-in-series-a3-financing/amp/); [DealStreetAsia](https://www.dealstreetasia.com/?p=493956)
  - [P] Epic–Meshcapade. — [MPG](https://www.mpg.de/26082348/max-planck-spin-off-draws-epic-games-to-tuebingen)
  - [P] Autodesk–RADiCAL. — [CG Channel](https://www.cgchannel.com/?p=175200)
  - [V] Unity–Uthana. — [Unity](https://unity.com/legal/third-party-ai-terms)
- [P] Sentiment headwind: GDC 2026, 52% negative on generative AI. — [GDC](https://gdconf.com/article/gdc-2026-state-of-the-game-industry-reveals-impact-of-layoffs-generative-ai-and-more/)

### Inferences
- **Where an open, agent-first package fits:** be infrastructure, the "three.js/Rapier of animation," not another generator.
  - Define the text motion format, playback, blending, retargeting and IK runtime, verification CLI and MCP, and the license-clean library.
  - Treat generators as pluggable backends: Uthana API, local Kimodo, Meshy/Tripo for rigging. Competitors then become suppliers, and the project rides model progress instead of fighting $100M+ model builders.
- **License hygiene is a differentiator.** None of the commercial libraries offers a growing, redistributable, editable, provenance-tracked corpus. Mixamo's and DeepMotion's terms structurally cannot. Uthana's and Meshy's terms make CC BY or owned contributions possible, so a contribution pipeline that records generator, ToS version and license per clip is both necessary and defensible.
- **Web-first is uncontested among the vendors profiled.** Every one targets Unity, Unreal, Maya or Blender, or a hosted web editor; none ships an embeddable web runtime library. Whether enough demand exists among web or three.js game developers is unproven (see Gaps).
- **Collision zones, and why to stay out:**
  - Generative model quality (Uthana, Epic, Autodesk, Tripo, Meshy, Cartwheel, Motorica, NVIDIA, Tencent): capital-intensive and fast-moving.
  - In-engine animation systems (UE motion matching, Control Rig, MetaHuman Animator, Unity AI): users inside UE or Unity will use built-ins.
  - DCC keyframing (Cascadeur, Maya MotionMaker).
  - Video mocap (Rokoko Create, Move.ai, QuickMagic, Plask, DeepMotion, Flow Studio).
  - A preset clip library alone would also compete with Meshy's and Tripo's bundled presets and Epic's free 500+ sample animations unless it is clearly more open and editable.
- **Strategic risks:**
  - Epic could extend MCP, MetaHuman and Meshcapade technology into an open motion format or runtime, as it did by MIT-licensing RigLogic.
  - NVIDIA could pair Kimodo and SOMA with an open runtime or format.
  - Unity bundling Uthana weakens the pull for Unity users.
  - Fast-changing vendor terms (Uthana's pricing changed in Aug 2026; DeepMotion's API access narrowed) mean any backend integration needs version-pinned license metadata.

### Gaps
- No market-size data on web or three.js developers who need character animation, and no survey of agent-driven game development adoption. Other researchers or primary interviews would be needed.
- No independent, game-oriented quality benchmark across commercial and open text-to-motion systems. A feasibility study may need its own small benchmark (foot-skate, penetration, loopability, prompt adherence).
- Official confirmation is missing for several key terms: the Mixamo FAQ's current wording (the helpx page blocked automated fetches; the most detailed text is a 2022 repost), Cascadeur's MCP scope and EULA, and the NVIDIA Open Model License output clause.
