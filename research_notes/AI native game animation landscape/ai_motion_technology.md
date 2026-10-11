# AI/ML and Algorithmic Methods for Game-Ready Skeletal Character Motion (state as of 2026-10-11)

_Method note: all sources were retrieved 2026-10-11. Paper facts come from arXiv abstracts and tables in arXiv's HTML versions. Licenses come from the actual LICENSE/README files (via raw.githubusercontent.com) and from Hugging Face model cards. Star counts and last-commit dates are approximate, from shields.io badges on 2026-10-11 (the GitHub API was blocked in this environment). A month with no year means 2026. The shared WebSearch budget ran out partway through, so some industry and product questions are listed under Gaps rather than answered. Venues for pre-2025 academic papers come from background knowledge and were not re-verified unless a source is cited. "Vendor claim" marks unreviewed company or tech-report numbers; "peer-reviewed" is used only where a venue is evidenced._

## 1. Text-to-motion: leading open models, measured quality, speed/hardware, and licensing. Is anything commercially licensable?

### Takeaway
As of October 2026 the clearest commercially usable open text-to-motion model is NVIDIA's **Kimodo**: Apache-2.0 code, SOMA/G1 "RP" and "SEED" weights under the NVIDIA Open Model License (NVIDIA describes them as "ready for commercial use"), trained on Bones Studio studio mocap (released 2026-03-16, v1.1 on 2026-04-10). Tencent's **HY-Motion 1.0** (2025-12-30) is the strongest model by its own human evaluation. Its community license excludes the EU, UK and South Korea, requires a separate license above 1M MAU, and forbids using its outputs to improve other AI models. Part of its training data was reconstructed with non-commercial GVHMR. Almost every academic model (MDM, T2M-GPT, MoMask, MotionGPT, MotionLCM, Light-T2M, BAMM, DART, MotionStreamer, MoMask++) is trained on HumanML3D/AMASS. The AMASS license explicitly forbids training networks "for commercial use of any kind", so those weights cannot back commercially shipped motion, whatever their code license says.

### Cited Findings

#### HumanML3D / KIT-ML benchmark (older academic results, 2022–2025)
- HumanML3D has 14,616 motions, 44,970 descriptions and 28.59 hours, at 20 fps, with clips of 2–10 s. It is built from HumanAct12 and AMASS on the 22-joint SMPL skeleton, and the authors are "not allowed to distribute the data directly" because of AMASS's distribution policy. KIT-ML has 3,911 motions and 21 joints. — [HumanML3D README](https://github.com/EricGuo5513/HumanML3D)
- The Light-T2M paper (arXiv 2024-12-15) reproduced several models under one protocol on HumanML3D (FID / R-precision top-3 / params / average inference time):
  - MDM: 0.544 / 0.611 / 17.88M / 14.32 s
  - T2M-GPT: 0.141 / 0.775 / 247.8M / 0.434 s
  - ReMoDiffuse: 0.103 / 0.795 / 46.97M / 0.475 s
  - MoMask: 0.045 / 0.807 / 44.85M / 0.180 s
  - Light-T2M: 0.040 / 0.795 / 4.48M / 0.151 s

  The measurement hardware was not captured. — [Light-T2M Table 1](https://arxiv.org/html/2412.11193v1)
- MotionLCM's table (arXiv 2024-04-30) gives inference time per sequence:
  - MDM: 24.74 s
  - MLD: 0.217 s
  - MotionLCM 1-step: 0.030 s (FID 0.467, top-3 R-precision 0.803)
  - MotionLCM 4-step: 0.043 s (FID 0.304)

  The README says the original setup was tested on an RTX 3090. — [MotionLCM Table 1](https://arxiv.org/html/2404.19759v3); [MotionLCM README](https://github.com/Dai-Wenxun/MotionLCM)
- On the same benchmark, real motions score top-3 R-precision 0.797 and FID 0.002 ([MotionLCM Table 1](https://arxiv.org/html/2404.19759v3)). MoMask (0.807) and MoMask++ (0.811, FID 0.072, top-1 0.528; SnapMoGen paper, arXiv 2025-07-12) both exceed real data on R-precision. — [SnapMoGen Table 2](https://arxiv.org/html/2507.09122v2)
- MoMask's own abstract reports FID 0.045 on HumanML3D and 0.228 on KIT-ML. — [MoMask arXiv](https://arxiv.org/abs/2312.00063). T2M-GPT reports FID 0.116 and notes that "dataset size is a limitation of our approach". — [T2M-GPT arXiv](https://arxiv.org/abs/2301.06052)
- MARDM (arXiv 2024-11-25) argues that VQ-token methods lose information and reduce diversity, and proposes "a more robust evaluation method". — [MARDM arXiv](https://arxiv.org/abs/2411.16575)

#### 2025–2026 large and "foundation" text-to-motion models
- **HY-Motion 1.0** (Tencent; tech report arXiv 2025-12-29; weights 2025-12-30) is a flow-matching DiT scaled to 1B parameters. It was pretrained on more than 3,000 h of motion, fine-tuned on 400 h of curated data, then aligned with RLHF (DPO) and reward models (Flow-GRPO). — [HY-Motion arXiv](https://arxiv.org/abs/2512.23464); [HY-Motion HTML](https://arxiv.org/html/2512.23464v1)
  - Hardware: HY-Motion-1.0 (1.0B) needs at least 26 GB VRAM and HY-Motion-1.0-Lite (0.46B) needs 24 GB. The optional LLM prompt-rewrite and duration module needs extra VRAM. — [HY-Motion README](https://github.com/Tencent-Hunyuan/HY-Motion-1.0)
  - Text conditioning uses Qwen3-8B token embeddings plus a CLIP-L global embedding. The rewrite/duration module is fine-tuned from Qwen3-30B-A3B. — [HY-Motion HTML](https://arxiv.org/html/2512.23464v1)
  - Data sources are 12 million HunyuanVideo clips reconstructed into SMPL-X with **GVHMR**, plus "approximately 500 hours" of acquired mocap and "3D animation assets, hand-crafted by professional artists for game production". The specific vendors are not named. Everything is retargeted to SMPL-H. — [HY-Motion HTML §2.1](https://arxiv.org/html/2512.23464v1)
  - Vendor evaluation (scores per the paper's own rating protocol):
    - Instruction-following average 3.24 vs MoMask 2.31, DART 2.31, GoToZero 2.19, LoM 2.17.
    - "SSAE" 78.6% vs MoMask 58.0%.
    - Motion quality 3.43 vs DART 3.11.

    This is not peer-reviewed. — [HY-Motion Tables 1–2](https://arxiv.org/html/2512.23464v1)
  - Scaling ablation: instruction following goes 3.10 (0.05B), 3.20 (0.46B), 3.34 (1B). A 0.46B model trained only on the 400 h high-quality set scores lower on instruction following (3.05) but slightly higher on quality (3.31). — [HY-Motion Tables 3–4](https://arxiv.org/html/2512.23464v1)
  - Repo has about 2.6k stars; last commit July 2026. — [HY-Motion repo](https://github.com/Tencent-Hunyuan/HY-Motion-1.0)
- **Kimodo** (NVIDIA; arXiv 2026-03-16) is a kinematic motion diffusion model with a two-stage denoiser (root first, then body), trained on about 700 h of optical mocap. It is controlled by text plus full-body keyframes, sparse joint positions/rotations, 2D waypoints and dense 2D paths. — [Kimodo arXiv](https://arxiv.org/abs/2603.15546); [Kimodo project page](https://research.nvidia.com/labs/sil/projects/kimodo/)
  - The model is 282M parameters, and clips are at most 10 s (300 frames at 30 fps). — [Kimodo-SOMA-RP-v1.1 model card](https://huggingface.co/nvidia/Kimodo-SOMA-RP-v1.1)
  - Running fully on GPU needs about 17 GB VRAM, "primarily due to the text embedding model" (LLM2Vec). Moving the text encoder to CPU cuts this to under 3 GB. It was tested on RTX 3090, RTX 4090 and A100. — [Kimodo README](https://github.com/nv-tlabs/kimodo)
  - Vendor results on its own Rigplay test set (ground truth in brackets): R@3 71.9 [75.6], FID 1.85, foot skate 3.87 cm/s [2.21], contact 0.98. Constraint errors: full-body keyframe 2.67 cm, end-effector 3.09 cm / 4.18°, 2D root 2.90 cm. — [Kimodo Table 1](https://arxiv.org/html/2603.15546v1)
  - Scaling: going from 56M to 148M to 282M parameters raises R@3 from 64.0 to 69.2 to 71.9. Training on 10% of the data raises keyframe error to 4.60 cm, against 2.77 cm on the full set. — [Kimodo Table 2](https://arxiv.org/html/2603.15546v1)
  - Repo has about 3.7k stars; last commit September 2026. — [Kimodo repo](https://github.com/nv-tlabs/kimodo)
- **MotionMillion / "Go to Zero"** (arXiv 2025-07-09) introduces a dataset of over 2,000 h and 2M sequences, plus 3B and 7B models. Code and checkpoints came out 2025-07-03 and the dataset on 2025-07-26. It needs the SMPL+H and DMPL models. — [Go to Zero arXiv](https://arxiv.org/abs/2507.07095); [MotionMillion README](https://github.com/VankouF/MotionMillion-Codes)
- **ScaMo** (arXiv 2024-12-19) confirms scaling laws for an FSQ-VAE plus prefix-autoregressive transformer. Its inference uses a 3B LLaMA and FLAN-T5-XL. The author writes: "we still do not observe the emerging abilities". — [ScaMo arXiv](https://arxiv.org/abs/2412.14559); [ScaMo README](https://github.com/shunlinlu/ScaMo_code)
- **Being-M0 / MotionLib** (arXiv 2024-10-04) claims a "million-level" dataset at least 15× larger than prior ones. On 2026-10-11 the README still says "We will release our code and part of our dataset soon". — [Being-M0 arXiv](https://arxiv.org/abs/2410.03311); [Being-M0 README](https://github.com/BeingBeyond/Being-M0)
- **ViMoGen** (arXiv 2025-10-30; homepage path indicates ICLR 2026) contributes:
  - the ViMoGen-228K dataset (optical mocap, web-video motion and video-generator-synthesized motion);
  - a flow-matching DiT, plus a distilled "ViMoGen-light" with no video-generation dependency;
  - the MBench benchmark.

  In its text-encoder ablation, T5-XXL beat CLIP on generalization. — [ViMoGen arXiv](https://arxiv.org/abs/2510.26794); [ViMoGen HTML](https://arxiv.org/html/2510.26794v2)
- **MotionStreamer** (arXiv 2025-03-19) does streaming text-to-motion using a causal continuous latent space. — [MotionStreamer arXiv](https://arxiv.org/abs/2503.15451). **DART** (ICLR 2025 per its README) is a real-time autoregressive latent-diffusion model built from motion primitives, profiled on a single RTX 4090. — [DART README](https://github.com/zkf1997/DART); [DART arXiv](https://arxiv.org/abs/2410.05260)
- **Newest preprints (not peer-reviewed):**
  - Timo (arXiv 2026-09-25) claims to beat Kimodo on 5 of 6 dimensions of its own 40,025-clip benchmark, a "40.8% relative improvement". — [Timo arXiv](https://arxiv.org/abs/2609.30761)
  - TACD (arXiv 2026-10-02) distils HY-Motion and Kimodo into 8-step students with 7.7–11.9× end-to-end speedups and 3.8–6.7× lower peak GPU memory. — [TACD arXiv](https://arxiv.org/abs/2610.02867). A "TACD-HY-Motion-Lite" checkpoint appeared on Hugging Face on 2026-10-05. — [HF](https://huggingface.co/weijinhuang/TACD-HY-Motion-Lite)
  - UMO (arXiv 2026-03-16) fine-tunes DiT motion foundation models for inpainting, editing and "text-serialized geometric constraints". — [UMO arXiv](https://arxiv.org/abs/2603.15975)

#### Licensing facts (code / weights / training data)
- **AMASS** (the source of HumanML3D) is licensed "for non-commercial scientific research purposes". The license prohibits "incorporation in a commercial product, use in a commercial service, or production of other artefacts for commercial purposes". It also "prohibits the use of the Dataset to train methods/algorithms/neural networks/etc. for commercial use of any kind". Commercial licensing is by email to ps-license@tue.mpg.de. — [AMASS LICENSE](https://github.com/nghorbani/amass/blob/master/LICENSE.txt)
- The **SMPL** model license is likewise non-commercial, with commercial licensing through Meshcapade. It also "prohibits the use of the Software to train methods/algorithms/neural networks/etc. for commercial use of any kind". — [SMPL model license](https://smpl.is.tue.mpg.de/modellicense.html)
- **NVIDIA Open Model License** (Kimodo SOMA/G1 weights; last modified 2025-10-24):
  - "Models are commercially usable. You are free to create and distribute Derivative Models. NVIDIA does not claim ownership to any outputs."
  - Distributing the model requires the attribution notice "Licensed by NVIDIA Corporation under the NVIDIA Open Model License".
  - Rights terminate automatically if you circumvent a "Guardrail" or sue over infringement.
  - "NVIDIA may update this Agreement… at any time".

  — [NVIDIA Open Model License](https://www.nvidia.com/en-us/agreements/enterprise-software/nvidia-open-model-license/); [GR00T-WBC dual license copy](https://github.com/NVlabs/GR00T-WholeBodyControl/blob/main/LICENSE)
- Kimodo's model table:
  - SOMA-RP, G1-RP, SOMA-SEED and G1-SEED use the NVIDIA Open Model License.
  - **Kimodo-SMPLX-RP uses a different "NVIDIA R&D Model" license** (terms not reviewed here).
  - The recommended RP models use "Bones Rigplay 1 (700 hours of mocap)". The README calls it "commercially-friendly", and the model card calls it "proprietary".

  — [Kimodo README](https://github.com/nv-tlabs/kimodo); [Kimodo-SOMA-RP-v1.1 card](https://huggingface.co/nvidia/Kimodo-SOMA-RP-v1.1); [Kimodo-G1-SEED-v1 card](https://huggingface.co/nvidia/Kimodo-G1-SEED-v1)
- **BONES-SEED** (Hugging Face dataset, created 2026-03-10):
  - 142,220 motions (71,132 original plus 71,088 mirrored), about 288 h, 120 fps, 522 actors.
  - Formats: SOMA BVH and Unitree G1 CSV.
  - Gated behind a custom "bones-seed-license". Its full text (bones.studio/info/seed-license) could not be retrieved, so commercial and ML-training terms are unverified.

  — [BONES-SEED card](https://huggingface.co/datasets/bones-studio/seed)
- **HY-Motion license** ("Tencent HY-MOTION 1.0 Community License", release date December 30, 2025):
  - It "DOES NOT APPLY IN THE EUROPEAN UNION, UNITED KINGDOM AND SOUTH KOREA".
  - Licensees with more than 1 million MAU "must request a license from Tencent".
  - "You must not use the Tencent HY-MOTION 1.0 Works or any Output… to improve any other AI model".
  - Military use is barred.

  — [HY-Motion License.txt](https://github.com/Tencent-Hunyuan/HY-Motion-1.0/blob/master/License.txt)
- License matrix (code / weights / data):

| Model (date) | Code | Weights | Training data (its license) | Commercial motion? |
|---|---|---|---|---|
| MDM (2022) | MIT ([LICENSE](https://github.com/GuyTevet/motion-diffusion-model/blob/main/LICENSE)) | no separate license | HumanML3D ← AMASS (NC; bans commercial training) | No |
| T2M-GPT (2023) | Apache-2.0 ([LICENSE](https://github.com/Mael-zys/T2M-GPT/blob/main/LICENSE)) | no separate license | HumanML3D/KIT | No |
| MoMask (2023) | MIT ([LICENSE](https://github.com/EricGuo5513/momask-codes/blob/main/LICENSE)) | no separate license | HumanML3D/KIT | No |
| MotionGPT (2023) | MIT ([LICENSE](https://github.com/OpenMotionLab/MotionGPT/blob/main/LICENSE)) | no separate license | HumanML3D/KIT | No |
| MotionLCM (2024) | "Non-commercial Scientific Research" ([LICENSE](https://github.com/Dai-Wenxun/MotionLCM/blob/main/LICENSE)) | same | HumanML3D | No |
| Light-T2M (2024) | MIT ([LICENSE](https://github.com/qinghuannn/light-t2m/blob/main/LICENSE)) | no separate license | HumanML3D/KIT | No |
| BAMM (2024) | CC BY-NC-ND 4.0 ([README](https://github.com/exitudio/BAMM)) | same | HumanML3D/KIT | No |
| DART (2024) | Apache-2.0 ([LICENSE](https://github.com/zkf1997/DART/blob/main/LICENSE)) | no separate license | AMASS, BABEL, HumanML3D ([README](https://github.com/zkf1997/DART)) | No |
| MotionStreamer (2025) | "Project Registration License v1.0": research free; organizational use needs registration ([LICENSE](https://github.com/zju3dv/MotionStreamer/blob/main/LICENSE)) | HF repo tagged MIT ([HF](https://huggingface.co/lxxiao/MotionStreamer)); conflicts with code license | 272-dim HumanML3D/BABEL, "solely for academic purposes" ([README](https://github.com/zju3dv/MotionStreamer)) | No |
| MotionMillion (2025) | Apache-2.0 ([LICENSE](https://github.com/VankouF/MotionMillion-Codes/blob/main/LICENSE)) | not determined | MotionMillion (web-video-derived; license not determined) + SMPL-H | Unclear |
| ScaMo (2024) | no LICENSE file found ([README](https://github.com/shunlinlu/ScaMo_code)) | not determined | not determined | Unclear |
| SnapMoGen / MoMask++ (2025) | Snap Non-Commercial ([LICENSE](https://github.com/snap-research/SnapMoGen/blob/main/LICENSE)) | same | SnapMoGen (Snap NC) | No |
| HY-Motion 1.0 (2025-12) | Tencent community | Tencent community | Video via GVHMR (NC code) + ~500 h acquired mocap/game assets | Restricted (territory, MAU, output-use clause) |
| Kimodo SOMA/G1-RP (2026-03/04) | Apache-2.0 ([LICENSE](https://github.com/nv-tlabs/kimodo/blob/main/LICENSE)) | NVIDIA Open Model License | Bones Rigplay 1 (proprietary, "commercially-friendly") | Yes, per NVIDIA |
| Kimodo SOMA/G1-SEED (2026) | Apache-2.0 | NVIDIA Open Model License | BONES-SEED (custom license, unverified) | Model card says yes; data terms unverified |
| Kimodo-SMPLX-RP (2026) | Apache-2.0 | "NVIDIA R&D Model" license | Rigplay retargeted to SMPL-X | Likely no (unverified) |

#### Commercial (closed) providers claiming licensed data (vendor claims)
- **Motorica** says it is "Powered by one of the world's largest fully licensed mocap databases, ensuring a verifiable chain of title". It also says it generates "bespoke datasets tailored for your motion matching system" in minutes. — [Motorica](https://www.motorica.ai/)
- **Uthana** claims "1,000+ hours of data to license", "<50ms speed to first motion token", and data captured "using a 120-camera motion capture system". It offers a GraphQL API for generation, video-to-motion, retargeting and auto-rigging. — [Uthana](https://uthana.com/)

### Inferences
- **Kimodo is the only verified option for an open package that ships commercially usable generated motion.** It should run as an optional server-side or local-GPU generator. HY-Motion should at most be an opt-in, user-licensed plugin: its EU/UK exclusion and its ban on using outputs to improve other AI models conflict with a global open library that wants AI-contributed clips to feed future models. HumanML3D/AMASS models fit only a clearly labelled research/evaluation mode.
- **Browser inference is the opposite of legal usability.**
  - The small models that would plausibly run in ONNX Runtime Web (Light-T2M at 4.48M parameters, MoMask at 44.85M, MotionLCM's 30 ms sampler) are all AMASS-derived.
  - Kimodo's 282M denoiser might fit in WebGPU memory. Its LLM2Vec text encoder is the 17 GB bottleneck and is impractical in a browser. A practical split is to encode text on a server or CPU and run the denoiser on the client, or to distil a small encoder (derivatives are allowed under the NVIDIA Open Model License).
  - Evidence that a smaller encoder is being pursued is weak but suggestive: a community repository named "LFM2.5-to-Llama8B-LLM2Vec-Kimodo" appeared on Hugging Face in August 2026 (seen in an HF API listing).
- **HumanML3D metrics cannot certify game-readiness.** Several models now exceed real data on R-precision, and the evaluator is itself trained on AMASS. The package should use geometric and contact metrics (see §7).
- **Retargeting is required whichever model is used.** Kimodo outputs SOMA (77-joint I/O skeleton since 2026-03-19, per the [Kimodo README](https://github.com/nv-tlabs/kimodo)), and HY-Motion outputs SMPL-H. Both must be retargeted to the package's canonical skeleton. Retargeting and IK are core runtime features anyway.

### Gaps
- Absolute per-clip latency for HY-Motion and Kimodo was not found. Only TACD's relative speedups exist, plus ARDY's statement that Kimodo is too slow for interactive use.
- Not found: MotionMillion 7B inference cost; ViMoGen code/weights licenses; Timo, UMO and TACD code licenses.
- The full BONES-SEED license text and the terms under which Bones licensed Rigplay to NVIDIA could not be retrieved. "Commercially-friendly" is NVIDIA's own wording.
- Not found: Kimodo-SMPLX-RP license terms.
- No independent third-party comparison of Kimodo vs HY-Motion was found; Timo's is a single preprint.
- Papers with Code leaderboards were not consulted.
- An apparent inconsistency is unresolved: the Kimodo model card says it is trained on the "30-joint SOMA skeleton", while the README says I/O uses the 77-joint `somaskel77`.

## 2. Motion in-betweening and keyframe completion: quality reached, and can an agent author sparse keyframes for a model to fill?

### Takeaway
On the LaFAN1 benchmark, transformer in-betweeners roughly halve the error of the 2020 Robust Motion In-betweening (RMIB) model at 30–45 frame gaps. Those models are trained on LaFAN1 (CC BY-NC-ND) or HumanML3D (AMASS non-commercial), so they cannot be shipped commercially as-is. The 2026 NVIDIA stack makes "agent writes sparse keyframes, model fills" practical and commercially licensable:
- Kimodo (offline) handles full-body keyframes, joint, root and path constraints with about 2.7 cm full-body keyframe error.
- ARDY (2026-07-10) is a real-time streaming version.
- MotionBricks (2026) is a 2 ms in-betweening backbone.

### Cited Findings
- **RMIB** (Harvey et al., Ubisoft La Forge; arXiv 2021-02-09; SIGGRAPH 2020) is an adversarial RNN with a time-to-arrival embedding and scheduled target noise. It shipped with a MotionBuilder plugin and introduced the LaFAN1 dataset; the released code reproduces the baselines. — [RMIB arXiv](https://arxiv.org/abs/2102.04942). LaFAN1 is CC BY-NC-ND 4.0 (repo about 1.6k stars, last commit November 2021). — [LaFAN1 license](https://github.com/ubisoft/ubisoft-laforge-animation-dataset/blob/master/license.txt)
- LaFAN1 position error (L2P) at 15/30/45-frame gaps, collated in SILK (arXiv 2025-06-09):

  | Method | 15 | 30 | 45 | L2Q @30 |
  |---|---|---|---|---|
  | SLERP | 1.38 | 2.49 | 3.45 | 0.97 |
  | RMIB | 0.65 | 1.28 | 2.24 | 0.69 |
  | Two-stage transformer (TST, Qin et al. 2022) | 0.39 | 0.89 | 1.68 | 0.54 |
  | Δ-interpolator | 0.47 | 1.00 | – | – |
  | SILK | 0.38 | 0.83 | 1.59 | 0.50 |

  — [SILK Table 1](https://arxiv.org/html/2506.09075v1)
- SILK uses a single Transformer encoder. It finds that "data modeling choices", including data volume, pose representation and velocity inputs, matter more than architectural complexity. — [SILK arXiv](https://arxiv.org/abs/2506.09075)
- The TST code is MIT-licensed (about 114 stars; last commit June 2023). — [motion_inbetweening LICENSE](https://github.com/victorqin/motion_inbetweening/blob/master/LICENSE.txt)
- **CondMDI** (arXiv 2024-05-17) is a diffusion in-betweener allowing "arbitrary dense-or-sparse keyframe placement and partial keyframe constraints" plus text, trained on HumanML3D. Code is MIT (about 281 stars; last commit September 2024). — [CondMDI arXiv](https://arxiv.org/abs/2405.11126); [LICENSE](https://github.com/setarehc/diffusion-motion-inbetweening/blob/main/LICENSE)
- **Joint-level spatial control** got much faster between 2023 and 2024. On HumanML3D:
  - OmniControl: 81.00 s per sequence, FID 2.328, trajectory error 0.336.
  - MotionLCM (1-step, latent and motion control): 0.042 s, FID 0.419, trajectory error 0.199.

  — [MotionLCM Table 2](https://arxiv.org/html/2404.19759v3); [OmniControl arXiv](https://arxiv.org/abs/2310.08580)
- MoMask can do "text-guided temporal inpainting" without fine-tuning. — [MoMask arXiv](https://arxiv.org/abs/2312.00063)
- **Kimodo constraints** (2026) use a 1D frame index per constraint. Constrainable features are 3D joint positions, 3×3 joint rotation matrices, 2D heading and 2D root position. — [Kimodo-G1-SEED-v1 card](https://huggingface.co/nvidia/Kimodo-G1-SEED-v1)
  - Measured constraint errors: full-body keyframes 2.67 cm, end-effector joints 3.09 cm / 4.18°, 2D root 2.90 cm. — [Kimodo Table 1](https://arxiv.org/html/2603.15546v1)
- **ARDY** (NVIDIA; released 2026-07-10) is "a streaming generation framework" supporting "online text prompting and flexible long-horizon kinematic constraints (root paths/waypoints, full-body keyframes, and sparse joint positions/rotations) with real-time responsiveness". It is pitched for "game character control". — [ARDY project page](https://research.nvidia.com/labs/sil/projects/ardy/); [Kimodo README news](https://github.com/nv-tlabs/kimodo)
- **MotionBricks** (NVIDIA, 2026) claims "15000 FPS and 2 ms latency covering over 350,000 motion skills by a single neural backbone" (vendor claim). In its "smart objects", interaction is specified "as a flexible set of proxy keyframes; the backbone fills in the approach, contact, and follow-through". — [MotionBricks page](https://nvlabs.github.io/motionbricks/)
  - NVIDIA describes it as specialising in "fast and robust motion in-betweening". — [Kimodo project page](https://research.nvidia.com/labs/sil/projects/kimodo/)
  - A preview (checkpoints plus training code) landed 2026-04-27 in a repo whose code is Apache-2.0 and whose weights are under the NVIDIA Open Model License. — [GR00T-WBC README](https://github.com/NVlabs/GR00T-WholeBodyControl); [GR00T-WBC LICENSE](https://github.com/NVlabs/GR00T-WholeBodyControl/blob/main/LICENSE)
  - Its stated corpus is "BONES-SEED… 350k production-grade mocap clips". The BONES-SEED card lists 142,220 motions, so the clip counts are inconsistent. — [MotionBricks page](https://nvlabs.github.io/motionbricks/); [BONES-SEED card](https://huggingface.co/datasets/bones-studio/seed)
- **MaskedMimic** (arXiv 2024-09-22) is the physics-based equivalent: a single controller that synthesises motion from "masked keyframes, objects, text descriptions, or any combination". — [MaskedMimic arXiv](https://arxiv.org/abs/2409.14393)
- **UMO** (arXiv 2026-03-16) adds temporal inpainting and "text-serialized geometric constraints" to a pretrained DiT text-to-motion model. — [UMO arXiv](https://arxiv.org/abs/2603.15975)

### Inferences
- **The predecessor's key-pose format maps directly onto Kimodo's constraint interface.** Its format is pelvis-height percent, torso turn/lean/tilt, and limb direction plus bend. Each key pose becomes per-frame root position and heading plus joint rotations or end-effector positions. An agent can therefore author 3–10 key poses and let Kimodo, ARDY or MotionBricks fill the frames between, then verify the result with metrics.
- **Scale check (different metrics, not directly comparable):** Kimodo's 2.67 cm keyframe adherence is about 1.5–2× the predecessor's 14–18 mm encoding error. Model-filled clips should be re-encoded and checked against the authored keys.
- **Ship a deterministic, license-free fallback.** Spline/SLERP plus IK plus foot-locking is the baseline that SILK and RMIB beat by 2×. Learned in-betweeners trained on LaFAN1 or HumanML3D need retraining on clean data (for example CC0 clips, or Kimodo-synthesised data) before commercial use.

### Gaps
- CondMDI's numeric keyframe-error results were not extracted.
- ARDY's latency, weights and license were not found.
- MotionBricks' public code status is ambiguous: its page says code is "one month out", while the GR00T-WBC README lists a 2026-04-27 preview.
- No study was found that measures LLM-authored keyframes fed into these in-betweeners.

## 3. Motion matching and learned motion matching: mechanics, data needs, open implementations and licenses, UE5 Pose Search, runtime cost, JS/WASM feasibility

### Takeaway
Motion matching (MM) is a periodic nearest-neighbour search over a database of animation frames, scored on pose and future-trajectory features. Its memory, and to some degree its runtime, grows linearly with data and feature count. Learned Motion Matching (LMM; Ubisoft, ACM TOG July 2020) replaces the stored data with small networks trained on CPU. The open code is permissive and has already been compiled to WebAssembly (Daniel Holden's MIT demo). The canonical demo data, LaFAN1, is CC BY-NC-ND, so a commercial package must supply its own dense locomotion set. Unreal Engine 5's Pose Search is the production reference design.

### Cited Findings
- **Origins (as recounted in the LMM paper):** MM was introduced by Büttner and Clavet (2015) as a greedy approximation of Motion Fields, developed for *For Honor*, and framed by Clavet (2016) as a database search. The algorithm searches the database every N frames for the frame that best matches the current pose and the desired trajectory, and jumps if that frame costs less than the current one. Ubisoft's implementation was "used in several AAA game productions". — [LMM paper PDF](https://theorangeduck.com/media/uploads/other_stuff/Learned_Motion_Matching.pdf)
- **Scaling limits and LMM:** "The primary limitation of Motion Matching is that the memory usage (and runtime performance to some degree) scale linearly with the amount of data… and the number of features". LMM's final model "has no need to store animation data or additional matching meta-data in memory". — [LMM paper PDF](https://theorangeduck.com/media/uploads/other_stuff/Learned_Motion_Matching.pdf); [LMM page](https://theorangeduck.com/page/learned-motion-matching)
- **LMM cost and quality:**
  - Networks were trained single-threaded on CPU because "the small network sizes made training on the CPU almost always more efficient than training on the GPU". Results take "a few hours"; optimal results take overnight.
  - Performance was measured single-threaded on a Xeon with a custom inference library.
  - It works on dog and bear quadrupeds.
  - In the user study, subjects showed "no preference in terms of quality" between MM and LMM.

  — [LMM paper PDF](https://theorangeduck.com/media/uploads/other_stuff/Learned_Motion_Matching.pdf)
- **Holden's Motion-Matching repo** (code MIT; about 918 stars; last commit February 2025) is a C++ demo using raylib with LMM training scripts. It can be compiled as a web demo with emscripten (`make PLATFORM=PLATFORM_WEB`). Its database comes from LaFAN1 "licensed under CC BY-NC-ND 4.0 (unlike the code, which is licensed under MIT)". — [Motion-Matching README](https://github.com/orangeduck/Motion-Matching); [LICENSE](https://github.com/orangeduck/Motion-Matching/blob/main/LICENSE)
- **Unity MM implementation:** José Luis Pontón's MotionMatching is MIT-licensed (about 599 stars; last commit April 2026). — [JLPM22/MotionMatching LICENSE](https://github.com/JLPM22/MotionMatching/blob/main/LICENSE)
- **UE5 Pose Search** (docs labelled UE 5.8 as of 2026-10):
  - Motion Matching is "a query-based animation pose selection system" with no explicit transition logic.
  - A Schema defines channels: Trajectory, Pose, Position, Velocity, Heading, Phase and others. The query cost is the weighted sum of channel costs, with automatic weight normalisation.
  - Search modes are Brute Force, PCAKDTree, and VPTree, which is experimental and "should not be relied upon in a production" setting.
  - More channels, samples and PCA dimensions cost more memory and performance. You can add "any amount of animation assets". Locomotion clips need root motion, and the example uses loops, pivots and stops.

  — [UE Motion Matching docs](https://dev.epicgames.com/documentation/en-us/unreal-engine/motion-matching-in-unreal-engine)
- **Game Animation Sample (GASP):**
  - Contents: "a suite of motion captured animations" for locomotion and traversal.
  - Systems: Choosers, Pose History, Orientation Warping, Leg IK, an experimental Offset Root Bone, and IK Rig/Retargeter.
  - It is distributed through Fab. The docs page states no animation count, capture source or license terms. — [GASP docs](https://dev.epicgames.com/documentation/en-us/unreal-engine/game-animation-sample-project-in-unreal-engine)
- **Research add-ons:** WalkTheDog (arXiv 2024-07-11) pairs a learned phase manifold with "an improved motion matching framework" for retrieval and transfer across morphologies, for example human and dog. — [WalkTheDog arXiv](https://arxiv.org/abs/2407.18946)
- **Commercial data shortcut (vendor claim):** Motorica sells "full coverage motion matching datasets" generated in minutes. — [Motorica](https://www.motorica.ai/)

### Inferences
- **JS/WASM feasibility is high.** Holden's emscripten build shows a complete MM plus LMM pipeline running as WASM. A TypeScript or Rust-WASM brute-force or KD-tree search over tens of thousands of frames with roughly 20–30 features should cost well under a millisecond. This is inferred from the algorithm's structure, not measured here.
- **Data is the hard part.** MM needs dense, root-motion locomotion coverage (loops, starts, stops, pivots, turns at several speeds). Sparse CC0 game clips (Quaternius UAL, Mesh2Motion) are unlikely to cover it. Options are commissioning or recording CC0 capture, buying licensed packs, or synthesising coverage with Kimodo or ARDY, whose license allows commercial use of outputs.
- **LMM is optional for web use.** It matters when memory budgets are tight, and its CPU training cost (hours) suits offline tools.

### Gaps
- Typical MM database size in hours or minutes was not verified for any shipped title or for UE GASP.
- LaFAN1's size statistics were not re-verified.
- LMM's per-scenario memory figures (paper Table 3) could not be reliably extracted from the PDF text, though the qualitative claims above are verbatim.
- No measured runtime (ms) for UE Pose Search or for any JavaScript MM implementation was found.
- GASP's Fab license terms (for example whether use is limited to Unreal Engine) were not checked.

## 4. Physics-based character control: real-time inference cost, training cost, browser feasibility with Rapier or MuJoCo-WASM

### Takeaway
Physics-based controllers are trained with GPU-parallel simulators, at costs from 12 hours on 4×A100 up to 21k GPU-hours. The lineage runs DeepMimic, AMP/ASE/CALM, PHC/PULSE, MaskedMimic, and in 2025–2026 Meta Motivo, ADD, SONIC, ProtoMotions3 and MimicKit. At inference the policies are small: SONIC is at most 42M parameters running at 50 Hz. NVIDIA's April 2026 SONIC web demo already runs MuJoCo WASM plus an ONNX Runtime Web policy in the browser. Licensing splits sharply:
- ASE/CALM (NVIDIA License) and Meta Motivo (CC BY-NC) are non-commercial.
- DeepMimic, ProtoMotions and MimicKit code is permissive, but policies trained on AMASS inherit its ban on commercial training.
- SONIC weights (NVIDIA Open Model License) and BONES-trained ProtoMotions policies are the commercially oriented path.

### Cited Findings
- **DeepMimic** (2018) code is MIT (about 3.1k stars; last commit November 2025). — [DeepMimic LICENSE](https://github.com/xbpeng/DeepMimic/blob/master/LICENSE)
- **ASE** (arXiv 2022-05-04) trains skill embeddings with "over a decade of simulated experiences" on a massively parallel GPU simulator. — [ASE arXiv](https://arxiv.org/abs/2205.01906). Its NVIDIA License says the work "only may be used or intended for use non-commercially". — [ASE LICENSE](https://github.com/nv-tlabs/ASE/blob/main/LICENSE.txt). **CALM** (arXiv 2023-05-02) uses the same NVIDIA non-commercial license (last commit July 2023). — [CALM License](https://github.com/NVlabs/CALM/blob/main/License.txt); [CALM arXiv](https://arxiv.org/abs/2305.02195)
- **PHC** (arXiv 2023-05-10) imitates up to "ten thousand motion clips without using any external stabilizing forces" and recovers from falls. It drives "live and real-time multi-person avatar" use from video or language input. Code is BSD 3-Clause Clear (CMU/NVIDIA). — [PHC arXiv](https://arxiv.org/abs/2305.06456); [PHC LICENSE](https://github.com/ZhengyiLuo/PHC/blob/master/LICENSE)
- **PULSE** (arXiv 2023-10-06) distils a universal latent space; no LICENSE file was found (about 372 stars). — [PULSE arXiv](https://arxiv.org/abs/2310.04582); [PULSE repo](https://github.com/ZhengyiLuo/PULSE)
- **ProtoMotions3** (NVIDIA; Apache-2.0; about 2.4k stars; last commit September 2026):
  - Learns "the entire public AMASS… (40+ hours) within 12 hours on 4 A100s", and has trained "with 24 A100s" on BONES in the SOMA skeleton.
  - Trains one tracking policy on all of BONES-SEED (about 142K motions) that transfers zero-shot to a Unitree G1.
  - Exports "a single ONNX model (with observation computation baked in)" and offers one-click switching between IsaacGym, Newton and MuJoCo.
  - Hosts MaskedMimic and a Kimodo-to-physics pipeline.

  — [ProtoMotions README](https://github.com/NVlabs/ProtoMotions); [LICENSE](https://github.com/NVlabs/ProtoMotions/blob/main/LICENSE.md)
- **MimicKit** (Xue Bin Peng; Apache-2.0; about 2.4k stars; last commit June 2026; guide on arXiv 2025-10-15) supports Isaac Gym, Isaac Lab and Newton v1.0.0. Training examples use 4,096 parallel environments, and it ships an AMASS converter. — [MimicKit README](https://github.com/xbpeng/MimicKit); [MimicKit arXiv](https://arxiv.org/abs/2510.13794)
- **CLoSD** (arXiv 2024-10-04; MIT) couples a diffusion planner with a tracking policy. Running it "requires a single GPU with ~4GB"; training needs a GPU with about 50 GB, on Isaac Gym. It inherits the SMPL, AMASS and HumanML3D terms. — [CLoSD README](https://github.com/GuyTevet/CLoSD); [CLoSD arXiv](https://arxiv.org/abs/2410.03441)
- **Meta Motivo** (behavioural foundation model; ICLR 2025 per the OpenReview link in its README; weights 2024-12) has code, weights and the HumEnv environment all under CC BY-NC 4.0. Its examples load the model on CPU. — [metamotivo README](https://github.com/facebookresearch/metamotivo); [LICENSE](https://github.com/facebookresearch/metamotivo/blob/main/LICENSE); [HF metamotivo-M-1](https://huggingface.co/facebook/metamotivo-M-1); [HumEnv LICENSE](https://github.com/facebookresearch/humenv/blob/main/LICENSE); [paper](https://arxiv.org/abs/2504.11054)
- **ADD** (arXiv 2025-05-08) is an adversarial differential discriminator that reaches state-of-the-art tracking quality "without relying on manually-designed reward functions". — [ADD arXiv](https://arxiv.org/abs/2505.04961)
- **SONIC** (NVIDIA; arXiv 2025-11-11): a motion-tracking foundation model.
  - Scale: 1.2M to 42M parameters, "100M+ frames from 700 hours of motion capture", "21k GPU hours". — [SONIC arXiv](https://arxiv.org/abs/2511.07820)
  - Release: checkpoints and C++ inference on 2026-02-19, training code on 2026-04-10.
  - Runtime: the controller runs at 50 Hz with ONNX encoder/decoder files and C++/TensorRT deployment.
  - License: code Apache-2.0, weights NVIDIA Open Model License.

  — [GR00T-WBC README](https://github.com/NVlabs/GR00T-WholeBodyControl)
- **SONIC browser demo** (2026-04-14) loads `lib/ort.min.js` (ONNX Runtime Web) and "MuJoCo WASM". Its demo.js obtains Kimodo text-to-motion from a remote "Kimodo bridge via ngrok tunnel". It warns that "Safari has known issues with MuJoCo WASM threading". — [SONIC demo](https://nvlabs.github.io/GEAR-SONIC/demo.html); [demo.js](https://nvlabs.github.io/GEAR-SONIC/js/demo.js)
- **Physics as a filter for generated motion** (S³, arXiv 2026-09-22): sampling 8 text-to-motion candidates and keeping the one the SONIC policy executes best raised upright execution on all 4,184 HumanML3D test prompts from 80.5% to 89.5%. A kinematic fall predictor with AUROC 0.90 recovered "only a quarter of this gain". — [S³ arXiv](https://arxiv.org/abs/2609.26420)
- **MuJoCo in the browser:**
  - Official JavaScript/WASM bindings ship as npm `@mujoco/mujoco` (ESM, precompiled WASM, TypeScript declarations).
  - They are "still a WIP", developed mainly on Linux with Chrome; Windows support was "experimental" as of 2025-11-13.
  - The multi-threaded build needs cross-origin isolation (COOP/COEP headers).

  — [MuJoCo wasm README](https://github.com/google-deepmind/mujoco/blob/main/wasm/README.md). The community mujoco_wasm project is now "just a small demo suite" because DeepMind completed official bindings. — [zalo/mujoco_wasm](https://github.com/zalo/mujoco_wasm)
- **Rapier** (Apache-2.0; about 5.8k stars; last commit 2026-10-10) is actively adding multibody (reduced-coordinate) joints, motors and robot-description import. v0.36.1 (2026-10-04) adds Python access to multibody motors and MJCF body/joint names, and v0.35.3 (2026-08-28) supports the MJCF frictionloss statement for multibodies. — [Rapier CHANGELOG](https://github.com/dimforge/rapier/blob/master/CHANGELOG.md)
- **ONNX Runtime Web's WebGPU backend** is "available out-of-box in latest versions of Chrome and Edge on Windows, macOS, Android and ChromeOS", behind a flag in Firefox, and in Safari Technology Preview (per the ORT docs as retrieved). — [ORT WebGPU docs](https://onnxruntime.ai/docs/tutorials/web/ep-webgpu.html)

### Inferences
- **Browser inference of a tracking policy alongside a physics engine is demonstrated, at least for one character in MuJoCo WASM.** With Rapier it is plausible but unproven. Policies trained in Isaac or MuJoCo will face a sim-to-sim gap in Rapier's solver unless retrained or fine-tuned against Rapier. ProtoMotions' one-click cross-simulator testing shows the gap is routinely checked.
- **Training must stay offline on GPU clusters.** The package should consume exported ONNX policies, not train them.
- **The most valuable near-term use is verification.** Following S³, a headless "does a physics tracker keep this clip upright?" check can catch infeasible generated or agent-edited clips better than kinematic heuristics.
- **Licensing:** prefer policies trained on clean data, such as SONIC (OML weights) or ProtoMotions trained on BONES or Kimodo output. AMASS-trained PHC, PULSE and MaskedMimic checkpoints are not commercially usable.

### Gaps
- Per-step browser inference time and multi-character budgets for the SONIC demo were not measured.
- Not found: MaskedMimic and PHC training budgets; Meta Motivo parameter counts.
- No humanoid policy trained for or deployed in Rapier was found.
- Whether SONIC's 700 h of mocap is the same Bones Rigplay data as Kimodo's is unconfirmed.

## 5. Procedural and neural animation for games: phase-based methods, neural state machines, quadrupeds, IK and foot placement, procedural creatures

### Takeaway
Phase-based neural controllers (PFNN, MANN, Neural State Machine, DeepPhase periodic autoencoders, WalkTheDog) are compact enough for real-time and browser use: PFNN needs "milliseconds" of execution and "a few megabytes" of memory. Their reference implementations (AI4Animation) and data are non-commercial, so any shipped version needs retraining on clean data. IK-based procedural layers are license-free and already available in engines: CCD and FABRIK-style solvers, leg IK, orientation and stride warping, and root offsetting.

### Cited Findings
- **PFNN** (SIGGRAPH 2017): "Once trained, our system is also extremely fast and compact, requiring only milliseconds of execution time and a few megabytes of memory, even when trained on gigabytes of motion data". — [PFNN page](https://theorangeduck.com/page/phase-functioned-neural-networks-character-control)
- **AI4Animation** (Sebastian Starke; about 8.9k stars; last commit April 2026) hosts:
  - Mode-Adaptive Neural Networks for quadrupeds (SIGGRAPH 2018);
  - the Neural State Machine for character–scene interaction (SIGGRAPH Asia 2019);
  - the Periodic Autoencoder (DeepPhase), which "can learn periodic features from large unstructured motion datasets in an unsupervised" way;
  - a SIGGRAPH 2024 real-time sparse-sensor avatar system.

  A new AI4AnimationPy version removes the Unity dependency (NumPy/PyTorch). It includes a stylised biped trained on "style100", a quadruped controller "with gait transitions", real-time IK, and GLB/FBX/BVH/NPZ import. License: "only for research or education purposes, and not freely available for commercial use or redistribution"; mocap data is CC BY-NC 4.0. — [AI4Animation README](https://github.com/sebastianstarke/AI4Animation)
- **WalkTheDog** (arXiv 2024-07-11) is a vector-quantised periodic autoencoder that learns a shared phase manifold for "a human and a dog" without supervision. — [WalkTheDog arXiv](https://arxiv.org/abs/2407.18946)
- **Learned Motion Matching** is also shown driving dog and bear characters from "a large database of raw unstructured motion capture data", matching paw positions and velocities, trajectory and gait. — [LMM paper PDF](https://theorangeduck.com/media/uploads/other_stuff/Learned_Motion_Matching.pdf)
- **Arbitrary skeletons:** AnyTop (arXiv 2025-02-24; MIT code) is a diffusion model that "generates motions for diverse characters… using only their skeletal structure as input". It generalises "with as few as three training examples per topology". — [AnyTop arXiv](https://arxiv.org/abs/2502.17327); [LICENSE](https://github.com/Anytop2025/Anytop/blob/main/LICENSE)
- **Engine procedural layers (UE GASP):** Leg IK ("pins feet to IK foot bones on uneven surfaces"), Orientation Warping, the experimental Offset Root Bone, and traversal montages for vault, climb and drop. — [GASP docs](https://dev.epicgames.com/documentation/en-us/unreal-engine/game-animation-sample-project-in-unreal-engine)
- **three.js IK:** `CCDIKSolver` solves IK "with a CCD Algorithm" and "is designed to work with instances of SkinnedMesh". — [three.js CCDIKSolver.js](https://github.com/mrdoob/three.js/blob/dev/examples/jsm/animation/CCDIKSolver.js)
- **Indie procedural reference:** David Rosen's GDC 2014 talk "An Indie Approach to Procedural Animation" (Wolfire) shows "simple procedural techniques to achieve interactive and fluid animations using very few key frames" in *Overgrowth*, *Receiver* and *Black Shades*. — [GDC Vault](https://www.gdcvault.com/play/1020583/Animation-Bootcamp-An-Indie-Approach)
- **Real-time generative locomotion (vendor claim):** MotionBricks' "Smart Locomotion" supports "continuous runtime transitions across speed, direction, and gait — dialed live from user commands". — [MotionBricks page](https://nvlabs.github.io/motionbricks/)

### Inferences
- **A phase-aware procedural layer is the lowest-risk, highest-value runtime feature.** It covers foot locking, stride and orientation warping, leg IK on terrain, and look-at, and can be written in TypeScript or Rust-WASM. Its components are all classical algorithms with no data licenses.
- **Neural phase controllers are attractive for the web because they are small,** but they must be retrained on clean data. Candidate sources: Kimodo-synthesised locomotion, BONES-SEED if its license allows, or CC0 captures.
- **Creatures and quadrupeds:** AnyTop suggests few-shot generation for new topologies is feasible. Its training data and the license of that data were not verified.

### Gaps
- Runtime and memory figures for MANN, NSM and DeepPhase were not extracted.
- Production procedural-creature talks (for example *Rain World*, *Spore*) were not verified.
- Shipped-game uses of ML locomotion (for example reported RL-driven enemies in recent titles) could not be verified because the search budget ran out.
- AnyTop's training dataset and its license were not checked.

## 6. Video-to-motion and markerless capture: quality and licensing, including SMPL constraints

### Takeaway
Monocular world-grounded capture improved markedly in 2024: GVHMR cuts WHAM's world-frame errors by about 25–30% and reduces jitter and foot sliding. The open stack is still almost entirely research-only, either through code licenses (GVHMR, SMPLer-X, CameraHMR, GENMO) or through the SMPL body-model dependency (WHAM, TRAM and 4D-Humans have MIT code but output SMPL). Meta's **SAM 3D Body** (SAM License, which permits commercial use with trade-control limits) and its **MHR** rig (Apache-2.0), both November 2025, are the notable commercially usable option. It is a per-image model that takes "several seconds per image". Open, SMPL-free body models now exist: NAVER's Anny and NVIDIA's SOMA-X, both Apache-2.0.

### Cited Findings
- **GVHMR** (arXiv 2024-09-10; SIGGRAPH Asia 2024 per its checkpoint name), world-grounded metrics with DPVO:
  - RICH: WA-MPJPE100 78.8 vs WHAM 109.9; W-MPJPE100 126.3 vs 184.6; RTE 2.4 vs 4.1; jitter 12.8 vs 19.7; foot sliding 3.0 vs 3.3.
  - EMDB-2: W-MPJPE100 276.5 vs 354.8; jitter 16.7 vs 22.5; foot sliding 3.5 vs 4.4.

  — [GVHMR Table 1](https://arxiv.org/html/2409.06662v1)
  - The release checkpoint was "trained with 2x4090 for 420 epochs". — [GVHMR README](https://github.com/zju3dv/GVHMR)
  - License: "educational, research and non-profit purposes only. Any modification… must be open-source and prohibited for commercial use" (about 2.1k stars; last commit September 2026). — [GVHMR LICENSE](https://github.com/zju3dv/GVHMR/blob/main/LICENSE)
- **WHAM** (arXiv 2023-12-12) code is MIT, but the paper says code is "available for research purposes" at the MPI site; it uses SMPL and mocap-trained lifting. — [WHAM arXiv](https://arxiv.org/abs/2312.07531); [WHAM LICENSE](https://github.com/yohanshin/WHAM/blob/main/LICENSE)
- **TRAM** (arXiv 2024-03-26) is MIT-licensed. — [TRAM LICENSE](https://github.com/yufu-wang/tram/blob/main/LICENSE). **4D-Humans / HMR2.0** is MIT (about 1.7k stars). — [4D-Humans LICENSE](https://github.com/shubham-goel/4D-Humans/blob/main/LICENSE.md). Both regress SMPL. — [TRAM arXiv](https://arxiv.org/abs/2403.17346)
- **CameraHMR** (arXiv 2024-11-12) makes "Code and pGT… available for research purposes"; no LICENSE file was found. — [CameraHMR arXiv](https://arxiv.org/abs/2411.08128)
- **SMPLer-X** (arXiv 2023-09-29) uses up to ViT-Huge on 4.5M instances from 32 datasets, reporting AGORA 107.2 mm NMVE and EHF 62.3 mm PVE. It is under the S-Lab License 1.0 ("non-commercial purpose"). — [SMPLer-X arXiv](https://arxiv.org/abs/2309.17448); [LICENSE](https://github.com/caizhongang/SMPLer-X/blob/main/LICENSE)
- **PromptHMR** (arXiv 2025-04-08) does promptable full-image mesh recovery and claims state-of-the-art results; its license was not determined. — [PromptHMR arXiv](https://arxiv.org/abs/2504.06397). **GENMO** (NVIDIA, arXiv 2025-05-02) unifies estimation and generation under the "NVIDIA OneWay Noncommercial License". — [GENMO arXiv](https://arxiv.org/abs/2505.01425); [GENMO LICENSE](https://github.com/NVlabs/GENMO/blob/main/LICENSE)
- **SAM 3D Body** (Meta; checkpoints 2025-11-19; paper arXiv 2026-02-17) is promptable single-image full-body mesh recovery covering body, feet and hands. It is "the first model to use… Momentum Human Rig (MHR), which decouples skeletal structure and surface shape". "Both 3DB and MHR are open-source." — [SAM 3D Body arXiv](https://arxiv.org/abs/2602.15989); [README](https://github.com/facebookresearch/sam-3d-body)
  - The SAM License grants a "non-exclusive, worldwide, non-transferable and royalty-free limited license… to use, reproduce, distribute, copy, create derivative works". It requires Trade Controls compliance and bars ITAR, military, nuclear and weapons uses. Checkpoints require an access request. — [SAM License](https://github.com/facebookresearch/sam-3d-body/blob/main/LICENSE)
- **Fast SAM 3D Body** (arXiv 2026-03-16) states that 3DB's "inference latency of several seconds per image precludes real-time application". It reports "up to a 10.9x end-to-end speedup" and a feedforward SMPL conversion more than 10,000× faster than iterative fitting. — [Fast SAM 3D Body arXiv](https://arxiv.org/abs/2603.15603)
- **MHR** (Apache-2.0; about 865 stars; last commit September 2026) has 45 identity, 204 pose and 72 expression parameters, 7 LODs, CPU or GPU inference, and MHR↔SMPL/SMPL-X conversion tools. — [MHR README](https://github.com/facebookresearch/MHR); [LICENSE](https://github.com/facebookresearch/MHR/blob/main/LICENSE)
- **Anny** (NAVER; arXiv 2025-11-05) is a "scan-free human body model" released "under the Apache 2.0 license". It is built from CC0 MakeHuman/MPFB2 assets, and HMR models trained with it "can match the performance of those trained with scan-based body models". The optional SMPL-X topology is non-commercial. v0.5–v0.6 (June–August 2026) added SOMA rig support. — [Anny arXiv](https://arxiv.org/abs/2511.03589); [Anny README](https://github.com/naver/anny)
- **SOMA-X** (NVIDIA; Apache-2.0) "provides a canonical, differentiable representation for parametric human bodies and hands". It maps "MHR, Anny, SMPL-family… and MANO" identities to a shared SOMA rig; this is the skeleton family Kimodo uses. — [SOMA-X README](https://github.com/NVlabs/SOMA-X)
- **Licensing cascade:** HY-Motion used GVHMR to turn 12M video clips into SMPL-X training motion, showing how research-licensed capture tools end up in commercial model pipelines. — [HY-Motion HTML §2.1](https://arxiv.org/html/2512.23464v1); [GVHMR LICENSE](https://github.com/zju3dv/GVHMR/blob/main/LICENSE)
- **Commercial service (vendor claim):** Uthana offers "extract 3D movement from video" through its API. — [Uthana](https://uthana.com/)

### Inferences
- **The package should not use SMPL or SMPL-X as its canonical body or skeleton.** SOMA, MHR or Anny (all Apache-2.0) are safe interchange targets.
- **A commercially clean "video to key poses" tool is possible but offline.** It would run SAM 3D Body per frame, convert MHR to the package skeleton, then apply temporal smoothing, contact detection and foot locking. GVHMR-class temporal quality is currently research-only.
- **Provenance taint:** clips contributed to the library from SMPL-based capture pipelines (WHAM, GVHMR, TRAM, 4D-Humans) carry SMPL and AMASS restrictions.

### Gaps
- No temporal or video benchmark of SAM 3D Body against GVHMR or WHAM was found.
- Not determined: the license of Fast SAM 3D Body; PromptHMR's license.
- Browser-capable capture (for example MediaPipe/BlazePose, Apache-2.0) was not verified this session.
- The accuracy of commercial markerless products (Move AI, Rokoko, DeepMotion, RADiCAL) was not researched because the search budget ran out.

## 7. Motion quality evaluation: standard metrics, learned critics, and whether vision-language models can judge plausibility

### Takeaway
HumanML3D's FID and R-precision are saturated and depend on an AMASS-trained evaluator. Game-relevant automatic checks are geometric:
- foot skate (cm/s) and contact consistency;
- ground penetration and floating;
- jitter and jerk;
- constraint error, as reported by Kimodo and GVHMR.

The learned critic MotionCritic agrees with human preferences about 85% of the time, against about 64–72% for jerk and contact heuristics, but it can be over-optimised. In 2025–2026, vision-language models are used as captioners (HY-Motion with Gemini-2.5-Pro) and as semantic judges (ViMoGen's MBench). Evidence that VLMs reliably detect fine physical artefacts is weak. Running a physics simulator as verifier (S³) beat a kinematic predictor.

### Cited Findings
- **Standard text-to-motion metrics** are R-precision, FID, MM-Dist, Diversity and MModality, computed with Guo et al.'s evaluator and averaged over 20 runs with 95% confidence intervals. — [MotionLCM Table 1](https://arxiv.org/html/2404.19759v3); [Light-T2M Table 1](https://arxiv.org/html/2412.11193v1)
- **Kimodo's practical metrics:**
  - Foot skate: generated 3.87 cm/s vs ground truth 2.21 cm/s.
  - Contact: 0.98.
  - Constraint position and rotation errors in cm and degrees.

  — [Kimodo Table 1](https://arxiv.org/html/2603.15546v1)
- **Video capture metrics:** GVHMR reports jitter and foot sliding alongside MPJPE-family errors. — [GVHMR Table 1](https://arxiv.org/html/2409.06662v1)
- **MotionCritic** (arXiv 2024-07-02) is trained on the MotionPercept human-preference dataset.
  - On the MotionPercept MDM test set it reaches 85.07% accuracy vs jerk 65.48%, acceleration 64.26%, ground contact 71.78% and PFC 64.79%. — [MotionCritic Table 11](https://arxiv.org/html/2407.02272v2)
  - Per-class accuracy on HumanAct12 ranges from 78.3% to 94.2% in the classes shown. — [Table 5](https://arxiv.org/html/2407.02272v2)
  - Fine-tuning MDM against the critic raised the critic score while FID stayed at 0.11–0.18 for up to 600 steps. At 700 steps, FID jumped to 0.54 and action accuracy fell from 0.98 to 0.92, which indicates over-optimisation. — [Table 2](https://arxiv.org/html/2407.02272v2)
  - In its user study, raters preferred MDM output over HumanAct12 ground truth in 62.5% of 120 pairs; ground truth was preferred 15.8% of the time. "Ground truth" mocap is therefore not always perceived as better. — [Table 10](https://arxiv.org/html/2407.02272v2)
  - The repo has no LICENSE file (about 93 stars; last commit March 2026). — [MotionCritic repo](https://github.com/ou524u/MotionCritic)
- **Post-hoc physical cleanup:** DMC (arXiv 2026-02-20) is a learned post-hoc calibrator that cut penetration by 33.0% on MoMask outputs and FID by 42.74% on T2M. — [DMC arXiv](https://arxiv.org/abs/2602.18199)
- **VLMs as captioners:** HY-Motion captions rendered SMPL-H videos with a VLM ("e.g., Gemini-2.5-Pro"), then manually verifies and corrects them. — [HY-Motion HTML §2.2](https://arxiv.org/html/2512.23464v1). ViMoGen annotates rendered depth videos with Gemini 2.0. — [ViMoGen HTML](https://arxiv.org/html/2510.26794v2)
- **VLMs as judges (MBench):** ViMoGen renders motions "as videos with realistic ground planes and natural camera movements, thereby avoiding oversimplified stick-figure visualizations". A VLM then judges whether rare actions are depicted, and picks the matching prompt from 10 candidates using chain-of-thought for motion–condition consistency. — [ViMoGen HTML](https://arxiv.org/html/2510.26794v2)
- **Model-run benchmarks (vendor):** NVIDIA's Kimodo Motion Generation Benchmark (2026-04-10) is built on BONES-SEED and tests text- and constraint-following. — [Kimodo README](https://github.com/nv-tlabs/kimodo). Timo's benchmark uses 40,025 held-out clips from six public datasets and scores six dimensions. — [Timo arXiv](https://arxiv.org/abs/2609.30761). HY-Motion reports an "SSAE" percentage plus rated scores. — [HY-Motion Table 1](https://arxiv.org/html/2512.23464v1)
- **Physics plausibility evidence from video generation:**
  - PhyGenEval (arXiv 2024-10-07) uses hierarchical VLM and LLM judging that it says "align closely with human feedback". — [PhyGenBench arXiv](https://arxiv.org/abs/2410.05363)
  - Physics-IQ (arXiv 2025-01-14) finds that "visual realism does not imply physical understanding" in video generators. — [Physics-IQ arXiv](https://arxiv.org/abs/2501.09038)
  - VideoPhy (arXiv 2024-06-05) relies on human evaluation of physical commonsense. — [VideoPhy arXiv](https://arxiv.org/abs/2406.03520)
- **Simulation as verifier:** in S³, the simulator was a better verifier than a learned kinematic fall predictor (AUROC 0.90, recovering only a quarter of the gain). — [S³ arXiv](https://arxiv.org/abs/2609.26420)

### Inferences
- **The package's headless verifier should be deterministic first.** Checks: foot skate in cm/s during detected contacts, penetration and float depth, jerk and jitter percentiles, joint-limit and self-intersection checks, constraint error against authored key poses, and loop-seam error. Contact sheets and short rendered clips (shaded, with a ground plane, not stick figures) should go to a VLM or human only for semantic questions such as "is this a stealthy walk?".
- **Optional physics-tracking check:** an ONNX policy in MuJoCo WASM or Rapier can serve as a feasibility test, given S³'s evidence.
- **Learned critics are rankers, not optimisation targets.** MotionCritic's degradation after 700 fine-tuning steps shows the risk. Its HumanAct12/AMASS-derived training data also limits commercial redistribution.

### Gaps
- No 2025–2026 successor critic to MotionCritic, and no quantitative study of VLM accuracy on frame strips for motion artefacts, could be found (search budget exhausted).
- HY-Motion's SSAE definition was not extracted.
- No agreement rates with humans for MBench's VLM judge were captured.

## 8. LLMs and motion: MotionGPT, MotionLLM, Motion-Agent, and LLMs authoring keyframes, joint angles or animation code directly

### Takeaway
"LLM plus motion" work falls into three groups:
- **Fine-tuned motion-token LLMs** (MotionGPT, MotionLLM/Motion-Agent, ChatPose). These inherit HumanML3D/AMASS restrictions.
- **Frontier LLMs as planners or prompt rewriters** in front of a motion model: Motion-Agent with GPT-4, HY-Motion's Qwen3-30B-A3B rewriter, SnapMoGen's LLM reformatting.
- **Direct authoring through compact, semantic intermediate representations:** pose codes (CoMo), foot-contact patterns (SayTap), parametrised control code (GenEM), reward parameters (Language-to-Rewards), CSS keyframes (Keyframer).

No rigorous public benchmark of frontier LLMs authoring full-body skeletal keyframes or joint angles directly was found.

### Cited Findings
- **MotionGPT** (arXiv 2023-06-26; MIT) treats VQ motion tokens as a "foreign language" and handles generation, captioning, prediction and in-betweening in one model. — [MotionGPT arXiv](https://arxiv.org/abs/2306.14795); [LICENSE](https://github.com/OpenMotionLab/MotionGPT/blob/main/LICENSE)
- **Motion-Agent** (arXiv 2024-05-27; MIT code) fine-tunes MotionLLM with adapters on "only 1–3% of the model's parameters". Coupled with GPT-4 "without additional training", it generates "highly complex motion sequences through multi-turn conversations". — [Motion-Agent arXiv](https://arxiv.org/abs/2405.17013); [LICENSE](https://github.com/szqwu/Motion-Agent/blob/main/LICENSE)
- **CoMo** (arXiv 2024-03-20) breaks motion into interpretable body-part "pose codes" (for example "left knee slightly bent") that "an LLM can directly intervene" on for editing. Human studies show substantially better editing than prior work. — [CoMo arXiv](https://arxiv.org/abs/2403.13900)
- **MotionScript** (arXiv 2023-12-19, revised to v5) generates fine-grained structured natural-language motion descriptions and reports better out-of-distribution generation when used for training. — [MotionScript arXiv](https://arxiv.org/abs/2312.12634)
- **ChatPose** (arXiv 2023-11-30) embeds SMPL poses as tokens in a fine-tuned multimodal LLM to generate and reason about 3D poses. — [ChatPose arXiv](https://arxiv.org/abs/2311.18836)
- **SayTap** (arXiv 2023-06-13) uses foot-contact patterns as the LLM interface for quadruped locomotion. It has "more than 50% success rate in predicting the correct contact patterns" and solves 10 more of 30 tasks than alternative interfaces. — [SayTap arXiv](https://arxiv.org/abs/2306.07580)
- **Prompt a Robot to Walk** (arXiv 2023-09-18): an LLM given few-shot prompts "autoregressively generate[s] low-level control commands" as a feedback controller, with no task-specific fine-tuning. — [Prompt2Walk arXiv](https://arxiv.org/abs/2309.09969)
- **GenEM** (arXiv 2024-01-26) uses few-shot chain-of-thought to turn instructions into "parametrized control code using the robot's available and learned skills". Users found the behaviours "competent and easy to understand". — [GenEM arXiv](https://arxiv.org/abs/2401.14673)
- **Language to Rewards** (arXiv 2023-06-14) has the LLM write reward parameters that MuJoCo MPC optimises, noting low-level actions are "underrepresented in LLM training corpora". — [L2R arXiv](https://arxiv.org/abs/2306.08647)
- **Keyframer** (Apple, arXiv 2024-02-08) has an LLM generate 2D (SVG/CSS) animation code from prompts. Its 13-participant study identifies a "decomposed" prompting style in which users iteratively refine. — [Keyframer arXiv](https://arxiv.org/abs/2402.06071)
- **HY-Motion's prompt module** fine-tunes Qwen3-30B-A3B with SFT then GRPO, using Qwen3-235B-A22B as reward judge, to rewrite prompts and predict duration. — [HY-Motion HTML §3.3](https://arxiv.org/html/2512.23464v1). **SnapMoGen** uses "an LLM to reformat inputs". — [SnapMoGen arXiv](https://arxiv.org/abs/2507.09122)
- **Text as constraint interface:** UMO supports "text-serialized geometric constraints". — [UMO arXiv](https://arxiv.org/abs/2603.15975). Kimodo's constraint inputs are frame-indexed matrices of positions, rotations, headings and root positions. — [Kimodo-G1-SEED-v1 card](https://huggingface.co/nvidia/Kimodo-G1-SEED-v1)

### Inferences
- **The evidence supports the predecessor's design choice.** LLMs work best with low-dimensional, quantised, semantically named descriptors (pose codes, contact patterns, parametrised code) rather than dense joint-angle streams; that describes integer "readable key poses".
- **The package should let agents edit key poses and constraints, not per-frame curves.** Model-based fill (Kimodo, ARDY, a classical in-betweener) and automatic verification (§7) should close the loop, mirroring Keyframer's iterative "decomposed" workflow.
- **Fine-tuned motion-LLMs are not a commercial path today.** MotionGPT and Motion-Agent use HumanML3D tokens. A frontier LLM driving a licensed motion model through tools (CLI or MCP) is the realistic architecture.

### Gaps
- No quantitative evaluation of current frontier LLMs (GPT-5-class, Claude, Gemini) authoring or editing full-body skeletal keyframes or joint angles was found; the search budget ran out before a dedicated search.
- The MotionLLM (Chen et al., 2024) understanding model was not reviewed.

## 9. What changed in 2025–2026, and what is expected next

### Takeaway
Between mid-2025 and October 2026, text-to-motion moved from about 30 h of HumanML3D to billion-parameter and multi-thousand-hour models: MotionMillion 7B (July 2025) and HY-Motion 1B (December 2025). More importantly for commercial use, it moved to licensed studio mocap:
- NVIDIA Kimodo on 700 h of Bones Rigplay (March 2026), plus the public 288 h BONES-SEED;
- real-time successors ARDY (July 2026) and MotionBricks (2 ms);
- few-step distillation (TACD, October 2026);
- physics-tracking foundation models (SONIC) that already run in a browser.

Open non-SMPL body models (MHR, Anny, SOMA-X) and a commercially licensable HMR model (SAM 3D Body) removed much of the SMPL lock-in. Robotics, through NVIDIA GR00T, is now a main funder of motion generation.

### Cited Findings
- **Timeline** (arXiv v1 dates unless noted):
  - Being-M0 / MotionLib (2024-10) — [arXiv](https://arxiv.org/abs/2410.03311)
  - ScaMo (2024-12) — [arXiv](https://arxiv.org/abs/2412.14559)
  - Meta Motivo weights (2024-12) — [HF](https://huggingface.co/facebook/metamotivo-M-1)
  - MoFM, a motion foundation model for understanding (2025-02) — [arXiv](https://arxiv.org/abs/2502.05432)
  - AnyTop (2025-02) — [arXiv](https://arxiv.org/abs/2502.17327)
  - MotionStreamer (2025-03) — [arXiv](https://arxiv.org/abs/2503.15451)
  - GENMO (2025-05) — [arXiv](https://arxiv.org/abs/2505.01425)
  - ADD (2025-05) — [arXiv](https://arxiv.org/abs/2505.04961)
  - MotionMillion (2025-07; dataset 2025-07-26) — [README](https://github.com/VankouF/MotionMillion-Codes)
  - SnapMoGen (2025-07) — [arXiv](https://arxiv.org/abs/2507.09122)
  - MimicKit guide (2025-10) — [arXiv](https://arxiv.org/abs/2510.13794)
  - ViMoGen (2025-10) — [arXiv](https://arxiv.org/abs/2510.26794)
  - Anny (2025-11) — [arXiv](https://arxiv.org/abs/2511.03589)
  - SONIC (2025-11; code 2026-02 to 2026-04) — [arXiv](https://arxiv.org/abs/2511.07820)
  - SAM 3D Body checkpoints (2025-11-19) — [README](https://github.com/facebookresearch/sam-3d-body)
  - HY-Motion 1.0 (2025-12-30) — [README](https://github.com/Tencent-Hunyuan/HY-Motion-1.0)
  - BONES-SEED open-sourced (2026-03-16) — [GR00T-WBC README](https://github.com/NVlabs/GR00T-WholeBodyControl)
  - Kimodo (2026-03-16; v1.1 and benchmark 2026-04-10) — [README](https://github.com/nv-tlabs/kimodo)
  - UMO and Fast SAM 3D Body (2026-03) — [UMO](https://arxiv.org/abs/2603.15975); [Fast 3DB](https://arxiv.org/abs/2603.15603)
  - SONIC browser demo (2026-04-14) and MotionBricks preview (2026-04-27) — [GR00T-WBC README](https://github.com/NVlabs/GR00T-WholeBodyControl)
  - ARDY (2026-07-10) — [Kimodo README](https://github.com/nv-tlabs/kimodo)
  - S³ (2026-09-22) — [arXiv](https://arxiv.org/abs/2609.26420)
  - Timo (2026-09-25) — [arXiv](https://arxiv.org/abs/2609.30761)
  - TACD (2026-10-02) — [arXiv](https://arxiv.org/abs/2610.02867)
- **Scaling evidence (vendor/preprint):**
  - Kimodo quality rises with model size (56M to 282M) and data (10% to 100%). — [Kimodo Table 2](https://arxiv.org/html/2603.15546v1)
  - HY-Motion instruction-following rises from 0.05B to 1B. — [HY-Motion Table 3](https://arxiv.org/html/2512.23464v1)
  - SONIC "performance improves steadily with compute and data diversity". — [SONIC arXiv](https://arxiv.org/abs/2511.07820)
  - ScaMo's author still saw no "emerging abilities". — [ScaMo README](https://github.com/shunlinlu/ScaMo_code)
- **Ecosystem:**
  - Kimodo output can be exported into ProtoMotions to train physics policies. — [Kimodo project page](https://research.nvidia.com/labs/sil/projects/kimodo/); [ProtoMotions README](https://github.com/NVlabs/ProtoMotions)
  - A community "motius" model zoo (Hugging Face cards, June–July 2026) wraps HY-Motion, MoMask, MotionLCM, MotionStreamer, ViMoGen-1.3B and MotionMillion-3B/7B as uniform pipelines. — [Motius HY-Motion card](https://huggingface.co/ZeyuLing/Motius-HYMotion-T2M-1.0)
  - Mesh2Motion (code MIT; animations CC0; about 3.4k stars; last commit 2026-10-06) remains an active CC0 animation source. — [mesh2motion README](https://github.com/mesh2motion/mesh2motion-app)
- **Commercial landscape (vendor claims):** Motorica emphasises "verifiable chain of title" licensed mocap. — [Motorica](https://www.motorica.ai/). Uthana claims more than 1,000 h of licensable data and under-50 ms time to first motion token. — [Uthana](https://uthana.com/)

### Inferences
- **Expected next, as of late 2026 (inference):**
  - More permissively licensed motion foundation models from the robotics-driven NVIDIA ecosystem.
  - Distilled few-step or real-time generators small enough for client-side WebGPU inference (TACD and ARDY point that way).
  - Standard rigs (SOMA) emerging as interchange skeletons.
  - Physics-in-the-loop selection and verification.
  - VLM-based semantic benchmarks replacing HumanML3D FID.
- **Strategic risks:**
  - Dependence on one vendor's license; NVIDIA reserves the right to update the Open Model License.
  - Undisclosed data provenance (HY-Motion's acquired assets; Bones licensing terms not public).
  - Fast obsolescence of specific models.

  For the package this argues for a model-agnostic generator interface (text plus constraints in, canonical clip out) with per-model license metadata recorded in each clip's provenance.

### Gaps
- Not verified because the search budget ran out: Autodesk MotionMaker, Unity's AI animation tools, Cascadeur, DeepMotion, Meshcapade and other 2025–2026 commercial releases.
- GDC 2025/2026 and SIGGRAPH 2026 industry talks (Ubisoft La Forge, EA SEED, Epic) were not reviewed.
- No adoption metrics for Kimodo or HY-Motion in shipped games were found.
- The CMU mocap license page (used by the predecessor project) was unreachable on 2026-10-11 (HTTP 503 and certificate errors), so its terms should be re-verified directly.
