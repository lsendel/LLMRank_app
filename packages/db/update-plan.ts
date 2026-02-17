import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { users, projects } from "./src/schema";
import { eq } from "drizzle-orm";

// Hardcoded for immediate execution
const connectionString =
  "postgresql://neondb_owner:npg_DPVdfE0kSi9A@ep-lively-night-aiaorhpc-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require";

const sql = neon(connectionString);
const db = drizzle(sql, { schema: { users, projects } });

async function main() {
  const email = "test-user-v2-20250114@example.com";
  console.log(`Checking projects for user: ${email}...`);

  try {
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (!user) {
      console.error("User not found.");
      return;
    }

    console.log("User found:", user.id);

    const userProjects = await db.query.projects.findMany({
      where: eq(projects.userId, user.id),
    });

    console.log(`Found ${userProjects.length} projects:`);
    userProjects.forEach((p) =>
      console.log(`- ${p.name} (${p.id}) - Domain: ${p.domain}`),
    );
  } catch (error) {
    console.error("Error querying projects:", error);
  }
}

main();
