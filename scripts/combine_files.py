import os
import sys

combined_dir = "combined"

def process_directory(input_dir: str, output_file: str):
    # Convert to absolute path and check if directory exists
    input_dir = os.path.abspath(input_dir)
    if not os.path.isdir(input_dir):
        print(f"Error: Directory '{input_dir}' does not exist")
        return

    # Pastikan folder untuk output_file ada
    os.makedirs(os.path.dirname(output_file), exist_ok=True)

    # Create or open output file
    with open(output_file, 'w', encoding='utf-8') as out_file:
        # Walk through directory
        for root, _, files in os.walk(input_dir):
            for file in files:
                file_path = os.path.join(root, file)
                rel_path = os.path.relpath(file_path, input_dir)
                
                try:
                    with open(file_path, 'r', encoding='utf-8') as in_file:
                        content = in_file.read()
                    out_file.write(f"// {rel_path}\n")
                    out_file.write(f"{content}\n")
                    out_file.write("\n" + "=" * 80 + "\n\n")
                except Exception as e:
                    print(f"Error processing file {file_path}: {str(e)}")

def main():
    if len(sys.argv) < 2:
        print("Usage: python combine_files.py <input_directory> [output_file]")
        sys.exit(1)

    input_dir = sys.argv[1]

    # simpan dir output di variabel

    if len(sys.argv) == 2:
        dir_name = os.path.normpath(input_dir).replace('/', '_').replace('\\', '_')
        output_file = os.path.join(combined_dir, f"{dir_name}_combined.txt")
    else:
        output_file = sys.argv[2]
    
    process_directory(input_dir, output_file)
    print(f"Files combined successfully into {output_file}")

if __name__ == "__main__":
    main()
