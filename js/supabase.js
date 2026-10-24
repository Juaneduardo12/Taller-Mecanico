// =========================================
// CONEXIÓN A SUPABASE
// La URL y la publishable key son públicas por diseño.
// NUNCA pongas aquí la contraseña de la base de datos ni una secret key.
// =========================================
const SUPABASE_URL = 'https://lkgetiuibhborypnxpts.supabase.co';
const SUPABASE_KEY = 'sb_publishable_h_V66iBOnAGqy-p9DCs2Vw_ry0BZd8U';

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
