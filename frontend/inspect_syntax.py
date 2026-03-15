import pathlib

path = pathlib.Path('electron/main.mjs')
raw = path.read_bytes()
text = raw.decode('utf-8', errors='replace')
lines = text.splitlines(True)

# Print a range around the reported error line (1019)
start = 1008
end = 1030
for i in range(start-1, end):
    line = lines[i].rstrip('\n')
    print(f"{i+1:4d}: {line}")

# Quick brace balance scan (ignoring strings/comments roughly)
brace_depth = 0
in_single = False
in_double = False
in_backtick = False
in_line_comment = False
in_block_comment = False

for lineno, line in enumerate(lines, start=1):
    i = 0
    while i < len(line):
        c = line[i]
        # Handle comment start/end
        if in_line_comment:
            if c == '\n':
                in_line_comment = False
        elif in_block_comment:
            if c == '*' and i + 1 < len(line) and line[i+1] == '/':
                in_block_comment = False
                i += 1
        elif in_single:
            if c == "'" and line[i-1] != '\\':
                in_single = False
        elif in_double:
            if c == '"' and line[i-1] != '\\':
                in_double = False
        elif in_backtick:
            if c == '`' and line[i-1] != '\\':
                in_backtick = False
        else:
            if c == "'":
                in_single = True
            elif c == '"':
                in_double = True
            elif c == '`':
                in_backtick = True
            elif c == '/' and i + 1 < len(line) and line[i+1] == '/':
                in_line_comment = True
                i += 1
            elif c == '/' and i + 1 < len(line) and line[i+1] == '*':
                in_block_comment = True
                i += 1
            elif c == '{':
                brace_depth += 1
            elif c == '}':
                brace_depth -= 1
                if brace_depth < 0:
                    print(f"Line {lineno}: brace depth went negative at character {i} (line content: {line.rstrip()})")
                    raise SystemExit(1)
        i += 1
    if lineno == 1019:
        print(f"\nBrace depth at line 1019: {brace_depth}")

print(f"\nFinal brace depth: {brace_depth}")
