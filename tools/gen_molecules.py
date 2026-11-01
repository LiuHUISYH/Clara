# -*- coding: utf-8 -*-
"""
gen_molecules.py
----------------
用于生成 data/molecules.json 的脚本。

设计说明：
1. 3D 分子可视化模块需要每个分子的原子笛卡尔坐标（单位：埃 Å）与化学键连接表。
2. 手工逐个敲坐标既容易出错也难以维护，因此本脚本用“理想几何构型 + 标准键长”
   的方式程序化生成坐标（教学级精度，非量化计算精度，符合 PRD 4.3 约定）。
3. 坐标原点原则上放在分子的几何中心或中心原子处，便于前端渲染时围绕原点旋转。

运行方式：
    python3 tools/gen_molecules.py
输出：
    data/molecules.json
"""
import json
import math
import os


# ---------------------------------------------------------------
# 基础向量工具
# ---------------------------------------------------------------


def rad(deg):
    """角度转弧度。"""
    return math.radians(deg)


def norm(v):
    """向量归一化。"""
    length = math.sqrt(sum(c * c for c in v))
    return tuple(c / length for c in v)


def scale(v, s):
    """向量缩放。"""
    return tuple(c * s for c in v)


def add(a, b):
    """向量相加。"""
    return tuple(x + y for x, y in zip(a, b))


# ---------------------------------------------------------------
# 分子构建器
# ---------------------------------------------------------------


class MoleculeBuilder:
    """按“先加原子、再加键”的顺序构建一个分子。"""

    def __init__(self, mid, formula, names, geometry, geometry_en,
                 bond_angle, hybridization, polarity, imf, notes):
        self.meta = {
            "id": mid,
            "formula": formula,
            "names": names,
            "geometry": geometry,
            "geometryEn": geometry_en,
            "bondAngle": bond_angle,
            "hybridization": hybridization,
            "polarity": polarity,
            "imf": imf,
            "notes": notes,
        }
        self.atoms = []
        self.bonds = []

    def atom(self, element, pos, label=None):
        """添加原子并返回其索引。"""
        idx = len(self.atoms)
        self.atoms.append({
            "element": element,
            "x": round(pos[0], 3),
            "y": round(pos[1], 3),
            "z": round(pos[2], 3),
            "label": label if label else element,
        })
        return idx

    def bond(self, a, b, order=1, kind="covalent"):
        """添加化学键：order 为键级，kind 取 covalent / ionic / aromatic。"""
        self.bonds.append({"a": a, "b": b, "order": order, "type": kind})

    def build(self):
        self.meta["atoms"] = self.atoms
        self.meta["bonds"] = self.bonds
        self.meta["atomCount"] = len(self.atoms)
        self.meta["bondCount"] = len(self.bonds)
        return self.meta


# ---------------------------------------------------------------
# 常用几何构型生成器：返回配体相对中心原子的方向向量
# ---------------------------------------------------------------


def dirs_linear():
    """直线形：两个方向相反的单位向量。"""
    return [(0, 1, 0), (0, -1, 0)]


def dirs_trigonal_planar():
    """平面三角形：xy 平面内互成 120°。"""
    return [(1, 0, 0),
            (math.cos(rad(120)), math.sin(rad(120)), 0),
            (math.cos(rad(240)), math.sin(rad(240)), 0)]


def dirs_tetrahedral():
    """正四面体：立方体互不相邻的四个顶点方向。"""
    return [norm(v) for v in ((1, 1, 1), (1, -1, -1), (-1, 1, -1), (-1, -1, 1))]


def dirs_trigonal_bipyramidal():
    """三角双锥：2 个轴向 + 3 个赤道向。"""
    eq = [(1, 0, 0),
          (math.cos(rad(120)), 0, math.sin(rad(120))),
          (math.cos(rad(240)), 0, math.sin(rad(240)))]
    return [(0, 1, 0), (0, -1, 0)] + eq


def dirs_octahedral():
    """正八面体：三条坐标轴的六个方向。"""
    return [(1, 0, 0), (-1, 0, 0), (0, 1, 0),
            (0, -1, 0), (0, 0, 1), (0, 0, -1)]


def dirs_square_planar():
    """平面正方形：xz 平面内互成 90°。"""
    return [(1, 0, 0), (-1, 0, 0), (0, 0, 1), (0, 0, -1)]


def dirs_pyramidal(n, angle):
    """三角锥形（C3v）：由 H-X-H 键角反推配体与 C3 轴的夹角。"""
    # cos(角) = cos²θ + sin²θ·cos(120°) = 1.5cos²θ - 0.5
    cos_theta = math.sqrt(max(0.0, (math.cos(rad(angle)) + 0.5) / 1.5))
    theta = math.acos(min(1.0, cos_theta))
    out = []
    for i in range(n):
        phi = rad(360.0 / n * i)
        out.append((math.sin(theta) * math.cos(phi),
                    -math.cos(theta),
                    math.sin(theta) * math.sin(phi)))
    return out


def dirs_bent(angle):
    """角形（V 形）：两个配体在 xy 平面内，关于 y 轴对称。"""
    half = rad(angle / 2.0)
    return [(math.sin(half), math.cos(half), 0),
            (-math.sin(half), math.cos(half), 0)]


# ---------------------------------------------------------------
# 各分子构造函数（键长单位：Å，键角取实验值或理想值）
# ---------------------------------------------------------------


def build_water():
    b = MoleculeBuilder(
        "h2o", "H2O", ["水", "water", "一氧化二氢"],
        "角形（V 形）", "Bent", "104.5°", "sp³",
        "极性分子（偶极矩 1.85 D）",
        "氢键 + 偶极-偶极作用力 + 色散力",
        "氧原子有两对孤电子对，VSEPR 把它们“压”向两侧，使 H-O-H 键角从 109.5° 缩小到 104.5°。")
    o = b.atom("O", (0, 0.22, 0))
    for d in dirs_bent(104.5):
        h = b.atom("H", add((0, 0.22, 0), scale(d, 0.96)))
        b.bond(o, h)
    return b.build()


def build_methane():
    b = MoleculeBuilder(
        "ch4", "CH4", ["甲烷", "沼气", "methane"],
        "正四面体形", "Tetrahedral", "109.5°", "sp³",
        "非极性分子",
        "仅色散力（伦敦色散力）",
        "四个 C-H 键完全等价，键的偶极相互抵消；因此甲烷是非极性分子，但电子云仍可被极化。")
    c = b.atom("C", (0, 0, 0))
    for d in dirs_tetrahedral():
        h = b.atom("H", scale(d, 1.09))
        b.bond(c, h)
    return b.build()


def build_co2():
    b = MoleculeBuilder(
        "co2", "CO2", ["二氧化碳", "干冰", "carbon dioxide"],
        "直线形", "Linear", "180°", "sp",
        "非极性分子",
        "色散力 + 偶极-偶极作用力（瞬时）",
        "C=O 键本身是极性的，但两个键方向相反、大小相等，分子偶极为 0；这也是 CO₂ 非极性却仍能溶于水的原因之一。")
    c = b.atom("C", (0, 0, 0))
    for d in dirs_linear():
        o = b.atom("O", scale(d, 1.16))
        b.bond(c, o, order=2)
    return b.build()


def build_ammonia():
    b = MoleculeBuilder(
        "nh3", "NH3", ["氨", "氨气", "ammonia"],
        "三角锥形", "Trigonal pyramidal", "107°", "sp³",
        "极性分子（偶极矩 1.47 D）",
        "氢键 + 偶极-偶极作用力 + 色散力",
        "氮上的一对孤电子对占据一个四面体方向，使分子呈三角锥形；这对孤电子对也是氨能接受质子（Lewis 碱）的原因。")
    n = b.atom("N", (0, 0.38, 0))
    for d in dirs_pyramidal(3, 107):
        h = b.atom("H", add((0, 0.38, 0), scale(d, 1.01)))
        b.bond(n, h)
    return b.build()


def build_benzene():
    b = MoleculeBuilder(
        "c6h6", "C6H6", ["苯", "benzene"],
        "平面正六边形", "Trigonal planar (aromatic ring)", "120°", "sp²",
        "非极性分子",
        "色散力 + π-π 堆积",
        "六个碳全部 sp² 杂化，剩余 p 轨道形成离域大 π 键；实际碳碳键长介于单键与双键之间（约 1.39 Å）。")
    idx = []
    for i in range(6):
        a = rad(60 * i)
        idx.append(b.atom("C", (1.39 * math.cos(a), 1.39 * math.sin(a), 0)))
    for i in range(6):
        b.bond(idx[i], idx[(i + 1) % 6], order=1.5, kind="aromatic")
    for i in range(6):
        a = rad(60 * i)
        h = b.atom("H", (2.47 * math.cos(a), 2.47 * math.sin(a), 0))
        b.bond(idx[i], h)
    return b.build()


def build_nacl():
    b = MoleculeBuilder(
        "nacl", "NaCl", ["氯化钠", "食盐", "盐", "sodium chloride"],
        "面心立方离子晶格片段", "Rock-salt lattice fragment", "90°", "离子键（无杂化）",
        "离子化合物（非分子）",
        "离子-偶极作用力（溶于水时）；晶格中为静电引力",
        "Na⁺ 与 Cl⁻ 交替排列，每个离子被 6 个相反电荷离子包围（配位数 6），因此熔点高达 801 ℃。")
    d = 2.82  # NaCl 晶格常数 5.64 Å 的一半
    ions = []
    for ix in (0, 1):
        for iy in (0, 1):
            for iz in (0, 1):
                el = "Na" if (ix + iy + iz) % 2 == 0 else "Cl"
                pos = ((ix - 0.5) * d, (iy - 0.5) * d, (iz - 0.5) * d)
                ions.append(b.atom(el, pos, el + ("⁺" if el == "Na" else "⁻")))
    # 仅连接最近邻（离子间距 = d），用虚线表示离子键
    for i in range(len(ions)):
        for j in range(i + 1, len(ions)):
            ai, aj = b.atoms[i], b.atoms[j]
            dist = math.dist((ai["x"], ai["y"], ai["z"]),
                             (aj["x"], aj["y"], aj["z"]))
            if abs(dist - d) < 1e-6:
                b.bond(i, j, order=1, kind="ionic")
    return b.build()


def build_o2():
    b = MoleculeBuilder(
        "o2", "O2", ["氧气", "氧", "oxygen"],
        "直线形", "Linear (diatomic)", "180°", "sp²（每个 O）",
        "非极性分子",
        "色散力",
        "O₂ 是双键分子，但两个未成对电子分别位于反键 π* 轨道，因此 O₂ 具有顺磁性。")
    a = b.atom("O", (0, 0.605, 0))
    c = b.atom("O", (0, -0.605, 0))
    b.bond(a, c, order=2)
    return b.build()


def build_n2():
    b = MoleculeBuilder(
        "n2", "N2", ["氮气", "氮", "nitrogen"],
        "直线形", "Linear (diatomic)", "180°", "sp",
        "非极性分子",
        "色散力",
        "N≡N 键能高达 941 kJ/mol，是自然界最稳定的化学键之一，因此氮气化学性质很不活泼。")
    a = b.atom("N", (0, 0.55, 0))
    c = b.atom("N", (0, -0.55, 0))
    b.bond(a, c, order=3)
    return b.build()


def build_h2():
    b = MoleculeBuilder(
        "h2", "H2", ["氢气", "氢", "hydrogen"],
        "直线形", "Linear (diatomic)", "180°", "s（无杂化）",
        "非极性分子",
        "色散力（极弱）",
        "氢气只有两个电子，分子间作用力极弱，因此沸点仅 −253 ℃。")
    a = b.atom("H", (0, 0.37, 0))
    c = b.atom("H", (0, -0.37, 0))
    b.bond(a, c)
    return b.build()


def build_hcl():
    b = MoleculeBuilder(
        "hcl", "HCl", ["氯化氢", "盐酸", "hydrogen chloride"],
        "直线形", "Linear (diatomic)", "180°", "s（H）/ sp³（Cl）",
        "极性分子（偶极矩 1.08 D）",
        "偶极-偶极作用力 + 色散力（无氢键，因 Cl 电负性不足）",
        "HCl 溶于水完全电离成 H₃O⁺ 与 Cl⁻，是强酸；气态时则以极性分子存在。")
    h = b.atom("H", (0, 0.635, 0))
    c = b.atom("Cl", (0, -0.635, 0))
    b.bond(h, c)
    return b.build()


def build_h2o2():
    b = MoleculeBuilder(
        "h2o2", "H2O2", ["过氧化氢", "双氧水", "hydrogen peroxide"],
        "非平面（书页形 / 扭曲结构）", "Skew (non-planar)", "约 100°（O-O-H）", "sp³（每个 O）",
        "极性分子",
        "氢键 + 偶极-偶极作用力 + 色散力",
        "两个 O-H 键不在同一平面内，二面角约 111°；O-O 单键较弱，易均裂产生自由基，故 H₂O₂ 是氧化剂。")
    o1 = b.atom("O", (-0.74, 0, 0))
    o2 = b.atom("O", (0.74, 0, 0))
    h1 = b.atom("H", (-1.36, 0.70, 0.12))
    h2 = b.atom("H", (1.10, -0.42, 0.63))
    b.bond(o1, o2)
    b.bond(o1, h1)
    b.bond(o2, h2)
    return b.build()


def build_so2():
    b = MoleculeBuilder(
        "so2", "SO2", ["二氧化硫", "亚硫酸酐", "sulfur dioxide"],
        "角形（V 形）", "Bent", "119°", "sp²",
        "极性分子（偶极矩 1.63 D）",
        "偶极-偶极作用力 + 色散力",
        "硫上有一对孤电子对，使 O-S-O 键角略小于 120°；SO₂ 是导致酸雨的主要污染物之一。")
    s = b.atom("S", (0, 0.30, 0))
    for d in dirs_bent(119):
        o = b.atom("O", add((0, 0.30, 0), scale(d, 1.43)))
        b.bond(s, o, order=2)
    return b.build()


def build_so3():
    b = MoleculeBuilder(
        "so3", "SO3", ["三氧化硫", "sulfur trioxide"],
        "平面三角形", "Trigonal planar", "120°", "sp²",
        "非极性分子",
        "色散力 + 偶极-偶极作用力（瞬时）",
        "三个 S=O 键完全对称，偶极相互抵消；SO₃ 是强 Lewis 酸，遇水剧烈反应生成硫酸。")
    s = b.atom("S", (0, 0, 0))
    for d in dirs_trigonal_planar():
        o = b.atom("O", scale(d, 1.42))
        b.bond(s, o, order=2)
    return b.build()


def build_no2():
    b = MoleculeBuilder(
        "no2", "NO2", ["二氧化氮", "nitrogen dioxide"],
        "角形（V 形）", "Bent", "134°", "sp²",
        "极性分子（含未成对电子）",
        "偶极-偶极作用力 + 色散力",
        "NO₂ 有一个未成对电子，分子呈红棕色并易二聚成 N₂O₄；实际两个 N-O 键因共振而等长。")
    n = b.atom("N", (0, 0.24, 0))
    ds = dirs_bent(134)
    o1 = b.atom("O", add((0, 0.24, 0), scale(ds[0], 1.19)))
    o2 = b.atom("O", add((0, 0.24, 0), scale(ds[1], 1.19)))
    b.bond(n, o1, order=2)
    b.bond(n, o2, order=1)
    return b.build()


def build_c2h4():
    b = MoleculeBuilder(
        "c2h4", "C2H4", ["乙烯", "ethene", "ethylene"],
        "平面形（两个碳均为平面三角形）", "Trigonal planar", "约 121°", "sp²",
        "非极性分子",
        "色散力 + π-π 相互作用",
        "C=C 双键由 1 个 σ 键与 1 个 π 键组成，π 键不能自由旋转，因此乙烯是平面分子。")
    c1 = b.atom("C", (-0.665, 0, 0))
    c2 = b.atom("C", (0.665, 0, 0))
    b.bond(c1, c2, order=2)
    for sign in (1, -1):
        h1 = b.atom("H", (-1.205, sign * 0.935, 0))
        h2 = b.atom("H", (1.205, sign * 0.935, 0))
        b.bond(c1, h1)
        b.bond(c2, h2)
    return b.build()


def build_c2h2():
    b = MoleculeBuilder(
        "c2h2", "C2H2", ["乙炔", "acetylene", "ethyne"],
        "直线形", "Linear", "180°", "sp",
        "非极性分子",
        "色散力 + 弱偶极作用",
        "C≡C 三键由 1 个 σ 键与 2 个互相垂直的 π 键组成，四个原子严格共线。")
    h1 = b.atom("H", (-1.66, 0, 0))
    c1 = b.atom("C", (-0.60, 0, 0))
    c2 = b.atom("C", (0.60, 0, 0))
    h2 = b.atom("H", (1.66, 0, 0))
    b.bond(h1, c1)
    b.bond(c1, c2, order=3)
    b.bond(c2, h2)
    return b.build()


def build_ch3oh():
    b = MoleculeBuilder(
        "ch3oh", "CH3OH", ["甲醇", "木醇", "methanol"],
        "四面体（以碳为中心）", "Tetrahedral at carbon", "109.5°", "sp³",
        "极性分子",
        "氢键 + 偶极-偶极作用力 + 色散力",
        "甲醇能与水任意比例互溶，正是因为 -OH 可与水形成氢键；但碳链增长会削弱这一能力。")
    c = b.atom("C", (0, 0, 0))
    o = b.atom("O", (1.43, 0.10, 0))
    ho = b.atom("H", (1.96, 0.82, 0.18))
    for d in [(-0.36, 0.93, 0.35), (-0.62, -0.55, 0.83), (-0.50, -0.60, -0.85)]:
        h = b.atom("H", scale(norm(d), 1.09))
        b.bond(c, h)
    b.bond(c, o)
    b.bond(o, ho)
    return b.build()


def build_c2h5oh():
    b = MoleculeBuilder(
        "c2h5oh", "C2H5OH", ["乙醇", "酒精", "ethanol"],
        "四面体（以碳为中心）", "Tetrahedral at carbon", "109.5°", "sp³",
        "极性分子",
        "氢键 + 偶极-偶极作用力 + 色散力",
        "乙醇分子间的氢键使其沸点（78 ℃）远高于相对分子质量相近的丙烷（−42 ℃）。")
    c1 = b.atom("C", (-0.77, 0, 0))
    c2 = b.atom("C", (0.77, 0, 0))
    o = b.atom("O", (1.55, 0.95, 0))
    ho = b.atom("H", (2.12, 1.18, 0.36))
    b.bond(c1, c2)
    b.bond(c2, o)
    b.bond(o, ho)
    for pos in [(-1.36, 0.90, 0.22), (-1.36, -0.50, 0.92), (-1.36, -0.42, -0.95)]:
        b.bond(c1, b.atom("H", pos))
    for pos in [(1.22, -0.55, 0.95), (1.20, -0.90, -0.38)]:
        b.bond(c2, b.atom("H", pos))
    return b.build()


def build_co():
    b = MoleculeBuilder(
        "co", "CO", ["一氧化碳", "carbon monoxide"],
        "直线形", "Linear (diatomic)", "180°", "sp",
        "极性分子（偶极矩很小，0.11 D）",
        "偶极-偶极作用力 + 色散力",
        "CO 与 N₂ 是等电子体，三键中含一个配位键；其偶极矩很小且碳端带负电，与电负性直觉相反。")
    c = b.atom("C", (-0.565, 0, 0))
    o = b.atom("O", (0.565, 0, 0))
    b.bond(c, o, order=3)
    return b.build()


def build_hcn():
    b = MoleculeBuilder(
        "hcn", "HCN", ["氢氰酸", "氰化氢", "hydrogen cyanide"],
        "直线形", "Linear", "180°", "sp",
        "极性分子",
        "偶极-偶极作用力 + 色散力 + 弱氢键",
        "HCN 中碳为 sp 杂化，H-C≡N 共线；它是极弱酸，而其盐（如 NaCN）溶液却呈强碱性。")
    h = b.atom("H", (-1.07, 0, 0))
    c = b.atom("C", (0, 0, 0))
    n = b.atom("N", (1.16, 0, 0))
    b.bond(h, c)
    b.bond(c, n, order=3)
    return b.build()


def build_bf3():
    b = MoleculeBuilder(
        "bf3", "BF3", ["三氟化硼", "boron trifluoride"],
        "平面三角形", "Trigonal planar", "120°", "sp²",
        "非极性分子",
        "色散力 + 偶极-偶极作用力（瞬时）",
        "硼只有 6 个价电子，不满足八隅体，是典型 Lewis 酸，可接受 NH₃ 的孤电子对。")
    bo = b.atom("B", (0, 0, 0))
    for d in dirs_trigonal_planar():
        f = b.atom("F", scale(d, 1.31))
        b.bond(bo, f)
    return b.build()


def build_pcl5():
    b = MoleculeBuilder(
        "pcl5", "PCl5", ["五氯化磷", "phosphorus pentachloride"],
        "三角双锥形", "Trigonal bipyramidal", "90° / 120° / 180°", "sp³d",
        "非极性分子",
        "色散力 + 偶极-偶极作用力（瞬时）",
        "5 个 Cl 分为轴向（2 个，键长 2.14 Å）与赤道向（3 个，键长 2.02 Å），两者并不等价。")
    p = b.atom("P", (0, 0, 0))
    for i, d in enumerate(dirs_trigonal_bipyramidal()):
        length = 2.14 if i < 2 else 2.02
        cl = b.atom("Cl", scale(d, length))
        b.bond(p, cl)
    return b.build()


def build_sf6():
    b = MoleculeBuilder(
        "sf6", "SF6", ["六氟化硫", "sulfur hexafluoride"],
        "正八面体形", "Octahedral", "90°", "sp³d²",
        "非极性分子",
        "仅色散力",
        "六个 S-F 键完全等价、高度对称，分子偶极为 0；SF₆ 化学惰性极强，常用作高压绝缘气体。")
    s = b.atom("S", (0, 0, 0))
    for d in dirs_octahedral():
        f = b.atom("F", scale(d, 1.56))
        b.bond(s, f)
    return b.build()


def build_xef4():
    b = MoleculeBuilder(
        "xef4", "XeF4", ["四氟化氙", "xenon tetrafluoride"],
        "平面正方形", "Square planar", "90°", "sp³d²",
        "非极性分子",
        "色散力",
        "Xe 上有两对孤电子对分别位于八面体的上下轴向，把 4 个 F 压到同一平面，形成平面正方形。")
    xe = b.atom("Xe", (0, 0, 0))
    for d in dirs_square_planar():
        f = b.atom("F", scale(d, 1.95))
        b.bond(xe, f)
    return b.build()


def build_cl2():
    b = MoleculeBuilder(
        "cl2", "Cl2", ["氯气", "氯", "chlorine"],
        "直线形", "Linear (diatomic)", "180°", "sp³（每个 Cl）",
        "非极性分子",
        "色散力",
        "Cl₂ 的分子间作用力比 F₂ 强、比 Br₂ 弱，因此卤素单质的颜色与状态随相对分子质量增大而递变。")
    a = b.atom("Cl", (0, 0.995, 0))
    c = b.atom("Cl", (0, -0.995, 0))
    b.bond(a, c)
    return b.build()


def build_hf():
    b = MoleculeBuilder(
        "hf", "HF", ["氟化氢", "氢氟酸", "hydrogen fluoride"],
        "直线形", "Linear (diatomic)", "180°", "s（H）/ sp³（F）",
        "极性分子（偶极矩 1.83 D）",
        "强氢键 + 偶极-偶极作用力 + 色散力",
        "F 电负性最大，HF 分子间氢键很强，导致其沸点（20 ℃）远高于 HCl（−85 ℃）。")
    h = b.atom("H", (0, 0.46, 0))
    f = b.atom("F", (0, -0.46, 0))
    b.bond(h, f)
    return b.build()


def build_o3():
    b = MoleculeBuilder(
        "o3", "O3", ["臭氧", "ozone"],
        "角形（V 形）", "Bent", "116.8°", "sp²",
        "极性分子",
        "偶极-偶极作用力 + 色散力",
        "O₃ 的两个 O-O 键因共振而等长（1.28 Å，介于单键与双键之间）；中心氧带正电、两端带负电。")
    o1 = b.atom("O", (-0.56, 0.30, 0))
    o2 = b.atom("O", (0.56, 0.30, 0))
    o3 = b.atom("O", (0, -0.80, 0))
    b.bond(o2, o1, order=2)
    b.bond(o2, o3, order=1)
    return b.build()


def build_nh4():
    b = MoleculeBuilder(
        "nh4", "NH4+", ["铵根", "铵离子", "ammonium"],
        "正四面体形", "Tetrahedral", "109.5°", "sp³",
        "离子（无分子偶极）",
        "离子-偶极作用力（水溶液中）",
        "NH₄⁺ 与 CH₄ 是等电子体，四个 N-H 键完全等价；它不能单独稳定存在，需与阴离子共存。")
    n = b.atom("N", (0, 0, 0), "N⁺")
    for d in dirs_tetrahedral():
        h = b.atom("H", scale(d, 1.03))
        b.bond(n, h)
    return b.build()


def build_h3o():
    b = MoleculeBuilder(
        "h3o", "H3O+", ["水合氢离子", "氢离子", "hydronium"],
        "三角锥形", "Trigonal pyramidal", "113°", "sp³",
        "离子（有偶极）",
        "离子-偶极作用力 + 氢键",
        "H₃O⁺ 是水溶液中质子的真实存在形式；它比 H₂O 多一个 H，键角略大（孤对电子排斥变小）。")
    o = b.atom("O", (0, 0.35, 0), "O⁺")
    for d in dirs_pyramidal(3, 113):
        h = b.atom("H", add((0, 0.35, 0), scale(d, 0.98)))
        b.bond(o, h)
    return b.build()


def build_ch3cooh():
    b = MoleculeBuilder(
        "ch3cooh", "CH3COOH", ["乙酸", "醋酸", "acetic acid"],
        "羧基平面 + 甲基四面体", "Planar carboxyl group", "约 120°（羧基）",
        "sp²（羧基 C）/ sp³（甲基 C）",
        "极性分子",
        "氢键（强）+ 偶极-偶极作用力 + 色散力",
        "羧基中的 C=O 与 O-H 形成强氢键，乙酸因此常以二聚体形式存在，沸点（118 ℃）显著升高。")
    c1 = b.atom("C", (0.10, 0, 0))
    o1 = b.atom("O", (0.75, 1.02, 0))
    o2 = b.atom("O", (0.72, -1.02, 0))
    ho = b.atom("H", (1.62, -1.28, 0))
    c2 = b.atom("C", (-1.42, 0, 0))
    b.bond(c1, o1, order=2)
    b.bond(c1, o2)
    b.bond(o2, ho)
    b.bond(c1, c2)
    for pos in [(-1.90, 0.90, 0.42), (-1.88, -0.52, 0.94), (-1.90, -0.40, -0.95)]:
        b.bond(c2, b.atom("H", pos))
    return b.build()


def build_sio2():
    b = MoleculeBuilder(
        "sio2", "SiO2", ["二氧化硅", "石英", "硅石", "silica"],
        "共价网络（SiO₄ 四面体共用顶点）", "Covalent network", "约 109.5°", "sp³（Si）",
        "共价晶体（非分子）",
        "共价键（晶格内），无分子间作用力",
        "每个 Si 与 4 个 O 形成四面体，每个 O 桥接 2 个 Si，整块晶体是一个“巨型分子”，故熔点极高（1710 ℃）。")
    si = b.atom("Si", (0, 0, 0))
    oxy = []
    for d in dirs_tetrahedral():
        o = b.atom("O", scale(d, 1.61))
        oxy.append(o)
        b.bond(si, o)
    # 两个桥氧再接一个 Si，体现“网络”结构
    for i in (0, 1):
        a = b.atoms[oxy[i]]
        d = norm((a["x"], a["y"], a["z"]))
        si2 = b.atom("Si", scale(d, 3.22))
        b.bond(oxy[i], si2)
    return b.build()


def build_h2s():
    b = MoleculeBuilder(
        "h2s", "H2S", ["硫化氢", "氢硫酸", "hydrogen sulfide"],
        "角形（V 形）", "Bent", "92°", "sp³",
        "极性分子（偶极矩 0.97 D）",
        "偶极-偶极作用力 + 色散力（氢键极弱）",
        "S 的电负性远小于 O，S-H 键几乎不参与氢键，所以 H₂S 沸点（−60 ℃）远低于 H₂O（100 ℃）。")
    s = b.atom("S", (0, 0.28, 0))
    for d in dirs_bent(92):
        h = b.atom("H", add((0, 0.28, 0), scale(d, 1.34)))
        b.bond(s, h)
    return b.build()


def build_ph3():
    b = MoleculeBuilder(
        "ph3", "PH3", ["磷化氢", "膦", "phosphine"],
        "三角锥形", "Trigonal pyramidal", "93.5°", "sp³",
        "极性分子（偶极矩 0.58 D）",
        "偶极-偶极作用力 + 色散力（几乎无氢键）",
        "PH₃ 键角接近 90°，说明 P 的杂化程度较低、p 轨道成分更多；这也是其碱性与 NH₃ 差异的原因。")
    p = b.atom("P", (0, 0.32, 0))
    for d in dirs_pyramidal(3, 93.5):
        h = b.atom("H", add((0, 0.32, 0), scale(d, 1.42)))
        b.bond(p, h)
    return b.build()


# ---------------------------------------------------------------
# 元素 CPK 配色与显示半径（前端也会读取该表）
# ---------------------------------------------------------------

ELEMENT_INFO = {
    "H": {"name": "氢", "color": "#ffffff", "radius": 0.32},
    "B": {"name": "硼", "color": "#ffb5b5", "radius": 0.60},
    "C": {"name": "碳", "color": "#404040", "radius": 0.62},
    "N": {"name": "氮", "color": "#3050f8", "radius": 0.58},
    "O": {"name": "氧", "color": "#ff2b2b", "radius": 0.55},
    "F": {"name": "氟", "color": "#90e050", "radius": 0.50},
    "Na": {"name": "钠", "color": "#ab5cf2", "radius": 0.95},
    "Mg": {"name": "镁", "color": "#8aff00", "radius": 0.85},
    "Al": {"name": "铝", "color": "#bfa6a6", "radius": 0.80},
    "Si": {"name": "硅", "color": "#f0c8a0", "radius": 0.78},
    "P": {"name": "磷", "color": "#ff8000", "radius": 0.72},
    "S": {"name": "硫", "color": "#ffff30", "radius": 0.70},
    "Cl": {"name": "氯", "color": "#1ff01f", "radius": 0.65},
    "Xe": {"name": "氙", "color": "#429eb0", "radius": 0.88},
}

BUILDERS = [
    build_water, build_methane, build_co2, build_ammonia, build_benzene,
    build_nacl, build_o2, build_n2, build_h2, build_hcl, build_h2o2,
    build_so2, build_so3, build_no2, build_c2h4, build_c2h2, build_ch3oh,
    build_c2h5oh, build_co, build_hcn, build_bf3, build_pcl5, build_sf6,
    build_xef4, build_cl2, build_hf, build_o3, build_nh4, build_h3o,
    build_ch3cooh, build_sio2, build_h2s, build_ph3,
]


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    out_path = os.path.join(here, "..", "data", "molecules.json")

    # 每个 build_xxx() 函数内部已经调用了 MoleculeBuilder.build()，返回 dict
    molecules = [builder() for builder in BUILDERS]
    payload = {
        "meta": {
            "version": "1.0.0",
            "unit": "angstrom",
            "coordinateNote": "教学级理想几何坐标，非量子化学计算结果",
            "count": len(molecules),
            "generatedBy": "tools/gen_molecules.py",
        },
        "elements": ELEMENT_INFO,
        "molecules": molecules,
    }

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print("已生成 %s，共 %d 个分子。" % (os.path.normpath(out_path), len(molecules)))
    for m in molecules:
        print("  - %-9s %-6s 原子 %2d / 键 %2d  %s" % (
            m["formula"], m["names"][0], m["atomCount"], m["bondCount"], m["geometry"]))


if __name__ == "__main__":
    main()






