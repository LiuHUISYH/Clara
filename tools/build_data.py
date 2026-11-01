# -*- coding: utf-8 -*-
"""
build_data.py
-------------
把 data/*.json 校验并生成为 data/*.js 包装文件。

为什么需要包装文件？
    浏览器在 file:// 协议下会阻止 fetch 读取本地 JSON（CORS 限制），
    为了保证“双击 index.html 即可运行”，我们额外生成一份 JS 文件，
    内容形如：
        window.CHEM_DATA = window.CHEM_DATA || {};
        window.CHEM_DATA.knowledge = { ...与 JSON 完全相同的内容... };
    index.html 通过 <script> 加载这些文件，data.js 会优先读取
    window.CHEM_DATA，读不到时才回退到 fetch JSON。

运行：
    python3 tools/build_data.py
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT, "data")

FILES = [
    ("knowledge", "knowledge.json", "ChemLearn 知识点数据"),
    ("quiz", "quiz.json", "ChemLearn 练习题库"),
    ("molecules", "molecules.json", "ChemLearn 3D 分子数据"),
    ("nameMap", "nameMap.json", "ChemLearn 名称映射表"),
    ("equations", "equations.json", "ChemLearn 配平题库"),
]


def fail(message):
    """打印错误并以非零状态退出。"""
    print("[校验失败] " + message, file=sys.stderr)
    sys.exit(1)


def load(filename):
    path = os.path.join(DATA_DIR, filename)
    if not os.path.exists(path):
        fail("缺少数据文件：%s" % path)
    try:
        with open(path, "r", encoding="utf-8") as handle:
            return json.load(handle)
    except json.JSONDecodeError as error:
        fail("%s 不是合法 JSON：%s" % (filename, error))
    except OSError as error:
        fail("无法读取 %s：%s" % (filename, error))


def validate_knowledge(data):
    chapters = data.get("chapters") or []
    points = data.get("points") or []
    if len(chapters) != 5:
        fail("knowledge.json 应有 5 个章节，实际 %d 个" % len(chapters))
    if len(points) < 20:
        fail("knowledge.json 知识点不足 20 个，实际 %d 个" % len(points))

    chapter_ids = {item["id"] for item in chapters}
    seen = set()
    for point in points:
        pid = point.get("id")
        if not pid or pid in seen:
            fail("知识点 id 缺失或重复：%r" % pid)
        seen.add(pid)

        if point.get("chapter") not in chapter_ids:
            fail("知识点 %s 的章节 %r 不存在" % (pid, point.get("chapter")))

        for field in ("title", "titleEn", "definition", "explanation",
                      "examples", "pitfalls", "summary"):
            if not point.get(field):
                fail("知识点 %s 缺少字段 %s" % (pid, field))

        if not point["definition"].get("cn") or not point["definition"].get("en"):
            fail("知识点 %s 的定义缺少中英文内容" % pid)
        if len(point["explanation"]) < 3:
            fail("知识点 %s 的细致讲解少于 3 段" % pid)
        if len(point["pitfalls"]) < 2:
            fail("知识点 %s 的易错点少于 2 条" % pid)
        if len(point["summary"]) < 3:
            fail("知识点 %s 的小结少于 3 条" % pid)
    print("  ✓ knowledge.json：%d 章 / %d 个知识点" % (len(chapters), len(points)))


def validate_quiz(data, knowledge):
    questions = data.get("questions") or []
    if len(questions) < 40:
        fail("quiz.json 题目不足 40 道，实际 %d 道" % len(questions))

    point_ids = {item["id"] for item in knowledge["points"]}
    seen = set()
    for question in questions:
        qid = question.get("id")
        if not qid or qid in seen:
            fail("题目 id 缺失或重复：%r" % qid)
        seen.add(qid)
        if question.get("knowledgeId") not in point_ids:
            fail("题目 %s 关联的知识点不存在" % qid)
        if not question.get("explanation"):
            fail("题目 %s 缺少解析" % qid)

        qtype = question.get("type")
        if qtype == "single":
            options = question.get("options") or []
            answer = question.get("answer")
            if len(options) < 3 or not isinstance(answer, int) or not (0 <= answer < len(options)):
                fail("单选题 %s 的选项或答案不合法" % qid)
        elif qtype == "judge":
            if not isinstance(question.get("answer"), bool):
                fail("判断题 %s 的答案必须是布尔值" % qid)
        elif qtype == "fill":
            answers = question.get("answer")
            if not isinstance(answers, list) or not answers:
                fail("填空题 %s 必须提供可接受答案列表" % qid)
        else:
            fail("题目 %s 的题型 %r 不受支持" % (qid, qtype))

    per_chapter = {}
    for question in questions:
        chapter = question.get("chapter")
        per_chapter[chapter] = per_chapter.get(chapter, 0) + 1
    for chapter in knowledge["chapters"]:
        count = per_chapter.get(chapter["id"], 0)
        if count < 8:
            fail("章节 %s 的题目不足 8 道（%d 道）" % (chapter["id"], count))
    print("  ✓ quiz.json：%d 道题（每章 ≥ 8）" % len(questions))

def validate_molecules(data):
    molecules = data.get("molecules") or []
    if len(molecules) < 25:
        fail("molecules.json 分子不足 25 个，实际 %d 个" % len(molecules))

    elements = data.get("elements") or {}
    for molecule in molecules:
        atoms = molecule.get("atoms") or []
        bonds = molecule.get("bonds") or []
        if not atoms:
            fail("分子 %s 没有原子数据" % molecule.get("id"))
        for atom in atoms:
            for field in ("element", "x", "y", "z"):
                if field not in atom:
                    fail("分子 %s 的原子缺少字段 %s" % (molecule.get("id"), field))
            if atom["element"] not in elements:
                fail("元素 %s 没有配色数据" % atom["element"])
        for bond in bonds:
            if not (0 <= bond.get("a", -1) < len(atoms)) or not (0 <= bond.get("b", -1) < len(atoms)):
                fail("分子 %s 的化学键索引越界" % molecule.get("id"))
        if not molecule.get("geometry"):
            fail("分子 %s 缺少几何构型描述" % molecule.get("id"))
    print("  ✓ molecules.json：%d 个分子 / %d 种元素" % (len(molecules), len(elements)))


def validate_name_map(data):
    entries = data.get("entries") or []
    if len(entries) < 30:
        fail("nameMap.json 名称映射不足 30 条，实际 %d 条" % len(entries))
    for entry in entries:
        if not entry.get("name") or not entry.get("formula"):
            fail("名称映射条目缺少 name 或 formula：%r" % entry)
    print("  ✓ nameMap.json：%d 条名称映射" % len(entries))


def validate_equations(data):
    equations = data.get("equations") or []
    if len(equations) < 15:
        fail("equations.json 方程式不足 15 组，实际 %d 组" % len(equations))
    for equation in equations:
        if not equation.get("equation") or not equation.get("balanced"):
            fail("方程式 %s 缺少 equation 或 balanced" % equation.get("id"))
        if not equation.get("steps"):
            fail("方程式 %s 缺少分步解析" % equation.get("id"))
    print("  ✓ equations.json：%d 组方程式" % len(equations))


def write_bundle(key, payload, description):
    """生成 data/<key>.js 包装文件（内容为一整行 JSON，减少体积）。"""
    path = os.path.join(DATA_DIR, key + ".js")
    json_text = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    content = (
        "/* 自动生成，请勿手动修改。\n"
        "   源文件：data/%s.json（%s）\n"
        "   生成脚本：tools/build_data.py\n"
        "   作用：把数据挂到 window.CHEM_DATA，使 index.html 在 file:// 下也能直接运行。 */\n"
        "window.CHEM_DATA = window.CHEM_DATA || {};\n"
        "window.CHEM_DATA.%s = %s;\n"
    ) % (key, description, key, json_text)

    with open(path, "w", encoding="utf-8") as handle:
        handle.write(content)

    size_kb = os.path.getsize(path) / 1024.0
    print("  → 生成 data/%s.js（%.1f KB）" % (key, size_kb))


def main():
    print("ChemLearn 数据校验与打包")
    print("=" * 46)

    knowledge = load("knowledge.json")
    quiz = load("quiz.json")
    molecules = load("molecules.json")
    name_map = load("nameMap.json")
    equations = load("equations.json")

    validate_knowledge(knowledge)
    validate_quiz(quiz, knowledge)
    validate_molecules(molecules)
    validate_name_map(name_map)
    validate_equations(equations)

    print("-" * 46)
    payloads = {
        "knowledge": knowledge,
        "quiz": quiz,
        "molecules": molecules,
        "nameMap": name_map,
        "equations": equations,
    }
    for key, filename, description in FILES:
        write_bundle(key, payloads[key], description)

    print("=" * 46)
    print("全部数据校验通过，包装文件生成完毕。")


if __name__ == "__main__":
    main()
