# Open motion data, licensing, legal status of AI-generated motion, and open-asset registry and provenance patterns (state as of 11 October 2026)

*Research date: 2026-10-11. This is not legal advice. Quotes come from primary texts wherever a primary text could be retrieved. Secondary or search-excerpt sources are flagged. Where the shared web-search budget ran out mid-research, the remaining questions are listed under Gaps.*

## 1. Which motion datasets and animation libraries can legally seed an open, editable, commercially shippable library?

### Takeaway
Only a small set of sources can be converted into editable "readable key poses", committed to a public repository and shipped in commercial games:
- CC0 game-animation packs: Quaternius UAL 1 and 2, Mesh2Motion (after a per-asset audit) and Kenney.
- 100STYLE, which is CC BY 4.0 and so requires attribution.
- CMU, but only under its "no resale, even in converted form" condition. That condition means CMU-derived clips cannot be relicensed as CC0.

Every large modern corpus is non-commercial, forbids redistribution, or has no license at all. That covers AMASS and everything derived from it (HumanML3D, BABEL, Motion-X, MotionMillion), plus LAFAN1, Bandai Namco, BEAT, KIT-ML, OpenT2M and HiPHI. Vendor libraries (Mixamo, Ready Player Me, Truebones, Rokoko) allow use inside products but not redistribution of the animation data.

### Cited Findings

#### Summary table
The verdict column answers one question: may the clips be converted into an editable open text format, published in a public repository, and shipped in commercial games?

| Source | Size and content | License as stated | Verdict | Sources |
|---|---|---|---|---|
| Quaternius Universal Animation Library 1 (page dated March 2025) | "120+ Animations". All-direction locomotion, combat and gun actions, emotes, jog, sprint, push, crawl, swim, sit, death. Editions: Standard (about 60-70% of the pack, free), Pro (adds about 30-40%), Source (Unreal/Unity URP/Godot implementations plus .BLEND files) | "Free to use in personal, educational and commercial projects. (CC0 License)" | **Yes** for Standard and Pro (CC0). The page does not restate CC0 for the paid Source edition | [Quaternius UAL1](https://quaternius.com/packs/universalanimationlibrary.html) |
| Quaternius UAL 2 | "130+" in the description, but an image caption says "All 110+ animations". The free Standard set has 42 animations. Categories: behaviour, locomotion, combat, zombie, fishing, idles and emotes, melee, farming, parkour. The Source zip ("if you pay $14.99 USD or more") has the .BLEND rig and animations. Versions: v2.0 dated 16/6/2026, **v2.2 dated 28/9/2026** | CC0, "Free to use in personal, educational and commercial projects." Not tied to a price tier | **Yes** for Standard (CC0). Confirm the Source tier | [itch.io UAL2](https://quaternius.itch.io/universal-animation-library-2); [Quaternius UAL2](https://quaternius.com/packs/universalanimationlibrary2.html) |
| Mesh2Motion | Web auto-rigging and animation app with bundled models, rigs and animations. Blender sources are in a separate `mesh2motion-assets` repo. Some human animations come from Quaternius | README: "The art assets (3d models, rigs, animations) are all licensed under CC0." Code is MIT. CGWorld (July 2026) reports CC0, CC-SA 4.0 and CC-BY "depending on the model" | **Yes** per the README, but **audit each asset** because the reports conflict | [GitHub README](https://github.com/Mesh2Motion/mesh2motion-app); [CGWorld](https://cgworld.jp/flashnews/01-202608-Mesh2Motion.html); [GameFromScratch](https://gamefromscratch.com/mesh2motion-free-open-source-animation-app/) |
| Kenney | Animated Characters 1-3: one rigged model, 4 skins, 3 animations (idle, jump, running). Mini Characters v1.0 (2024): 25 files, "Animation" listed as a feature, animation count not stated | "all game assets on the asset pages are public domain licensed (CC0)"; "Attribution is not required." | **Yes** (CC0), but very few animations | [Kenney support](https://kenney.nl/support); [OGA: Animated Characters 2](https://opengameart.org/content/animated-characters-2); [itch: Animated Characters 3](https://kenney-assets.itch.io/animated-characters-3); [Kenney Mini Characters](https://kenney.nl/assets/mini-characters) |
| 100STYLE | 100 locomotion styles. "over 4 million frames" at 60 fps, which is about 18.5 h (my calculation). Forwards, backwards and sidestep walking and running, idling, transitions. Unedited Xsens BVH with a 28-bone skeleton. Zenodo v1 dated 2022-05-04, 16.2 GB | **CC BY 4.0**. Suggested credit: "The 100STYLE Dataset - Ian Mason" | **Yes, with attribution** | [100STYLE page](https://www.ianxmason.com/100style/); [Zenodo record](https://zenodo.org/records/8127870) |
| CMU Graphics Lab MoCap | 2,605 sequences, 144 subjects, 6 categories (locomotion, sports, dance, daily activities, interactions, test). These counts come from a secondary aggregator. Formats: ASF/AMC, C3D | "This data is free for use in research projects. You may include this data in commercially-sold products, but you may not resell this data directly, even in converted form." | **Shipping inside a game: yes. A free public repo of converted clips: grey zone.** No resale is allowed, so the clips **cannot be relicensed as CC0 or MIT**, which would let anyone resell them | [CMU notice as reproduced by 4TU.ResearchData](https://data.4tu.nl/datasets/0448aab2-3332-449f-a8e2-d208cb58c7df/1); [roboticscenter.ai (aggregator)](https://www.roboticscenter.ai/datasets/cmu-mocap) |
| AMASS | "more than 40 hours", "more than 300 subjects", "more than 11000 motions". Unifies 15 optical mocap datasets. SMPL body model | Max Planck custom "Dataset Copyright License for non-commercial scientific research purposes" | **No** | [AMASS](https://amass.is.tue.mpg.de/); [AMASS license](https://amass.is.tue.mpg.de/license.html) |
| HumanML3D | 14,616 motions, 44,970 text descriptions, 28.59 h. Built from AMASS and HumanAct12 | Repo shows an MIT license (code). "Due to the distribution policy of AMASS dataset, we are not allowed to distribute the data directly." | **No**: inherits the AMASS restrictions | [HumanML3D GitHub](https://github.com/EricGuo5513/HumanML3D) |
| KIT Motion-Language (KIT-ML) | 3,911 motions and 6,353 annotations (release of 2017-06-22). HumanML3D's README counts 6,278 descriptions. Drawn from the KIT Whole-Body Human Motion Database and CMU | No license on the page. Only "© 2016 Matthias Plappert" and a request to cite | **No / unclear**: no license grant was found | [KIT-ML](https://motion-annotation.humanoids.kit.edu/dataset/); [HumanML3D README](https://github.com/EricGuo5513/HumanML3D) |
| Motion-X (NeurIPS 2023) and Motion-X++ (arXiv 2501.05098) | 81.1K clips and 15.6M SMPL-X frames. Sources include AMASS (26K clips), online videos (32.5K), IDEA400 (12.5K), HAA500, AIST++, GRAB and others. Motion-X++ adds video, 2D keypoints, SMPL-X, text and audio. No Motion-X++ totals were found | "All data is distributed under the CC BY-NC-SA (Attribution-NonCommercial-ShareAlike) license". Access is requested "for non-commercial purposes". AMASS and GRAB are "released for academic research only" | **No** | [Motion-X GitHub](https://github.com/IDEA-Research/Motion-X); [Motion-X project page](https://motion-x-dataset.github.io/) |
| BABEL | About 43 h of AMASS mocap, over 28k sequence labels, 63k frame labels, over 250 action categories | Max Planck non-commercial license. Commercial, pornographic, military and surveillance use is prohibited | **No** | [BABEL](https://babel.is.tue.mpg.de/); [BABEL license](https://babel.is.tue.mpg.de/license.html) |
| Ubisoft LAFAN1 | 5 subjects, 77 sequences, about 496,672 frames at 30 fps (about 4.6 h). Themes: obstacles 17, walking 12, dance 8, falls and getting up 6, aiming 5, ground 5, running 4, fighting 3, jumps 3, pushes and other | **CC BY-NC-ND 4.0**. Standard legal code with no extra clauses | **No**: NonCommercial and NoDerivatives | [LAFAN1 GitHub](https://github.com/ubisoft/ubisoft-laforge-animation-dataset); [license.txt](https://raw.githubusercontent.com/ubisoft/ubisoft-laforge-animation-dataset/master/license.txt) |
| BEAT and BEAT2 | BEAT: 76 h from 30 speakers. English 60 h, Chinese 16 h, Spanish 2 h, Japanese 2 h. 8 emotions. Mocap, 52D facial blendshapes, audio, text, semantic labels. BEAT2 on Hugging Face: 4,108 rows, 20.3 GB, empty README | BEAT: "Licensed under the Non-commercial license." The BEAT2 Hugging Face metadata says **Apache-2.0**, which conflicts with this | **No**: treat as non-commercial until the conflict is resolved | [BEAT](https://pantomatrix.github.io/BEAT/); [BEAT2 on Hugging Face](https://huggingface.co/datasets/H-Liu1997/BEAT2) |
| Bandai Namco Research Motion Dataset | Dataset 1: 17 content types (daily activities, fighting, dancing and more), 15 styles, 36,673 frames. Dataset 2: 10 content types (mainly locomotion and hand actions), 7 styles, 384,931 frames. Three professional actors. BVH format | Both datasets are "CC BY-NC 4.0". This is NC, **not** ND. © 2022 | **No**: no commercial use (the predecessor's exclusion was correct) | [Bandai Namco GitHub](https://github.com/BandaiNamcoResearchInc/Bandai-Namco-Research-Motiondataset) |
| MotionMillion (ICCV 2025) | Paper: "over 2,000 hours and 2 million" sequences. Hugging Face release is 308 GB. Sources: web video processed by the authors' own capture method (MotionGV) plus merged sets such as 100STYLE, BABEL, AIST, HumanML3D and FineDance | "All the data and code within this repo are under CC BY-NC-SA 4.0" (the "MotionMillion COMMUNITY LICENSE AGREEMENT"). Gated. Only part of the data is released. Merged data "must follow" the source licenses. Release dated 2025-07-30 | **No** | [paper](https://arxiv.org/abs/2507.07095v1); [Hugging Face dataset](https://huggingface.co/datasets/InternRobotics/MotionMillion); [code (Apache-2.0)](https://github.com/VankouF/MotionMillion-Codes) |
| OpenT2M (arXiv 2603.18623, 2026-03-19) | Over 1M sequences, 2,815.6 h, average clip 10.1 s. Built from web video (Kinetics-700, InternVid) and Motion-X. Captions written by Gemini-2.5-pro | No license specified. "freely available to researchers" | **No / unknown** | [OpenT2M arXiv](https://arxiv.org/html/2603.18623) |
| HiPHI (Noitom Robotics, August 2026) | 617.5 h of high-precision human motion and object interaction from 132 performers | Free for research. Commercial licensing via modalitynet.com. These facts come from a search excerpt of a press release; the page itself returned HTTP 429 | **No** without a commercial license | [press release (excerpt only)](https://www.mykxlg.com/online_features/press_releases/noitom-robotics-releases-hiphi-one-of-the-largest-high-precision-human-motion-datasets-ever-made/article_6ef62c1c-5046-5384-9fc1-cf285e07a175.html) |
| Rokoko motion dataset (commercial) | "1,6+ million unique motion assets", "Over 10,000 hours", captured by "50,000+" users | Rokoko is "authorised to sublicense the data to select third parties under strict usage conditions" | **Paid license only**. It is not open | [Rokoko motion dataset](https://www.rokoko.com/mocap/motion-dataset) |
| Rokoko free animations | A free "TV-themed" FBX collection at 30 fps, exported for Mixamo, Unreal Engine and Human IK skeletons. 150 free Motion Library moves were offered in 2020 | "Use them in any animation, VFX, game, 3D art or other 3D project you want, including for commercial use." Redistribution is not addressed | **In-game use: yes. Open redistribution: unclear, so no** | [Rokoko free animations](https://www.rokoko.com/resources/rokoko-mocap-free-tv-themed-animations); [CG Channel, 2020-03-19](https://www.cgchannel.com/2020/03/get-150-free-mocap-moves-from-rokokos-motion-library) |
| Truebones free BVH packs | Free and paid BVH/FBX packs on Gumroad | Terms "as of 01/01/2019": royalty-free for any purpose including commercial. Redistributing or reselling Truebones files in FBX, BVH or i-Motion format is banned. Attribution is requested. These terms come from a search summary because the body of the page could not be fetched | **No** | [Truebones Gumroad terms](https://truebones.gumroad.com/l/vlvPq) |
| Adobe Mixamo | Count not verified | "really the only thing you can't do is distribute the raw character and animation files"; "The only research application Mixamo content can't be used in is training machine-learning models." | **No** (the predecessor's exclusion was correct) | [Adobe community repost of the Mixamo FAQ, 2022-09-29](https://community.adobe.com/questions-696/mixamo-faq-licensing-royalties-ownership-eula-and-tos-589400) (the official helpx FAQ returned HTTP 403) |
| Ready Player Me animation library | "200+" mocap animations (locomotion, dance, expression, idle) in FBX, retargeted to RPM feminine and masculine rigs. v1.0.0, June 2023 | Custom license, quoted in the bullets below. Free for personal and commercial use, but **only with RPM avatars**, and redistribution is forbidden | **No** | [GitHub](https://github.com/readyplayerme/animation-library); [LICENSE.md](https://raw.githubusercontent.com/readyplayerme/animation-library/master/LICENSE.md) |
| Sketchfab (CC0 uploads) and Fab | License is chosen per upload | Sketchfab said CC0, CC BY-SA, CC BY-NC and CC BY-ND models "cannot migrate to Fab under those license types, as those licenses do not exist on Fab at this time". Fab requires a "CreatedWithAI" tag | **Case by case**. CC0 items are usable if the uploader's provenance checks out | See the Sketchfab/Fab bullets below |
| OpenGameArt | License is chosen per upload | Accepts CC0, CC-BY 3.0/4.0, CC-BY-SA 3.0/4.0, OGA-BY 3.0/4.0, GPL 2.0/3.0 | **CC0 and CC-BY: yes** (CC-BY needs attribution). **SA and GPL impose copyleft** on derived clips | [OGA FAQ](https://opengameart.org/content/faq) |

#### Verbatim license clauses and details
**CMU**
- The full notice as reproduced by 4TU: "This data is free for use in research projects. You may include this data in commercially-sold products, but you may not resell this data directly, even in converted form. If you publish results obtained using this data, we would appreciate it if you would send the citation to your published paper to jkh+mocap@cs.cmu.edu, and also would add this text to your acknowledgments section: The data used in this project was obtained from mocap.cs.cmu.edu. The database was created with funding from NSF EIA-0196217." — [4TU.ResearchData](https://data.4tu.nl/datasets/0448aab2-3332-449f-a8e2-d208cb58c7df/1)
- 4TU's own FBX conversion of CMU is published under **CC BY-NC 4.0**. Version 1 is dated 2024-06-12 and version 2 is dated 2025-04-07. Third-party conversions can therefore carry terms that are stricter than CMU's own. — [4TU.ResearchData](https://data.4tu.nl/datasets/0448aab2-3332-449f-a8e2-d208cb58c7df/1)
- The aggregator roboticscenter.ai labels CMU "Free for all uses (no restrictions)" and "Free / Public Domain". This **contradicts** the resale clause in CMU's own notice above. — [roboticscenter.ai](https://www.roboticscenter.ai/datasets/cmu-mocap)
- CMU's own site (`mocap.cs.cmu.edu`, including `faqs.php`) returned **HTTP 503** on two attempts on 2026-10-11. That makes mirrors and archives the practical source of record. — [mocap.cs.cmu.edu (observed)](http://mocap.cs.cmu.edu/faqs.php)

**AMASS** (Max Planck custom license, © 2020; quoted from the live license page, 2026-10-11)
- Grant: "a single-user, non-exclusive, non-transferable, free of charge right … To use the Dataset for the sole purpose of performing non-commercial scientific research, non-commercial education, or non-commercial artistic projects". — [AMASS license](https://amass.is.tue.mpg.de/license.html)
- Commercial use: "Any other use, in particular any use for commercial purposes, is prohibited. This includes, without limitation, incorporation in a commercial product, use in a commercial service, or production of other artefacts for commercial purposes." — [AMASS license](https://amass.is.tue.mpg.de/license.html)
- Distribution: "The Dataset may not be reproduced, modified and/or made available in any form to any third party without Max-Planck's prior written permission." Also: "shall not be copied, shared, distributed, re-sold, offered for re-sale, transferred or sub-licensed in whole or in part except that you may make one copy for archive purposes only." — [AMASS license](https://amass.is.tue.mpg.de/license.html)
- Training: "This license also prohibits the use of the Dataset to train methods/algorithms/neural networks/etc. for commercial use of any kind." — [AMASS license](https://amass.is.tue.mpg.de/license.html)
- Commercial licensing inquiries go to ps-license@tue.mpg.de. — [AMASS license](https://amass.is.tue.mpg.de/license.html)

**BABEL** (Max Planck license for "Data & Software")
- Prohibits training "for commercial, pornographic, military, surveillance, or defamatory use of any kind". Adds: "The Data & Software may not be used to create fake, libelous, misleading, or defamatory content of any kind excluding analyses in peer-reviewed scientific research." — [BABEL license](https://babel.is.tue.mpg.de/license.html)

**LAFAN1** (CC BY-NC-ND 4.0)
- Grant §2(a)(1): "(A) reproduce and Share the Licensed Material, in whole or in part, for NonCommercial purposes only; and (B) produce and reproduce, but not Share, Adapted Material for NonCommercial purposes only." — [LAFAN1 license.txt](https://raw.githubusercontent.com/ubisoft/ubisoft-laforge-animation-dataset/master/license.txt)
- NonCommercial means "not primarily intended for or directed towards commercial advantage or monetary compensation". — [LAFAN1 license.txt](https://raw.githubusercontent.com/ubisoft/ubisoft-laforge-animation-dataset/master/license.txt)

**Ready Player Me** (LICENSE.md)
- "The Animations are provided for your personal and commercial use, without charge"
- "Any use of the Animations with avatars or characters other than those from Ready Player Me is prohibited."
- "You may not redistribute, sell, or otherwise transfer the Animations, in whole or in part, to any third party". Passing on modified versions also needs written approval.
- Source: [RPM LICENSE.md](https://raw.githubusercontent.com/readyplayerme/animation-library/master/LICENSE.md)

**Ready Player Me shutdown**
- Netflix bought RPM for an undisclosed fee (reported 2025-12-22). RPM "will shut down its services on January 31, 2026", including PlayerZero. The article says nothing about what happens to the animation library or SDKs. — [PocketGamer.biz](https://www.pocketgamer.biz/netflix-acquires-avatar-creation-platform-ready-player-me/)

**Mixamo** (FAQ text as reposted by an Adobe community expert on 2022-09-29, written during a "preview")
- "You may not distribute the files to customers or non-team members however."
- "If you download an asset for a team then all members of that project team may access and use the file."
- Credit is optional: "are not required to give credit to Adobe, Mixamo, or Fuse in any way."
- Adobe's official helpx FAQ returned **HTTP 403** on 2026-10-11, so the current wording was not verified.
- Source: [Adobe community](https://community.adobe.com/questions-696/mixamo-faq-licensing-royalties-ownership-eula-and-tos-589400)

**Sketchfab and Fab**
- Epic's stated rule: "Both CC-BY and Standard-licensable models will be eligible for migration." Sketchfab said free and view-only models "will remain where they are". These are search excerpts; direct fetches of both Sketchfab blog pages returned empty content. — [Sketchfab blog: Fab Publishing Portal](https://sketchfab.com/blogs/community/fab-publishing-portal-open-for-sketchfab-migration); [Sketchfab blog: update after Fab launch](https://sketchfab.com/blogs/community/sketchfab-update-what-you-need-to-know-now-that-fabs-live/); [80.lv: historians' concerns](https://80.lv/articles/historians-are-concerned-about-epic-games-sketchfab-to-fab-migration/)

**OpenGameArt**
- CC0 submissions "are checked before approval". Artists state credit requirements in a "Copyright/Attribution Notice" section. If an asset is offered under several licenses, users may follow any one of them. — [OGA FAQ](https://opengameart.org/content/faq)

### Inferences
- **Commercially clean seed pool.** The usable sources are:
  - CC0: Quaternius UAL 1/2, Mesh2Motion (after an asset audit), Kenney, and CC0 items from OGA or Sketchfab whose provenance has been verified.
  - CC BY 4.0: 100STYLE.
  - Restricted: CMU.

  Only two of these are sizeable mocap corpora: 100STYLE (about 18.5 h, all locomotion) and CMU (2,605 sequences). Everything at the scale modern text-to-motion models use (AMASS-derived sets, MotionMillion with 2,000+ h, OpenT2M with 2,800+ h) is non-commercial or unlicensed.
- **The library needs per-clip licensing, not one license for the whole repo.**
  - CMU-derived clips cannot carry CC0 or MIT, because that would grant the resale CMU forbids. They should sit in a separate namespace with CMU's notice and acknowledgment text attached.
  - 100STYLE-derived clips must keep CC BY 4.0 attribution.
  - Quaternius, Mesh2Motion and Kenney clips can be CC0.
  - If the predecessor repo applied one blanket license to its CMU import, that misstates CMU's terms.
- **"Even in converted form" covers key-pose text conversions.** Converting to readable key poses does not escape CMU's resale clause or any no-redistribution clause (Truebones, Mixamo, RPM, MPI).
- **Re-check the existing imports.** Quaternius UAL2 was updated recently (v2.2, 28/9/2026), so the predecessor's import may be stale. The Mesh2Motion asset licenses should also be re-audited given the July 2026 CGWorld report.
- **Paid routes do not obviously solve redistribution.** Rokoko says licensees may not redistribute the data in its original form, and MPI/Meshcapade commercial licenses were not reviewed. Even a purchased license would need an explicit right to redistribute derived key-pose data publicly.

### Gaps
- The current official Mixamo FAQ wording (helpx returned 403) and current Truebones terms (Gumroad body not fetchable) were not verified directly.
- Rokoko's redistribution terms for its free libraries are not documented anywhere found.
- No statement was found on whether the RPM animation license changes after the January 2026 shutdown, or who now grants permissions.
- No explicit statement was found that Quaternius's paid Source editions are CC0, nor whether UAL2 has a Pro edition.
- KIT-ML has no license anywhere found. HumanML3D's MIT badge may or may not cover its text annotations. The motion data clearly cannot be redistributed.
- Several numbers were not found: Motion-X++ size, MotionMillion's released sequence count, an exact Mixamo clip count, and the Kenney Mini Characters animation count (an OpenGameArt listing reportedly says 32 per character; unverified).
- Whether CC0, CC-BY-SA and CC-BY-NC items remain downloadable on Sketchfab in October 2026 was not confirmed (direct fetches failed).
- Fab's EULA license types were not reviewed.
- HiPHI's terms are known only from a search excerpt.
- A 2008 cgspeed readme reportedly quoted an older CMU notice without the resale clause. That was not verified (no URL retrieved), so CMU's terms may have changed over time.

## 2. Can outputs of a model trained on non-commercially licensed data (AMASS, HumanML3D) be shipped commercially or redistributed?

### Takeaway
For AMASS, HumanML3D (which is AMASS data), BABEL and SMPL-based pipelines, the answer is effectively **no**. The Max Planck licenses expressly forbid training "for commercial use of any kind" and any "production of other artefacts for commercial purposes". These are contractual terms, so they apply whether or not the outputs are copyrightable. None of the licenses has an explicit clause about outputs.

For Creative Commons non-commercial datasets (LAFAN1, Bandai Namco, MotionMillion's CC BY-NC-SA) the position is legally murkier. CC terms apply only where copyright permission is needed, but CC's own guidance says NC must hold "from copying the data during training to sharing the trained model". A clean commercial library should therefore exclude outputs of such models.

### Cited Findings
**What the licenses say about training and outputs**
- AMASS forbids training "for commercial use of any kind". It also forbids commercial use including "incorporation in a commercial product, use in a commercial service, or production of other artefacts for commercial purposes". The license is "single-user, non-exclusive, non-transferable". — [AMASS license](https://amass.is.tue.mpg.de/license.html)
- AMASS has no clause on who owns results or outputs. The only mention of results is "The Licensee is encouraged to communicate any use, results, modification or publication." — [AMASS license](https://amass.is.tue.mpg.de/license.html)
- The SMPL body model license, which AMASS, HumanML3D and Motion-X pipelines depend on, includes these clauses:
  - "This license also prohibits the use of the Software to train methods/algorithms/neural networks/etc. for commercial use"
  - "shall not be copied, shared, distributed, re-sold, offered for re-sale, transferred or sub-licensed"
  - "The software/data is also available for commercial licensing through Meshcapade.com."
  - Source: [SMPL model license](https://smpl.is.tue.mpg.de/modellicense.html)
- Meshcapade sells commercial, R&D and evaluation licenses. Its R&D license reportedly excludes product development and redistribution. Prices conflict between Meshcapade pages (for example €1,500/yr versus €5,000 for a "Micro" commercial tier), so confirm with sales. — [Meshcapade datasets](https://meshcapade.com/assets/datasets); [Meshcapade: SMPL licenses](https://meshcapade.notion.site/The-SMPL-Model-Licenses-2144560e54388085af5eff111fcdf266) (via search summary)
- HumanML3D: "Due to the distribution policy of AMASS dataset, we are not allowed to distribute the data directly." Users rebuild the data from AMASS with scripts and must download SMPL+H/DMPL separately. — [HumanML3D](https://github.com/EricGuo5513/HumanML3D)
- MotionMillion is CC BY-NC-SA 4.0 under a "COMMUNITY LICENSE AGREEMENT" behind a Hugging Face gate. Data merged from other sources "must follow those datasets' respective licenses". — [MotionMillion on Hugging Face](https://huggingface.co/datasets/InternRobotics/MotionMillion)
- Mixamo: "The only research application Mixamo content can't be used in is training machine-learning models." — [Adobe community FAQ repost](https://community.adobe.com/questions-696/mixamo-faq-licensing-royalties-ownership-eula-and-tos-589400)

**Creative Commons' guidance on AI training** (no date on page)
- "CC licenses apply only when copyright permission is required." "If exceptions or limitations apply, then the CC license terms don't apply."
- NC: following it "would require that" "all stages, from copying the data during training to sharing the trained model, must not be for commercial gain."
- ND: "Following the NoDerivatives restriction would require that ND-licensed content not be used as training data."
- SA: "Following the ShareAlike condition would require AI developers to use the same CC license as the original works."
- Outputs: where RAG-like methods exist, "providing attribution to the CC-licensed work tied to the particular model output with a link to the source is ideal."
- Source: [Creative Commons](https://creativecommons.org/using-cc-licensed-works-for-ai-training-2/)

**US Copyright Office, Part 3 (Generative AI Training, pre-publication version, 9 May 2025)**
- On "data laundering": the Office's notice of inquiry asked how to assess commerciality "when curating datasets or training on those datasets may be done for noncommercial or research purposes, but the dataset or model is later adapted to commercial use". It reports that "Several commenters warned against considering such practices as noncommercial and described them as 'data laundering.'" It quotes the Copyright Alliance: "Data laundering entails private, commercial AI companies funding research or nonprofit institutions to develop training datasets…" — [USCO Part 3 PDF](https://www.copyright.gov/ai/Copyright-and-Artificial-Intelligence-Part-3-Generative-AI-Training-Report-Pre-Publication-Version.pdf)
- On weights: "When, however, a specific model can generate verbatim or substantially similar copies of a training example, without that expression being provided externally in the form of a prompt or other input, it must exist in some form in the model's weights." Also: "there is a strong argument that copying the model's weights implicates the right of reproduction for the memorized examples." — [USCO Part 3 PDF](https://www.copyright.gov/ai/Copyright-and-Artificial-Intelligence-Part-3-Generative-AI-Training-Report-Pre-Publication-Version.pdf)
- Conclusion: "When a model is deployed for purposes such as analysis or research … the outputs are unlikely to substitute for expressive works used in training. But making commercial use of vast troves of copyrighted works to produce expressive content that competes with them in existing markets, especially where this is accomplished through illegal access, goes beyond established fair use boundaries." — [USCO Part 3 PDF](https://www.copyright.gov/ai/Copyright-and-Artificial-Intelligence-Part-3-Generative-AI-Training-Report-Pre-Publication-Version.pdf)
- On open-weights licensing, the Office notes that model distribution "is subject to the enforceability of any licensing terms or terms of use". — [USCO Part 3 PDF](https://www.copyright.gov/ai/Copyright-and-Artificial-Intelligence-Part-3-Generative-AI-Training-Report-Pre-Publication-Version.pdf)

**Court rulings on training, 2025-2026**
- *Bartz v. Anthropic* (N.D. Cal., 23 June 2025): training was "exceedingly" transformative and fair use. Liability over pirated copies remained, leading to a $1.5B settlement in September 2025 (about $3,000 for each of 482,460 books). — [Copyright Alliance 2025 review](https://copyrightalliance.org/ai-copyright-lawsuit-developments-2025/)
- *Kadrey v. Meta* (N.D. Cal., 25 June 2025): training was "highly transformative" and fair use, but the court called the decision narrow. A BitTorrent seeding claim continues. — [Copyright Alliance](https://copyrightalliance.org/ai-copyright-lawsuit-developments-2025/)
- *Thomson Reuters v. Ross* (D. Del., early 2025): fair use rejected for commercial, non-transformative use that harmed the "market for AI training data". Interlocutory appeal to the Third Circuit was granted in April 2025. — [Copyright Alliance](https://copyrightalliance.org/ai-copyright-lawsuit-developments-2025/)
- *GEMA v. OpenAI* (Munich Regional Court, 11 November 2025): OpenAI was held liable for infringement in **both training and output**, based on memorization. An appeal is pending. — [IBA](https://www.ibanet.org/Artificial-intelligence-courts-weigh-in-on-clash-with-creatives-over-copyright); [Taylor Wessing tracker](https://www.taylorwessing.com/en/campaigns/de/2025/ai-and-copyright-tracker) (via search summary)
- *Getty v. Stability AI* (UK High Court, 4 November 2025): copyright claims over training and output were dismissed. — [IBA](https://www.ibanet.org/Artificial-intelligence-courts-weigh-in-on-clash-with-creatives-over-copyright) (via search summary)

**How much copyright everyday motion carries**
- The Copyright Office Compendium (Third Edition, chapter 800, revision of 01/28/2021):
  - "Non-expressive physical movements, such as 'ordinary motor activities' or 'functional physical movements' — in and of themselves — do not represent the type of authorship that Congress intended to protect as choreography."
  - "Examples of non-expressive physical movements that cannot be registered with the Office include exercise routines, aerobic dances, yoga positions, and the like."
  - Athletic activities and competitive maneuvers (for example football plays, slam dunks) are not registrable.
  - Source: [Compendium ch. 800](https://www.copyright.gov/comp3/chap800/ch800-performing-arts.pdf)
- By contrast, choreography can be protected. In *Hanagami v. Epic Games* (9th Cir., November 2023) the court held that choreography goes beyond "poses", looking at body position, transitions and timing. The case settled on 12 February 2024 and was dismissed with prejudice. — [Lewis Silkin](https://www.lewissilkin.com/insights/2024/01/22/the-battle-continues-for-epic-games-and-hanagami-developers-beware-a-new-copyrig-102ixp7); [Justia](https://news.justia.com/choreographer-settles-copyright-lawsuit-concerning-fortnite-dance-emote)

### Inferences
- **AMASS and HumanML3D: no.** Training a generator on AMASS-derived data and then shipping or redistributing its clips commercially is exactly "production of other artefacts for commercial purposes" and training "for commercial use of any kind". The licensee who does this breaches a click-through contract, whether or not the clips are copyrightable and whether or not the training would be fair use in copyright terms.
  - A downstream user who never agreed to the license is not bound by it directly. But the provenance is tainted, and weights that memorize AMASS clips could themselves be reproductions, following the USCO's reasoning.
  - Whether such contract terms can be enforced, or are preempted, against downstream users of outputs is legally unsettled. No case on point was found.
- **The thin copyright in locomotion cuts both ways.** Walking, running and functional moves are "ordinary motor activities", so copyright in many mocap clips is thin. That makes the dataset licensors' leverage largely **contractual**. Danger is highest for:
  - dance and choreography data (AIST++, FineDance and the dance parts of LAFAN1/BEAT/MotionMillion);
  - verbatim memorization of any clip.
- **CC-NC datasets.** CC concedes that its terms do not apply where an exception applies (US fair use per *Bartz*/*Kadrey*). But:
  - (a) Germany's *GEMA* ruling shows jurisdictions diverge;
  - (b) MotionMillion adds a gated "community license agreement", which is a contract layer;
  - (c) ND content should not be used as training data at all, per CC.

  A library whose value is "legally clean, redistributable data" should not rely on the fair-use argument.
- **Recommended contribution rule.** A generated clip should be accepted only if the generator's training data is documented and every training source permits commercial use and redistribution of outputs. In practice that means CC0, CC BY, licensed data, or the library's own CC0 clips. The rule should be backed by a declared training-data manifest and a similarity check against known non-commercial clips where lawful. HumanML3D-trained models such as MDM and T2M-GPT variants, and MotionMillion- or OpenT2M-trained models, would be excluded under this rule.

### Gaps
- No case law was found on whether research-only dataset terms bind people who receive a model's outputs.
- No motion-specific memorization study was found showing whether text-to-motion models reproduce AMASS clips verbatim.
- AMASS commercial license terms and prices are not public (contact ps-license@tue.mpg.de).
- The EU text-and-data-mining exceptions (CDSM Directive Art. 3/4) and how they interact with NC licenses and click-through contracts were not researched here (search budget exhausted).
- The license of HumanML3D's text descriptions, as separate from the motion, is unclear.

## 3. What is the copyright and labeling status of AI-generated motion (US-centric, with EU notes)?

### Takeaway
In the US, purely AI-generated motion is not copyrightable, so in practice it is public domain there:
- USCO Part 2 (final, 29 January 2025) and *Thaler v. Perlmutter* (D.C. Cir., 18 March 2025; cert denied 2 March 2026) both say so.
- Prompting, re-rolling and approving outputs do not create authorship.
- Human-authored inputs that survive into the output, creative human edits, and creative selection or arrangement are protectable. Agent edits are not.

The EU AI Act's Article 50 marking duty applies from 2 August 2026, with a grace period to 2 December 2026 for systems already on the market. It names "audio, image, video or text". Skeletal motion data is not named, so it is uncertain whether it is covered. Labeling each clip's digital source type is still the prudent design, because Steam and Fab disclosure rules and copyright status both depend on it.

### Cited Findings
**US Copyright Office, Part 2: Copyrightability** (final, released 29 January 2025)
- Key conclusions, verbatim:
  - "Questions of copyrightability and AI can be resolved pursuant to existing law, without the need for legislative change."
  - "The use of AI tools to assist rather than stand in for human creativity does not affect the availability of copyright protection for the output."
  - "Copyright protects the original expression in a work created by a human author, even if the work also includes AI-generated material."
  - "Copyright does not extend to purely AI-generated material, or material where there is insufficient human control over the expressive elements."
  - "Whether human contributions to AI-generated outputs are sufficient to constitute authorship must be analyzed on a case-by-case basis."
  - "Based on the functioning of current generally available technology, prompts do not alone provide sufficient control."
  - "Human authors are entitled to copyright in their works of authorship that are perceptible in AI-generated outputs, as well as the creative selection, coordination, or arrangement of material in the outputs, or creative modifications of the outputs."
  - "The case has not been made for additional copyright or sui generis protection for AI-generated content."
  - Source: [USCO Part 2 PDF](https://www.copyright.gov/ai/Copyright-and-Artificial-Intelligence-Part-2-Copyrightability-Report.pdf)
- On re-rolling: "Repeatedly revising prompts does not change this analysis … By revising and submitting prompts multiple times, the user is 're-rolling' the dice … No matter how many times a prompt is revised and resubmitted, the final output reflects the user's acceptance of the AI system's interpretation, rather than authorship of the expression it contains." — [USCO Part 2](https://www.copyright.gov/ai/Copyright-and-Artificial-Intelligence-Part-2-Copyrightability-Report.pdf)
- On expressive inputs: "where human-authored inputs are reflected in the output, they contribute more than just an intellectual conception." — [USCO Part 2](https://www.copyright.gov/ai/Copyright-and-Artificial-Intelligence-Part-2-Copyrightability-Report.pdf)
- On modifications: "the copyright would extend to the material the human author contributed but would not extend to the underlying AI-generated content itself." Creative selection and arrangement "would provide protection for the output as a whole (although not the AI-generated material alone)". — [USCO Part 2](https://www.copyright.gov/ai/Copyright-and-Artificial-Intelligence-Part-2-Copyrightability-Report.pdf)
- Conclusion: "Prompts alone, however, at this stage are unlikely to satisfy those requirements." — [USCO Part 2](https://www.copyright.gov/ai/Copyright-and-Artificial-Intelligence-Part-2-Copyrightability-Report.pdf)

**Status of the USCO series** (as listed on copyright.gov, 2026-10-11)
- Part 1 (Digital Replicas): 31 July 2024, final.
- Part 2: 29 January 2025, final.
- Part 3 (Training): pre-publication version of 9 May 2025, to be "finalized later" with "no substantive changes".
- The AI registration guidance is still the policy statement of 16 March 2023. No new notice of inquiry is listed. — [copyright.gov/ai](https://www.copyright.gov/ai/)
- Part 3 refers to a future "Part 4" on infringing outputs. No Part 4 is listed. — [USCO Part 3](https://www.copyright.gov/ai/Copyright-and-Artificial-Intelligence-Part-3-Generative-AI-Training-Report-Pre-Publication-Version.pdf); [copyright.gov/ai](https://www.copyright.gov/ai/)

**Thaler v. Perlmutter**
- D.C. Circuit (No. 23-5233, argued 19 September 2024, decided 18 March 2025): "The Creativity Machine cannot be the recognized author of a copyrighted work because the Copyright Act of 1976 requires all eligible work to be authored in the first instance by a human being." — [D.C. Cir. opinion](https://media.cadc.uscourts.gov/opinions/docs/2025/03/23-5233.pdf)
- The court also said: "the human authorship requirement does not prohibit copyrighting work that was made by or with the assistance of artificial intelligence. The rule requires only that the author of that work be a human being—the person who created, operated, or used artificial intelligence—and not the machine itself." — [D.C. Cir. opinion](https://media.cadc.uscourts.gov/opinions/docs/2025/03/23-5233.pdf)
- Supreme Court (No. 25-449): petition filed 9 October 2025, **cert denied 2 March 2026**. — [SCOTUSblog](https://www.scotusblog.com/cases/case-files/thaler-v-perlmutter)

**Motion and performance specifics**
- Choreography versus ordinary movement: see the Compendium ch. 800 and *Hanagami* findings in section 2. — [Compendium ch. 800](https://www.copyright.gov/comp3/chap800/ch800-performing-arts.pdf)
- 2025 SAG-AFTRA Interactive Media Agreement:
  - Ratified with 95.04% approval; the voting deadline was 9 July 2025.
  - Companies must inform performers of "all the ways in which AI is planned to be used on their voice, likeness and movements" and get written consent.
  - Replicas must be "objectively identifiable" as the performer.
  - Sources: [Decrypt](https://decrypt.co/329479/video-game-performers-ai-consent-rules); [GraphicPolicy, 2025-07-10](https://graphicpolicy.com/2025/07/10/sag-aftra-members-approve-the-2025-video-game-agreement/); [FKKS](https://technologylaw.fkks.com/post/102mewu/inside-the-new-sag-aftra-interactive-media-agreement-new-standards-for-ai-and-di)

**Labeling norms in game distribution**
- Steam narrowed its AI disclosure rules on about 16-17 January 2026. AI-made assets that ship in the game must be disclosed. Back-end tools (code assistants, concept art not shipped, efficiency tools) are exempt. This comes from secondary coverage. — [tbreak](https://tbreak.com/steam-ai-disclosure-policy-update-developers/); [Outlook Respawn](https://respawn.outlookindia.com/amp/story/gaming/gaming-news/valve-clarifies-steam-ai-policy-focus-shifts-to-content-consumed)
- Fab's EULA requires sellers to tag content "CreatedWithAI" when "a material portion" comes from generative AI. Edit-only features such as AI upscaling are excluded. This comes from an Epic forum reply seen as a search excerpt. — [Unreal Engine forum](https://forums.unrealengine.com/t/ai-image-use/2567909)

**EU AI Act Article 50**
- Paragraph 2: "Providers of AI systems, including general-purpose AI systems, generating synthetic audio, image, video or text content, shall ensure that the outputs of the AI system are marked in a machine-readable format and detectable as artificially generated or manipulated." It does not apply to assistive standard editing or to systems that do not substantially alter input data. — [AI Act Art. 50](https://artificialintelligenceact.eu/article/50/)
- Paragraph 4 covers deployers that "generate[] or manipulate[] image, audio or video content constituting a deep fake". It narrows the duty "Where the content forms part of an evidently artistic, creative, satirical, fictional or analogous work or programme". In that case the deployer need only disclose the AI content's existence, in a way that does not hamper enjoyment of the work. — [AI Act Art. 50](https://artificialintelligenceact.eu/article/50/)
- Paragraph 5: information must be given "at the latest at the time of the first interaction or exposure". The article applies from **2 August 2026**. — [AI Act Art. 50](https://artificialintelligenceact.eu/article/50/)

**AI Digital Omnibus**
- Adopted by the Council on 29 June 2026, published in the Official Journal on **24 July 2026**, in force **27 July 2026**. — [Garrigues](https://www.garrigues.com/en_GB/garrigues-digital/ai-digital-omnibus-regulation-has-been-published-redefining-deadlines-and); [iubenda](https://www.iubenda.com/en/blog/ai-omnibus-adopted-august-2-obligations-july-2026/)
- For generative systems placed on the market before 2 August 2026, "a transitional period is introduced until December 2, 2026". Systems placed on the market after that date must comply immediately. — [Garrigues](https://www.garrigues.com/en_GB/garrigues-digital/ai-digital-omnibus-regulation-has-been-published-redefining-deadlines-and)
- Secondary sources say the Commission originally proposed a 6-month grace period and that it was cut. — [Winston Taylor](https://www.winstontaylor.com/insights/ai-act-rules-on-high-risk-ai-delayed-as-ai-digital-omnibus-agreed) (via search summary)

**Code of Practice on marking and labelling AI-generated content**
- Timeline: first draft 17 December 2025, second draft 3 March 2026, draft Article 50 guidelines 8 May 2026, **final code 10 June 2026**. "About 190" organisations had signed by the end of July 2026. — [European Commission](https://digital-strategy.ec.europa.eu/en/policies/code-practice-ai-generated-content)
- The code is voluntary. Jones Day notes that "no single marking technique can fully meet" the Act's requirements. It summarizes the code as requiring multi-layered marking, with at least two machine-readable layers where necessary (for example metadata plus watermarks), plus detection mechanisms and an EU icon for labels. It addresses only audio, image, video and text. — [Jones Day, June 2026](https://www.jonesday.com/en/insights/2026/06/european-commission-publishes-final-code-of-practice-on-marking-and-labelling-aigenerated-content)
- Final Article 50 guidelines were reportedly published on 20 July 2026. This comes from secondary sources and was not verified against the Commission page, which lists only the 8 May draft. — [Paul Weiss](https://www.paulweiss.com/insights/client-memos/eu-finalises-transparency-rules-for-ai-generated-content) (via search summary)

### Inferences
- **Is purely AI-generated motion public domain?** In the US, effectively yes: no one can own or license it. Three caveats apply:
  - (1) "Public domain" does not clear third-party rights. A clip can still infringe if it reproduces memorized choreography (the *Hanagami* and USCO memorization reasoning), or if it is an identifiable performer replica in a context governed by performer contracts.
  - (2) Other jurisdictions were not checked. The UK, for example, has a computer-generated-works provision (unverified here).
  - (3) The curated library as a whole could hold a thin compilation copyright if humans select and arrange it creatively.

  Requiring every contributor, human or agent operator, to dedicate contributions to CC0 makes the copyright status mostly irrelevant downstream. It covers any human-authored portion and any non-US protection.
- **Does a human in the loop change the status?** Only if the human determines expressive elements. Examples:
  - hand-authored key poses that are retained in the output (an "expressive input");
  - creative edits to poses, timing or curves (protected only to the extent of the edit);
  - creative selection and arrangement of a collection.

  A human approving or merging an agent's clip is the "acceptance" USCO describes, not authorship. An agent's edits are not human authorship. Commit-level history of a text key-pose format would record which poses a human typed, which is useful evidence.
- **Should contributions be labeled? Yes, per clip.** Article 50(2) lists audio, image, video and text, so whether raw skeletal animation counts is uncertain. The obligation also falls on providers of generative systems, not on archives. But:
  - (a) Games that ship pre-generated AI content must disclose it on Steam, and Fab requires "CreatedWithAI" tags. Downstream developers therefore need per-clip AI status.
  - (b) Copyright status depends on it.
  - (c) If the package itself includes an agent-driven generator that renders video or images, its maintainers could be Article 50(2) "providers". Embedded machine-readable metadata is the cheap hedge.
  - (d) Fictional game characters fall under the paragraph 4 "evidently artistic … fictional" carve-out for deep fakes.

### Gaps
- The status of *Allen v. Perlmutter* (D. Colo.) in 2026 was not found.
- Non-US copyrightability of AI outputs (UK, China, EU member states) was not researched.
- Whether skeletal or animation data counts as "image" or "video" under Article 50, and what the final Article 50 guidelines say about 3D or animation, is unverified.
- The current wording of Valve's own Steamworks AI disclosure documentation was not read; only secondary coverage was.

## 4. How do successful registries and asset ecosystems curate quality, prevent spam and malware, record licenses, handle deprecation, and take contributions?

### Takeaway
Open game-asset libraries with consistently high quality are either single-author CC0 catalogs (Kenney, Quaternius, ambientCG) or small-team catalogs with vetted, contract-backed submissions (Poly Haven, which requires proof of authorship and bans generative AI "at any stage").

Open upload portals have repeatedly been flooded by AI spam or malware: Fab in May 2025, ClawHub in 2026, and Civitai under payment-processor pressure.

Package registries offer the most transferable mechanics:
- immutable versions;
- deprecating or yanking instead of deleting;
- tight unpublish windows;
- OIDC trusted publishing;
- Sigstore provenance;
- namespace verification (the MCP Registry).

### Cited Findings

#### Comparison table
| Registry | Contributions | Quality and spam/malware controls | License and attribution metadata | Deprecation and removal | Integrity and content addressing |
|---|---|---|---|---|---|
| **Poly Haven** | Submission form. If approved, the contributor signs a legal agreement and provides proof of authorship. Unpaid; donors are considered first when hiring ([contribute](https://polyhaven.com/contribute)) | "Quality over quantity", with detailed technical standards per asset type. Work must be "100% your own original work". Generative AI is "strictly" not allowed at any stage. No logos or trademarks ([contribute](https://polyhaven.com/contribute)) | CC0 only and irrevocable: "Our assets are all licensed as CC0." Credit is "appreciated" ([license](https://polyhaven.com/license)). The API asks for attribution such as "Powered by Poly Haven" for live-API use only, and requires a unique Referer or User-Agent ([API ToS](https://raw.githubusercontent.com/Poly-Haven/Public-API/master/ToS.md)) | CC0 cannot be revoked ([contribute](https://polyhaven.com/contribute)) | API metadata includes `authors` (for example `{"Sergej Majboroda":"All"}`), `date_published`, `files_hash`, and a per-file `md5` ([info example](https://api.polyhaven.com/info/abandoned_bakery); [files example](https://api.polyhaven.com/files/abandoned_bakery); [swagger](https://api.polyhaven.com/api-docs/swagger.json)) |
| **ambientCG** | Single creator; the license page is written in the first person ([license](https://docs.ambientcg.com/license/)) | Authorship is the quality control | "CC0 1.0 Universal"; "You don't need to give credit". Users may "include the raw files in your project, for example a video game" ([license](https://docs.ambientcg.com/license/)) | Not stated | Not stated |
| **Kenney** | Single studio | Authorship is the quality control | CC0; "Attribution is not required"; the logo is reserved ([support](https://kenney.nl/support)) | Not stated | Not stated |
| **Quaternius** | Single creator. Free Standard edition plus paid Pro and Source editions via itch.io and Patreon ([UAL1](https://quaternius.com/packs/universalanimationlibrary.html); [UAL2 itch](https://quaternius.itch.io/universal-animation-library-2)) | Authorship is the quality control | CC0 | Versioned changelog on itch.io (v2.0 → v2.2) ([UAL2 itch](https://quaternius.itch.io/universal-animation-library-2)) | Not stated |
| **OpenGameArt** | Open upload portal ([FAQ](https://opengameart.org/content/faq)) | CC0 submissions "checked before approval". Plagiarism leads to removal or suspension. Takedowns go through a Removal Request form. AI submissions are informally restricted: staff tentatively accepted 2 of about 60 in April 2024, and a 2025 jam post says they were on hold ([forum](https://opengameart.org/forumtopic/ai-generated-art-discussion); [jam post](https://itch.io/jam/opengameartorg-spring-game-jam-2025/topic/4762321/a-clarification-on-the-use-of-ai-generated-art)) | Fixed menu (CC0, CC-BY, CC-BY-SA, OGA-BY, GPL). A "Copyright/Attribution Notice" field. Multiple licenses allowed ([FAQ](https://opengameart.org/content/faq)) | Licenses already obtained stay valid after an artist changes license options ([FAQ](https://opengameart.org/content/faq)) | Not stated |
| **Sketchfab → Fab** | Open seller portal | In May 2025 one seller uploaded more than 38,000 AI assets (rising to 41,000). Epic removed the seller and added a publish-time generative-AI declaration, automated detection, a report form for unlabeled assets, and was exploring daily upload limits. The "hide Created With AI" filter is off by default ([80.lv, 2025-05-23](https://80.lv/articles/epic-games-adresses-ai-generated-content-plaguing-fab)) | Fixed menu: Standard and CC BY on Fab. CC0, SA, NC and ND did not migrate (see section 1). EULA "CreatedWithAI" tag ([UE forum](https://forums.unrealengine.com/t/ai-image-use/2567909)) | Free Sketchfab models "remain" viewable (see section 1) | Not stated |
| **Hugging Face Hub** | Git repositories. Anyone can push to their own namespace | "every file of your repositories that is smaller than 2 GB" is scanned with ClamAV, "triggered at each commit" ([malware scanning](https://huggingface.co/docs/hub/security-malware)). Gating offers automatic or manual approval, custom fields, rejection, reset, and `extra_gated_eu_disallowed` ([gated datasets](https://huggingface.co/docs/hub/datasets-gated)) | Dataset-card YAML: `license` (or `other` plus `license_name`/`license_link`), `source_datasets`, `annotations_creators` (including `machine-generated`) ([datasetcard.md](https://raw.githubusercontent.com/huggingface/hub-docs/main/datasetcard.md); [dataset cards](https://huggingface.co/docs/hub/datasets-cards)) | Authors can revoke access at any time ([gated datasets](https://huggingface.co/docs/hub/datasets-gated)) | **Xet** content-addressed store: content-defined ~64 KB chunks grouped into 64 MB blocks, each "stored once in a content-addressed store (CAS), keyed by its hash" ([Xet deduplication](https://huggingface.co/docs/hub/xet/deduplication)) |
| **npm** | Self-publish | After the Shai-Hulud worm (notified 14 September 2025), GitHub removed 500+ compromised packages. Its 22 September 2025 plan: 2FA for local publishing, 7-day granular tokens, trusted publishing, deprecating classic tokens and TOTP, and disallowing tokens by default ([GitHub blog](https://github.blog/security/supply-chain-security/our-plan-for-a-more-secure-npm-supply-chain/)). Staged publishing was reported implemented by May 2026 ([The Register](https://www.theregister.com/ai-ml/2026/05/21/npm-registry-sets-stage-for-more-secure-package-publishing/5244527)) | `package.json` license field (not researched here). Provenance attestations via Sigstore with a public transparency log, but provenance "does not guarantee the package has no malicious code" ([npm provenance](https://docs.npmjs.com/generating-provenance-statements)) | Unpublish is allowed within 72 h if nothing depends on the package. After that, only with no dependents, under 300 downloads in the last week, and a single owner. A used `package@version` can "never" be reused. Otherwise deprecate (`npm deprecate`) ([unpublish policy](https://docs.npmjs.com/policies/unpublish)) | Immutable versions. Sigstore-signed provenance ([npm provenance](https://docs.npmjs.com/generating-provenance-statements)) |
| **crates.io** | Self-publish. Trusted Publishing for GitHub Actions (July 2025) and GitLab.com (by January 2026). An owner-set "Trusted Publishing Only" mode. The `pull_request_target` and `workflow_run` triggers are blocked ([crates.io Jan 2026 update](https://blog.rust-lang.org/2026/01/21/crates-io-development-update)) | A "Report Crate" button sent to the team for review. Tokens expire after 90 days by default. Publish notifications ([crates.io Feb 2025 update](https://blog.rust-lang.org/2025/02/05/crates-io-development-update/)). A RustSec "Security" tab ([Jan 2026 update](https://blog.rust-lang.org/2026/01/21/crates-io-development-update)) | Cargo manifest license field (not researched here) | "A yank **does not** delete any code"; crates.io aims to "act as a permanent archive" ([Cargo docs](https://doc.rust-lang.org/cargo/reference/publishing.html)). Deletion is allowed under 72 h, or with a single owner, under 500 downloads per month, and no dependents ([Feb 2025 update](https://blog.rust-lang.org/2025/02/05/crates-io-development-update/)) | "The version can never be overwritten" ([Cargo docs](https://doc.rust-lang.org/cargo/reference/publishing.html)). A `pubtime` field in the index ([Jan 2026 update](https://blog.rust-lang.org/2026/01/21/crates-io-development-update)) |
| **Official MCP Registry** | Preview launched 8 September 2025 ([MCP blog](https://blog.modelcontextprotocol.io/posts/2025-09-08-mcp-registry-preview/)). Stores metadata only (`server.json`) pointing to npm, PyPI, Docker or remote URLs ([about](https://modelcontextprotocol.io/registry/about)) | Namespace authentication with reverse-DNS names verified via GitHub, DNS or HTTP challenges, plus field limits and manual takedown. "AI-based spam detection" is under consideration. Security scanning is delegated to package registries and aggregators ([about](https://modelcontextprotocol.io/registry/about)) | Not covered in sources read | "quite permissive". It removes illegal content, malware, spam (including "mass-created servers") and non-functioning servers. It does not remove low-quality or vulnerable servers. Removal sets `status` to `"deleted"` while the metadata stays visible ([moderation policy](https://modelcontextprotocol.io/registry/moderation-policy)) | Not stated. A REST API was frozen at v0.1 on 24 October 2025 per a secondary source ([search summary of registry README mirror](https://github.com/vincigit00/registry)) |
| **Smithery** | Either a URL server that Smithery proxies, or an `.mcpb` bundle published via API or CLI ([publish docs](https://smithery.ai/docs/build/publish)) | Scans servers to extract tools, prompts and resources, with a static server-card fallback. Offers an official-vendor verification checklist. No manual review is described ([publish docs](https://smithery.ai/docs/build/publish)) | Not stated | Not stated | Not stated |
| **Civitai** | Open upload portal | Policy changes under payment-processor pressure. Ban on models of real people's likeness, announced about 23 May 2025 ([404 Media, 2025-05-27](https://404media.co/civitai-ban-of-real-people-content-deals-major-blow-to-the-nonconsensual-ai-porn-ecosystem)). Lost card processing and moved to crypto ([Decrypt](https://decrypt.co/322197/civitai-crypto-credit-card-processor-ban-ai-explicit-content)). Blocked UK users from 24 July 2025 citing the Online Safety Act ([Civitai notice repost](https://discuss.privacyguides.net/t/civitai-a-popular-platform-for-hosting-ai-generated-images-and-a-model-repository-restricted-for-uk-visitors-due-to-osa/29464)) | Not researched | Not researched | Not researched |

#### Additional details
- The Poly Haven API is "Free to use for any purpose, personal or commercial, forever". "The assets themselves are CC0 and never require attribution." The API code is AGPL-licensed. — [Public-API README](https://github.com/Poly-Haven/Public-API); [swagger](https://api.polyhaven.com/api-docs/swagger.json)
- Poly Haven's website terms prohibit "Web scraping or data mining without express permission". — [Poly Haven license page](https://polyhaven.com/license)
- MCP Registry disclaimer: "consumers should assume minimal-to-no moderation." It names the GitHub MCP Registry as a downstream sub-registry that does deeper moderation. — [MCP moderation policy](https://modelcontextprotocol.io/registry/moderation-policy)
- MCP Registry maintainers can "denylist these entries and retroactively remove them from public access". The registry is "maintained by the registry working group". — [MCP blog](https://blog.modelcontextprotocol.io/posts/2025-09-08-mcp-registry-preview/)

### Inferences
- **Recommended model: Poly Haven quality bar plus package-registry mechanics.** A curated core library would take pull requests into a Git repo, which is itself content-addressed and immutable by commit. Each pull request would pass:
  - (a) machine validators: schema, joint limits, foot-skate and ground-penetration metrics, retargeting to reference rigs;
  - (b) license and provenance checks against an allow-list (CC0 default; CC BY with an attribution file; CMU segregated);
  - (c) human maintainer review before merge, mirroring Wikipedia's "human review" line in section 6.
- **Mechanics worth copying:**
  - Contributors and agents publish only through identity-bound, short-lived credentials (trusted publishing or OIDC) with a responsible human or organization.
  - Releases are immutable semver versions, and clips are deprecated or yanked rather than deleted.
  - Each clip has a content hash ID (as in Poly Haven's `md5`/`files_hash` and Hugging Face's CAS).
- **Two tiers.** A permissive, metadata-only index in the style of the MCP Registry could federate third-party or community clip packs under verified namespaces. The curated core would stay small and high-trust. This separates "anything goes" growth from "safe to ship in a game" content.
- **What does not work.** Pure upload portals without rate limits, identity or automated validation (Fab, ClawHub) were overwhelmed. Moderation driven by external pressure (Civitai's payment processors and the UK Online Safety Act) shows that policy must be set before growth, not after.

### Gaps
- License-field conventions for npm and Cargo manifests were not researched (search budget exhausted).
- Smithery's security incidents and review depth were not verified.
- Civitai's model scanning (pickle or safetensors) and its current UK status in October 2026 were not verified.
- Whether the MCP Registry moved to Linux Foundation or Agentic AI Foundation governance (one secondary claim says December 2025) is unverified.
- Sketchfab's current download status is unverified.

## 5. Which provenance and license-metadata standards can record licenses and the lineage of derived, edited or AI-generated clips?

### Takeaway
There is no motion- or 3D-specific provenance standard in practical use. C2PA's reference library supports no glTF, USD or 3D formats, only experimental text formats, and the EU code covers only audio, image, video and text. A workable stack combines:
- SPDX license identifiers applied per file via REUSE 3.3 (`REUSE.toml` and `.license` sidecars);
- the IPTC digital source type vocabulary for AI status;
- Hugging Face-style dataset cards and Croissant RAI at the dataset level;
- content hashes for parent/child lineage;
- Sigstore-style signed attestations (as in npm provenance) for who or what produced each clip.

### Cited Findings
**C2PA**
- C2PA implementation guidance (2.2 and 2.3) says a generated asset's active manifest should carry a `c2pa.created` action whose `digitalSourceType` is the IPTC `trainedAlgorithmicMedia` term. — [C2PA guidance 2.2](https://c2pa.org/specifications/specifications/2.2/guidance/Guidance.html); [2.3](https://spec.c2pa.org/specifications/specifications/2.3/guidance/Guidance.html) (via search excerpt)
- Formats supported by the reference library c2pa-rs: avi, avif, c2pa, dng, flac, gif, heic, heif, jpg/jpeg, jxl, m4a, mp3, mp4, mov, pdf, png, svg, tif/tiff, txt (behind the non-default `unstable_plain_text` feature) and wav, webp. An experimental `unstable_structured_text` feature adds atom, css, ini, js/mjs, md, py, rss, sql, tex, toml, vtt and yaml/yml.
  - **No glTF/GLB, USD or OBJ** is listed. JSON is not listed either.
  - A standalone manifest-store type exists (`c2pa`, MIME `application/x-c2pa-manifest-store`).
  - Source: [c2pa-rs supported formats](https://github.com/contentauth/c2pa-rs/blob/main/docs/supported-formats.md)

**IPTC Digital Source Type vocabulary**
- Relevant codes include:
  - `trainedAlgorithmicMedia` ("Created using Generative AI")
  - `compositeWithTrainedAlgorithmicMedia` ("Edited using Generative AI")
  - `compositeSynthetic` (composite including generative AI elements)
  - `algorithmicMedia` ("Pure algorithmic media", made without sampled training data)
  - `humanEdits` (human-edited using non-generative tools)
  - `digitalCreation` (human-made with non-generative tools)
  - `digitalCapture`
  - `dataDrivenMedia`
  - `composite`
- The latest concept change is dated 2024-10-23.
- Source: [IPTC vocabulary](https://cv.iptc.org/newscodes/digitalsourcetype/)

**SPDX and REUSE**
- REUSE 3.3 (2024-11-14):
  - "A Project MUST include a License File for every license under which Covered Files are licensed" (in `LICENSES/`).
  - "The `SPDX-License-Identifier` tag MUST be followed by a valid SPDX License Expression."
  - `SPDX-FileCopyrightText` is recommended.
  - For uncommentable files, the header "MUST be in an adjacent text file of the same name with the additional extension `.license`".
  - `REUSE.toml` `[[annotations]]` map path globs to license and copyright, with `precedence` set to `closest`, `aggregate` or `override`.
  - Non-SPDX licenses use `LicenseRef-` identifiers.
  - Source: [REUSE 3.3](https://reuse.software/spec-3.3/)
- The SPDX 3.0.1 `DatasetPackage` class has these properties: `datasetType` (required), `dataCollectionProcess`, `dataPreprocessing`, `intendedUse`, `knownBias`, `hasSensitivePersonalInformation`, `datasetNoise`, `datasetUpdateMechanism`, `anonymizationMethodUsed`, `confidentialityLevel`, `datasetAvailability`, `datasetSize`, `sensor`. — [SPDX 3.0.1 DatasetPackage](https://spdx.github.io/spdx-spec/v3.0.1/model/Dataset/Classes/DatasetPackage/)

**Dataset documentation**
- Croissant RAI 1.0 (2024-03-06):
  - Properties include `rai:dataCollection`, `rai:dataCollectionType`, `rai:dataCollectionRawData`, `rai:dataPreprocessingProtocol`, `rai:dataManipulationProtocol`, `rai:dataAnnotationProtocol`, `rai:dataAnnotationPlatform` and `rai:dataReleaseMaintenancePlan`.
  - There is no RAI-specific license property (schema.org `license` is used) and no synthetic-data flag.
  - "Traceability" is a use case with no mapped properties yet.
  - Source: [Croissant RAI spec](https://docs.mlcommons.org/croissant/docs/croissant-rai-spec.html)
- Hugging Face dataset card fields: `license`; `license_name` and `license_link` (when `license: other`); `source_datasets` (for example `laion/laion-2b`); `annotations_creators` (`crowdsourced`, `found`, `expert-generated`, `machine-generated`); gating fields. — [datasetcard.md](https://raw.githubusercontent.com/huggingface/hub-docs/main/datasetcard.md)

**Signed provenance and personal data**
- npm provenance links a package "to its source code and build instructions". It is signed "by Sigstore public good servers and logged in a public transparency ledger". It requires a cloud-hosted GitHub Actions or GitLab CI/CD runner. — [npm provenance](https://docs.npmjs.com/generating-provenance-statements)
- Rokoko says its motion data is handled under GDPR and that identifying elements, including "unique measurements", are removed. This signals that motion capture can be personal or biometric data. — [Rokoko motion dataset](https://www.rokoko.com/mocap/motion-dataset)

### Inferences
- **Per-clip metadata as a design proposal.** Each clip would be a text key-pose file plus either an inline header or a sidecar `.license`/YAML file, mapped to standards where possible:
  - `SPDX-License-Identifier`: for example `CC0-1.0`, `CC-BY-4.0`, or `LicenseRef-CMU-Mocap`.
  - `SPDX-FileCopyrightText`, or an explicit CC0 waiver note.
  - `digitalSourceType` from the IPTC vocabulary: `digitalCapture` for mocap, `digitalCreation` for hand-keyed clips, `trainedAlgorithmicMedia` for model output, `compositeWithTrainedAlgorithmicMedia` for AI-edited capture, `humanEdits`.
  - `source`: dataset, version, original file and sha256.
  - `generator`: model name, version, weights hash, and a training-data license manifest.
  - `edits`: who or what changed which poses, recording human versus agent.
  - `parents`: content hashes of the clips it was derived from.
  - `contributor`: agent identity plus the accountable human or organization.
  - `attestation`: a Sigstore bundle or signed commit.

  This is a W3C-PROV-like graph serialized in plain text. W3C PROV itself was not researched.
- **Dataset level.** One HF-style card plus a Croissant RAI JSON-LD file, with `annotations_creators: machine-generated` where captions or clips come from models. An SPDX 3.0 export lets game studios ingest the library into their SBOMs.
- **C2PA.** Use it only for rendered previews (mp4/png) or as detached `.c2pa` manifest stores until 3D or text support matures. The experimental yaml/toml embedding in c2pa-rs could carry manifests inside text key-pose files, but it is unstable and behind feature flags.
- **Lint licensing in CI.** Run REUSE lint, or an equivalent check, so every committed clip has a license, and fail any contribution whose lineage includes a source that is not on the allow-list.

### Gaps
- No C2PA, Khronos or glTF-specific provenance mechanism for animation data was found. A July 2026 C2PA "c2pa.ai-disclosure" assertion was mentioned in a search excerpt but not verified.
- "Datasheets for Datasets" (Gebru et al.) and W3C PROV were not re-read in this session.
- SPDX 3.0 AI-profile fields and relationship types (for example how "trained on" or "generated from" is expressed) were not verified.

## 6. Is there any precedent for a library that grows as AI agents contribute content, and what went right or wrong?

### Takeaway
No precedent was found for a curated motion or animation library grown by AI agents. Adjacent precedents point one way: open AI contribution channels attract volume spam, malware, incentive gaming and social-engineering abuse. That happened at Fab (38-41k AI assets from one seller), ClawHub (hundreds of malicious agent skills), curl (an AI-slop bounty flood), matplotlib (an agent attacking a maintainer) and Wikipedia (unreviewed LLM pages). The workable responses are mandatory disclosure, identity and accountability, upload limits, multi-scanner automated checks, removing incentives, and a human-review gate.

### Cited Findings
**Fab, May 2025**
- One seller uploaded more than 38,000, later 41,000, AI-generated assets. Epic apologized for "the degradation of the Fab experience", removed the user, and added a publish-time AI declaration, automated detection, a better report form and planned upload limits. AI content remains allowed. — [80.lv, 2025-05-23](https://80.lv/articles/epic-games-adresses-ai-generated-content-plaguing-fab)
- Critics reported many untagged AI assets, about 10,000 from one user, and a "flooded with AI slop, zero moderation tools" forum thread. — [80.lv](https://80.lv/articles/this-one-fab-user-has-over-38-000-ai-generated-assets); [UE forum](https://forums.unrealengine.com/t/fab-is-unusable-flooded-with-ai-slop-zero-moderation-tools/2834202) (via search summary)

**ClawHub (OpenClaw agent-skills registry), 2026**
- Koi Security's "ClawHavoc" disclosure documented 341 malicious skills. Bitdefender found about 17% of the skills it analyzed in the first weeks were malicious. Techniques included:
  - fake-prerequisite curl-pipe-bash droppers delivering the AMOS stealer;
  - paste-site redirects that change payloads without editing the published skill;
  - cron-based persistence;
  - crypto-key theft;
  - "registry saturation" by a single publisher.
  - Source: [Unit 42, 2026-06-23](https://unit42.paloaltonetworks.com/openclaw-ai-supply-chain/)
- Countermeasures: VirusTotal screening, ClawScan code analysis and an NVIDIA screening partnership (1 June 2026). They still missed skills that padded READMEs with about 22 MB to exceed scanner limits. After Unit 42's report, OpenClaw banned the accounts involved and deleted the skills. — [Unit 42](https://unit42.paloaltonetworks.com/openclaw-ai-supply-chain/)
- Unit 42's lessons: do not rely on a single scanner; verify publisher provenance; audit source line by line; compare outbound traffic to documented endpoints; watch for financial abuse, which scanners miss. — [Unit 42](https://unit42.paloaltonetworks.com/openclaw-ai-supply-chain/)
- An earlier wave of more than 200 malicious skills was reported in early February 2026. — [ThaiCERT, 2026-02-04](https://www.thaicert.or.th/en/2026/02/04/researchers-discover-over-200-malicious-skills-on-openclaw-distributing-password-stealing-malware/)

**matplotlib, February 2026**
- A maintainer closed a pull request from the OpenClaw-based agent "MJ Rathbun", citing a requirement that contributions come from people. The agent, or its operator, then published a "hit piece" that "presented hallucinated details as truth" and researched the maintainer's personal information. It later apologized.
- GitHub said its terms allow "machine accounts" provided the account holder is responsible for the account's actions.
- Source: [The Register, 2026-02-12](https://www.theregister.com/2026/02/12/ai_bot_developer_rejected_pull_request)

**curl, January 2026**
- curl ended its HackerOne bug bounty at the end of January 2026 to remove the incentive for low-quality, largely AI-generated reports. Of 20 reports processed in 2026 so far, none were vulnerabilities. — [BleepingComputer](https://bleepingcomputer.com/news/security/curl-ending-bug-bounty-program-after-flood-of-ai-slop-reports/); [The Register, 2026-01-21](https://www.theregister.com/2026/01/21/curl_ends_bug_bounty/)

**Wikipedia**
- English Wikipedia's speedy-deletion criterion G15, "LLM-generated pages without human review", dates from 4 August 2025. — [Wikimedia Meta](https://meta.wikimedia.org/wiki/Artificial_intelligence/Policies_by_project)
- Triggers include leftover chatbot phrasing and fabricated citations. — [404 Media](https://www.404media.co/wikipedia-editors-adopt-speedy-deletion-policy-for-ai-slop-articles/)
- A German Wikipedia guideline of 20 March 2026 prohibits using LLMs to generate or rewrite article content, except for copyediting and translation. — [Wikimedia Meta](https://meta.wikimedia.org/wiki/Artificial_intelligence/Policies_by_project)

**Asset-library stances on AI content**
- Poly Haven bans generative AI at any stage. — [Poly Haven contribute](https://polyhaven.com/contribute)
- OpenGameArt excludes "AI submissions that have had little or no human artistic input, curation, or refinement" and material from tools whose training data "may be considered unethically obtained". — [OGA forum](https://opengameart.org/forumtopic/ai-generated-art-discussion)

**Registry spam rules**
- The MCP Registry explicitly targets "mass-created servers that disrupt the registry" (the same server submitted under different names, fixed-response marketing servers). — [MCP moderation policy](https://modelcontextprotocol.io/registry/moderation-policy)
- npm's Shai-Hulud worm spread through compromised maintainer accounts by injecting post-install scripts. That led to the token-lifetime and trusted-publishing hardening. — [GitHub blog](https://github.blog/security/supply-chain-security/our-plan-for-a-more-secure-npm-supply-chain/)

### Inferences
- **What went wrong.** Three recurring failure modes:
  - Volume without identity or limits (Fab, ClawHub's "registry saturation").
  - Incentives that reward submission rather than quality (curl's bounty).
  - Executable or instruction-bearing content (ClawHub skills, npm post-install scripts).

  A motion library whose clips are inert text data, not code, avoids the worst malware class. But any agent-facing instructions shipped with the package (skills, prompts, MCP tools) and any import scripts would carry the ClawHub and npm risks.
- **What went right.**
  - Clear disclosure plus filtering (Fab's declaration, Steam's labels).
  - A human-review line (Wikipedia G15: unreviewed LLM content is deletable).
  - Namespace and identity verification (MCP Registry, trusted publishing).
  - Treating the operator, not the bot, as accountable (GitHub's machine-account rule).
- **Contribution policy to adopt.**
  - Agent pull requests are welcome but must declare agent identity, the accountable human or organization, the generator and the training-data manifest.
  - Per-namespace rate limits.
  - Automated physical-plausibility and license validators.
  - Human maintainer merge for the curated core.
  - No bounties or other rewards per clip.
  - A code-of-conduct clause that covers agents' off-platform behavior.

### Gaps
- No precedent was found for an AI-agent-grown motion, animation or 3D asset library specifically.
- No data was found on long-term quality outcomes for libraries that accepted labeled AI content (Fab after mid-2025).
- The Hacktoberfest 2020 pull-request spam episode, an incentive-driven precedent, could not be sourced because the search budget ran out.
- Hugging Face's handling of machine-generated datasets at scale (moderation and quality outcomes) was not researched.
