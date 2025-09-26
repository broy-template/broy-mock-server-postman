import os
import argparse
import sys

def print_tree(directory, prefix="", output=sys.stdout):
    entries = sorted(os.listdir(directory))
    for index, entry in enumerate(entries):
        path = os.path.join(directory, entry)
        is_last = index == len(entries) - 1
        connector = "└── " if is_last else "├── "

        print(prefix + connector + entry, file=output)

        if os.path.isdir(path):
            extension = "    " if is_last else "│   "
            print_tree(path, prefix + extension, output)

def main():
    parser = argparse.ArgumentParser(description="Tampilkan struktur folder seperti pohon (tree).")
    parser.add_argument("path", help="Path folder yang ingin ditampilkan struktur tree-nya.")
    
    args = parser.parse_args()
    folder_path = args.path

    if not os.path.exists(folder_path):
        print(f"❌ Path '{folder_path}' tidak ditemukan.")
        return
    
    if not os.path.isdir(folder_path):
        print(f"❌ Path '{folder_path}' bukan folder.")
        return

    else:
        print(folder_path)
        print_tree(folder_path)
    
    with open("tree.txt", "w", encoding="utf-8") as f:
        print(folder_path, file=f)
        print_tree(folder_path, output=f)

if __name__ == "__main__":
    main()