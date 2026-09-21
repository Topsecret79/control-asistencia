import os
import shutil

def build_single_file():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    
    with open(os.path.join(base_dir, 'index.html'), 'r', encoding='utf-8') as f:
        html = f.read()
        
    with open(os.path.join(base_dir, 'css', 'style.css'), 'r', encoding='utf-8') as f:
        css = f.read()
        
    with open(os.path.join(base_dir, 'js', 'attendance.js'), 'r', encoding='utf-8') as f:
        js_attendance = f.read()
        
    with open(os.path.join(base_dir, 'js', 'app.js'), 'r', encoding='utf-8') as f:
        js_app = f.read()
        
    # Inline CSS
    html = html.replace('<link rel="stylesheet" href="css/style.css">', f'<style>\n{css}\n</style>')
    
    # Inline JS
    js_bundle = f"<script>\n{js_attendance}\n{js_app}\n</script>"
    html = html.replace('<script src="js/attendance.js"></script>', '')
    html = html.replace('<script src="js/app.js"></script>', js_bundle)
    
    output_path = os.path.join(base_dir, 'asistencia.html')
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(html)
        
    print(f"Built single-file app: {output_path} ({len(html)} bytes)")
    
    # Copy to Desktop and Downloads
    desktop_dir = r"C:\Users\WINDOWS 11 PRO\Desktop"
    downloads_dir = r"C:\Users\WINDOWS 11 PRO\Downloads"
    
    if os.path.exists(desktop_dir):
        dest_desktop = os.path.join(desktop_dir, 'asistencia.html')
        shutil.copyfile(output_path, dest_desktop)
        print(f"Copied to Desktop: {dest_desktop}")
        
    if os.path.exists(downloads_dir):
        dest_downloads = os.path.join(downloads_dir, 'asistencia.html')
        shutil.copyfile(output_path, dest_downloads)
        print(f"Copied to Downloads: {dest_downloads}")

if __name__ == '__main__':
    build_single_file()
