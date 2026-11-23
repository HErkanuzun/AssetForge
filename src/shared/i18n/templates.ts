// SPDX-License-Identifier: AGPL-3.0-only
export const templateRows = {
  'template.tpl_prop_text3d.name': ['Prop — Text→3D (QA)', '道具 — 文本→3D（质量检查）', 'Prop — Metin→3D (QA)'],
  'template.tpl_prop_text3d.description': [
    'Quick props/building parts: prompt → textured Meshy text-to-3D → Blender cleanup → quality control → Unreal.',
    '快速制作道具或建筑部件：提示词 → Meshy 文本转带纹理 3D → Blender 清理 → 质量检查 → Unreal。',
    'Hızlı prop/yapı parçası: prompt → Meshy metin→3D (dokulu) → Blender temizlik → kalite kontrol → Unreal.'
  ],
  'template.tpl_prop_concept3d.name': ['Prop — Concept→Image→3D (QA)', '道具 — 概念→图像→3D（质量检查）', 'Prop — Konsept→Görsel→3D (QA)'],
  'template.tpl_prop_concept3d.description': [
    'Highest quality: generate and approve a reference image before image-to-3D. Includes two quality gates.',
    '高质量流程：先生成并审核参考图，再将图像转为 3D，包含两道质量关卡。',
    'En yüksek kalite: önce referans görsel üretilip onaylanır, sonra görselden 3D yapılır. İki kalite kapısı vardır.'
  ],
  'template.tpl_character_rig.name': ['Character — Rigged (A-pose)', '角色 — 骨骼绑定（A 姿势）', 'Karakter — Riglenmiş (A-pose)'],
  'template.tpl_character_rig.description': [
    'Humanoid: A-pose concept → image-to-3D → rig with walking/running → Unreal. Rigging supports bipedal humanoids only.',
    '类人角色：A 姿势概念图 → 图像转 3D → 骨骼绑定（含行走和奔跑）→ Unreal。绑定仅支持双足类人角色。',
    'İnsansı karakter: A-pose konsept → görsel→3D → rig (yürüme/koşma dahil) → Unreal. Rig yalnızca iki ayaklı insansılarda çalışır.'
  ],
  'template.tpl_sfx.name': ['Sound effect (ElevenLabs)', '音效（ElevenLabs）', 'Ses Efekti (ElevenLabs)'],
  'template.tpl_sfx.description': [
    'SFX/ambience from a sound list row: prompt → ElevenLabs variations → Unreal.',
    '根据音频列表条目生成音效或环境声：提示词 → ElevenLabs 变体 → Unreal。',
    'Ses listesindeki satırdan SFX/ambiyans: prompt → ElevenLabs (varyasyonlu) → Unreal.'
  ],
  'template.tpl_existing_model.name': ['Existing model → Cleanup → Unreal', '现有模型 → 清理 → Unreal', 'Mevcut Model → Temizlik → Unreal'],
  'template.tpl_existing_model.description': [
    'Scale an existing model to asset dimensions, reduce it to budget, check quality and export to Unreal. Set the file path in the Local Model node.',
    '将现有模型缩放到资源尺寸，减面至预算，检查质量并导出到 Unreal。请在本地模型节点中设置文件路径。',
    'Elinizdeki modeli (ör. önceki Meshy çıktıları) boyuta ölçekler, bütçeye indirir, kalite kontrolden geçirir ve Unreal\'a aktarır. "Yerel Model" node\'unda dosya yolunu ayarlayın.'
  ],
  'template.tpl_voice_tts.name': ['Voice line — Dialogue + TTS', '语音台词 — 对白 + TTS', 'Ses Satırı — Replik + TTS'],
  'template.tpl_voice_tts.description': [
    'The Prompt Engine writes dialogue, then an OpenAI compatible speech endpoint (OpenAI TTS, Kokoro, LocalAI…) speaks it and exports to Unreal.',
    '提示词引擎编写角色对白，再由兼容 OpenAI 的语音端点（OpenAI TTS、Kokoro、LocalAI…）合成语音并导出至 Unreal。',
    'Karakter repliği: Prompt Motoru repliği yazar → OpenAI uyumlu konuşma ucu (OpenAI TTS, Kokoro, LocalAI…) seslendirir → Unreal.'
  ],
  'template.tpl_texture_comfy.name': ['Texture — ComfyUI (QA)', '纹理 — ComfyUI（质量检查）', 'Doku — ComfyUI (QA)'],
  'template.tpl_texture_comfy.description': [
    'Material/ground texture: tileable prompt → local ComfyUI → quality control → Unreal.',
    '材质或地面纹理：无缝纹理提示词 → 本地 ComfyUI → 质量检查 → Unreal。',
    'Malzeme/zemin dokusu: tileable prompt → yerel ComfyUI → kalite kontrol → Unreal.'
  ],
  'template.tpl_agent_blender.name': ['Agent — Model with Blender MCP (QA)', '代理 — 通过 Blender MCP 建模（质量检查）', 'Ajan — Blender MCP ile Model (QA)'],
  'template.tpl_agent_blender.description': [
    'The selected AI builds separate model objects through Blender MCP and saves GLB → Blender cleanup → quality control → Unreal. Failed checks return feedback to the agent. Blender must be open with BlenderMCP connected (Settings → MCP).',
    '所选 AI 通过 Blender MCP 创建独立部件并保存 GLB → Blender 清理 → 质量检查 → Unreal。检查失败会将反馈返回代理。需打开 Blender 并连接 BlenderMCP（设置 → MCP）。',
    'Seçtiğin yapay zekâ Blender MCP üzerinden modeli Blender’da kendisi kurar (parçalar ayrı objeler), GLB kaydeder → Blender temizlik → kalite kontrol → Unreal. Kalite kontrol beğenmezse geri bildirim ajana gider. Blender açık ve BlenderMCP eklentisi bağlı olmalı (Ayarlar → MCP).'
  ],
  'template.tpl_character_game.name': ['Character — Game ready (Manny)', '角色 — 游戏就绪（Manny）', 'Karakter — Oyuna Hazır (Manny)'],
  'template.tpl_character_game.description': [
    'A-pose concept → image-to-3D within budget → Meshy rig → Blender Manny bone names and reduction → quality control → Unreal LODs 50/25/10, IK Rig and Manny-to-character retargeter.',
    'A 姿势概念图 → 预算内图像转 3D → Meshy 绑定 → Blender 转换 Manny 骨骼名称并减面 → 质量检查 → Unreal LOD 50/25/10、IK Rig 和 Manny 到角色重定向器。',
    'A-pose konsept → görsel→3D (bütçeli) → Meshy rig → Blender: Manny kemik adları + bütçeye indirme → kalite kontrol → Unreal: LOD 50/25/10, IK Rig, Manny→karakter retargeter.'
  ],
  'template.tpl_vehicle_rig.name': ['Vehicle — Concept→3D + Rig → Unreal', '车辆 — 概念→3D + 绑定 → Unreal', 'Araç — Konsept→3D + Rig → Unreal'],
  'template.tpl_vehicle_rig.description': [
    'Vehicle reference → quality gate → image-to-3D → Blender dimensions/budget/pivots → assembly and motion rig (wheels, doors, trunk, effects, damage zones, clips) → quality control → Unreal skeletal mesh, physics, Anim BP, sounds and vehicle Blueprint.',
    '车辆参考图 → 质量关卡 → 图像转 3D → Blender 尺寸、预算和轴心调整 → 装配与动作绑定（车轮、车门、后备箱、特效、损伤区域、片段）→ 质量检查 → Unreal 骨骼网格、物理、Anim BP、音效及车辆蓝图。',
    'Araç: referans görsel → kalite kapısı → görsel→3D → Blender (boyut, bütçe, pivot) → montaj ve hareket rigi (tekerlek, kapı, bagaj, efekt noktaları, ezilme bölgeleri, klipler) → kalite kontrol → Unreal (iskeletli mesh, fizik, Anim BP, kit sesleri, araç Blueprint’i).'
  ],
  'template.tpl_engine_dynamic.name': ['Dynamic engine sound (MetaSound)', '动态引擎音效（MetaSound）', 'Dinamik Motor Sesi (MetaSound)'],
  'template.tpl_engine_dynamic.description': [
    'Engine character → looping layers at different RPMs (ElevenLabs) → Unreal MetaSound with RPM + Throttle inputs. Set RPM through an AudioComponent in game.',
    '引擎特征 → 不同转速的循环音层（ElevenLabs）→ 带 RPM 和 Throttle 输入的 Unreal MetaSound。在游戏中通过 AudioComponent 设置转速。',
    'Motor karakteri → farklı devirlerde döngü katmanları (ElevenLabs) → Unreal: RPM + Throttle girişli MetaSound. Oyunda AudioComponent ile devir parametresi verilir.'
  ],
  'template.tpl_anim_kimodo.name': ['Animation — Kimodo → Character', '动画 — Kimodo → 角色', 'Animasyon — Kimodo → Karakter'],
  'template.tpl_anim_kimodo.description': [
    'Text-to-motion (NVIDIA Kimodo) → Blender Manny names + root motion → quality control (sliding, jitter, target speed/direction; regenerate on failure) → Unreal shared SOMA skeleton → automatic character retargeting.',
    '文本生成动作（NVIDIA Kimodo）→ Blender Manny 名称和根运动 → 质量检查（脚滑、抖动、目标速度和方向；失败时重新生成）→ Unreal 共用 SOMA 骨骼 → 自动重定向到角色。',
    'Metinden hareket (NVIDIA Kimodo) → Blender: Manny adları + root motion → kalite kontrol (ayak kayması, titreme, hedef hız/yön; kötüyse yeniden üretir) → Unreal: ortak SOMA iskeleti → ana karaktere otomatik retarget.'
  ],
  'template.tpl_vfx_sprite.name': ['VFX — Sprite/Flipbook', '特效 — 精灵图/序列帧', 'VFX — Sprite/Flipbook'],
  'template.tpl_vfx_sprite.description': [
    'Particle sprites such as smoke, dust and sparks: prompt → image on black background → quality control → Unreal texture. Niagara templates are in the VFX module.',
    '烟雾、灰尘、火花等粒子精灵图：提示词 → 黑色背景图像 → 质量检查 → Unreal 纹理。Niagara 模板位于特效模块中。',
    'Duman, toz, kıvılcım gibi parçacık sprite’ı: prompt → görsel (siyah zemin) → kalite kontrol → Unreal doku. Niagara şablonları VFX modülünde.'
  ]
} as const
