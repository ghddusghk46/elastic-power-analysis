import os
import glob

input_folder = r"C:\elastic\data"

for filepath in glob.glob(os.path.join(input_folder, "**/*.csv"), recursive = True):
    with open(filepath, 'r', encoding='euc-kr', errors='ignore') as f:
        content = f.read()

    with open(filepath, 'w', encoding='utf-8', errors='ignore') as f:
        f.write(content)

    print(f"변환 완료: {filepath}")

print("전체 완료")