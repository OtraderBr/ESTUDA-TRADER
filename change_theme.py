import os

files = [
  'index.html',
  'js/app.js',
  'js/sidebar.js',
  'js/dashboard.js',
  'js/concept-list.js',
  'js/concept-detail.js',
  'js/sessions.js',
  'js/roadmap.js'
]

mapping = {
  "850: '#202022'": "850: '#f4f4f5'",
  "950: '#09090b'": "950: '#fafafa'",
  "bg-zinc-950": "bg-zinc-50",
  "bg-zinc-900/90": "bg-white/90",
  "bg-zinc-900/50": "bg-white/50",
  "bg-zinc-900/20": "bg-zinc-100/50",
  "bg-zinc-900": "bg-white",
  "bg-zinc-800": "bg-zinc-100",
  "bg-zinc-700": "bg-zinc-200",
  "text-zinc-100": "text-zinc-900",
  "text-zinc-200": "text-zinc-800",
  "text-zinc-300": "text-zinc-700",
  "text-zinc-400": "text-zinc-600",
  "text-zinc-600": "text-zinc-500",
  "border-zinc-800/50": "border-zinc-200/50",
  "border-zinc-800": "border-zinc-200",
  "border-zinc-700": "border-zinc-300",
  '"#27272a"': '"#e4e4e7"',
  '"#09090b"': '"#ffffff"',
  '"#3f3f46"': '"#d4d4d8"',
  '"#fafafa"': '"#18181b"',
  "hover:bg-zinc-900": "hover:bg-zinc-50",
  "hover:bg-zinc-800": "hover:bg-zinc-100",
  "hover:bg-zinc-700": "hover:bg-zinc-200",
  "hover:border-zinc-800": "hover:border-zinc-200",
  "hover:text-zinc-200": "hover:text-zinc-900",
  "hover:text-zinc-400": "hover:text-zinc-700",
  "disabled:bg-zinc-800": "disabled:bg-zinc-200",
  "disabled:text-zinc-500": "disabled:text-zinc-400",
  "placeholder:text-zinc-600": "placeholder:text-zinc-400",
  "text-emerald-400": "text-emerald-600",
  "text-amber-400": "text-amber-600",
  "text-blue-400": "text-blue-600",
  "text-purple-400": "text-purple-600",
  "text-red-400": "text-red-600",
  "bg-emerald-500/10": "bg-emerald-600/10",
  "bg-amber-500/10": "bg-amber-600/10",
  "bg-blue-500/10": "bg-blue-600/10",
  "bg-purple-500/10": "bg-purple-600/10",
  "bg-red-500/10": "bg-red-600/10",
  "border-emerald-500/20": "border-emerald-600/20",
  "border-amber-500/20": "border-amber-600/20",
  "border-blue-500/20": "border-blue-600/20",
  "border-purple-500/20": "border-purple-600/20",
  "border-red-500/20": "border-red-600/20"
}

keys = sorted(mapping.keys(), key=len, reverse=True)

for fpath in files:
    if os.path.exists(fpath):
        with open(fpath, 'r', encoding='utf-8') as f:
            content = f.read()
        for k in keys:
            content = content.replace(k, mapping[k])
        with open(fpath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {fpath}")
