export default {
  datasource: {
    url: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || "postgresql://dummy:dummy@localhost:5432/dummy",
  },
};
