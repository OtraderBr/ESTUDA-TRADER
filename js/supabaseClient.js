// js/supabaseClient.js
// Configuração e inicialização do Supabase Cliente via CDN
// A URL e a ANON KEY foram inseridas conforme os dados do projeto atual no supabase-mcp-server

const supabaseUrl = 'https://jebbklacmrxrhbajweug.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImplYmJrbGFjbXJ4cmhiYWp3ZXVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMzgwOTcsImV4cCI6MjA4ODgxNDA5N30.-41Xg5zhF2hHiTJ3BUoT3TiL5LYwkhwzKfUUhTTUJks';

export const supabase = window.supabase.createClient(supabaseUrl, supabaseAnonKey);
