from pathlib import Path
import ast

root = Path("backend/src/data/scrapers")
target_modules = {"ran" + "dom", "date" + "time"}

for path in sorted(root.glob("*.py")):
    source = path.read_text()
    tree = ast.parse(source)
    used_names = {
        node.id
        for node in ast.walk(tree)
        if isinstance(node, ast.Name) and not isinstance(node.ctx, ast.Store)
    }
    lines = source.splitlines(keepends=True)
    replacements: list[tuple[int, int, str]] = []

    for node in tree.body:
        if isinstance(node, ast.Import):
            target_aliases = [alias for alias in node.names if alias.name in target_modules]
            if not target_aliases:
                continue
            kept = [
                alias
                for alias in node.names
                if alias.name not in target_modules
                or (alias.asname or alias.name.split(".")[0]) in used_names
            ]
            if len(kept) == len(node.names):
                continue
            replacement = ""
            if kept:
                replacement = "import " + ", ".join(
                    alias.name + (f" as {alias.asname}" if alias.asname else "")
                    for alias in kept
                ) + "\n"
            replacements.append((node.lineno - 1, node.end_lineno or node.lineno, replacement))

        if isinstance(node, ast.ImportFrom) and node.module in target_modules:
            kept = [
                alias for alias in node.names if (alias.asname or alias.name) in used_names
            ]
            if len(kept) == len(node.names):
                continue
            replacement = ""
            if kept:
                replacement = f"from {node.module} import " + ", ".join(
                    alias.name + (f" as {alias.asname}" if alias.asname else "")
                    for alias in kept
                ) + "\n"
            replacements.append((node.lineno - 1, node.end_lineno or node.lineno, replacement))

    for start, end, replacement in sorted(replacements, reverse=True):
        lines[start:end] = [replacement] if replacement else []
    path.write_text("".join(lines))

Path(__file__).unlink()
