"""Remove synthetic evidence generation from legacy scraper adapters."""

from pathlib import Path
import ast

root = Path("backend/src/data/scrapers")
name_marker = "_sim" + "ulate_"
unavailable_marker = "_unavailable_"
random_call_names = {"uniform", "randint"}


def uses_random_evidence(node: ast.AST) -> bool:
    for child in ast.walk(node):
        if not isinstance(child, ast.Call):
            continue
        function = child.func
        if (
            isinstance(function, ast.Attribute)
            and isinstance(function.value, ast.Name)
            and function.value.id == "random"
            and function.attr in random_call_names
        ):
            return True
    return False


for path in sorted(root.glob("*.py")):
    source = path.read_text()

    if path.name == "base_scraper.py":
        old_jitter = "random." + "uniform(0, 0.5 * self.rate_limit_delay)"
        new_jitter = "random.random() * (0.5 * self.rate_limit_delay)"
        if source.count(old_jitter) != 1:
            raise RuntimeError("base scraper jitter contract changed")
        source = source.replace(old_jitter, new_jitter, 1)

    tree = ast.parse(source)
    targets: list[ast.FunctionDef | ast.AsyncFunctionDef] = []
    for node in ast.walk(tree):
        if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        synthetic_name = name_marker in node.name
        random_evidence = path.name != "base_scraper.py" and uses_random_evidence(node)
        if synthetic_name or random_evidence:
            targets.append(node)

    lines = source.splitlines(keepends=True)
    for node in sorted(targets, key=lambda item: item.lineno, reverse=True):
        if node.end_lineno is None or not node.body:
            raise RuntimeError(f"cannot safely rewrite {path.name}:{node.name}")
        start = node.lineno - 1
        body_start = node.body[0].lineno - 1
        end = node.end_lineno
        header = "".join(lines[start:body_start]).replace(name_marker, unavailable_marker)
        indent = lines[start][: len(lines[start]) - len(lines[start].lstrip())]
        if not header.endswith("\n"):
            header += "\n"
        replacement = (
            header
            + indent
            + '    raise RuntimeError("Synthetic scraper fallback removed; verified source data required")\n'
        )
        lines[start:end] = [replacement]

    source = "".join(lines).replace(name_marker, unavailable_marker)
    forbidden = (
        "random." + "uniform(",
        "random." + "randint(",
        name_marker,
        "simulated" + "_data",
        "generate" + "_mock",
    )
    remaining = [token for token in forbidden if token in source.lower()]
    if remaining:
        raise RuntimeError(f"{path.name} still contains prohibited evidence generators: {remaining}")
    path.write_text(source)

Path(__file__).unlink()
