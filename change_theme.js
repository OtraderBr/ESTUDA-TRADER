const fs = require('fs');
const path = require('path');

const files = [
    'index.html',
    'js/app.js',
    'js/sidebar.js',
    'js/dashboard.js',
    'js/concept-list.js',
    'js/concept-detail.js',
    'js/sessions.js',
    'js/roadmap.js'
];

const map = {
    // Config replacements
    "zinc: {": "zinc: {", // dummy to avoid replacing
    "850: '#202022'": "850: '#f4f4f5'",
    "950: '#09090b'": "950: '#fafafa'",

    // Backgrounds
    "bg-zinc-950": "bg-zinc-50",
    "bg-zinc-900/90": "bg-white/90",
    "bg-zinc-900/50": "bg-white/50",
    "bg-zinc-900/20": "bg-zinc-100/50",
    "bg-zinc-900": "bg-white",
    "bg-zinc-800": "bg-zinc-100",
    "bg-zinc-700": "bg-zinc-200",

    // Text
    "text-zinc-100": "text-zinc-900",
    "text-zinc-200": "text-zinc-800",
    "text-zinc-300": "text-zinc-700",
    "text-zinc-400": "text-zinc-600",
    // 500 stays same for neutral
    // text-zinc-600 used sometimes for borders/dark text in light mode
    "text-zinc-600": "text-zinc-500",

    // Borders
    "border-zinc-800/50": "border-zinc-200/50",
    "border-zinc-800": "border-zinc-200",
    "border-zinc-700": "border-zinc-300",

    // Specific HEX
    '"#27272a"': '"#e4e4e7"',
    '"#09090b"': '"#ffffff"',
    '"#3f3f46"': '"#d4d4d8"',
    '"#fafafa"': '"#18181b"',

    // Hovers
    "hover:bg-zinc-900": "hover:bg-zinc-50",
    "hover:bg-zinc-800": "hover:bg-zinc-100",
    "hover:bg-zinc-700": "hover:bg-zinc-200",
    "hover:border-zinc-800": "hover:border-zinc-200",
    "hover:text-zinc-200": "hover:text-zinc-900",
    "hover:text-zinc-400": "hover:text-zinc-700",

    // Disabled states
    "disabled:bg-zinc-800": "disabled:bg-zinc-200",
    "disabled:text-zinc-500": "disabled:text-zinc-400",

    // Placeholders
    "placeholder:text-zinc-600": "placeholder:text-zinc-400",

    // Colors adjustments for better contrast in light mode
    "text-emerald-400": "text-emerald-600",
    "text-amber-400": "text-amber-600",
    "text-blue-400": "text-blue-600",
    "text-purple-400": "text-purple-600",
    "text-red-400": "text-red-600",

    // Background tint adjustments
    "bg-emerald-500/10": "bg-emerald-600/10",
    "bg-amber-500/10": "bg-amber-600/10",
    "bg-blue-500/10": "bg-blue-600/10",
    "bg-purple-500/10": "bg-purple-600/10",
    "bg-red-500/10": "bg-red-600/10",

    // Border tint adjustments
    "border-emerald-500/20": "border-emerald-600/20",
    "border-amber-500/20": "border-amber-600/20",
    "border-blue-500/20": "border-blue-600/20",
    "border-purple-500/20": "border-purple-600/20",
    "border-red-500/20": "border-red-600/20",
};

// Sort keys by length descending to prevent partial replacements (e.g. text-zinc-100/50 matched by text-zinc-100)
const keys = Object.keys(map).sort((a, b) => b.length - a.length);

for (const file of files) {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');

        for (const k of keys) {
            if (k === "zinc: {") continue;
            // Global replace using split and join
            content = content.split(k).join(map[k]);
        }

        fs.writeFileSync(filePath, content);
        console.log(\`Updated \${file}\`);
  }
}
